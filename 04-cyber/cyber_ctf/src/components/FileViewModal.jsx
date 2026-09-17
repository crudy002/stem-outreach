import { useTheme } from '../theme.jsx';
import { SecretChip, DecoyReveal } from './SecretChip';

// EASY mode's file popup: clicking a file in the sidebar opens this instead
// of just dropping the contents into the terminal transcript, so kids have
// to actually stop and read (and take a deliberate second click to close it)
// rather than click-chaining through every file in a couple of seconds.
export function FileViewModal({ path, content, secrets, copiedValue, hasCopiedRoot, onCopy, onClose }) {
  const { theme } = useTheme();
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '20px' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: '8px', padding: '20px', width: '480px', maxWidth: '100%', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', gap: '12px' }}>
          <span style={{ fontSize: '12px', color: theme.accent, letterSpacing: '0.05em', fontFamily: 'monospace', wordBreak: 'break-all' }}>📄 {path}</span>
          <button
            onClick={onClose}
            style={{ flexShrink: 0, background: 'transparent', border: `1px solid ${theme.borderStrong}`, color: theme.muted, padding: '4px 10px', fontFamily: 'inherit', fontSize: '11px', cursor: 'pointer', borderRadius: '4px' }}
          >
            ✕ Close
          </button>
        </div>

        <pre style={{ fontSize: '12px', lineHeight: '1.6', color: theme.text, whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit' }}>{content}</pre>

        {secrets.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '14px', paddingTop: '14px', borderTop: `1px solid ${theme.panel2}` }}>
            {secrets.map((secret) =>
              secret.isRoot ? (
                <SecretChip
                  key={secret.value}
                  secret={secret}
                  badged
                  copied={copiedValue === secret.value}
                  nudge={!hasCopiedRoot}
                  onCopy={() => onCopy(secret.value)}
                />
              ) : (
                <DecoyReveal key={secret.value} secret={secret} />
              )
            )}
          </div>
        )}

        <button
          onClick={onClose}
          style={{ marginTop: '16px', width: '100%', background: 'transparent', border: `1px solid ${theme.borderStrong}`, color: theme.accent, padding: '8px', fontFamily: 'inherit', fontSize: '11px', letterSpacing: '0.1em', cursor: 'pointer', borderRadius: '4px' }}
        >
          Got it — back to files
        </button>
      </div>
    </div>
  );
}
