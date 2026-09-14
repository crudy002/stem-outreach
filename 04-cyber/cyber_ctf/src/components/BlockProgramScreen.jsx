import { useEffect, useState } from 'react';
import { SecretChip } from './SecretChip';
import { useTheme } from '../theme.jsx';

// ROOKIE mode: big, colorful blocks that fire immediately on tap (no
// build-a-queue-then-run step). Three things layer on top of that base loop:
//  - Every file teaches a short lesson when peeked, not just the one with
//    the password, so wrong taps still pay off and the sidebar always has
//    something specific to show ("visibility"). The lesson text now travels
//    with the file itself, because the password's file moves between runs.
//  - Several files hold decoy secrets. The 🦸 superhero badge marks the one
//    that actually works, so the decoys add texture without stranding a
//    six-year-old.
//  - Reaching root requires a one-time access code that's shown briefly and
//    then hidden, so repeat booth visitors who've memorized "which box to
//    click" still have to actually pay attention at the end, not just recall
//    a click pattern.

const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

const generateAccessCode = () => {
  const code = 100 + Math.floor(Math.random() * 900);
  const decoys = new Set();
  while (decoys.size < 2) {
    const d = 100 + Math.floor(Math.random() * 900);
    if (d !== code) decoys.add(d);
  }
  return { code, options: shuffle([code, ...decoys]) };
};

export function BlockProgramScreen({ terminal }) {
  const { theme } = useTheme();
  const { fileTree, lessonFor, terminalOutput, foundCreds, copiedValue, hasCopiedRoot, terminalRef, copyToClipboard } = terminal;
  const [chain, setChain] = useState([]);
  const [lastLesson, setLastLesson] = useState(null);
  const [accessCode, setAccessCode] = useState(null); // { code, options, revealed }
  const [wrongPick, setWrongPick] = useState(false);

  const executedPaths = new Set(chain.filter((b) => b.kind === 'read').map((b) => b.path));
  const unlockDone = chain.some((b) => b.kind === 'unlock');

  useEffect(() => {
    if (foundCreds && !accessCode) {
      const generated = generateAccessCode();
      setAccessCode({ ...generated, revealed: true });
      setTimeout(() => setAccessCode((prev) => (prev ? { ...prev, revealed: false } : prev)), 5000);
    }
  }, [foundCreds, accessCode]);

  const runFile = (node) => {
    if (executedPaths.has(node.path)) return;
    terminal.viewFile(node.path);
    setChain((prev) => [...prev, { kind: 'read', path: node.path, name: node.name }]);
    setLastLesson(lessonFor(node.path));
  };

  const peekCode = () => {
    setAccessCode((prev) => (prev ? { ...prev, revealed: true } : prev));
    setTimeout(() => setAccessCode((prev) => (prev ? { ...prev, revealed: false } : prev)), 3000);
  };

  const pickCode = (value) => {
    if (!accessCode) return;
    if (value === accessCode.code) {
      terminal.unlockRoot();
      setChain((prev) => [...prev, { kind: 'unlock', name: 'Unlock root' }]);
    } else {
      setWrongPick(true);
      peekCode();
      setTimeout(() => setWrongPick(false), 1600);
    }
  };

  const rootLevelNodes = Object.values(fileTree.children);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px' }}>
      <style>{`
        .rookie-block { transition: transform 0.1s ease; }
        .rookie-block:active:not(:disabled) { transform: scale(0.95); }
        @keyframes popIn { from { transform: scale(0.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .rookie-chain-item { animation: popIn 0.25s ease; }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Step 1: explore files */}
        <div style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: '8px', padding: '18px' }}>
          <div style={{ fontSize: '13px', color: theme.accent, letterSpacing: '0.1em', marginBottom: '4px', fontWeight: 'bold' }}>🧩 STEP 1 — EXPLORE THE FILES</div>
          <div style={{ fontSize: '11px', color: theme.text2, marginBottom: '14px' }}>Tap a block to peek inside. Lots of them hide a secret — only one is the 🦸 superuser password.</div>

          <div style={{ maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px', alignItems: 'start' }}>
              {rootLevelNodes.map((node) =>
                node.type === 'file' ? (
                  <FileBlock key={node.path} node={node} done={executedPaths.has(node.path)} onClick={() => runFile(node)} />
                ) : (
                  <FolderCells key={node.path} node={node} executedPaths={executedPaths} onRun={runFile} />
                )
              )}
            </div>
          </div>
        </div>

        {/* Step 2: final access-code gate */}
        <div style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: '8px', padding: '18px', opacity: foundCreds ? 1 : 0.5 }}>
          <div style={{ fontSize: '13px', color: theme.warning, letterSpacing: '0.1em', marginBottom: '4px', fontWeight: 'bold' }}>🔐 STEP 2 — FINAL ACCESS CODE</div>

          {!foundCreds && (
            <div style={{ fontSize: '11px', color: theme.dim, marginTop: '8px' }}>Locked — find the password first.</div>
          )}

          {foundCreds && !unlockDone && accessCode && (
            <div style={{ marginTop: '10px' }}>
              <div style={{ fontSize: '11px', color: theme.text2, marginBottom: '10px' }}>
                {wrongPick ? "Not quite — here's the code again, watch closely!" : 'Memorize this code, then pick it below to authorize root access.'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
                <div
                  style={{
                    fontSize: '28px', fontWeight: 'bold', letterSpacing: '0.2em', fontFamily: 'monospace',
                    color: accessCode.revealed ? theme.warning : theme.dim,
                    filter: accessCode.revealed ? 'none' : 'blur(6px)',
                    padding: '6px 18px', background: theme.bgDeep, border: `2px solid ${theme.warning}`, borderRadius: '8px',
                    userSelect: 'none',
                  }}
                >
                  {accessCode.code}
                </div>
                {!accessCode.revealed && (
                  <button onClick={peekCode} className="rookie-block" style={{ background: 'transparent', border: `1px solid ${theme.borderStrong}`, color: theme.muted, padding: '8px 12px', fontFamily: 'inherit', fontSize: '11px', cursor: 'pointer', borderRadius: '6px' }}>
                    👀 Peek again
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                {accessCode.options.map((opt) => (
                  <button
                    key={opt}
                    className="rookie-block"
                    onClick={() => pickCode(opt)}
                    style={{
                      flex: 1, background: theme.bgDeep, border: `2px solid ${theme.accent}`, color: theme.text,
                      padding: '14px', fontFamily: 'monospace', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', borderRadius: '8px',
                    }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {unlockDone && (
            <div style={{ marginTop: '10px', fontSize: '13px', color: theme.success, fontWeight: 'bold' }}>✅ Root access granted!</div>
          )}
        </div>

        {/* Activity feed: mission chain + raw terminal, one bounded panel */}
        <div ref={terminalRef} style={{ background: theme.bgDeep, border: `1px solid ${theme.border}`, borderRadius: '8px', padding: '16px', height: '180px', overflowY: 'auto' }}>
          <div style={{ fontSize: '10px', color: theme.muted, letterSpacing: '0.2em', marginBottom: '10px' }}>🖥 WHAT THE COMPUTER SEES</div>

          {chain.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
              {chain.map((block, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {i > 0 && <span style={{ color: theme.dim }}>→</span>}
                  <div className="rookie-chain-item" style={{ display: 'flex', alignItems: 'center', gap: '6px', border: `2px solid ${block.kind === 'unlock' ? theme.warning : theme.success}`, borderRadius: '20px', padding: '4px 12px', fontSize: '11px', color: theme.text }}>
                    <span>{block.kind === 'unlock' ? '🔓' : '✅'}</span>
                    <span>{block.kind === 'unlock' ? 'Unlock root' : block.name}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ fontSize: '12px', lineHeight: '1.7', color: theme.text2, whiteSpace: 'pre-wrap' }}>
            {terminalOutput.length === 0 && <div style={{ color: theme.dim }}>Nothing yet — start tapping blocks!</div>}
            {terminalOutput.map((line, i) => (
              <div key={i} style={{ color: line.type === 'cmd' ? theme.accent : theme.text2, marginBottom: line.type === 'out' ? '8px' : '0' }}>
                {line.text}
                {line.secrets?.length > 0 && (
                  <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {line.secrets.map((secret) => (
                      <SecretChip
                        key={secret.value}
                        secret={secret}
                        badged={secret.isRoot}
                        copied={copiedValue === secret.value}
                        nudge={secret.isRoot && !hasCopiedRoot}
                        onCopy={() => copyToClipboard(secret.value)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontSize: '11px', color: theme.muted, letterSpacing: '0.2em', marginBottom: '12px' }}>OBJECTIVES</div>
          <div style={{ fontSize: '12px', lineHeight: '1.8' }}>
            <div style={{ color: foundCreds ? theme.success : theme.text }}>{foundCreds ? '✓' : '◯'} Find the 🦸 superuser password</div>
            <div style={{ color: unlockDone ? theme.success : foundCreds ? theme.warning : theme.dim }}>{unlockDone ? '✓' : '◯'} Enter the access code to unlock root</div>
          </div>
        </div>

        <div style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontSize: '11px', color: theme.warning, letterSpacing: '0.2em', marginBottom: '10px' }}>💡 LESSON LEARNED</div>
          <div style={{ fontSize: '12px', color: theme.text2, lineHeight: '1.6' }}>
            {lastLesson || 'Tap a file block to find out what it teaches.'}
          </div>
        </div>
      </div>
    </div>
  );
}

function FolderCells({ node, executedPaths, onRun }) {
  const { theme } = useTheme();
  const children = Object.values(node.children);
  return (
    <>
      <div style={{ gridColumn: '1 / -1', fontSize: '11px', color: theme.muted, letterSpacing: '0.1em', marginTop: '6px' }}>📁 {node.name}/</div>
      {children.map((child) => (
        <FileBlock key={child.path} node={child} done={executedPaths.has(child.path)} onClick={() => onRun(child)} />
      ))}
    </>
  );
}

function FileBlock({ node, done, onClick }) {
  const { theme } = useTheme();
  return (
    <button
      className="rookie-block"
      onClick={onClick}
      disabled={done}
      style={{
        background: done ? theme.panel2 : theme.bgDeep,
        border: `2px solid ${done ? theme.success : theme.accent}`,
        color: done ? theme.success : theme.text,
        padding: '12px 14px', fontFamily: 'inherit', cursor: done ? 'default' : 'pointer',
        borderRadius: '10px', textAlign: 'left', minHeight: '60px', width: '100%', boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px',
        boxShadow: done ? 'none' : `0 3px 0 ${theme.borderStrong}`,
      }}
    >
      <div style={{ fontSize: '13px', fontWeight: 'bold' }}>{done ? '✅' : '📄'} {node.name}</div>
      <div style={{ fontSize: '9px', color: theme.dim, fontFamily: 'monospace' }}>cat {node.path}</div>
    </button>
  );
}
