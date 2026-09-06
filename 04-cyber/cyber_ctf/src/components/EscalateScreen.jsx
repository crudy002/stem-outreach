import { useState } from 'react';
import { LogsOverlay } from './LogsOverlay';
import { ExfilOverlay } from './ExfilOverlay';
import { DeployOverlay } from './DeployOverlay';

export function EscalateScreen({ onInject }) {
  const [activePanel, setActivePanel] = useState(null); // null | 'logs' | 'exfil' | 'inject'

  return (
    <div style={{ background: '#081320', border: '1px solid #1f3354', borderRadius: '4px', padding: '32px', minHeight: '480px' }}>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div style={{ fontSize: '11px', color: '#fbbf24', letterSpacing: '0.3em', marginBottom: '8px' }}>⚠ ROOT ACCESS GRANTED ⚠</div>
        <div style={{ fontSize: '22px', color: '#5b9bd5', letterSpacing: '0.1em' }}>ELEVATED TERMINAL</div>
      </div>

      <div style={{ background: '#0f1f33', border: '1px solid #2a4870', padding: '14px', borderRadius: '2px', marginBottom: '24px', fontSize: '12.5px', color: '#c8d4e3' }}>
        <div style={{ color: '#4ade80' }}># whoami</div>
        <div style={{ marginBottom: '8px' }}>root</div>
        <div style={{ color: '#4ade80' }}># id</div>
        <div>uid=0(root) gid=0(root) groups=0(root)</div>
      </div>

      <div style={{ marginBottom: '20px', fontSize: '13px', color: '#c8d4e3', textAlign: 'center', lineHeight: '1.6' }}>
        You now have full system access. Choose your final action:
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', maxWidth: '720px', margin: '0 auto' }}>
        <ActionButton label="VIEW LOGS" sub="Read-only inspection" color="#8da3c0" onClick={() => setActivePanel('logs')} />
        <ActionButton label="DOWNLOAD DATA" sub="Exfiltrate sensitive files" color="#fbbf24" onClick={() => setActivePanel('exfil')} />
        <ActionButton label="INJECT PAYLOAD" sub="Deploy malicious code" color="#ef4444" pulse onClick={() => setActivePanel('inject')} />
      </div>

      <div style={{ marginTop: '32px', fontSize: '11px', color: '#5a7090', textAlign: 'center', lineHeight: '1.6' }}>
        In a real engagement, defenders would see this activity in logs.<br/>
        Detection &gt; Prevention &gt; Response — that's why monitoring matters.
      </div>

      {activePanel === 'logs' && <LogsOverlay onClose={() => setActivePanel(null)} />}
      {activePanel === 'exfil' && <ExfilOverlay onClose={() => setActivePanel(null)} />}
      {activePanel === 'inject' && <DeployOverlay onComplete={onInject} />}
    </div>
  );
}

function ActionButton({ label, sub, color, onClick, pulse }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? color : 'transparent',
        border: `1px solid ${color}`,
        color: hover ? '#0a1628' : color,
        padding: '20px 14px',
        fontFamily: 'inherit',
        cursor: 'pointer',
        borderRadius: '2px',
        textAlign: 'center',
        animation: pulse && !hover ? 'pulse-warn 1.5s infinite' : 'none',
        transition: 'all 0.15s',
      }}
    >
      <div style={{ fontSize: '13px', fontWeight: 'bold', letterSpacing: '0.15em', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '10px', opacity: 0.7 }}>{sub}</div>
    </button>
  );
}
