import { useTheme } from '../theme.jsx';

export function StartScreen({
  playerName, setPlayerName, mode, setMode, onBegin, startButtonRef,
  leaderboard = [], leaderboardError = false, onRefreshLeaderboard,
}) {
  const { theme } = useTheme();
  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', maxWidth: '980px', width: '100%' }}>
        <div style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: '4px', padding: '36px' }}>
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <img
              src="/navsea-logo.png"
              alt="NAVSEA NSWC Dahlgren Division — Dam Neck Activity"
              style={{ height: '88px', width: 'auto', display: 'block', margin: '0 auto 20px' }}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <div style={{ fontSize: '11px', letterSpacing: '0.3em', color: theme.muted, marginBottom: '6px' }}>CYBER OPERATIONS RANGE</div>
            <div style={{ fontSize: '20px', color: theme.accent, letterSpacing: '0.1em' }}>MISSION BRIEFING</div>
          </div>

          <div style={{ fontSize: '13px', lineHeight: '1.7', color: theme.text, marginBottom: '20px', textAlign: 'center' }}>
            Enter your callsign to start the clock and get on the leaderboard.
          </div>

          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '10px', color: theme.muted, letterSpacing: '0.2em', marginBottom: '6px' }}>CALLSIGN</div>
            <input
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onBegin();
                else if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); startButtonRef.current?.focus(); }
              }}
              maxLength={40}
              autoFocus
              style={{
                width: '100%',
                background: theme.bgDeep,
                border: `1px solid ${theme.borderStrong}`,
                color: theme.accent,
                padding: '12px 14px',
                fontFamily: 'inherit',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
                borderRadius: '2px',
              }}
              onFocus={(e) => e.target.style.borderColor = theme.accent}
              onBlur={(e) => e.target.style.borderColor = theme.borderStrong}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '10px', color: theme.muted, letterSpacing: '0.2em', marginBottom: '6px' }}>DIFFICULTY</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <ModeButton label="EASY" sub="Guided, click-to-explore" active={mode === 'easy'} onClick={() => setMode('easy')} />
              <ModeButton label="HARD" sub="Type every command" active={mode === 'hard'} onClick={() => setMode('hard')} />
            </div>
          </div>

          <button
            ref={startButtonRef}
            onClick={onBegin}
            style={{
              width: '100%',
              background: `linear-gradient(180deg, ${theme.panel2} 0%, ${theme.panel} 100%)`,
              border: `1px solid ${theme.accent}`,
              color: playerName.trim() ? theme.accent : theme.dim,
              padding: '14px',
              fontFamily: 'inherit',
              fontSize: '13px',
              letterSpacing: '0.2em',
              fontWeight: 'bold',
              cursor: playerName.trim() ? 'pointer' : 'not-allowed',
              borderRadius: '2px',
              outline: 'none',
            }}
            onFocus={(e) => { e.target.style.borderColor = theme.success; e.target.style.boxShadow = `0 0 0 2px ${theme.successGlow}`; }}
            onBlur={(e) => { e.target.style.borderColor = theme.accent; e.target.style.boxShadow = 'none'; }}
          >
            ▶ START MISSION
          </button>
        </div>

        <LeaderboardPanel scores={leaderboard} error={leaderboardError} onRefresh={onRefreshLeaderboard} />
      </div>
    </div>
  );
}

function LeaderboardPanel({ scores, error, onRefresh }) {
  const { theme } = useTheme();
  return (
    <div style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: '4px', padding: '36px', display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', paddingBottom: '18px', borderBottom: `1px solid ${theme.panel2}` }}>
        <div style={{ fontSize: '14px', color: theme.accent, letterSpacing: '0.1em' }}>🏆 TOP OPERATIVES</div>
        <button
          onClick={onRefresh}
          title="Refresh leaderboard"
          style={{ background: 'transparent', border: 'none', color: theme.muted, fontSize: '14px', cursor: 'pointer', lineHeight: 1, padding: '4px' }}
        >
          ↻
        </button>
      </div>

      {error && (
        <div style={{ fontSize: '12px', color: theme.danger, lineHeight: '1.6' }}>
          Could not reach the leaderboard server.
        </div>
      )}

      {!error && scores.length === 0 && (
        <div style={{ fontSize: '12px', color: theme.text2, lineHeight: '1.6' }}>
          No runs recorded yet — be the first!
        </div>
      )}

      {!error && scores.length > 0 && (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: '4px' }}>
          {scores.map((s) => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', padding: '9px 0', borderBottom: `1px solid ${theme.panel2}`, fontSize: '12.5px' }}>
              <span style={{ color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <span style={{ color: theme.muted }}>#{s.rank}</span> {s.player_name}
              </span>
              <span style={{ color: theme.success, fontFamily: 'monospace', flexShrink: 0 }}>{s.elapsed_seconds.toFixed(1)}s</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ModeButton({ label, sub, active, onClick }) {
  const { theme } = useTheme();
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? theme.panel2 : 'transparent',
        border: `1px solid ${active ? theme.accent : theme.borderStrong}`,
        color: active ? theme.accent : theme.muted,
        padding: '10px 8px',
        fontFamily: 'inherit',
        cursor: 'pointer',
        borderRadius: '2px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: '12px', fontWeight: 'bold', letterSpacing: '0.15em', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '9px', opacity: 0.8 }}>{sub}</div>
    </button>
  );
}
