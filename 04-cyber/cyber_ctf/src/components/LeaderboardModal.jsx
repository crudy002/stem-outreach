import { useTheme } from '../theme.jsx';
import { MODES, modeLabel } from '../modes';

// One board per difficulty. Tabs browse other modes' times without changing
// the difficulty the next player is set to play — that stays with the start
// screen's picker.
export function LeaderboardModal({ scores, error, onRefresh, boardMode, onSelectMode, onClose }) {
  const { theme } = useTheme();
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: theme.overlay,
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: theme.panel, border: `1px solid ${theme.borderStrong}`, borderRadius: '4px', padding: '28px', width: '420px', maxWidth: '90vw', maxHeight: '80vh', overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ fontSize: '14px', color: theme.accent, letterSpacing: '0.15em' }}>🏆 FASTEST TIMES</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: theme.muted, fontSize: '16px', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${MODES.length}, 1fr)`, gap: '6px', marginBottom: '16px' }}>
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => onSelectMode(m.id)}
              style={{
                background: boardMode === m.id ? theme.panel2 : 'transparent',
                border: `1px solid ${boardMode === m.id ? theme.accent : theme.borderStrong}`,
                color: boardMode === m.id ? theme.accent : theme.muted,
                padding: '7px 4px', fontFamily: 'inherit', fontSize: '10px',
                letterSpacing: '0.15em', cursor: 'pointer', borderRadius: '2px',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {error && (
          <div style={{ fontSize: '12px', color: theme.danger, marginBottom: '12px' }}>
            Could not reach the leaderboard server.
          </div>
        )}

        {!error && scores.length === 0 && (
          <div style={{ fontSize: '12px', color: theme.text2 }}>
            No {modeLabel(boardMode)} runs recorded yet — be the first!
          </div>
        )}

        {!error && scores.length > 0 && (
          <div style={{ fontSize: '13px', color: theme.text }}>
            {scores.map((s) => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${theme.panel2}` }}>
                <span>#{s.rank} {s.player_name}</span>
                <span style={{ color: theme.success, fontFamily: 'monospace' }}>{s.elapsed_seconds.toFixed(1)}s</span>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => onRefresh()}
          style={{ marginTop: '18px', width: '100%', background: 'transparent', border: `1px solid ${theme.borderStrong}`, color: theme.muted, padding: '10px', fontFamily: 'inherit', fontSize: '11px', letterSpacing: '0.15em', cursor: 'pointer', borderRadius: '2px' }}
        >
          ↻ REFRESH
        </button>
      </div>
    </div>
  );
}
