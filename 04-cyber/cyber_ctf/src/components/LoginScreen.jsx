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
      <div style={{ background: '#0f1f33', border: '1px solid #1f3354', borderRadius: '4px', padding: '24px' }}>
        <div style={{ fontSize: '11px', color: '#5a7090', letterSpacing: '0.2em', marginBottom: '14px' }}>OPERATION BRIEFING</div>
        <div style={{ fontSize: '13px', lineHeight: '1.7', color: '#c8d4e3', marginBottom: '16px' }}>
          You're a security researcher testing a system that's been flagged as vulnerable. Your mission: gain access, locate sensitive data, and demonstrate full system compromise.
        </div>
        <div style={{ background: '#081320', border: '1px solid #1f3354', padding: '14px', borderRadius: '2px', marginTop: '20px' }}>
          <div style={{ fontSize: '10px', color: '#fbbf24', letterSpacing: '0.2em', marginBottom: '8px' }}>⚠ INTEL DROP</div>
          <div style={{ fontSize: '12px', color: '#8da3c0', lineHeight: '1.6' }}>
            The system administrator was reported to use default credentials. Common defaults include "admin" with the password being a single common word that means... "password".
          </div>
        </div>
        <div style={{ marginTop: '20px', fontSize: '10px', color: '#3a4a66', lineHeight: '1.6' }}>
          <div style={{ color: '#5a7090', letterSpacing: '0.15em', marginBottom: '6px' }}>LESSON</div>
          Default credentials are the #1 cause of breaches in real systems. Always change them.
        </div>
      </div>
    </div>
  );
}
