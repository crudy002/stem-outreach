import { useState } from 'react';
import { FILE_TREE } from '../hooks/useTerminal';
import { useTheme } from '../theme.jsx';

// ROOKIE mode: big, colorful, chunky blocks that fire immediately on tap —
// no separate "build a queue then press run" step, that felt like extra
// homework before anything happened. Each tap both runs the action via
// useTerminal (viewFile/unlockRoot, so mission state stays in sync with the
// other modes) and appends a piece to a growing "mission chain" so kids
// still see a program assembling itself, just without the delay.
export function BlockProgramScreen({ terminal }) {
  const { theme } = useTheme();
  const { FLAG, terminalOutput, foundCreds, copiedFlag, hasCopiedFlag, terminalRef, copyToClipboard } = terminal;
  const [chain, setChain] = useState([]);

  const executedPaths = new Set(chain.filter((b) => b.kind === 'read').map((b) => b.path));
  const unlockDone = chain.some((b) => b.kind === 'unlock');

  const runFile = (node) => {
    if (executedPaths.has(node.path)) return;
    terminal.viewFile(node.path);
    setChain((prev) => [...prev, { kind: 'read', path: node.path, name: node.name, cmd: `cat ${node.path}` }]);
  };

  const runUnlock = () => {
    if (!foundCreds || unlockDone) return;
    terminal.unlockRoot();
    setChain((prev) => [...prev, { kind: 'unlock', name: 'Unlock root', cmd: 'sudo su' }]);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px' }}>
      <style>{`
        .rookie-block { transition: transform 0.1s ease; }
        .rookie-block:active:not(:disabled) { transform: scale(0.95); }
        @keyframes popIn { from { transform: scale(0.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .rookie-chain-item { animation: popIn 0.25s ease; }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: '8px', padding: '20px' }}>
          <div style={{ fontSize: '13px', color: theme.accent, letterSpacing: '0.1em', marginBottom: '16px', fontWeight: 'bold' }}>🧩 MISSION BLOCKS — tap to run</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {Object.values(FILE_TREE.children).map((node) =>
              node.type === 'file' ? (
                <div key={node.path} style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  <FileBlock node={node} done={executedPaths.has(node.path)} onClick={() => runFile(node)} />
                </div>
              ) : (
                <FolderGroup key={node.path} node={node} executedPaths={executedPaths} onRun={runFile} />
              )
            )}
          </div>

          <div style={{ marginTop: '18px', paddingTop: '16px', borderTop: `1px dashed ${theme.borderStrong}` }}>
            <UnlockBlock enabled={foundCreds && !unlockDone} done={unlockDone} onClick={runUnlock} />
          </div>
        </div>

        <div style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: '8px', padding: '18px' }}>
          <div style={{ fontSize: '11px', color: theme.muted, letterSpacing: '0.2em', marginBottom: '12px' }}>YOUR MISSION SO FAR</div>
          {chain.length === 0 ? (
            <div style={{ fontSize: '12px', color: theme.dim }}>Tap a block above to get started.</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
              {chain.map((block, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {i > 0 && <span style={{ color: theme.dim }}>→</span>}
                  <div
                    className="rookie-chain-item"
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px', background: theme.bgDeep,
                      border: `2px solid ${block.kind === 'unlock' ? theme.warning : theme.success}`, borderRadius: '20px',
                      padding: '6px 14px', fontSize: '12px', color: theme.text,
                    }}
                  >
                    <span>{block.kind === 'unlock' ? '🔓' : '✅'}</span>
                    <span>{block.kind === 'unlock' ? 'Unlock root' : block.name}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          ref={terminalRef}
          style={{ background: theme.bgDeep, border: `1px solid ${theme.border}`, borderRadius: '8px', padding: '16px', minHeight: '140px', maxHeight: '200px', overflowY: 'auto' }}
        >
          <div style={{ fontSize: '10px', color: theme.muted, letterSpacing: '0.2em', marginBottom: '8px' }}>🖥 WHAT THE COMPUTER SEES</div>
          <div style={{ fontSize: '12px', lineHeight: '1.7', color: theme.text2, whiteSpace: 'pre-wrap' }}>
            {terminalOutput.length === 0 && <div style={{ color: theme.dim }}>Nothing yet — start tapping blocks!</div>}
            {terminalOutput.map((line, i) => (
              <div key={i} style={{ color: line.type === 'cmd' ? theme.accent : theme.text2, marginBottom: line.type === 'out' ? '8px' : '0' }}>
                {line.text}
                {line.flag && (
                  <div style={{ marginTop: '6px' }}>
                    <button
                      onClick={() => copyToClipboard(FLAG)}
                      style={{
                        background: 'transparent', border: `1px solid ${theme.borderStrong}`, color: copiedFlag ? theme.success : theme.accent,
                        padding: '4px 10px', fontFamily: 'inherit', fontSize: '10px', letterSpacing: '0.1em', cursor: 'pointer', borderRadius: '2px',
                        animation: !hasCopiedFlag ? 'pulse-warn 1.3s infinite' : 'none',
                      }}
                    >
                      {copiedFlag ? '✓ Copied!' : '📋 Copy Flag'}
                    </button>
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
            <div style={{ color: foundCreds ? theme.success : theme.text }}>{foundCreds ? '✓' : '◯'} Find something useful in the files</div>
            <div style={{ color: foundCreds ? theme.warning : theme.dim }}>◯ Unlock root access</div>
          </div>
        </div>

        <div style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontSize: '11px', color: theme.warning, letterSpacing: '0.2em', marginBottom: '10px' }}>⚠ INTEL DROP</div>
          <div style={{ fontSize: '12px', color: theme.text2, lineHeight: '1.6' }}>
            {!foundCreds
              ? <>Tap the blocks to peek inside each file. One of them is hiding a password!</>
              : <>Found it! Now tap <span style={{ color: theme.warning }}>🔓 Unlock Root Access</span> to finish the job.</>}
          </div>
        </div>
      </div>
    </div>
  );
}

function FolderGroup({ node, executedPaths, onRun }) {
  const { theme } = useTheme();
  const children = Object.values(node.children);
  return (
    <div>
      <div style={{ fontSize: '11px', color: theme.muted, letterSpacing: '0.1em', marginBottom: '8px' }}>📁 {node.name}/</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
        {children.map((child) => (
          <FileBlock key={child.path} node={child} done={executedPaths.has(child.path)} onClick={() => onRun(child)} />
        ))}
      </div>
    </div>
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
        padding: '14px 16px', fontFamily: 'inherit', cursor: done ? 'default' : 'pointer',
        borderRadius: '10px', textAlign: 'left', minWidth: '170px',
        boxShadow: done ? 'none' : `0 3px 0 ${theme.borderStrong}`,
      }}
    >
      <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{done ? '✅' : '📄'} Peek inside {node.name}</div>
      <div style={{ fontSize: '10px', color: theme.dim, fontFamily: 'monospace', marginTop: '4px' }}>cat {node.path}</div>
    </button>
  );
}

function UnlockBlock({ enabled, done, onClick }) {
  const { theme } = useTheme();
  const disabled = !enabled || done;
  return (
    <button
      className="rookie-block"
      onClick={onClick}
      disabled={disabled}
      title={!enabled && !done ? 'Find something useful first' : ''}
      style={{
        background: done ? theme.panel2 : disabled ? 'transparent' : theme.panel2,
        border: `2px solid ${done ? theme.success : disabled ? theme.dim : theme.warning}`,
        color: done ? theme.success : disabled ? theme.dim : theme.warning,
        padding: '16px 20px', fontFamily: 'inherit', cursor: disabled ? 'not-allowed' : 'pointer',
        borderRadius: '10px', textAlign: 'left', minWidth: '220px', fontSize: '15px', fontWeight: 'bold',
        boxShadow: disabled ? 'none' : `0 3px 0 ${theme.warning}55`,
        animation: enabled && !done ? 'pulse-warn 1.6s infinite' : 'none',
      }}
    >
      <div>{done ? '✅' : enabled ? '🔓' : '🔒'} Unlock Root Access</div>
      <div style={{ fontSize: '10px', color: theme.dim, fontFamily: 'monospace', marginTop: '4px', fontWeight: 'normal' }}>sudo su</div>
    </button>
  );
}
