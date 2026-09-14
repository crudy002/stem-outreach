import { useTheme } from '../theme.jsx';

export function HackedScreen({ elapsedSeconds, submitStatus, assisted, rank, modeName, onViewLeaderboard, onReset }) {
  const { theme } = useTheme();
  return (
    <div style={{
      background: `radial-gradient(circle at center, ${theme.hackedStart} 0%, ${theme.bg} 100%)`,
      border: `1px solid ${theme.danger}`,
      borderRadius: '4px',
      padding: '60px 32px',
      minHeight: '480px',
      textAlign: 'center',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: '2px',
        background: `linear-gradient(90deg, transparent, ${theme.danger}, transparent)`,
        animation: 'scan-red 2s linear infinite',
      }}></div>

      <div style={{ fontSize: '14px', color: theme.danger, letterSpacing: '0.4em', marginBottom: '20px', animation: 'pulse-warn 1s infinite' }}>
        ⚠ ⚠ ⚠ SYSTEM COMPROMISED ⚠ ⚠ ⚠
      </div>

      <div style={{ fontSize: '64px', fontWeight: 'bold', color: theme.danger, letterSpacing: '0.08em', marginBottom: '16px', animation: 'glitch 0.4s infinite' }}>
        P0WNED
      </div>

      <div style={{ fontSize: '14px', color: theme.text, maxWidth: '520px', margin: '0 auto 32px', lineHeight: '1.7' }}>
        You successfully chained a default credential, exposed secret, and privilege escalation into full system compromise.
      </div>

      <div style={{ background: theme.bgDeep, border: `1px solid ${theme.borderStrong}`, padding: '20px', maxWidth: '520px', margin: '0 auto', textAlign: 'left', borderRadius: '2px' }}>
        <div style={{ fontSize: '11px', color: theme.success, letterSpacing: '0.2em', marginBottom: '12px' }}>FLAG CAPTURED</div>
        <div style={{ fontSize: '14px', color: theme.accent, fontFamily: 'monospace', marginBottom: '16px' }}>ctf{'{'}d3f4ult_cr3d5_c0nf1g_l34k_pwn3d{'}'}</div>

        <div style={{ fontSize: '11px', color: theme.muted, letterSpacing: '0.2em', marginBottom: '8px' }}>WHAT YOU LEARNED</div>
        <div style={{ fontSize: '12px', color: theme.text2, lineHeight: '1.7' }}>
          Default creds → leaked secrets → unchecked privileges = full compromise.<br/>
          Defense in depth would've stopped you at any one of those steps.
        </div>

        <div style={{ borderTop: `1px solid ${theme.border}`, marginTop: '16px', paddingTop: '16px' }}>
          <div style={{ fontSize: '11px', color: theme.muted, letterSpacing: '0.2em', marginBottom: '8px' }}>YOUR TIME</div>
          <div style={{ fontSize: '18px', color: theme.success, fontFamily: 'monospace' }}>
            {elapsedSeconds !== null ? `${elapsedSeconds.toFixed(1)}s` : '—'}
          </div>
          <div style={{ fontSize: '11px', color: theme.text2, marginTop: '6px' }}>
            {assisted && '📡 Backup-assisted run — not eligible for the leaderboard.'}
            {!assisted && submitStatus === 'submitting' && 'Submitting to leaderboard…'}
            {!assisted && submitStatus === 'done' && rank && `Ranked #${rank} on the ${modeName} leaderboard`}
            {!assisted && submitStatus === 'error' && 'Could not reach the leaderboard server — score not recorded.'}
          </div>
          <button
            onClick={onViewLeaderboard}
            style={{ marginTop: '10px', background: 'transparent', border: `1px solid ${theme.borderStrong}`, color: theme.accent, padding: '8px 16px', fontFamily: 'inherit', fontSize: '11px', letterSpacing: '0.15em', cursor: 'pointer', borderRadius: '2px' }}
          >
            🏆 VIEW LEADERBOARD
          </button>
        </div>
      </div>

      <button
        onClick={onReset}
        style={{
          marginTop: '32px',
          background: 'transparent',
          border: `1px solid ${theme.accent}`,
          color: theme.accent,
          padding: '12px 32px',
          fontFamily: 'inherit',
          fontSize: '12px',
          letterSpacing: '0.2em',
          cursor: 'pointer',
          borderRadius: '2px',
        }}
      >
        ▶ NEW SESSION
      </button>
    </div>
  );
}
