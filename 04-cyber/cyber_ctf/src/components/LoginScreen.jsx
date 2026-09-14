import { useEffect, useState } from 'react';
import { useTheme } from '../theme.jsx';

export function LoginScreen({
  username, setUsername, password, setPassword, onLogin,
  shake, loginAttempts, passwordInputRef, authButtonRef,
  stickyUsername, stickyPassword,
}) {
  const { theme } = useTheme();
  const [flipped, setFlipped] = useState(false);
  // The idle wobble is an invitation; it stops the moment they engage, so a
  // note they've already touched doesn't keep twitching at them.
  const [nudging, setNudging] = useState(true);
  // Nobody should stall at the login screen because they didn't read the
  // note as turnable — there's a queue behind them at the booth. Any real
  // interaction disarms this; otherwise the note turns itself over.
  const [autoFlipArmed, setAutoFlipArmed] = useState(true);

  useEffect(() => {
    if (!autoFlipArmed) return;
    const timer = setTimeout(() => {
      setFlipped(true);
      setAutoFlipArmed(false);
      setNudging(false);
    }, 8000);
    return () => clearTimeout(timer);
  }, [autoFlipArmed]);

  // Two wrong guesses is the other signal that the hint hasn't landed.
  useEffect(() => {
    if (loginAttempts >= 2) {
      setFlipped(true);
      setAutoFlipArmed(false);
      setNudging(false);
    }
  }, [loginAttempts]);

  // Hover only quiets the wobble. A mouse brushing past the note is not
  // evidence the player understood it, so the auto-flip stays armed until
  // they actually turn it over.
  const quiet = () => setNudging(false);
  const flip = () => {
    setNudging(false);
    setAutoFlipArmed(false);
    setFlipped((f) => !f);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
      <style>{`
        /* The tilt and the 3D space live on the wrapper. Leaving the -3deg
           on the flipping element itself composes with the rotateY and the
           note visibly skews halfway through the turn. */
        .sticky-wrap {
          perspective: 900px;
          transform: rotate(-3deg);
          transition: transform 0.2s ease;
          background: transparent;
          border: none;
          padding: 0;
          cursor: pointer;
        }
        .sticky-wrap.is-nudging { animation: sticky-nudge 4.5s ease-in-out infinite; }
        .sticky-wrap:hover, .sticky-wrap:focus-visible { transform: rotate(-3deg) translateY(-4px) scale(1.03); }
        .sticky-wrap:focus-visible { outline: 2px solid ${theme.accent}; outline-offset: 6px; }

        .sticky-flip {
          display: grid;
          width: 190px;
          transform-style: preserve-3d;
          transition: transform 0.55s cubic-bezier(0.2, 0.8, 0.3, 1.1);
        }
        .sticky-flip.is-flipped { transform: rotateY(180deg); }

        /* Both faces share one grid cell, so the note auto-sizes to the
           taller of the two instead of needing a hard-coded height. */
        .sticky-face {
          grid-area: 1 / 1;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          padding: 16px 20px;
          box-sizing: border-box;
          font-family: "Comic Sans MS", "Marker Felt", cursive;
          color: #3a3320;
          text-align: center;
          line-height: 1.5;
          box-shadow: 3px 4px 10px rgba(0, 0, 0, 0.4);
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        /* Deeper yellow on the back: two identical faces make the flip read
           as a rendering glitch rather than as paper. */
        .sticky-front { background: #fef3a3; position: relative; }
        .sticky-back { background: #f4e585; transform: rotateY(180deg); }

        /* A lifted corner beats any written label — it survives the reading
           level and language spread you get at a K-12 booth. */
        .sticky-peel {
          position: absolute;
          right: 0;
          bottom: 0;
          width: 22px;
          height: 22px;
          background: linear-gradient(135deg, transparent 0 50%, #ded07c 50%, #c6b862 100%);
          box-shadow: -2px -2px 5px rgba(0, 0, 0, 0.14) inset;
          transition: width 0.2s ease, height 0.2s ease;
        }
        .sticky-wrap:hover .sticky-peel, .sticky-wrap:focus-visible .sticky-peel { width: 36px; height: 36px; }

        @keyframes sticky-nudge {
          0%, 86%, 100% { transform: rotate(-3deg); }
          89% { transform: rotate(-8deg); }
          92% { transform: rotate(1deg); }
          95% { transform: rotate(-5deg); }
          98% { transform: rotate(-2deg); }
        }

        @media (prefers-reduced-motion: reduce) {
          .sticky-wrap.is-nudging { animation: none; }
          .sticky-flip { transition: none; }
          .sticky-peel { transition: none; }
        }
      `}</style>
      <div style={{
        background: theme.panel,
        border: `1px solid ${theme.border}`,
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
          <div style={{ fontSize: '11px', letterSpacing: '0.3em', color: theme.muted, marginBottom: '6px' }}>SECURE TERMINAL</div>
          <div style={{ fontSize: '20px', color: theme.accent, letterSpacing: '0.1em' }}>AUTHENTICATION REQUIRED</div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '10px', color: theme.muted, letterSpacing: '0.2em', marginBottom: '6px' }}>USERNAME</div>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onLogin();
              else if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); passwordInputRef.current?.focus(); }
            }}
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
          <div style={{ fontSize: '10px', color: theme.muted, letterSpacing: '0.2em', marginBottom: '6px' }}>PASSWORD</div>
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

        <button
          ref={authButtonRef}
          onClick={onLogin}
          style={{
            width: '100%',
            background: `linear-gradient(180deg, ${theme.panel2} 0%, ${theme.panel} 100%)`,
            border: `1px solid ${theme.accent}`,
            color: theme.accent,
            padding: '14px',
            fontFamily: 'inherit',
            fontSize: '13px',
            letterSpacing: '0.2em',
            fontWeight: 'bold',
            cursor: 'pointer',
            borderRadius: '2px',
            outline: 'none',
          }}
          onFocus={(e) => { e.target.style.borderColor = theme.success; e.target.style.boxShadow = `0 0 0 2px ${theme.successGlow}`; }}
          onBlur={(e) => { e.target.style.borderColor = theme.accent; e.target.style.boxShadow = 'none'; }}
        >
          ▶ AUTHENTICATE
        </button>

        {loginAttempts > 0 && (
          <div style={{ marginTop: '14px', textAlign: 'center', color: theme.danger, fontSize: '11px', letterSpacing: '0.15em' }}>
            ✕ ACCESS DENIED // ATTEMPT {loginAttempts}
          </div>
        )}
      </div>

      {/* Hint panel */}
      <div style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: '4px', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ fontSize: '11px', color: theme.muted, letterSpacing: '0.2em', marginBottom: '14px', alignSelf: 'flex-start' }}>OPERATION BRIEFING</div>
        <div style={{ fontSize: '13px', lineHeight: '1.7', color: theme.text, marginBottom: '8px', alignSelf: 'flex-start' }}>
          This system's been flagged as vulnerable. Get in, find the data, prove it.
        </div>

        <div style={{ fontSize: '10px', color: theme.muted, letterSpacing: '0.1em', marginTop: '18px', marginBottom: '12px' }}>
          someone left this on the desk...
        </div>

        <button
          type="button"
          className={`sticky-wrap${nudging ? ' is-nudging' : ''}`}
          onClick={flip}
          onMouseEnter={quiet}
          aria-pressed={flipped}
          aria-label={flipped ? 'Sticky note, turned over' : 'Sticky note, face down. Turn it over.'}
        >
          <div className={`sticky-flip${flipped ? ' is-flipped' : ''}`}>
            <div className="sticky-face sticky-front" aria-hidden={flipped}>
              <div style={{ fontSize: '17px' }}>passwords</div>
              <div style={{ fontSize: '11px', marginTop: '6px', opacity: 0.65 }}>do not lose!!</div>
              <span className="sticky-peel" />
            </div>
            <div className="sticky-face sticky-back" aria-hidden={!flipped}>
              <div style={{ fontSize: '16px' }}>{stickyUsername}<br/>{stickyPassword}</div>
              <div style={{ fontSize: '10px', marginTop: '10px', opacity: 0.75 }}>— shh, don't tell IT 🤫</div>
            </div>
          </div>
        </button>

        <div style={{ marginTop: '14px', fontSize: '10px', color: theme.muted, letterSpacing: '0.1em', height: '12px' }}>
          {!flipped && 'tap to turn it over'}
        </div>

        <div style={{ marginTop: '6px', fontSize: '10px', color: theme.dim, textAlign: 'center' }}>
          Sticky notes are how real breaches start.
        </div>
      </div>
    </div>
  );
}
