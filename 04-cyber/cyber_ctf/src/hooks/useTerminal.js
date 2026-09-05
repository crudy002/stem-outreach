import { useEffect, useRef, useState } from 'react';

const fileSystem = {
  'README.txt': 'Welcome to the system.\n\nThis is a training environment for STEM Outreach.\nLook around. Some files contain sensitive info.',
  'logs/': null,
  'logs/access.log': '2026-05-09 14:22:11 LOGIN admin from 192.168.1.42\n2026-05-09 14:22:18 SUDO admin\n2026-05-09 14:22:33 LOGIN admin from 192.168.1.42',
  'config/': null,
  'config/credentials.txt': '# DO NOT COMMIT THIS FILE\nroot_user=root\nroot_password=ctf{w34k_p455w0rd5_4r3_b4d}',
  'config/network.conf': 'interface=eth0\nip=192.168.1.42\ngateway=192.168.1.1',
  'projects/': null,
  'projects/notes.md': 'Reminder: rotate the root password.\nAlso need to fix that thing in credentials.txt.',
};
const FLAG = 'ctf{w34k_p455w0rd5_4r3_b4d}';
const COMMANDS = ['ls', 'cat', 'cd', 'pwd', 'whoami', 'id', 'head', 'file', 'find', 'grep', 'man', 'history', 'sudo', 'clear', 'help'];

const isDir = (p) => p === '' || fileSystem[p + '/'] !== undefined;
const isFile = (p) => fileSystem[p] !== undefined && fileSystem[p] !== null;

const listChildren = (p) => {
  if (p === '') {
    return Object.keys(fileSystem).filter((k) => !k.includes('/') || k.endsWith('/'));
  }
  const prefix = p + '/';
  return Object.keys(fileSystem)
    .filter((k) => k.startsWith(prefix) && k !== prefix && !k.slice(prefix.length).includes('/'))
    .map((k) => k.replace(prefix, ''));
};

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

// Drives the simulated shell used in the FILESYSTEM/ESCALATE stages: command
// parsing, tab completion, history, and the sudo password prompt. Reports
// mission milestones back to the caller via onCredentialsFound/onRootAccess
// so App.jsx keeps ownership of stage/progress.
export function useTerminal({ playerName, onCredentialsFound, onRootAccess }) {
  const [terminalOutput, setTerminalOutput] = useState([]);
  const [command, setCommand] = useState('');
  const [cwd, setCwd] = useState('');
  const [cmdHistory, setCmdHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [sudoPrompt, setSudoPrompt] = useState(null); // null, or the pending sudo arg (e.g. "su")
  const [sudoAttempts, setSudoAttempts] = useState(0);
  const [copiedFlag, setCopiedFlag] = useState(false);
  const [foundCreds, setFoundCreds] = useState(false);
  const terminalRef = useRef(null);
  const commandInputRef = useRef(null);

  useEffect(() => {
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [terminalOutput]);

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
        if (target === 'config/credentials.txt') markCredsFound();
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
        if (filePath === 'config/credentials.txt') markCredsFound();
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

    const hasFlag = typeof output === 'string' && output.includes(FLAG);
    setTerminalOutput((prev) => [...prev, { type: 'cmd', text: `admin@target:${promptPath()}$ ${cmd}` }, { type: 'out', text: output, flag: hasFlag }]);
    setCmdHistory((prev) => [...prev, cmd]);
    setHistoryIndex(-1);
    setCommand('');
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

  const copyToClipboard = (text) => {
    const flash = () => { setCopiedFlag(true); setTimeout(() => setCopiedFlag(false), 1500); };
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
        setTerminalOutput((prev) => [...prev, { type: 'out', text: '[+] Authentication successful. Elevating to root.' }]);
        setSudoPrompt(null);
        setSudoAttempts(0);
        setTimeout(() => onRootAccess?.(), 800);
      } else {
        setTerminalOutput((prev) => [...prev, { type: 'out', text: `sudo: ${sudoPrompt}: command not found` }]);
        setSudoPrompt(null);
        setSudoAttempts(0);
      }
    } else {
      const attempts = sudoAttempts + 1;
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
    setTerminalOutput([]);
    setCommand('');
    setCwd('');
    setCmdHistory([]);
    setHistoryIndex(-1);
    setSudoPrompt(null);
    setSudoAttempts(0);
    setFoundCreds(false);
  };

  return {
    FLAG,
    terminalOutput,
    command,
    setCommand,
    cwd,
    foundCreds,
    sudoPrompt,
    copiedFlag,
    terminalRef,
    commandInputRef,
    promptPath,
    handleTerminalKeyDown,
    copyToClipboard,
    reset,
  };
}
