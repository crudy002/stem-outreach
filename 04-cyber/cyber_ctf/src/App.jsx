import React, { useState, useEffect, useRef } from 'react';
import { useTerminal } from './hooks/useTerminal';
import { useTheme, THEMES } from './theme.jsx';
import { StartScreen } from './components/StartScreen';
import { LoginScreen } from './components/LoginScreen';
import { FilesystemScreen } from './components/FilesystemScreen';
import { EscalateScreen } from './components/EscalateScreen';
import { HackedScreen } from './components/HackedScreen';
import { IntroOverlay } from './components/IntroOverlay';
import { LeaderboardModal } from './components/LeaderboardModal';
import { ElapsedTimer } from './components/ElapsedTimer';
import { modeLabel } from './modes';

// The leaderboard API runs standalone (see ../leaderboard-api) and defaults
// to localhost:8000. Override with VITE_LEADERBOARD_API_URL when the API is
// hosted elsewhere (e.g. a shared box on the booth LAN).
const API_BASE = import.meta.env.VITE_LEADERBOARD_API_URL || 'http://localhost:8000';
const STATION_ID = import.meta.env.VITE_STATION_ID || null;

// Rotated per playthrough so repeat visitors can't just muscle-memory
// "admin"/"password" without reading the sticky note.
const USERNAME_POOL = ['admin', 'operator', 'sysadmin', 'itguy', 'rootuser'];
const PASSWORD_POOL = ['sunshine1', 'dragon22', 'starfish7', 'rocket99', 'blueSky3', 'tigerPaw5'];
const randomCreds = () => ({
  username: USERNAME_POOL[Math.floor(Math.random() * USERNAME_POOL.length)],
  password: PASSWORD_POOL[Math.floor(Math.random() * PASSWORD_POOL.length)],
});

export default function App() {
  const { theme, themeId, setThemeId } = useTheme();
  const [stage, setStage] = useState('start'); // start, login, filesystem, escalate, hacked, victory
  const [mode, setMode] = useState('easy'); // rookie: tap coloured blocks. easy: click-to-explore + one-click root. hard: type every command.
  // Which mode's leaderboard is on screen. Follows the difficulty picker on
  // the start screen, but the modal can browse other modes' boards without
  // changing what the next player is about to play.
  const [boardMode, setBoardMode] = useState('easy');
  const [playerName, setPlayerName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [correctCreds, setCorrectCreds] = useState(randomCreds);
  const [shake, setShake] = useState(false);
  const [escalateInput, setEscalateInput] = useState('');
  const [escalated, setEscalated] = useState(false);
  const [progress, setProgress] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [rootReachedAt, setRootReachedAt] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(null);
  const [submitStatus, setSubmitStatus] = useState('idle'); // idle, submitting, done, error
  const [rank, setRank] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardError, setLeaderboardError] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const startButtonRef = useRef(null);
  const passwordInputRef = useRef(null);
  const authButtonRef = useRef(null);

  const terminal = useTerminal({
    playerName,
    onCredentialsFound: () => setProgress(60),
    onRootAccess: () => { setStage('escalate'); setProgress(80); setRootReachedAt(Date.now()); },
  });
  const { foundCreds, assisted, commandInputRef } = terminal;

  useEffect(() => {
    if (stage === 'filesystem' && commandInputRef.current) commandInputRef.current.focus();
  }, [stage]);

  // Boards are always per-mode: a rookie tapping blocks would otherwise
  // outrank every hard-mode player who typed the commands by hand.
  // `m` is guarded rather than defaulted: this is wired straight to onClick
  // in a couple of places, and React would hand a click event in as the
  // first argument.
  const fetchLeaderboard = (m) => {
    const target = typeof m === 'string' ? m : boardMode;
    fetch(`${API_BASE}/scores?limit=10&mode=${encodeURIComponent(target)}`)
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

  // Also covers the initial load, since boardMode has a value on mount.
  useEffect(() => {
    fetchLeaderboard(boardMode);
  }, [boardMode]);

  // Picking a difficulty also swings the start screen's board to that mode,
  // so a player sees the times they'll actually be measured against.
  const selectMode = (m) => {
    setMode(m);
    setBoardMode(m);
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
        mode,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('bad response');
        return res.json();
      })
      .then((data) => {
        setRank(data.rank);
        setSubmitStatus('done');
        // Show the board for the mode just played, not whatever the modal
        // was last left browsing.
        setBoardMode(mode);
        fetchLeaderboard(mode);
      })
      .catch(() => setSubmitStatus('error'));
  };

  const beginMission = () => {
    if (!playerName.trim()) return;
    setStage('intro');
  };

  const launchMission = () => {
    setStartTime(Date.now());
    setStage('login');
    setProgress(20);
  };

  const tryLogin = () => {
    if (username.toLowerCase() === correctCreds.username && password.toLowerCase() === correctCreds.password.toLowerCase()) {
      setStage('filesystem');
      setProgress(40);
    } else {
      setShake(true);
      setLoginAttempts((a) => a + 1);
      setTimeout(() => setShake(false), 400);
    }
  };

  const runEscalation = (action) => {
    if (action === 'inject') {
      // Locked at root access, not at this click — the timed skill is
      // breach → creds → escalate; exploring the escalate-screen flavor
      // actions afterward shouldn't cost leaderboard time.
      const elapsed = startTime && rootReachedAt ? (rootReachedAt - startTime) / 1000 : null;
      setEscalated(true);
      setStage('hacked');
      setProgress(100);
      setElapsedSeconds(elapsed);
      if (elapsed !== null && !assisted) submitScore(elapsed);
    }
  };

  const reset = () => {
    setStage('start');
    setBoardMode(mode);
    setPlayerName('');
    setUsername('');
    setPassword('');
    setLoginAttempts(0);
    setCorrectCreds(randomCreds());
    terminal.reset();
    setEscalateInput('');
    setEscalated(false);
    setProgress(0);
    setStartTime(null);
    setRootReachedAt(null);
    setElapsedSeconds(null);
    setSubmitStatus('idle');
    setRank(null);
    setShowLeaderboard(false);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: theme.bg, color: theme.text, fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', padding: '24px' }}>
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
          color: ${theme.accent};
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: `1px solid ${theme.border}`, paddingBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <img
            src="/navsea-logo.png"
            alt="NAVSEA NSWC Dahlgren Division — Dam Neck Activity"
            style={{ height: '52px', width: 'auto', display: 'block' }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          <div style={{ borderLeft: `1px solid ${theme.border}`, paddingLeft: '16px' }}>
            <div style={{ fontSize: '11px', letterSpacing: '0.3em', color: theme.muted, marginBottom: '4px' }}>NSWCDD DNA STEM</div>
            <div style={{ fontSize: '22px', fontWeight: 'bold', color: theme.accent, letterSpacing: '0.05em' }}>CYBER OPERATIONS RANGE</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', fontSize: '11px', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: `1px solid ${theme.borderStrong}`, color: theme.muted, padding: '6px 12px', fontFamily: 'inherit', fontSize: '10px', letterSpacing: '0.15em', cursor: 'pointer', borderRadius: '2px' }}>
            <span aria-hidden="true">🎨</span>
            <select
              value={themeId}
              onChange={(e) => setThemeId(e.target.value)}
              title="Display theme"
              style={{ appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none', background: 'transparent', border: 'none', color: 'inherit', font: 'inherit', letterSpacing: 'inherit', cursor: 'pointer', outline: 'none', padding: 0 }}
            >
              {Object.entries(THEMES).map(([id, t]) => (
                <option key={id} value={id}>{t.label.toUpperCase()}</option>
              ))}
            </select>
          </label>
          <button onClick={openLeaderboard} style={{ background: 'transparent', border: `1px solid ${theme.borderStrong}`, color: theme.muted, padding: '6px 12px', fontFamily: 'inherit', fontSize: '10px', letterSpacing: '0.15em', cursor: 'pointer', borderRadius: '2px' }}>🏆 LEADERBOARD</button>
          <button onClick={reset} style={{ background: 'transparent', border: `1px solid ${theme.borderStrong}`, color: theme.muted, padding: '6px 12px', fontFamily: 'inherit', fontSize: '10px', letterSpacing: '0.15em', cursor: 'pointer', borderRadius: '2px' }}>↻ RESET</button>
        </div>
      </div>

      {showLeaderboard && (
        <LeaderboardModal
          scores={leaderboard}
          error={leaderboardError}
          onRefresh={fetchLeaderboard}
          boardMode={boardMode}
          onSelectMode={setBoardMode}
          onClose={() => setShowLeaderboard(false)}
        />
      )}

      <ElapsedTimer
        startTime={startTime}
        running={['login', 'filesystem'].includes(stage)}
        lockedMs={stage === 'escalate' && rootReachedAt ? rootReachedAt - startTime : null}
      />

      {/* Mission progress */}
      <div style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: '4px', padding: '14px 18px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '11px', color: theme.muted, letterSpacing: '0.2em' }}>MISSION PROGRESS</span>
          <span style={{ fontSize: '11px', color: theme.accent }}>{progress}%</span>
        </div>
        <div style={{ height: '4px', background: theme.panel2, borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: `linear-gradient(90deg, ${theme.accent}, ${theme.success})`, transition: progress === 0 ? 'none' : 'width 0.6s ease' }}></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '10px' }}>
          <span style={{ color: !['start', 'intro', 'login'].includes(stage) ? theme.success : stage === 'login' ? theme.warning : theme.dim }}>● BREACH ACCESS</span>
          <span style={{ color: foundCreds ? theme.success : stage === 'filesystem' ? theme.warning : theme.dim }}>● FIND CREDENTIALS</span>
          <span style={{ color: stage === 'escalate' || stage === 'hacked' ? theme.success : theme.dim }}>● ESCALATE PRIVILEGES</span>
          <span style={{ color: stage === 'hacked' ? theme.success : theme.dim }}>● DEPLOY PAYLOAD</span>
        </div>
      </div>

      {stage === 'start' && (
        <StartScreen
          playerName={playerName}
          setPlayerName={setPlayerName}
          mode={mode}
          setMode={selectMode}
          onBegin={beginMission}
          startButtonRef={startButtonRef}
          leaderboard={leaderboard}
          leaderboardError={leaderboardError}
          onRefreshLeaderboard={fetchLeaderboard}
          boardMode={boardMode}
        />
      )}

      {stage === 'intro' && <IntroOverlay playerName={playerName} onComplete={launchMission} />}

      {stage === 'login' && (
        <LoginScreen
          username={username}
          setUsername={setUsername}
          password={password}
          setPassword={setPassword}
          onLogin={tryLogin}
          shake={shake}
          loginAttempts={loginAttempts}
          passwordInputRef={passwordInputRef}
          authButtonRef={authButtonRef}
          stickyUsername={correctCreds.username}
          stickyPassword={correctCreds.password}
        />
      )}

      {stage === 'filesystem' && <FilesystemScreen terminal={terminal} mode={mode} />}

      {stage === 'escalate' && <EscalateScreen onInject={() => runEscalation('inject')} />}

      {stage === 'hacked' && (
        <HackedScreen
          elapsedSeconds={elapsedSeconds}
          submitStatus={submitStatus}
          assisted={assisted}
          rank={rank}
          modeName={modeLabel(mode)}
          onViewLeaderboard={openLeaderboard}
          onReset={reset}
        />
      )}

      <div style={{ marginTop: 'auto', paddingTop: '20px', display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: theme.dim, letterSpacing: '0.15em' }}>
        <span>STEM_OUTREACH_v0.1 // PROTOTYPE</span>
        <span>CYBER_RANGE // DEFENSE TECH OUTREACH</span>
      </div>
    </div>
  );
}
