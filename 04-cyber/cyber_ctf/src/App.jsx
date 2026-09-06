import React, { useState, useEffect, useRef } from 'react';
import { useTerminal } from './hooks/useTerminal';
import { StartScreen } from './components/StartScreen';
import { LoginScreen } from './components/LoginScreen';
import { FilesystemScreen } from './components/FilesystemScreen';
import { EscalateScreen } from './components/EscalateScreen';
import { HackedScreen } from './components/HackedScreen';
import { LeaderboardModal } from './components/LeaderboardModal';

// The leaderboard API runs standalone (see ../leaderboard-api) and defaults
// to localhost:8000. Override with VITE_LEADERBOARD_API_URL when the API is
// hosted elsewhere (e.g. a shared box on the booth LAN).
const API_BASE = import.meta.env.VITE_LEADERBOARD_API_URL || 'http://localhost:8000';
const STATION_ID = import.meta.env.VITE_STATION_ID || null;

export default function App() {
  const [stage, setStage] = useState('start'); // start, login, filesystem, escalate, hacked, victory
  const [mode, setMode] = useState('easy'); // easy: click-to-explore + one-click root. hard: type every command.
  const [playerName, setPlayerName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [shake, setShake] = useState(false);
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
  const startButtonRef = useRef(null);
  const passwordInputRef = useRef(null);
  const authButtonRef = useRef(null);

  const terminal = useTerminal({
    playerName,
    onCredentialsFound: () => setProgress(60),
    onRootAccess: () => { setStage('escalate'); setProgress(80); },
  });
  const { foundCreds, assisted, commandInputRef } = terminal;

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
    if (!playerName.trim()) return;
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

  const runEscalation = (action) => {
    if (action === 'inject') {
      const elapsed = startTime ? (Date.now() - startTime) / 1000 : null;
      setEscalated(true);
      setStage('hacked');
      setProgress(100);
      setElapsedSeconds(elapsed);
      if (elapsed !== null && !assisted) submitScore(elapsed);
    }
  };

  const reset = () => {
    setStage('start');
    setPlayerName('');
    setUsername('');
    setPassword('');
    setLoginAttempts(0);
    terminal.reset();
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
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#0a1628', color: '#c8d4e3', fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', padding: '24px' }}>
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
          <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #5b9bd5, #4ade80)', transition: progress === 0 ? 'none' : 'width 0.6s ease' }}></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '10px' }}>
          <span style={{ color: !['start', 'login'].includes(stage) ? '#4ade80' : stage === 'login' ? '#fbbf24' : '#3a4a66' }}>● BREACH ACCESS</span>
          <span style={{ color: foundCreds ? '#4ade80' : stage === 'filesystem' ? '#fbbf24' : '#3a4a66' }}>● FIND CREDENTIALS</span>
          <span style={{ color: stage === 'escalate' || stage === 'hacked' ? '#4ade80' : '#3a4a66' }}>● ESCALATE PRIVILEGES</span>
          <span style={{ color: stage === 'hacked' ? '#4ade80' : '#3a4a66' }}>● DEPLOY PAYLOAD</span>
        </div>
      </div>

      {stage === 'start' && (
        <StartScreen playerName={playerName} setPlayerName={setPlayerName} mode={mode} setMode={setMode} onBegin={beginMission} startButtonRef={startButtonRef} />
      )}

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
          onViewLeaderboard={openLeaderboard}
          onReset={reset}
        />
      )}

      <div style={{ marginTop: 'auto', paddingTop: '20px', display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#3a4a66', letterSpacing: '0.15em' }}>
        <span>STEM_OUTREACH_v0.1 // PROTOTYPE</span>
        <span>CYBER_RANGE // DEFENSE TECH OUTREACH</span>
      </div>
    </div>
  );
}
