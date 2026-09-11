import { useTheme } from '../theme.jsx';

export function StartScreen({ playerName, setPlayerName, mode, setMode, onBegin, startButtonRef }) {
  const { theme } = useTheme();
  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <div style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: '4px', padding: '36px', maxWidth: '480px', width: '100%' }}>
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
