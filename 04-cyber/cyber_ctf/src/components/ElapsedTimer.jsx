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
export function ElapsedTimer({ startTime, running }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!running || !startTime) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [running, startTime]);

  if (!startTime || !running) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      background: '#081320',
      border: '1px solid #1f3354',
      borderRadius: '4px',
      padding: '10px 18px',
      textAlign: 'center',
      zIndex: 50,
    }}>
      <div style={{ fontSize: '9px', color: '#5a7090', letterSpacing: '0.25em', marginBottom: '4px' }}>ELAPSED</div>
      <div style={{
        fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
        fontSize: '34px',
        fontWeight: 'bold',
        color: '#4ade80',
        letterSpacing: '0.05em',
        fontVariantNumeric: 'tabular-nums',
        textShadow: '0 0 10px rgba(74, 222, 128, 0.55)',
      }}>
        {formatElapsed(now - startTime)}
      </div>
    </div>
  );
}
