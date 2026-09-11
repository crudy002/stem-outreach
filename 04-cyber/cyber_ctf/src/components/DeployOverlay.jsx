import { useEffect, useState } from 'react';
import { useTheme } from '../theme.jsx';

const STEPS = [
  'encrypting payload…',
  'bypassing endpoint protection…',
  'injecting into pid 4021…',
  'establishing persistence…',
];

// Runs once, then calls onComplete — this is a fixed beat before the
// P0WNED reveal, not an optional action, so there's no close button.
export function DeployOverlay({ onComplete }) {
  const { theme } = useTheme();
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
      position: 'fixed', inset: 0, background: theme.overlay,
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }}>
      <div style={{ width: '420px', maxWidth: '92vw', textAlign: 'center' }}>
        <div style={{ fontSize: '13px', color: theme.danger, letterSpacing: '0.3em', marginBottom: '18px', animation: 'pulse-warn 0.8s infinite' }}>
          ⚠ DEPLOYING PAYLOAD ⚠
        </div>
        <div style={{ fontSize: '12px', color: theme.text2, marginBottom: '18px', fontFamily: 'monospace' }}>
          {progress < 100 ? STEPS[stepIndex] : 'done.'}
        </div>
        <div style={{ height: '10px', background: theme.bgDeep, border: `1px solid ${theme.borderStrong}`, borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${progress}%`,
            background: `linear-gradient(90deg, ${theme.accent}, ${theme.danger})`,
            transition: 'width 0.09s linear',
          }} />
        </div>
      </div>
    </div>
  );
}
