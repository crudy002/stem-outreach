export function StartScreen({ playerName, setPlayerName, mode, setMode, onBegin, startButtonRef }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <div style={{ background: '#0f1f33', border: '1px solid #1f3354', borderRadius: '4px', padding: '36px', maxWidth: '480px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <img
            src="/navsea-logo.png"
            alt="NAVSEA NSWC Dahlgren Division — Dam Neck Activity"
            style={{ height: '88px', width: 'auto', display: 'block', margin: '0 auto 20px' }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          <div style={{ fontSize: '11px', letterSpacing: '0.3em', color: '#5a7090', marginBottom: '6px' }}>CYBER OPERATIONS RANGE</div>
          <div style={{ fontSize: '20px', color: '#5b9bd5', letterSpacing: '0.1em' }}>MISSION BRIEFING</div>
        </div>

        <div style={{ fontSize: '13px', lineHeight: '1.7', color: '#c8d4e3', marginBottom: '20px', textAlign: 'center' }}>
          Enter your callsign to start the clock and get on the leaderboard.
        </div>

        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '10px', color: '#5a7090', letterSpacing: '0.2em', marginBottom: '6px' }}>CALLSIGN</div>
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
              background: '#081320',
              border: '1px solid #2a4870',
              color: '#5b9bd5',
              padding: '12px 14px',
              fontFamily: 'inherit',
              fontSize: '14px',
              outline: 'none',
              boxSizing: 'border-box',
              borderRadius: '2px',
            }}
            onFocus={(e) => e.target.style.borderColor = '#5b9bd5'}
            onBlur={(e) => e.target.style.borderColor = '#2a4870'}
          />
        </div>

        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '10px', color: '#5a7090', letterSpacing: '0.2em', marginBottom: '6px' }}>DIFFICULTY</div>
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
            background: 'linear-gradient(180deg, #152942 0%, #0f1f33 100%)',
            border: '1px solid #5b9bd5',
            color: playerName.trim() ? '#5b9bd5' : '#3a4a66',
            padding: '14px',
            fontFamily: 'inherit',
            fontSize: '13px',
            letterSpacing: '0.2em',
            fontWeight: 'bold',
            cursor: playerName.trim() ? 'pointer' : 'not-allowed',
            borderRadius: '2px',
            outline: 'none',
          }}
          onFocus={(e) => { e.target.style.borderColor = '#4ade80'; e.target.style.boxShadow = '0 0 0 2px rgba(74, 222, 128, 0.4)'; }}
          onBlur={(e) => { e.target.style.borderColor = '#5b9bd5'; e.target.style.boxShadow = 'none'; }}
        >
          ▶ START MISSION
        </button>
      </div>
    </div>
  );
}

function ModeButton({ label, sub, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? '#152942' : 'transparent',
        border: `1px solid ${active ? '#5b9bd5' : '#2a4870'}`,
        color: active ? '#5b9bd5' : '#5a7090',
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
