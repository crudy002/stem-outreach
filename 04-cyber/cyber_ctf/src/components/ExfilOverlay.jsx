import { useEffect, useState } from 'react';

const FILES = [
  { name: 'config/credentials.txt', size: 1 },
  { name: 'backup/private_keys.tar.gz', size: 3 },
  { name: 'financial_q3_report.xlsx', size: 12 },
  { name: 'customer_ssn_export.csv', size: 46 },
  { name: 'employee_records.db', size: 128 },
];
const TOTAL = FILES.reduce((sum, f) => sum + f.size, 0);
const THRESHOLDS = FILES.reduce((acc, f) => {
  const prev = acc.length ? acc[acc.length - 1] : 0;
  acc.push(prev + (f.size / TOTAL) * 100);
  return acc;
}, []);

export function ExfilOverlay({ onClose }) {
  const [progress, setProgress] = useState(0);
  const done = progress >= 100;

  useEffect(() => {
    if (done) return;
    const interval = setInterval(() => {
      setProgress((p) => Math.min(100, p + 2 + Math.random() * 3));
    }, 120);
    return () => clearInterval(interval);
  }, [done]);

  const doneCount = THRESHOLDS.filter((t) => progress >= t).length;

  return (
    <div
      onClick={done ? onClose : undefined}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(4, 9, 18, 0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: '#0f1f33', border: `1px solid ${done ? '#ef4444' : '#2a4870'}`, borderRadius: '4px', padding: '24px', width: '480px', maxWidth: '92vw' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div style={{ fontSize: '13px', color: '#fbbf24', letterSpacing: '0.15em' }}>⇩ EXFILTRATING DATA</div>
          {done && <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#5a7090', fontSize: '16px', cursor: 'pointer' }}>✕</button>}
        </div>

        <div style={{ marginBottom: '16px' }}>
          {FILES.map((f, i) => {
            const isDone = i < doneCount;
            const isActive = i === doneCount && !done;
            return (
              <div key={f.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '12px', color: isDone ? '#4ade80' : isActive ? '#5b9bd5' : '#3a4a66' }}>
                <span>{isDone ? '✓' : isActive ? '↓' : '·'} {f.name}</span>
                <span style={{ fontFamily: 'monospace' }}>{f.size}MB{isActive ? '…' : ''}</span>
              </div>
            );
          })}
        </div>

        <div style={{ height: '10px', background: '#081320', border: '1px solid #1f3354', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${progress}%`,
            background: done ? '#ef4444' : 'linear-gradient(90deg, #fbbf24, #ef4444)',
            transition: 'width 0.12s linear',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '10px', color: '#5a7090', letterSpacing: '0.1em' }}>
          <span>{Math.round(progress)}%</span>
          <span>{TOTAL}MB TOTAL</span>
        </div>

        {done && (
          <div style={{ marginTop: '20px', borderTop: '1px solid #2a4870', paddingTop: '16px' }}>
            <div style={{ fontSize: '12px', color: '#ef4444', letterSpacing: '0.15em', marginBottom: '8px', animation: 'pulse-warn 1.2s infinite' }}>
              ⚠ DLP ALERT — SOC NOTIFIED
            </div>
            <div style={{ fontSize: '11.5px', color: '#8da3c0', lineHeight: '1.6' }}>
              {TOTAL}MB gone before anyone read the alert. Exfil beats detection every time.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
