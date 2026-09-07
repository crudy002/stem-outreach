export function HackedScreen({ elapsedSeconds, submitStatus, assisted, rank, onViewLeaderboard, onReset }) {
  return (
    <div style={{
      background: 'radial-gradient(circle at center, #1a0408 0%, #0a1628 100%)',
      border: '1px solid #ef4444',
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
        background: 'linear-gradient(90deg, transparent, #ef4444, transparent)',
        animation: 'scan-red 2s linear infinite',
      }}></div>

      <div style={{ fontSize: '14px', color: '#ef4444', letterSpacing: '0.4em', marginBottom: '20px', animation: 'pulse-warn 1s infinite' }}>
        ⚠ ⚠ ⚠ SYSTEM COMPROMISED ⚠ ⚠ ⚠
      </div>

      <div style={{ fontSize: '64px', fontWeight: 'bold', color: '#ef4444', letterSpacing: '0.08em', marginBottom: '16px', animation: 'glitch 0.4s infinite' }}>
        P0WNED
      </div>

      <div style={{ fontSize: '14px', color: '#c8d4e3', maxWidth: '520px', margin: '0 auto 32px', lineHeight: '1.7' }}>
        You successfully chained a default credential, exposed secret, and privilege escalation into full system compromise.
      </div>

      <div style={{ background: '#081320', border: '1px solid #2a4870', padding: '20px', maxWidth: '520px', margin: '0 auto', textAlign: 'left', borderRadius: '2px' }}>
        <div style={{ fontSize: '11px', color: '#4ade80', letterSpacing: '0.2em', marginBottom: '12px' }}>FLAG CAPTURED</div>
        <div style={{ fontSize: '14px', color: '#5b9bd5', fontFamily: 'monospace', marginBottom: '16px' }}>ctf{'{'}d3f4ult_cr3d5_c0nf1g_l34k_pwn3d{'}'}</div>

        <div style={{ fontSize: '11px', color: '#5a7090', letterSpacing: '0.2em', marginBottom: '8px' }}>WHAT YOU LEARNED</div>
        <div style={{ fontSize: '12px', color: '#8da3c0', lineHeight: '1.7' }}>
          Default creds → leaked secrets → unchecked privileges = full compromise.<br/>
          Defense in depth would've stopped you at any one of those steps.
        </div>

        <div style={{ borderTop: '1px solid #1f3354', marginTop: '16px', paddingTop: '16px' }}>
          <div style={{ fontSize: '11px', color: '#5a7090', letterSpacing: '0.2em', marginBottom: '8px' }}>YOUR TIME</div>
          <div style={{ fontSize: '18px', color: '#4ade80', fontFamily: 'monospace' }}>
            {elapsedSeconds !== null ? `${elapsedSeconds.toFixed(1)}s` : '—'}
          </div>
          <div style={{ fontSize: '11px', color: '#8da3c0', marginTop: '6px' }}>
            {assisted && '📡 Backup-assisted run — not eligible for the leaderboard.'}
            {!assisted && submitStatus === 'submitting' && 'Submitting to leaderboard…'}
            {!assisted && submitStatus === 'done' && rank && `Ranked #${rank} on the leaderboard`}
            {!assisted && submitStatus === 'error' && 'Could not reach the leaderboard server — score not recorded.'}
          </div>
          <button
            onClick={onViewLeaderboard}
            style={{ marginTop: '10px', background: 'transparent', border: '1px solid #2a4870', color: '#5b9bd5', padding: '8px 16px', fontFamily: 'inherit', fontSize: '11px', letterSpacing: '0.15em', cursor: 'pointer', borderRadius: '2px' }}
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
          border: '1px solid #5b9bd5',
          color: '#5b9bd5',
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
