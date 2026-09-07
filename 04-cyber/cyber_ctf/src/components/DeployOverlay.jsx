import { useEffect, useState } from 'react';

const STEPS = [
  'encrypting payload…',
  'bypassing endpoint protection…',
  'injecting into pid 4021…',
  'establishing persistence…',
];

// Runs once, then calls onComplete — this is a fixed beat before the
// P0WNED reveal, not an optional action, so there's no close button.
export function DeployOverlay({ onComplete }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (progress >= 100) {
      const t = setTimeout(onComplete, 500);
      return () => clearTimeout(t);
    }
    const interval = setInterval(() => {
      setProgress((p) => Math.min(100, p + 6 + Math.random() * 6));
    }, 90);
    return () => clearInterval(interval);
  }, [progress, onComplete]);

  const stepIndex = Math.min(STEPS.length - 1, Math.floor((progress / 100) * STEPS.length));

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(4, 9, 18, 0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }}>
      <div style={{ width: '420px', maxWidth: '92vw', textAlign: 'center' }}>
        <div style={{ fontSize: '13px', color: '#ef4444', letterSpacing: '0.3em', marginBottom: '18px', animation: 'pulse-warn 0.8s infinite' }}>
          ⚠ DEPLOYING PAYLOAD ⚠
        </div>
        <div style={{ fontSize: '12px', color: '#8da3c0', marginBottom: '18px', fontFamily: 'monospace' }}>
          {progress < 100 ? STEPS[stepIndex] : 'done.'}
        </div>
        <div style={{ height: '10px', background: '#081320', border: '1px solid #2a4870', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${progress}%`,
            background: 'linear-gradient(90deg, #5b9bd5, #ef4444)',
            transition: 'width 0.09s linear',
          }} />
        </div>
      </div>
    </div>
  );
}
