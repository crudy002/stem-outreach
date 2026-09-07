export function LoginScreen({
  username, setUsername, password, setPassword, onLogin,
  shake, loginAttempts, passwordInputRef, authButtonRef,
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
      <div style={{
        background: '#0f1f33',
        border: '1px solid #1f3354',
        borderRadius: '4px',
        padding: '36px',
        animation: shake ? 'shake 0.4s' : 'none',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <img
            src="/navsea-logo.png"
            alt="NAVSEA NSWC Dahlgren Division — Dam Neck Activity"
            style={{ height: '88px', width: 'auto', display: 'block', margin: '0 auto 20px' }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          <div style={{ fontSize: '11px', letterSpacing: '0.3em', color: '#5a7090', marginBottom: '6px' }}>SECURE TERMINAL</div>
          <div style={{ fontSize: '20px', color: '#5b9bd5', letterSpacing: '0.1em' }}>AUTHENTICATION REQUIRED</div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '10px', color: '#5a7090', letterSpacing: '0.2em', marginBottom: '6px' }}>USERNAME</div>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onLogin();
              else if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); passwordInputRef.current?.focus(); }
            }}
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
          <div style={{ fontSize: '10px', color: '#5a7090', letterSpacing: '0.2em', marginBottom: '6px' }}>PASSWORD</div>
          <input
            ref={passwordInputRef}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onLogin();
              else if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); authButtonRef.current?.focus(); }
            }}
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

        <button
          ref={authButtonRef}
          onClick={onLogin}
          style={{
            width: '100%',
            background: 'linear-gradient(180deg, #152942 0%, #0f1f33 100%)',
            border: '1px solid #5b9bd5',
            color: '#5b9bd5',
            padding: '14px',
            fontFamily: 'inherit',
            fontSize: '13px',
            letterSpacing: '0.2em',
            fontWeight: 'bold',
            cursor: 'pointer',
            borderRadius: '2px',
            outline: 'none',
          }}
          onFocus={(e) => { e.target.style.borderColor = '#4ade80'; e.target.style.boxShadow = '0 0 0 2px rgba(74, 222, 128, 0.4)'; }}
          onBlur={(e) => { e.target.style.borderColor = '#5b9bd5'; e.target.style.boxShadow = 'none'; }}
        >
          ▶ AUTHENTICATE
        </button>

        {loginAttempts > 0 && (
          <div style={{ marginTop: '14px', textAlign: 'center', color: '#ef4444', fontSize: '11px', letterSpacing: '0.15em' }}>
            ✕ ACCESS DENIED // ATTEMPT {loginAttempts}
          </div>
        )}
      </div>

      {/* Hint panel */}
      <div style={{ background: '#0f1f33', border: '1px solid #1f3354', borderRadius: '4px', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ fontSize: '11px', color: '#5a7090', letterSpacing: '0.2em', marginBottom: '14px', alignSelf: 'flex-start' }}>OPERATION BRIEFING</div>
        <div style={{ fontSize: '13px', lineHeight: '1.7', color: '#c8d4e3', marginBottom: '8px', alignSelf: 'flex-start' }}>
          This system's been flagged as vulnerable. Get in, find the data, prove it.
        </div>

        <div style={{ fontSize: '10px', color: '#5a7090', letterSpacing: '0.1em', marginTop: '18px', marginBottom: '10px' }}>
          someone left this on the desk...
        </div>
        <div style={{
          background: '#fef3a3',
          color: '#3a3320',
          padding: '16px 20px',
          width: '190px',
          fontFamily: '"Comic Sans MS", "Marker Felt", cursive',
          fontSize: '16px',
          lineHeight: '1.5',
          textAlign: 'center',
          transform: 'rotate(-3deg)',
          boxShadow: '3px 4px 10px rgba(0,0,0,0.4)',
        }}>
          admin<br/>password
          <div style={{ fontSize: '10px', marginTop: '10px', opacity: 0.75 }}>— shh, don't tell IT 🤫</div>
        </div>

        <div style={{ marginTop: '18px', fontSize: '10px', color: '#3a4a66', textAlign: 'center' }}>
          Sticky notes are how real breaches start.
        </div>
      </div>
    </div>
  );
}
