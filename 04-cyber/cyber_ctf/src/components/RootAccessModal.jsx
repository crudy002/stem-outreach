import { useEffect, useState } from 'react';
import { useTheme } from '../theme.jsx';

const MASK_LENGTH = 10;
const TYPE_INTERVAL_MS = 90;
const GRANTED_HOLD_MS = 1200;

// Full-screen "sudo" moment: plays out the password mask filling in, then a
// beat of ACCESS GRANTED, before calling onDone — which is what actually
// advances the mission (see completeEscalation in useTerminal.js). Replaces
// the old approach of animating dots inline in the terminal transcript,
// which was easy to miss scrolled behind other output.
export function RootAccessModal({ open, onDone }) {
  const { theme } = useTheme();
  const [phase, setPhase] = useState('typing'); // typing | granted
  const [typed, setTyped] = useState(0);

  useEffect(() => {
    if (!open) return;
    setPhase('typing');
    setTyped(0);
    let count = 0;
    const typeTimer = setInterval(() => {
      count += 1;
      setTyped(count);
      if (count >= MASK_LENGTH) {
        clearInterval(typeTimer);
        setTimeout(() => setPhase('granted'), 300);
      }
    }, TYPE_INTERVAL_MS);
    return () => clearInterval(typeTimer);
  }, [open]);

  useEffect(() => {
    if (phase !== 'granted') return;
    const t = setTimeout(() => onDone?.(), GRANTED_HOLD_MS);
    return () => clearTimeout(t);
  }, [phase, onDone]);

  if (!open) return null;

  const granted = phase === 'granted';
  const glow = granted ? theme.success : theme.warning;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <style>{`
        @keyframes rootPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }
        @keyframes rootSweep { 0% { transform: translateY(-140%); } 100% { transform: translateY(140%); } }
        @keyframes rootGrantPop { 0% { transform: scale(0.6); opacity: 0; } 60% { transform: scale(1.08); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes rootRing { 0% { box-shadow: 0 0 0 0 ${glow}66; } 100% { box-shadow: 0 0 0 26px ${glow}00; } }
      `}</style>
      <div
        style={{
          position: 'relative',
          width: '400px',
          maxWidth: '90vw',
          background: theme.bgDeep,
          border: `1px solid ${glow}`,
          borderRadius: '12px',
          padding: '36px 30px',
          textAlign: 'center',
          overflow: 'hidden',
          boxShadow: `0 0 70px ${glow}40`,
          transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
        }}
      >
        {!granted && (
          <div
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: '90px',
              background: `linear-gradient(180deg, ${theme.warning}22, transparent)`,
              animation: 'rootSweep 1.6s linear infinite',
              pointerEvents: 'none',
            }}
          />
        )}

        <div
          style={{
            fontSize: '46px',
            marginBottom: '16px',
            display: 'inline-block',
            borderRadius: '50%',
            padding: '6px',
            animation: granted ? 'rootGrantPop 0.4s ease' : 'rootPulse 0.85s ease-in-out infinite, rootRing 1.4s ease-out infinite',
          }}
        >
          {granted ? '🔓' : '🔒'}
        </div>

        <div style={{ fontSize: '12px', letterSpacing: '0.3em', color: glow, fontWeight: 'bold', marginBottom: '20px' }}>
          {granted ? 'ACCESS GRANTED' : 'ELEVATING PRIVILEGES'}
        </div>

        <div style={{ fontFamily: 'monospace', fontSize: '13px', color: theme.muted, marginBottom: '10px' }}>
          [sudo] password for admin:
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: '22px', letterSpacing: '0.35em', color: theme.text, minHeight: '30px' }}>
          {'•'.repeat(typed)}
          {!granted && <span className="cursor" />}
        </div>

        {granted && (
          <div style={{ marginTop: '18px', fontSize: '12px', color: theme.success }}>
            Root shell opened.
          </div>
        )}
      </div>
    </div>
  );
}
