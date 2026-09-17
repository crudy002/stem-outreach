import { useTheme } from '../theme.jsx';

// One copyable chip per password-shaped value found in command output.
//
// Every secret gets a chip, including the decoys. In HARD mode that's the
// whole challenge: if only the real password were copyable, the button
// would hand over the answer. `badged` is the difficulty lever — EASY gets
// the superhero flash on the one that actually opens sudo, HARD gets no
// help and has to read the labels.
export function SecretChip({ secret, badged, copied, nudge, onCopy }) {
  const { theme } = useTheme();
  const color = badged ? theme.success : theme.muted;

  return (
    <button
      // Deliberately lets the click bubble: the terminal panel's own
      // onClick refocuses the command input, so copying a password leaves
      // the cursor ready to type `sudo su`.
      onClick={onCopy}
      title={badged ? 'The superuser password — this is the one' : `Copy ${secret.label}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '7px',
        background: badged ? theme.panel2 : 'transparent',
        border: `1px solid ${copied ? theme.success : badged ? theme.success : theme.borderStrong}`,
        color: copied ? theme.success : color,
        padding: '5px 11px',
        fontFamily: 'inherit',
        fontSize: '10px',
        letterSpacing: '0.1em',
        cursor: 'pointer',
        borderRadius: '2px',
        animation: nudge && !copied ? 'pulse-warn 1.3s infinite' : 'none',
      }}
    >
      {badged && <span aria-hidden="true" style={{ fontSize: '13px', lineHeight: 1 }}>🦸</span>}
      <span>
        {copied ? '✓ Copied!' : badged ? 'SUPERUSER PASSWORD' : secret.label}
      </span>
      {!copied && <span aria-hidden="true">📋</span>}
    </button>
  );
}

// Explains why each decoy doesn't matter instead of just labelling it, so
// the message teaches something even though there's nothing to copy.
const DECOY_DESCRIPTIONS = [
  [/wifi/i, 'a wifi password — gets you online, not root'],
  [/db|database/i, 'a database password — opens the database, not sudo'],
  [/api[_-]?key/i, 'an API key — for calling a service, not becoming root'],
  [/old.*root/i, 'an old root password — rotated out, no longer works'],
];

const describeDecoy = (label) =>
  (DECOY_DESCRIPTIONS.find(([pattern]) => pattern.test(label)) || [null, 'a password — not the one that unlocks root'])[1];

// EASY mode's non-copyable stand-in for a decoy chip: naming what it found
// without handing over a value to copy, so clicking through every file
// stops being a viable shortcut to the root password.
export function DecoyReveal({ secret }) {
  const { theme } = useTheme();
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '7px',
        border: `1px dashed ${theme.borderStrong}`,
        color: theme.dim,
        padding: '5px 11px',
        fontFamily: 'inherit',
        fontSize: '10px',
        letterSpacing: '0.05em',
        borderRadius: '2px',
      }}
    >
      <span aria-hidden="true">🔍</span>
      <span>Found {describeDecoy(secret.label)}.</span>
    </div>
  );
}
