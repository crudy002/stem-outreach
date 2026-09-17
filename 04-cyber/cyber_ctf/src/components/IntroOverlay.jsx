import { useEffect, useState } from 'react';
import { useTheme } from '../theme.jsx';

const PHASES = ['dim', 'logo', '3', '2', '1', 'go'];
// Lengthened from the original 500/1500/450/450/450/700 (4.05s total) to
// 5.65s so the flyby/sail-by fleet has room to move slower without feeling
// rushed against the countdown beat.
const DURATIONS = { dim: 500, logo: 2200, '3': 650, '2': 650, '1': 650, go: 1000 };

// Runs once between the callsign screen and login — a fixed dim-to-logo
// to 3-2-1 beat, then calls onComplete to actually start the mission clock.
// Not skippable, same reasoning as DeployOverlay. Four Navy assets cross the
// scene in their own depth band, slowest/most-distant first: a submarine
// glides low near the waterline, an aircraft carrier glides behind it
// higher and hazier, a destroyer sails a closer band, and a Blue Angels
// diamond screams past up top timed to the 3-2-1 beat. All four are
// fixed-timed from mount (not tied to `phase` re-renders), so each plays
// once and doesn't restart. Source photos live in public/, background-
// removed to PNG.
export function IntroOverlay({ playerName, onComplete }) {
  const { theme } = useTheme();
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
        background: theme.bgDeepest,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: phase === 'dim' ? 0 : 1,
        transition: 'opacity 0.35s ease',
        overflow: 'hidden',
      }}
    >
      <img
        src="/submarine.png"
        alt=""
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '86%',
          left: 0,
          width: '150px',
          height: 'auto',
          opacity: 0,
          animation: phase === 'dim' ? 'none' : 'ship-sail 3.4s linear 0.1s both',
          filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.5))',
        }}
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />
      <img
        src="/carrier.png"
        alt=""
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '22%',
          left: 0,
          width: '300px',
          height: 'auto',
          opacity: 0,
          animation: phase === 'dim' ? 'none' : 'ship-sail 5.2s linear 0.3s both',
          filter: 'brightness(0.88) saturate(0.8) blur(0.4px) drop-shadow(0 8px 12px rgba(0,0,0,0.45))',
        }}
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />
      <img
        src="/destroyer.png"
        alt=""
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '68%',
          left: 0,
          width: '260px',
          height: 'auto',
          opacity: 0,
          animation: phase === 'dim' ? 'none' : 'ship-sail 4.8s linear 0.6s both',
          filter: 'drop-shadow(0 8px 14px rgba(0,0,0,0.55))',
        }}
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />
      <img
        src="/blueangels.png"
        alt=""
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '8%',
          left: 0,
          width: '190px',
          height: 'auto',
          opacity: 0,
          animation: phase === 'dim' ? 'none' : 'jet-flyby 1.7s ease-in 2.1s both',
          filter: 'drop-shadow(0 8px 14px rgba(0,0,0,0.55))',
        }}
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />
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
          color: theme.muted,
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
              color: countdownLabel === 'BREACHING' ? theme.success : theme.accent,
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
        @keyframes jet-flyby {
          0% { transform: translateX(-20vw) translateY(0); opacity: 0; }
          10% { opacity: 1; }
          50% { transform: translateX(55vw) translateY(-26px); }
          90% { opacity: 1; }
          100% { transform: translateX(140vw) translateY(-4px); opacity: 0; }
        }
        @keyframes ship-sail {
          0% { transform: translateX(-25vw); opacity: 0; }
          8% { opacity: 0.9; }
          92% { opacity: 0.9; }
          100% { transform: translateX(115vw); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
