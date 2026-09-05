import React, { useState, useEffect, useRef } from 'react';

// The leaderboard API runs standalone (see ../leaderboard-api) and defaults
// to localhost:8000. Override with VITE_LEADERBOARD_API_URL when the API is
// hosted elsewhere (e.g. a shared box on the booth LAN).
const API_BASE = import.meta.env.VITE_LEADERBOARD_API_URL || 'http://localhost:8000';
const STATION_ID = import.meta.env.VITE_STATION_ID || null;

export default function App() {
  const [stage, setStage] = useState('start'); // start, login, filesystem, escalate, hacked, victory
  const [playerName, setPlayerName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [shake, setShake] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState([]);
  const [command, setCommand] = useState('');
  const [cwd, setCwd] = useState('');
  const [cmdHistory, setCmdHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [sudoPrompt, setSudoPrompt] = useState(null); // null, or the pending sudo arg (e.g. "su")
  const [sudoAttempts, setSudoAttempts] = useState(0);
  const [foundCreds, setFoundCreds] = useState(false);
  const [escalateInput, setEscalateInput] = useState('');
  const [escalated, setEscalated] = useState(false);
  const [progress, setProgress] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(null);
  const [submitStatus, setSubmitStatus] = useState('idle'); // idle, submitting, done, error
  const [rank, setRank] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardError, setLeaderboardError] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const terminalRef = useRef(null);
  const commandInputRef = useRef(null);

  useEffect(() => {
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [terminalOutput]);

  useEffect(() => {
    if (stage === 'filesystem' && commandInputRef.current) commandInputRef.current.focus();
  }, [stage]);

  const fetchLeaderboard = () => {
    fetch(`${API_BASE}/scores?limit=10`)
      .then((res) => {
        if (!res.ok) throw new Error('bad response');
        return res.json();
      })
      .then((data) => {
        setLeaderboard(data);
        setLeaderboardError(false);
      })
      .catch(() => setLeaderboardError(true));
  };

  const openLeaderboard = () => {
    setShowLeaderboard(true);
    fetchLeaderboard();
  };

  const submitScore = (elapsed) => {
    setSubmitStatus('submitting');
    fetch(`${API_BASE}/scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        player_name: playerName || 'Anonymous',
        elapsed_seconds: elapsed,
        station_id: STATION_ID,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('bad response');
        return res.json();
      })
      .then((data) => {
        setRank(data.rank);
        setSubmitStatus('done');
        fetchLeaderboard();
      })
      .catch(() => setSubmitStatus('error'));
  };

  const beginMission = () => {
    setStartTime(Date.now());
    setStage('login');
    setProgress(20);
  };

  const tryLogin = () => {
    if (username.toLowerCase() === 'admin' && password.toLowerCase() === 'password') {
      setStage('filesystem');
      setProgress(40);
    } else {
      setShake(true);
      setLoginAttempts((a) => a + 1);
      setTimeout(() => setShake(false), 400);
    }
  };

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

  const promptPath = () => (cwd ? `~/${cwd}` : '~');

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
      output = `/home/user${cwd ? '/' + cwd : ''}`;
    } else if (op === 'whoami') {
      output = 'user';
    } else if (op === 'id') {
      output = 'uid=1000(user) gid=1000(user) groups=1000(user)';
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
        if (target === 'config/credentials.txt' && !foundCreds) {
          setFoundCreds(true);
          setProgress(60);
        }
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
        if (filePath === 'config/credentials.txt' && !foundCreds) {
          setFoundCreds(true);
          setProgress(60);
        }
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
        setTerminalOutput((prev) => [...prev, { type: 'cmd', text: `${promptPath()} $ ${cmd}` }]);
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

    setTerminalOutput((prev) => [...prev, { type: 'cmd', text: `user@target:${promptPath()}$ ${cmd}` }, { type: 'out', text: output }]);
    setCmdHistory((prev) => [...prev, cmd]);
    setHistoryIndex(-1);
    setCommand('');
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
        setTimeout(() => {
          setStage('escalate');
          setProgress(80);
        }, 800);
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

  const runEscalation = (action) => {
    if (action === 'inject') {
      const elapsed = startTime ? (Date.now() - startTime) / 1000 : null;
      setEscalated(true);
      setStage('hacked');
      setProgress(100);
      setElapsedSeconds(elapsed);
      if (elapsed !== null) submitScore(elapsed);
    }
  };

  const reset = () => {
    setStage('start');
    setPlayerName('');
    setUsername('');
    setPassword('');
    setLoginAttempts(0);
    setTerminalOutput([]);
    setCommand('');
    setCwd('');
    setCmdHistory([]);
    setHistoryIndex(-1);
    setSudoPrompt(null);
    setSudoAttempts(0);
    setFoundCreds(false);
    setEscalateInput('');
    setEscalated(false);
    setProgress(0);
    setStartTime(null);
    setElapsedSeconds(null);
    setSubmitStatus('idle');
    setRank(null);
    setShowLeaderboard(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a1628', color: '#c8d4e3', fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', padding: '24px' }}>
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }
        @keyframes blink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        @keyframes pulse-warn {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes glitch {
          0%, 100% { transform: translate(0); }
          20% { transform: translate(-2px, 2px); }
          40% { transform: translate(2px, -2px); }
          60% { transform: translate(-1px, -1px); }
          80% { transform: translate(1px, 1px); }
        }
        @keyframes scan-red {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
        .cursor::after {
          content: '_';
          animation: blink 1s infinite;
          color: #5b9bd5;
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #1f3354', paddingBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <img
            src="/navsea-logo.png"
            alt="NAVSEA NSWC Dahlgren Division — Dam Neck Activity"
            style={{ height: '52px', width: 'auto', display: 'block' }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          <div style={{ borderLeft: '1px solid #1f3354', paddingLeft: '16px' }}>
            <div style={{ fontSize: '11px', letterSpacing: '0.3em', color: '#5a7090', marginBottom: '4px' }}>NSWCDD DNA STEM</div>
            <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#5b9bd5', letterSpacing: '0.05em' }}>CYBER OPERATIONS RANGE</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', fontSize: '11px', alignItems: 'center' }}>
          <button onClick={openLeaderboard} style={{ background: 'transparent', border: '1px solid #2a4870', color: '#5a7090', padding: '6px 12px', fontFamily: 'inherit', fontSize: '10px', letterSpacing: '0.15em', cursor: 'pointer', borderRadius: '2px' }}>🏆 LEADERBOARD</button>
          <button onClick={reset} style={{ background: 'transparent', border: '1px solid #2a4870', color: '#5a7090', padding: '6px 12px', fontFamily: 'inherit', fontSize: '10px', letterSpacing: '0.15em', cursor: 'pointer', borderRadius: '2px' }}>↻ RESET</button>
        </div>
      </div>

      {showLeaderboard && (
        <LeaderboardModal
          scores={leaderboard}
          error={leaderboardError}
          onRefresh={fetchLeaderboard}
          onClose={() => setShowLeaderboard(false)}
        />
      )}

      {/* Mission progress */}
      <div style={{ background: '#0f1f33', border: '1px solid #1f3354', borderRadius: '4px', padding: '14px 18px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '11px', color: '#5a7090', letterSpacing: '0.2em' }}>MISSION PROGRESS</span>
          <span style={{ fontSize: '11px', color: '#5b9bd5' }}>{progress}%</span>
        </div>
        <div style={{ height: '4px', background: '#152942', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #5b9bd5, #4ade80)', transition: 'width 0.6s ease' }}></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '10px' }}>
          <span style={{ color: !['start', 'login'].includes(stage) ? '#4ade80' : stage === 'login' ? '#fbbf24' : '#3a4a66' }}>● BREACH ACCESS</span>
          <span style={{ color: foundCreds ? '#4ade80' : stage === 'filesystem' ? '#fbbf24' : '#3a4a66' }}>● FIND CREDENTIALS</span>
          <span style={{ color: stage === 'escalate' || stage === 'hacked' ? '#4ade80' : '#3a4a66' }}>● ESCALATE PRIVILEGES</span>
          <span style={{ color: stage === 'hacked' ? '#4ade80' : '#3a4a66' }}>● DEPLOY PAYLOAD</span>
        </div>
      </div>

      {/* Stage: START (name entry) */}
      {stage === 'start' && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{ background: '#0f1f33', border: '1px solid #1f3354', borderRadius: '4px', padding: '36px', maxWidth: '480px', width: '100%' }}>
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <img
                src="/navsea-logo.png"
                alt="NAVSEA NSWC Dahlgren Division — Dam Neck Activity"
                style={{ height: '88px', width: 'auto', display: 'block', margin: '0 auto 20px' }}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
              <div style={{ fontSize: '11px', letterSpacing: '0.3em', color: '#5a7090', marginBottom: '6px' }}>CYBER OPERATIONS RANGE</div>
              <div style={{ fontSize: '20px', color: '#5b9bd5', letterSpacing: '0.1em' }}>MISSION BRIEFING</div>
            </div>

            <div style={{ fontSize: '13px', lineHeight: '1.7', color: '#c8d4e3', marginBottom: '20px', textAlign: 'center' }}>
              Enter your callsign to start the clock and get on the leaderboard.
            </div>

            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '10px', color: '#5a7090', letterSpacing: '0.2em', marginBottom: '6px' }}>CALLSIGN</div>
              <input
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && beginMission()}
                maxLength={40}
                autoFocus
                style={{
                  width: '100%',
                  background: '#081320',
                  border: '1px solid #2a4870',
                  color: '#5b9bd5',
                  padding: '12px 14px',
                  fontFamily: 'inherit',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  borderRadius: '2px',
                }}
                onFocus={(e) => e.target.style.borderColor = '#5b9bd5'}
                onBlur={(e) => e.target.style.borderColor = '#2a4870'}
              />
            </div>

            <button
              onClick={beginMission}
              disabled={!playerName.trim()}
              style={{
                width: '100%',
                background: 'linear-gradient(180deg, #152942 0%, #0f1f33 100%)',
                border: '1px solid #5b9bd5',
                color: playerName.trim() ? '#5b9bd5' : '#3a4a66',
                padding: '14px',
                fontFamily: 'inherit',
                fontSize: '13px',
                letterSpacing: '0.2em',
                fontWeight: 'bold',
                cursor: playerName.trim() ? 'pointer' : 'not-allowed',
                borderRadius: '2px',
              }}
            >
              ▶ START MISSION
            </button>
          </div>
        </div>
      )}

      {/* Stage: LOGIN */}
      {stage === 'login' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div style={{
            background: '#0f1f33',
            border: '1px solid #1f3354',
            borderRadius: '4px',
            padding: '36px',
            animation: shake ? 'shake 0.4s' : 'none',
          }}>
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <img
                src="/navsea-logo.png"
                alt="NAVSEA NSWC Dahlgren Division — Dam Neck Activity"
                style={{ height: '88px', width: 'auto', display: 'block', margin: '0 auto 20px' }}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
              <div style={{ fontSize: '11px', letterSpacing: '0.3em', color: '#5a7090', marginBottom: '6px' }}>SECURE TERMINAL</div>
              <div style={{ fontSize: '20px', color: '#5b9bd5', letterSpacing: '0.1em' }}>AUTHENTICATION REQUIRED</div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '10px', color: '#5a7090', letterSpacing: '0.2em', marginBottom: '6px' }}>USERNAME</div>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && tryLogin()}
                style={{
                  width: '100%',
                  background: '#081320',
                  border: '1px solid #2a4870',
                  color: '#5b9bd5',
                  padding: '12px 14px',
                  fontFamily: 'inherit',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  borderRadius: '2px',
                }}
                onFocus={(e) => e.target.style.borderColor = '#5b9bd5'}
                onBlur={(e) => e.target.style.borderColor = '#2a4870'}
              />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '10px', color: '#5a7090', letterSpacing: '0.2em', marginBottom: '6px' }}>PASSWORD</div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && tryLogin()}
                style={{
                  width: '100%',
                  background: '#081320',
                  border: '1px solid #2a4870',
                  color: '#5b9bd5',
                  padding: '12px 14px',
                  fontFamily: 'inherit',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  borderRadius: '2px',
                }}
                onFocus={(e) => e.target.style.borderColor = '#5b9bd5'}
                onBlur={(e) => e.target.style.borderColor = '#2a4870'}
              />
            </div>

            <button
              onClick={tryLogin}
              style={{
                width: '100%',
                background: 'linear-gradient(180deg, #152942 0%, #0f1f33 100%)',
                border: '1px solid #5b9bd5',
                color: '#5b9bd5',
                padding: '14px',
                fontFamily: 'inherit',
                fontSize: '13px',
                letterSpacing: '0.2em',
                fontWeight: 'bold',
                cursor: 'pointer',
                borderRadius: '2px',
              }}
            >
              ▶ AUTHENTICATE
            </button>

            {loginAttempts > 0 && (
              <div style={{ marginTop: '14px', textAlign: 'center', color: '#ef4444', fontSize: '11px', letterSpacing: '0.15em' }}>
                ✕ ACCESS DENIED // ATTEMPT {loginAttempts}
              </div>
            )}
          </div>

          {/* Hint panel */}
          <div style={{ background: '#0f1f33', border: '1px solid #1f3354', borderRadius: '4px', padding: '24px' }}>
            <div style={{ fontSize: '11px', color: '#5a7090', letterSpacing: '0.2em', marginBottom: '14px' }}>OPERATION BRIEFING</div>
            <div style={{ fontSize: '13px', lineHeight: '1.7', color: '#c8d4e3', marginBottom: '16px' }}>
              You're a security researcher testing a system that's been flagged as vulnerable. Your mission: gain access, locate sensitive data, and demonstrate full system compromise.
            </div>
            <div style={{ background: '#081320', border: '1px solid #1f3354', padding: '14px', borderRadius: '2px', marginTop: '20px' }}>
              <div style={{ fontSize: '10px', color: '#fbbf24', letterSpacing: '0.2em', marginBottom: '8px' }}>⚠ INTEL DROP</div>
              <div style={{ fontSize: '12px', color: '#8da3c0', lineHeight: '1.6' }}>
                The system administrator was reported to use default credentials. Common defaults include "admin" with the password being a single common word that means... "password".
              </div>
            </div>
            <div style={{ marginTop: '20px', fontSize: '10px', color: '#3a4a66', lineHeight: '1.6' }}>
              <div style={{ color: '#5a7090', letterSpacing: '0.15em', marginBottom: '6px' }}>LESSON</div>
              Default credentials are the #1 cause of breaches in real systems. Always change them.
            </div>
          </div>
        </div>
      )}

      {/* Stage: FILESYSTEM */}
      {stage === 'filesystem' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '20px' }}>
          <div
            onClick={() => commandInputRef.current && commandInputRef.current.focus()}
            style={{ background: '#081320', border: '1px solid #1f3354', borderRadius: '4px', padding: '20px', height: '480px', display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px', paddingBottom: '10px', borderBottom: '1px solid #152942' }}>
              <span style={{ fontSize: '11px', color: '#5a7090', letterSpacing: '0.2em' }}>SHELL // user@target</span>
              <span style={{ fontSize: '11px', color: '#4ade80' }}>● CONNECTED</span>
            </div>

            <div ref={terminalRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', fontSize: '12.5px', lineHeight: '1.7', color: '#c8d4e3', whiteSpace: 'pre-wrap', marginBottom: '12px' }}>
              <div style={{ color: '#5a7090', marginBottom: '10px' }}>
                Welcome to TARGET-01. Type 'help' for available commands.{'\n'}
                Hint: try 'ls' to see what's around.
              </div>
              {terminalOutput.map((line, i) => (
                <div key={i} style={{ color: line.type === 'cmd' ? '#5b9bd5' : '#c8d4e3', marginBottom: line.type === 'out' ? '8px' : '0' }}>{line.text}</div>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid #152942', paddingTop: '12px' }}>
              <span style={{ color: sudoPrompt !== null ? '#fbbf24' : '#5b9bd5', fontSize: '13px', whiteSpace: 'nowrap' }}>
                {sudoPrompt !== null ? '[sudo] password for user:' : `user@target:${promptPath()}$`}
              </span>
              <input
                ref={commandInputRef}
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={handleTerminalKeyDown}
                type={sudoPrompt !== null ? 'password' : 'text'}
                autoFocus
                style={{ flex: 1, background: 'transparent', border: 'none', color: '#c8d4e3', fontFamily: 'inherit', fontSize: '13px', outline: 'none' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ background: '#0f1f33', border: '1px solid #1f3354', borderRadius: '4px', padding: '16px' }}>
              <div style={{ fontSize: '11px', color: '#5a7090', letterSpacing: '0.2em', marginBottom: '12px' }}>OBJECTIVES</div>
              <div style={{ fontSize: '12px', lineHeight: '1.8' }}>
                <div style={{ color: foundCreds ? '#4ade80' : '#c8d4e3' }}>{foundCreds ? '✓' : '◯'} Locate credentials file</div>
                <div style={{ color: '#3a4a66' }}>◯ Run 'sudo su' and enter the password</div>
              </div>
            </div>

            <div style={{ background: '#0f1f33', border: '1px solid #1f3354', borderRadius: '4px', padding: '16px' }}>
              <div style={{ fontSize: '11px', color: '#fbbf24', letterSpacing: '0.2em', marginBottom: '10px' }}>⚠ INTEL DROP</div>
              <div style={{ fontSize: '12px', color: '#8da3c0', lineHeight: '1.6' }}>
                Try <span style={{ color: '#5b9bd5' }}>ls config/</span>. Devs sometimes leave secrets in plain text. Tab-complete file names, and use ↑/↓ to reuse past commands.
              </div>
            </div>

            <div style={{ background: '#0f1f33', border: '1px solid #1f3354', borderRadius: '4px', padding: '16px' }}>
              <div style={{ fontSize: '11px', color: '#5a7090', letterSpacing: '0.2em', marginBottom: '10px' }}>LESSON</div>
              <div style={{ fontSize: '11px', color: '#8da3c0', lineHeight: '1.6' }}>
                Real breaches often start with secrets accidentally committed to code. Tools like git-secrets and pre-commit hooks catch these before they ship.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stage: ESCALATE */}
      {stage === 'escalate' && (
        <div style={{ background: '#081320', border: '1px solid #1f3354', borderRadius: '4px', padding: '32px', minHeight: '480px' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ fontSize: '11px', color: '#fbbf24', letterSpacing: '0.3em', marginBottom: '8px' }}>⚠ ROOT ACCESS GRANTED ⚠</div>
            <div style={{ fontSize: '22px', color: '#5b9bd5', letterSpacing: '0.1em' }}>ELEVATED TERMINAL</div>
          </div>

          <div style={{ background: '#0f1f33', border: '1px solid #2a4870', padding: '14px', borderRadius: '2px', marginBottom: '24px', fontSize: '12.5px', color: '#c8d4e3' }}>
            <div style={{ color: '#4ade80' }}># whoami</div>
            <div style={{ marginBottom: '8px' }}>root</div>
            <div style={{ color: '#4ade80' }}># id</div>
            <div>uid=0(root) gid=0(root) groups=0(root)</div>
          </div>

          <div style={{ marginBottom: '20px', fontSize: '13px', color: '#c8d4e3', textAlign: 'center', lineHeight: '1.6' }}>
            You now have full system access. Choose your final action:
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', maxWidth: '720px', margin: '0 auto' }}>
            <ActionButton label="VIEW LOGS" sub="Read-only inspection" color="#8da3c0" onClick={() => alert('Safe action — logs displayed.')} />
            <ActionButton label="DOWNLOAD DATA" sub="Exfiltrate sensitive files" color="#fbbf24" onClick={() => alert('You exfiltrated data. In a real attack, this is data theft.')} />
            <ActionButton label="INJECT PAYLOAD" sub="Deploy malicious code" color="#ef4444" pulse onClick={() => runEscalation('inject')} />
          </div>

          <div style={{ marginTop: '32px', fontSize: '11px', color: '#5a7090', textAlign: 'center', lineHeight: '1.6' }}>
            In a real engagement, defenders would see this activity in logs.<br/>
            Detection &gt; Prevention &gt; Response — that's why monitoring matters.
          </div>
        </div>
      )}

      {/* Stage: HACKED */}
      {stage === 'hacked' && (
        <div style={{
          background: 'radial-gradient(circle at center, #1a0408 0%, #0a1628 100%)',
          border: '1px solid #ef4444',
          borderRadius: '4px',
          padding: '60px 32px',
          minHeight: '480px',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            height: '2px',
            background: 'linear-gradient(90deg, transparent, #ef4444, transparent)',
            animation: 'scan-red 2s linear infinite',
          }}></div>

          <div style={{ fontSize: '14px', color: '#ef4444', letterSpacing: '0.4em', marginBottom: '20px', animation: 'pulse-warn 1s infinite' }}>
            ⚠ ⚠ ⚠ SYSTEM COMPROMISED ⚠ ⚠ ⚠
          </div>

          <div style={{ fontSize: '64px', fontWeight: 'bold', color: '#ef4444', letterSpacing: '0.08em', marginBottom: '16px', animation: 'glitch 0.4s infinite' }}>
            P0WNED
          </div>

          <div style={{ fontSize: '14px', color: '#c8d4e3', maxWidth: '520px', margin: '0 auto 32px', lineHeight: '1.7' }}>
            You successfully chained a default credential, exposed secret, and privilege escalation into full system compromise.
          </div>

          <div style={{ background: '#081320', border: '1px solid #2a4870', padding: '20px', maxWidth: '520px', margin: '0 auto', textAlign: 'left', borderRadius: '2px' }}>
            <div style={{ fontSize: '11px', color: '#4ade80', letterSpacing: '0.2em', marginBottom: '12px' }}>FLAG CAPTURED</div>
            <div style={{ fontSize: '14px', color: '#5b9bd5', fontFamily: 'monospace', marginBottom: '16px' }}>ctf{'{'}d3f4ult_cr3d5_c0nf1g_l34k_pwn3d{'}'}</div>

            <div style={{ fontSize: '11px', color: '#5a7090', letterSpacing: '0.2em', marginBottom: '8px' }}>WHAT YOU LEARNED</div>
            <div style={{ fontSize: '12px', color: '#8da3c0', lineHeight: '1.7' }}>
              • Default passwords are catastrophic<br/>
              • Secrets in config files leak constantly<br/>
              • Privilege escalation turns small wins into full compromise<br/>
              • Defense in depth blocks each stage independently
            </div>

            <div style={{ borderTop: '1px solid #1f3354', marginTop: '16px', paddingTop: '16px' }}>
              <div style={{ fontSize: '11px', color: '#5a7090', letterSpacing: '0.2em', marginBottom: '8px' }}>YOUR TIME</div>
              <div style={{ fontSize: '18px', color: '#4ade80', fontFamily: 'monospace' }}>
                {elapsedSeconds !== null ? `${elapsedSeconds.toFixed(1)}s` : '—'}
              </div>
              <div style={{ fontSize: '11px', color: '#8da3c0', marginTop: '6px' }}>
                {submitStatus === 'submitting' && 'Submitting to leaderboard…'}
                {submitStatus === 'done' && rank && `Ranked #${rank} on the leaderboard`}
                {submitStatus === 'error' && 'Could not reach the leaderboard server — score not recorded.'}
              </div>
              <button
                onClick={openLeaderboard}
                style={{ marginTop: '10px', background: 'transparent', border: '1px solid #2a4870', color: '#5b9bd5', padding: '8px 16px', fontFamily: 'inherit', fontSize: '11px', letterSpacing: '0.15em', cursor: 'pointer', borderRadius: '2px' }}
              >
                🏆 VIEW LEADERBOARD
              </button>
            </div>
          </div>

          <button
            onClick={reset}
            style={{
              marginTop: '32px',
              background: 'transparent',
              border: '1px solid #5b9bd5',
              color: '#5b9bd5',
              padding: '12px 32px',
              fontFamily: 'inherit',
              fontSize: '12px',
              letterSpacing: '0.2em',
              cursor: 'pointer',
              borderRadius: '2px',
            }}
          >
            ▶ NEW SESSION
          </button>
        </div>
      )}

      <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#3a4a66', letterSpacing: '0.15em' }}>
        <span>STEM_OUTREACH_v0.1 // PROTOTYPE</span>
        <span>CYBER_RANGE // DEFENSE TECH OUTREACH</span>
      </div>
    </div>
  );
}

function LeaderboardModal({ scores, error, onRefresh, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(4, 9, 18, 0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: '#0f1f33', border: '1px solid #2a4870', borderRadius: '4px', padding: '28px', width: '420px', maxWidth: '90vw', maxHeight: '80vh', overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div style={{ fontSize: '14px', color: '#5b9bd5', letterSpacing: '0.15em' }}>🏆 FASTEST TIMES</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#5a7090', fontSize: '16px', cursor: 'pointer' }}>✕</button>
        </div>

        {error && (
          <div style={{ fontSize: '12px', color: '#ef4444', marginBottom: '12px' }}>
            Could not reach the leaderboard server.
          </div>
        )}

        {!error && scores.length === 0 && (
          <div style={{ fontSize: '12px', color: '#8da3c0' }}>No runs recorded yet — be the first!</div>
        )}

        {!error && scores.length > 0 && (
          <div style={{ fontSize: '13px', color: '#c8d4e3' }}>
            {scores.map((s) => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #152942' }}>
                <span>#{s.rank} {s.player_name}</span>
                <span style={{ color: '#4ade80', fontFamily: 'monospace' }}>{s.elapsed_seconds.toFixed(1)}s</span>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={onRefresh}
          style={{ marginTop: '18px', width: '100%', background: 'transparent', border: '1px solid #2a4870', color: '#5a7090', padding: '10px', fontFamily: 'inherit', fontSize: '11px', letterSpacing: '0.15em', cursor: 'pointer', borderRadius: '2px' }}
        >
          ↻ REFRESH
        </button>
      </div>
    </div>
  );
}

function ActionButton({ label, sub, color, onClick, pulse }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? color : 'transparent',
        border: `1px solid ${color}`,
        color: hover ? '#0a1628' : color,
        padding: '20px 14px',
        fontFamily: 'inherit',
        cursor: 'pointer',
        borderRadius: '2px',
        textAlign: 'center',
        animation: pulse && !hover ? 'pulse-warn 1.5s infinite' : 'none',
        transition: 'all 0.15s',
      }}
    >
      <div style={{ fontSize: '13px', fontWeight: 'bold', letterSpacing: '0.15em', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '10px', opacity: 0.7 }}>{sub}</div>
    </button>
  );
}
