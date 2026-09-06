import { useEffect, useState } from 'react';

const PHASES = ['dim', 'logo', '3', '2', '1', 'go'];
const DURATIONS = { dim: 600, logo: 1600, '3': 850, '2': 850, '1': 850, go: 700 };

// Runs once between the callsign screen and login — a fixed dim-to-logo
// to 3-2-1 beat, then calls onComplete to actually start the mission
// clock. Not skippable, same reasoning as DeployOverlay.
export function IntroOverlay({ playerName, onComplete }) {
  const [phase, setPhase] = useState('dim');

  useEffect(() => {
    const idx = PHASES.indexOf(phase);
    const next = PHASES[idx + 1];
    const t = setTimeout(() => {
      if (next) setPhase(next);
      else onComplete();
    }, DURATIONS[phase]);
    return () => clearTimeout(t);
  }, [phase, onComplete]);

  const showLogo = phase !== 'dim';
  const countdownLabel = ['3', '2', '1'].includes(phase) ? phase : phase === 'go' ? 'BREACHING' : null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: '#04070d',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: phase === 'dim' ? 0 : 1,
        transition: 'opacity 0.35s ease',
      }}
    >
      <img
        src="/navsea-logo.png"
        alt="NAVSEA NSWC Dahlgren Division — Dam Neck Activity"
        style={{
          width: 'min(46vw, 320px)',
          height: 'auto',
          opacity: showLogo ? 1 : 0,
          transform: showLogo ? 'scale(1)' : 'scale(0.85)',
          transition: 'opacity 0.5s ease, transform 0.5s ease',
          marginBottom: '28px',
        }}
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />
      <div
        style={{
          fontSize: '12px',
          letterSpacing: '0.35em',
          color: '#5a7090',
          marginBottom: '14px',
          opacity: showLogo ? 1 : 0,
          transition: 'opacity 0.5s ease',
        }}
      >
        OPERATOR: {(playerName || 'UNKNOWN').toUpperCase()}
      </div>
      <div style={{ height: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {countdownLabel && (
          <div
            key={countdownLabel}
            style={{
              fontSize: countdownLabel === 'BREACHING' ? '26px' : '64px',
              fontWeight: 'bold',
              letterSpacing: countdownLabel === 'BREACHING' ? '0.3em' : 'normal',
              color: countdownLabel === 'BREACHING' ? '#4ade80' : '#5b9bd5',
              animation: 'intro-pop 0.5s ease',
            }}
          >
            {countdownLabel === 'BREACHING' ? 'BREACHING…' : countdownLabel}
          </div>
        )}
      </div>
      <style>{`
        @keyframes intro-pop {
          0% { transform: scale(0.4); opacity: 0; }
          40% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
