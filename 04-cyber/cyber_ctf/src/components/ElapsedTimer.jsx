import { useEffect, useState } from 'react';

const pad = (n) => String(n).padStart(2, '0');

const formatElapsed = (ms) => {
  const totalTenths = Math.floor(ms / 100);
  const tenths = totalTenths % 10;
  const totalSeconds = Math.floor(totalTenths / 10);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${pad(minutes)}:${pad(seconds)}.${tenths}`;
};

// Live mission stopwatch, pinned bottom-right, in both easy and hard mode —
// makes the clock feel real without yet being the hard-mode countdown/fail
// timer that's still on the roadmap.
//
// `lockedMs` freezes the display at a fixed value (used once root access is
// granted, so the leaderboard clock stops before the escalate-screen flavor
// actions — reading the logs or watching the exfil bar shouldn't cost time).
export function ElapsedTimer({ startTime, running, lockedMs = null }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!running || !startTime) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [running, startTime]);

  if (!startTime || (!running && lockedMs == null)) return null;

  const ms = lockedMs != null ? lockedMs : now - startTime;

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      background: '#081320',
      border: `1px solid ${lockedMs != null ? '#4ade80' : '#1f3354'}`,
      borderRadius: '4px',
      padding: '10px 18px',
      textAlign: 'center',
      zIndex: 50,
    }}>
      <div style={{ fontSize: '9px', color: '#5a7090', letterSpacing: '0.25em', marginBottom: '4px' }}>
        {lockedMs != null ? '🔒 LOCKED' : 'ELAPSED'}
      </div>
      <div style={{
        fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
        fontSize: '34px',
        fontWeight: 'bold',
        color: '#4ade80',
        letterSpacing: '0.05em',
        fontVariantNumeric: 'tabular-nums',
        textShadow: '0 0 10px rgba(74, 222, 128, 0.55)',
      }}>
        {formatElapsed(ms)}
      </div>
    </div>
  );
}
