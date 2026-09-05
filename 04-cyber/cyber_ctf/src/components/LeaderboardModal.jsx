export function LeaderboardModal({ scores, error, onRefresh, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(4, 9, 18, 0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: '#0f1f33', border: '1px solid #2a4870', borderRadius: '4px', padding: '28px', width: '420px', maxWidth: '90vw', maxHeight: '80vh', overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div style={{ fontSize: '14px', color: '#5b9bd5', letterSpacing: '0.15em' }}>🏆 FASTEST TIMES</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#5a7090', fontSize: '16px', cursor: 'pointer' }}>✕</button>
        </div>

        {error && (
          <div style={{ fontSize: '12px', color: '#ef4444', marginBottom: '12px' }}>
            Could not reach the leaderboard server.
          </div>
        )}

        {!error && scores.length === 0 && (
          <div style={{ fontSize: '12px', color: '#8da3c0' }}>No runs recorded yet — be the first!</div>
        )}

        {!error && scores.length > 0 && (
          <div style={{ fontSize: '13px', color: '#c8d4e3' }}>
            {scores.map((s) => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #152942' }}>
                <span>#{s.rank} {s.player_name}</span>
                <span style={{ color: '#4ade80', fontFamily: 'monospace' }}>{s.elapsed_seconds.toFixed(1)}s</span>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={onRefresh}
          style={{ marginTop: '18px', width: '100%', background: 'transparent', border: '1px solid #2a4870', color: '#5a7090', padding: '10px', fontFamily: 'inherit', fontSize: '11px', letterSpacing: '0.15em', cursor: 'pointer', borderRadius: '2px' }}
        >
          ↻ REFRESH
        </button>
      </div>
    </div>
  );
}
