import { useEffect, useMemo, useRef, useState } from 'react';

const FLAG = 'ctf{w34k_p455w0rd5_4r3_b4d}';

// Files that are always on the box.
//
// Three of these hold deliberate decoys: a wifi password, a service
// account password, an API key, and a rotated-out old root password. None
// of them opens sudo. Finding a secret is not the same as finding THE
// secret, which is the whole point — read what it's labelled.
const BASE_FILES = [
  {
    path: 'README.txt',
    body: 'Welcome to the system.\n\nThis is a training environment for STEM Outreach.\nLook around. Some files contain sensitive info.',
  },
  {
    path: 'logs/access.log',
    body: '2026-05-09 14:22:11 LOGIN admin from 192.168.1.42\n2026-05-09 14:22:18 SUDO admin\n2026-05-09 14:22:33 LOGIN admin from 192.168.1.42\n# rotated on 2026-04-01, no longer accepted:\nold_root_password=hunter2',
  },
  {
    path: 'config/network.conf',
    body: 'interface=eth0\nip=192.168.1.42\ngateway=192.168.1.1\nwifi_password=GuestLounge2019',
  },
  {
    path: 'config/service.conf',
    body: '# background job runner\nservice_user=app\ndb_password=app_svc_9021\nretries=3',
  },
  {
    path: 'projects/notes.md',
    body: "Reminder: rotate the root password.\nAlso need to fix that thing in the config files.\n\napi_key=sk_live_2f9d41ba77c3",
  },
];

// Where the root password hides. Picked fresh every run so a repeat booth
// visitor can't just remember "it's in config/credentials.txt" and skip
// the actual searching.
const HIDING_SPOTS = [
  {
    path: 'config/credentials.txt',
    body: (pw) => `# DO NOT COMMIT THIS FILE\nroot_user=root\nroot_password=${pw}`,
  },
  {
    path: 'config/backup.conf',
    body: (pw) => `# emergency restore settings\nrestore_target=/dev/sda1\nroot_password=${pw}`,
  },
  {
    path: 'projects/handoff.md',
    body: (pw) => `Handing this box over to the new admin.\nEverything you need is here:\n\nroot_password=${pw}\n\nTODO: delete this file once you've memorised it.`,
  },
  {
    path: 'logs/install.log',
    body: (pw) => `[ok] packages installed\n[ok] user root configured\n[warn] plaintext secret written to log:\nroot_password=${pw}\n[ok] install complete`,
  },
  {
    path: 'backup/env.bak',
    body: (pw) => `# leftover from the server migration\nDB_HOST=localhost\nroot_password=${pw}`,
  },
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Builds one playthrough's file system: the fixed files plus the root
// password dropped into one randomly chosen spot. Directory markers (the
// `foo/` keys the flat map uses) are derived from the paths so adding a
// hiding spot in a brand-new folder can't silently produce a folder the
// shell refuses to `cd` into.
const buildWorld = () => {
  const spot = pick(HIDING_SPOTS);
  const entries = [...BASE_FILES, { path: spot.path, body: spot.body(FLAG) }]
    .sort((a, b) => a.path.localeCompare(b.path));

  const fileSystem = {};
  for (const entry of entries) {
    const segments = entry.path.split('/');
    for (let i = 1; i < segments.length; i += 1) {
      fileSystem[`${segments.slice(0, i).join('/')}/`] = null;
    }
    fileSystem[entry.path] = entry.body;
  }
  return { fileSystem, flagPath: spot.path };
};

// Pulls password-shaped assignments out of command output so every one of
// them can get a copy button. In HARD mode that's the point: if only the
// real password were copyable, the button would give the answer away.
const SECRET_RE = /^\s*#?\s*([A-Za-z0-9_]*(?:password|passwd|secret|api_key|key|token)[A-Za-z0-9_]*)\s*[:=]\s*(\S+)\s*$/i;

const findSecrets = (text) => {
  if (typeof text !== 'string') return [];
  const found = [];
  const seen = new Set();
  for (const line of text.split('\n')) {
    const match = line.match(SECRET_RE);
    if (!match) continue;
    const [, label, value] = match;
    if (seen.has(value)) continue;
    seen.add(value);
    found.push({ label, value, isRoot: value === FLAG });
  }
  return found;
};

const COMMANDS = ['ls', 'cat', 'cd', 'pwd', 'whoami', 'id', 'head', 'file', 'find', 'grep', 'man', 'history', 'sudo', 'clear', 'help'];
// How many failed commands/sudo attempts before we offer the "call for
// backup" escape hatch, so nobody gets stuck at the booth indefinitely.
const STRUGGLE_THRESHOLD = 4;
const isFailureOutput = (output) =>
  typeof output === 'string' && /not found|No such|missing operand|^usage:|must find the credentials|Is a directory/i.test(output);

const resolvePath = (base, input) => {
  if (input === '~') return '';
  if (!input) return base;
  const parts = input.startsWith('/') ? [] : base.split('/').filter(Boolean);
  for (const seg of input.split('/').filter(Boolean)) {
    if (seg === '.') continue;
    else if (seg === '..') parts.pop();
    else parts.push(seg);
  }
  return parts.join('/');
};

// Nested tree view for the easy-mode file browser sidebar, decoupled from
// the flat slash-key convention.
const buildFileTree = (fileSystem) => {
  const root = { type: 'dir', name: '', path: '', children: {} };
  for (const key of Object.keys(fileSystem)) {
    const isDirEntry = key.endsWith('/');
    const parts = (isDirEntry ? key.slice(0, -1) : key).split('/');
    let node = root;
    parts.forEach((part, i) => {
      const isLast = i === parts.length - 1;
      if (!node.children[part]) {
        node.children[part] = {
          type: isLast && !isDirEntry ? 'file' : 'dir',
          name: part,
          path: parts.slice(0, i + 1).join('/'),
          children: {},
        };
      }
      node = node.children[part];
    });
  }
  return root;
};


// Drives the simulated shell used in the FILESYSTEM/ESCALATE stages: command
// parsing, tab completion, history, and the sudo password prompt. Reports
// mission milestones back to the caller via onCredentialsFound/onRootAccess
// so App.jsx keeps ownership of stage/progress.
export function useTerminal({ playerName, onCredentialsFound, onRootAccess }) {
  // Regenerated on reset() so the next player gets a new hiding spot.
  const [world, setWorld] = useState(buildWorld);
  const { fileSystem, flagPath } = world;
  const fileTree = useMemo(() => buildFileTree(fileSystem), [fileSystem]);

  const [terminalOutput, setTerminalOutput] = useState([]);
  const [command, setCommand] = useState('');
  const [cwd, setCwd] = useState('');
  const [cmdHistory, setCmdHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [sudoPrompt, setSudoPrompt] = useState(null); // null, or the pending sudo arg (e.g. "su")
  const [sudoAttempts, setSudoAttempts] = useState(0);
  const [copiedValue, setCopiedValue] = useState(null);
  const [hasCopiedRoot, setHasCopiedRoot] = useState(false);
  const [foundCreds, setFoundCreds] = useState(false);
  const [errorCount, setErrorCount] = useState(0);
  const [assisted, setAssisted] = useState(false);
  // True while the RootAccessModal's password/grant animation is playing.
  // Real stage transition (onRootAccess) waits for it to finish rather
  // than firing the instant the button is clicked.
  const [escalating, setEscalating] = useState(false);
  const terminalRef = useRef(null);
  const commandInputRef = useRef(null);

  useEffect(() => {
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [terminalOutput]);

  const isDir = (path) => path === '' || fileSystem[`${path}/`] !== undefined;
  const isFile = (path) => fileSystem[path] !== undefined && fileSystem[path] !== null;

  const listChildren = (path) => {
    if (path === '') {
      return Object.keys(fileSystem).filter((k) => !k.includes('/') || k.endsWith('/'));
    }
    const prefix = `${path}/`;
    return Object.keys(fileSystem)
      .filter((k) => k.startsWith(prefix) && k !== prefix && !k.slice(prefix.length).includes('/'))
      .map((k) => k.replace(prefix, ''));
  };

  const promptPath = () => (cwd ? `~/${cwd}` : '~');

  const markCredsFound = () => {
    if (!foundCreds) {
      setFoundCreds(true);
      onCredentialsFound?.();
    }
  };

  const completeToken = () => {
    const parts = command.split(' ');
    const tokenIndex = parts.length - 1;
    const partial = parts[tokenIndex];

    let candidates;
    if (tokenIndex === 0) {
      candidates = COMMANDS.filter((c) => c.startsWith(partial));
    } else {
      const lastSlash = partial.lastIndexOf('/');
      const dirPart = lastSlash >= 0 ? partial.slice(0, lastSlash) : '';
      const namePart = lastSlash >= 0 ? partial.slice(lastSlash + 1) : partial;
      const resolvedDir = resolvePath(cwd, dirPart);
      if (!isDir(resolvedDir)) return;
      candidates = listChildren(resolvedDir)
        .map((name) => name.replace(/\/$/, ''))
        .filter((name) => name.startsWith(namePart))
        .map((name) => (dirPart ? `${dirPart}/${name}` : name));
    }

    if (candidates.length === 1) {
      const isCandidateDir = tokenIndex !== 0 && isDir(resolvePath(cwd, candidates[0]));
      parts[tokenIndex] = candidates[0] + (isCandidateDir ? '/' : '');
      setCommand(parts.join(' ') + (isCandidateDir ? '' : ' '));
    } else if (candidates.length > 1) {
      setTerminalOutput((prev) => [...prev, { type: 'out', text: candidates.join('  ') }]);
    }
  };

  const navigateHistory = (direction) => {
    if (cmdHistory.length === 0) return;
    let nextIndex = historyIndex + direction;
    nextIndex = Math.max(-1, Math.min(cmdHistory.length - 1, nextIndex));
    setHistoryIndex(nextIndex);
    setCommand(nextIndex === -1 ? '' : cmdHistory[cmdHistory.length - 1 - nextIndex]);
  };

  const handleCommand = () => {
    const cmd = command.trim();
    if (!cmd) return;

    let output = '';
    const parts = cmd.split(' ').filter(Boolean);
    const op = parts[0];
    const arg = parts.slice(1).join(' ');
    const target = resolvePath(cwd, arg);

    if (op === 'ls') {
      const dirArg = arg || '.';
      const resolved = resolvePath(cwd, dirArg);
      if (!isDir(resolved)) {
        output = isFile(resolved) ? arg : `ls: ${arg}: No such directory`;
      } else {
        output = listChildren(resolved).join('  ');
      }
    } else if (op === 'cd') {
      const resolved = arg ? resolvePath(cwd, arg) : '';
      if (!isDir(resolved)) {
        output = `cd: ${arg}: No such directory`;
      } else {
        setCwd(resolved);
      }
    } else if (op === 'pwd') {
      output = `/home/admin${cwd ? '/' + cwd : ''}`;
    } else if (op === 'whoami') {
      output = `admin (callsign: ${playerName || 'unknown'})`;
    } else if (op === 'id') {
      output = 'uid=1000(admin) gid=1000(admin) groups=1000(admin)';
    } else if (op === 'history') {
      output = cmdHistory.length ? cmdHistory.map((c, i) => `  ${i + 1}  ${c}`).join('\n') : '(no history yet)';
    } else if (op === 'man') {
      const topics = {
        ls: 'ls - list directory contents',
        cat: 'cat - print file contents',
        cd: 'cd - change working directory',
        sudo: 'sudo - execute a command as another user',
        grep: 'grep - search file contents for a pattern',
        find: 'find - search for files by name',
        head: 'head - print the first lines of a file',
      };
      output = topics[arg] || `No manual entry for ${arg || '(nothing)'}`;
    } else if (op === 'file') {
      if (!arg) output = 'file: missing operand';
      else if (isDir(target)) output = `${arg}: directory`;
      else if (isFile(target)) output = `${arg}: ASCII text`;
      else output = `${arg}: cannot open (No such file or directory)`;
    } else if (op === 'cat' || op === 'head') {
      if (!arg) {
        output = `${op}: missing operand`;
      } else if (isDir(target)) {
        output = `${op}: ${arg}: Is a directory`;
      } else if (!isFile(target)) {
        output = `${op}: ${arg}: No such file or directory`;
      } else {
        const content = fileSystem[target];
        output = op === 'head' ? content.split('\n').slice(0, 3).join('\n') : content;
      }
    } else if (op === 'grep') {
      const [pattern, ...fileParts] = parts.slice(1);
      const fileArg = fileParts.join(' ');
      const filePath = resolvePath(cwd, fileArg);
      if (!pattern || !fileArg) {
        output = 'usage: grep <pattern> <file>';
      } else if (!isFile(filePath)) {
        output = `grep: ${fileArg}: No such file or directory`;
      } else {
        const matches = fileSystem[filePath].split('\n').filter((l) => l.toLowerCase().includes(pattern.toLowerCase()));
        output = matches.length ? matches.join('\n') : '';
      }
    } else if (op === 'find') {
      const startDir = resolvePath(cwd, arg);
      if (!isDir(startDir)) {
        output = `find: ${arg}: No such directory`;
      } else {
        const prefix = startDir ? startDir + '/' : '';
        output = Object.keys(fileSystem)
          .filter((k) => k.startsWith(prefix))
          .map((k) => './' + k.replace(/\/$/, ''))
          .join('\n');
      }
    } else if (op === 'help') {
      output = 'Available commands:\n  ls [path]      - list files\n  cd [path]      - change directory\n  pwd            - print working directory\n  cat/head <f>   - display file contents\n  grep <p> <f>   - search a file\n  find [path]    - list files recursively\n  file <f>       - identify file type\n  whoami / id    - show current user\n  history        - show past commands\n  man <cmd>      - manual page\n  sudo <cmd>     - elevate privileges (e.g. sudo su)\n  clear          - clear screen\n  help           - show this help';
    } else if (op === 'sudo') {
      if (!arg) {
        output = 'usage: sudo <command>';
      } else if (!foundCreds) {
        output = 'sudo: you must find the credentials first';
      } else {
        setTerminalOutput((prev) => [...prev, { type: 'cmd', text: `admin@target:${promptPath()}$ ${cmd}` }]);
        setSudoPrompt(arg);
        setCmdHistory((prev) => [...prev, cmd]);
        setHistoryIndex(-1);
        setCommand('');
        return;
      }
    } else if (op === 'clear') {
      setTerminalOutput([]);
      setCommand('');
      return;
    } else {
      output = `${op}: command not found. Type 'help' for available commands.`;
    }

    // Credentials count as found when the password actually appears on
    // screen — `head` on a file whose password sits below line 3 shouldn't
    // unlock sudo, and a path check can't tell the difference.
    const secrets = findSecrets(output);
    if (secrets.some((secret) => secret.isRoot)) markCredsFound();
    if (isFailureOutput(output)) setErrorCount((c) => c + 1);
    setTerminalOutput((prev) => [...prev, { type: 'cmd', text: `admin@target:${promptPath()}$ ${cmd}` }, { type: 'out', text: output, secrets }]);
    setCmdHistory((prev) => [...prev, cmd]);
    setHistoryIndex(-1);
    setCommand('');
  };

  // Easy-mode file browser: clicking a file "cats" it without requiring the
  // player to type the command themselves. Returns the content/secrets so
  // the caller can also show them in a popup, rather than only in the
  // scrolling terminal transcript.
  const viewFile = (path) => {
    if (!isFile(path)) return null;
    const cmdText = `cat ${path}`;
    const content = fileSystem[path];
    const secrets = findSecrets(content);
    setTerminalOutput((prev) => [...prev, { type: 'cmd', text: `admin@target:${promptPath()}$ ${cmdText}` }, { type: 'out', text: content, secrets }]);
    setCmdHistory((prev) => [...prev, cmdText]);
    setHistoryIndex(-1);
    if (secrets.some((secret) => secret.isRoot)) markCredsFound();
    return { content, secrets };
  };

  // Easy-mode one-click root: skips manually typing "sudo su", then hands
  // off to the cinematic RootAccessModal for the password-entry/access-
  // granted sequence — see `escalating`/`completeEscalation` below.
  const unlockRoot = () => {
    if (!foundCreds || sudoPrompt !== null) return;
    setTerminalOutput((prev) => [...prev, { type: 'cmd', text: `admin@target:${promptPath()}$ sudo su` }]);
    setCmdHistory((prev) => [...prev, 'sudo su']);
    setHistoryIndex(-1);
    setTimeout(() => setEscalating(true), 450);
  };

  // Called by RootAccessModal once its animation finishes playing. This is
  // what actually advances the mission, so the stage change lands on the
  // beat of "ACCESS GRANTED" rather than the instant the button was clicked.
  const completeEscalation = () => {
    setEscalating(false);
    setTerminalOutput((prev) => [...prev, { type: 'out', text: '[+] Authentication successful. Elevating to root...' }]);
    onRootAccess?.();
  };

  // Escape hatch for players who are out of their depth: after enough failed
  // commands/sudo attempts, HQ "takes over" and plays out the rest of the
  // mission for them so nobody gets stuck at the booth. Marked `assisted` so
  // the caller can keep this run off the leaderboard.
  const callForBackup = () => {
    setAssisted(true);
    setSudoPrompt(null);
    const hadCreds = foundCreds;
    setTerminalOutput((prev) => [...prev, { type: 'out', text: '📡 HQ: Patching you through to a senior operator...' }]);

    const doUnlock = () => {
      setTerminalOutput((prev) => [...prev, { type: 'cmd', text: `admin@target:${promptPath()}$ sudo su` }]);
      setTimeout(() => setEscalating(true), 400);
    };

    if (hadCreds) {
      setTimeout(doUnlock, 900);
    } else {
      setTimeout(() => {
        const revealed = fileSystem[flagPath];
        setTerminalOutput((prev) => [
          ...prev,
          { type: 'cmd', text: `admin@target:${promptPath()}$ cat ${flagPath}` },
          { type: 'out', text: revealed, secrets: findSecrets(revealed) },
        ]);
        setFoundCreds(true);
        onCredentialsFound?.();
        setTimeout(doUnlock, 900);
      }, 900);
    }
  };

  const fallbackCopy = (text, onDone) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { document.execCommand('copy'); onDone(); } catch { /* clipboard unavailable */ }
    document.body.removeChild(ta);
  };

  // Copying a decoy is allowed and deliberately unhelpful: only the real
  // root password arms the easy-mode unlock button.
  const copyToClipboard = (text) => {
    const flash = () => {
      setCopiedValue(text);
      if (text === FLAG) setHasCopiedRoot(true);
      setTimeout(() => setCopiedValue((current) => (current === text ? null : current)), 1500);
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(flash).catch(() => fallbackCopy(text, flash));
    } else {
      fallbackCopy(text, flash);
    }
  };

  const submitSudoPassword = () => {
    const attempt = command;
    setCommand('');
    if (attempt === FLAG) {
      const rootShells = ['su', '-i', '-s', 'bash', 'sh'];
      if (rootShells.includes(sudoPrompt)) {
        // Same RootAccessModal payoff as the easy-mode unlock/backup flows
        // (see completeEscalation) — HARD players typed the password
        // themselves, so this is their reward beat too.
        setSudoPrompt(null);
        setSudoAttempts(0);
        setEscalating(true);
      } else {
        setTerminalOutput((prev) => [...prev, { type: 'out', text: `sudo: ${sudoPrompt}: command not found` }]);
        setSudoPrompt(null);
        setSudoAttempts(0);
        setErrorCount((c) => c + 1);
      }
    } else {
      const attempts = sudoAttempts + 1;
      setErrorCount((c) => c + 1);
      if (attempts >= 3) {
        setTerminalOutput((prev) => [...prev, { type: 'out', text: 'sudo: 3 incorrect password attempts' }]);
        setSudoPrompt(null);
        setSudoAttempts(0);
      } else {
        setTerminalOutput((prev) => [...prev, { type: 'out', text: 'Sorry, try again.' }]);
        setSudoAttempts(attempts);
      }
    }
  };

  const handleTerminalKeyDown = (e) => {
    if (sudoPrompt !== null) {
      if (e.key === 'Enter') submitSudoPassword();
      return;
    }
    if (e.key === 'Enter') {
      handleCommand();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      completeToken();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      navigateHistory(1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      navigateHistory(-1);
    }
  };

  const reset = () => {
    // New playthrough, new hiding spot.
    setWorld(buildWorld());
    setTerminalOutput([]);
    setCommand('');
    setCwd('');
    setCmdHistory([]);
    setHistoryIndex(-1);
    setSudoPrompt(null);
    setSudoAttempts(0);
    setFoundCreds(false);
    setErrorCount(0);
    setAssisted(false);
    setEscalating(false);
    setCopiedValue(null);
    setHasCopiedRoot(false);
  };

  return {
    FLAG,
    fileTree,
    flagPath,
    terminalOutput,
    command,
    setCommand,
    cwd,
    foundCreds,
    sudoPrompt,
    copiedValue,
    hasCopiedRoot,
    assisted,
    escalating,
    completeEscalation,
    strugglingBadly: errorCount >= STRUGGLE_THRESHOLD,
    terminalRef,
    commandInputRef,
    promptPath,
    handleTerminalKeyDown,
    copyToClipboard,
    viewFile,
    unlockRoot,
    callForBackup,
    reset,
  };
}
