import { useState } from 'react';
import { LogsOverlay } from './LogsOverlay';
import { ExfilOverlay } from './ExfilOverlay';
import { DeployOverlay } from './DeployOverlay';
import { useTheme } from '../theme.jsx';

export function EscalateScreen({ onInject, flagPath }) {
  const { theme } = useTheme();
  const [activePanel, setActivePanel] = useState(null); // null | 'logs' | 'exfil' | 'inject'

  return (
    <div style={{ background: theme.bgDeep, border: `1px solid ${theme.border}`, borderRadius: '4px', padding: '32px', minHeight: '480px' }}>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div style={{ fontSize: '11px', color: theme.warning, letterSpacing: '0.3em', marginBottom: '8px' }}>⚠ ROOT ACCESS GRANTED ⚠</div>
        <div style={{ fontSize: '22px', color: theme.accent, letterSpacing: '0.1em' }}>ELEVATED TERMINAL</div>
      </div>

      <div style={{ background: theme.panel, border: `1px solid ${theme.borderStrong}`, padding: '14px', borderRadius: '2px', marginBottom: '24px', fontSize: '12.5px', color: theme.text }}>
        <div style={{ color: theme.success }}># whoami</div>
        <div style={{ marginBottom: '8px' }}>root</div>
        <div style={{ color: theme.success }}># id</div>
        <div>uid=0(root) gid=0(root) groups=0(root)</div>
      </div>

      <div style={{ marginBottom: '20px', fontSize: '13px', color: theme.text, textAlign: 'center', lineHeight: '1.6' }}>
        You now have full system access. Choose your final action:
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', maxWidth: '720px', margin: '0 auto' }}>
        <ActionButton label="VIEW LOGS" sub="Read-only inspection" color={theme.text2} onClick={() => setActivePanel('logs')} />
        <ActionButton label="DOWNLOAD DATA" sub="Exfiltrate sensitive files" color={theme.warning} onClick={() => setActivePanel('exfil')} />
        <ActionButton label="INJECT PAYLOAD" sub="Deploy malicious code" color={theme.danger} pulse onClick={() => setActivePanel('inject')} />
      </div>

      <div style={{ marginTop: '32px', fontSize: '11px', color: theme.muted, textAlign: 'center', lineHeight: '1.6' }}>
        In a real engagement, defenders would see this activity in logs.<br/>
        Detection &gt; Prevention &gt; Response — that's why monitoring matters.
      </div>

      {activePanel === 'logs' && <LogsOverlay onClose={() => setActivePanel(null)} flagPath={flagPath} />}
      {activePanel === 'exfil' && <ExfilOverlay onClose={() => setActivePanel(null)} flagPath={flagPath} />}
      {activePanel === 'inject' && <DeployOverlay onComplete={onInject} />}
    </div>
  );
}

function ActionButton({ label, sub, color, onClick, pulse }) {
  const { theme } = useTheme();
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? color : 'transparent',
        border: `1px solid ${color}`,
        color: hover ? theme.onAccent : color,
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
