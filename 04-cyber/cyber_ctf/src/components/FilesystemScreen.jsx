import { useState } from 'react';
import { FileBrowserSidebar } from './FileBrowserSidebar';
import { FileViewModal } from './FileViewModal';
import { RootAccessModal } from './RootAccessModal';
import { SecretChip, DecoyReveal } from './SecretChip';
import { useTheme } from '../theme.jsx';

export function FilesystemScreen({ terminal, mode }) {
  const { theme } = useTheme();
  const [activeFile, setActiveFile] = useState(null); // { path, content, secrets } | null
  const {
    fileTree,
    terminalOutput,
    command,
    setCommand,
    foundCreds,
    sudoPrompt,
    copiedValue,
    hasCopiedRoot,
    terminalRef,
    commandInputRef,
    promptPath,
    handleTerminalKeyDown,
    copyToClipboard,
    viewFile,
    unlockRoot,
    assisted,
    escalating,
    completeEscalation,
    strugglingBadly,
    callForBackup,
  } = terminal;
  const easy = mode === 'easy';
  const hard = mode === 'hard';

  const fillInSudo = () => {
    setCommand('sudo su');
    commandInputRef.current?.focus();
  };

  // EASY mode's file click opens a popup instead of just letting the
  // contents land in the terminal transcript, so browsing every file in a
  // couple of seconds isn't a viable shortcut.
  const openFile = (path) => {
    const result = viewFile(path);
    if (result) setActiveFile({ path, ...result });
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: easy ? '200px 1fr 320px' : '1fr 320px', gap: '20px' }}>
      {easy && <FileBrowserSidebar tree={fileTree} onSelectFile={openFile} />}

      {activeFile && (
        <FileViewModal
          path={activeFile.path}
          content={activeFile.content}
          secrets={activeFile.secrets}
          copiedValue={copiedValue}
          hasCopiedRoot={hasCopiedRoot}
          onCopy={copyToClipboard}
          onClose={() => setActiveFile(null)}
        />
      )}

      <RootAccessModal open={escalating} onDone={completeEscalation} />

      <div
        onClick={() => commandInputRef.current && commandInputRef.current.focus()}
        style={{ background: theme.bgDeep, border: `1px solid ${theme.border}`, borderRadius: '4px', padding: '20px', height: '480px', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px', paddingBottom: '10px', borderBottom: `1px solid ${theme.panel2}` }}>
          <span style={{ fontSize: '11px', color: theme.muted, letterSpacing: '0.2em' }}>SHELL // admin@target</span>
          <span style={{ fontSize: '11px', color: theme.success }}>● CONNECTED</span>
        </div>

        <div ref={terminalRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', fontSize: '12.5px', lineHeight: '1.7', color: theme.text, whiteSpace: 'pre-wrap', marginBottom: '12px' }}>
          <div style={{ color: theme.muted, marginBottom: '10px' }}>
            Welcome to TARGET-01. Type 'help' for available commands.{'\n'}
            Hint: try 'ls' to see what's around.
          </div>
          {terminalOutput.map((line, i) => (
            <div key={i} style={{ color: line.type === 'cmd' ? theme.accent : theme.text, marginBottom: line.type === 'out' ? '8px' : '0' }}>
              {line.text}
              {line.secrets?.length > 0 && (
                <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {line.secrets.map((secret) =>
                    easy && !secret.isRoot ? (
                      <DecoyReveal key={secret.value} secret={secret} />
                    ) : (
                      <SecretChip
                        key={secret.value}
                        secret={secret}
                        badged={!hard && secret.isRoot}
                        copied={copiedValue === secret.value}
                        nudge={easy && secret.isRoot && !hasCopiedRoot}
                        onCopy={() => copyToClipboard(secret.value)}
                      />
                    )
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderTop: `1px solid ${theme.panel2}`, paddingTop: '12px' }}>
          <span style={{ color: sudoPrompt !== null ? theme.warning : theme.accent, fontSize: '13px', whiteSpace: 'nowrap' }}>
            {sudoPrompt !== null ? '[sudo] password for user:' : `admin@target:${promptPath()}$`}
          </span>
          <input
            ref={commandInputRef}
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleTerminalKeyDown}
            type={sudoPrompt !== null ? 'password' : 'text'}
            autoFocus
            style={{ flex: 1, background: 'transparent', border: 'none', color: theme.text, fontFamily: 'inherit', fontSize: '13px', outline: 'none' }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: '4px', padding: '16px' }}>
          <div style={{ fontSize: '11px', color: theme.muted, letterSpacing: '0.2em', marginBottom: '12px' }}>OBJECTIVES</div>
          <div style={{ fontSize: '12px', lineHeight: '1.8' }}>
            <div style={{ color: foundCreds ? theme.success : theme.text }}>{foundCreds ? '✓' : '◯'} Locate credentials file</div>
            <div style={{ color: foundCreds ? theme.warning : theme.dim }}>◯ Run 'sudo su' and enter the password</div>
          </div>
        </div>

        {strugglingBadly && !assisted && (
          <div style={{ background: theme.warnPanelBg, border: `1px solid ${theme.warnPanelBorder}`, borderRadius: '4px', padding: '16px' }}>
            <div style={{ fontSize: '11px', color: theme.warning, letterSpacing: '0.2em', marginBottom: '8px' }}>📡 STUCK?</div>
            <div style={{ fontSize: '12px', color: theme.warnPanelText, lineHeight: '1.6', marginBottom: '10px' }}>
              HQ can take over and finish the mission for you. You'll still see it through — this run just won't count for the leaderboard.
            </div>
            <button
              onClick={callForBackup}
              style={{ width: '100%', background: 'transparent', border: `1px solid ${theme.warning}`, color: theme.warning, padding: '8px 12px', fontFamily: 'inherit', fontSize: '10px', letterSpacing: '0.15em', cursor: 'pointer', borderRadius: '2px' }}
            >
              CALL FOR BACKUP
            </button>
          </div>
        )}

        <div style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: '4px', padding: '16px' }}>
          <div style={{ fontSize: '11px', color: theme.warning, letterSpacing: '0.2em', marginBottom: '10px' }}>⚠ INTEL DROP</div>
          {!foundCreds ? (
            <div style={{ fontSize: '12px', color: theme.text2, lineHeight: '1.6' }}>
              {easy ? (
                <>Open the folders. One file's hiding something it shouldn't.</>
              ) : (
                <>Run <span style={{ color: theme.accent }}>ls</span>, then look inside each folder — the password isn't in the same place twice. Plenty of files hold <em>a</em> secret; only one holds the <em>root</em> password. Tab-completes names, ↑/↓ recalls commands.</>
              )}
            </div>
          ) : (
            <div style={{ fontSize: '12px', color: theme.text2, lineHeight: '1.6' }}>
              {easy ? (
                hasCopiedRoot ? <>Password copied. Escalate?</> : <>Copy the 🦸 superuser password above — the other ones won't work.</>
              ) : (
                <>Found the root password? Copy it with the chip under that output, then run <span style={{ color: theme.accent }}>sudo su</span> and paste it (Ctrl/Cmd+V) when prompted. Pick the wrong secret and sudo will just say no.</>
              )}
              {sudoPrompt === null && (!easy || hasCopiedRoot) && (
                <button
                  onClick={(e) => { e.stopPropagation(); easy ? unlockRoot() : fillInSudo(); }}
                  style={{ display: 'block', marginTop: '10px', background: 'transparent', border: `1px solid ${theme.borderStrong}`, color: theme.accent, padding: '6px 12px', fontFamily: 'inherit', fontSize: '10px', letterSpacing: '0.1em', cursor: 'pointer', borderRadius: '2px' }}
                >
                  {easy ? "🔓 Unlock Root Access" : "⌨ Fill in 'sudo su'"}
                </button>
              )}
            </div>
          )}
        </div>

        {!easy && (
          <div style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: '4px', padding: '16px' }}>
            <div style={{ fontSize: '11px', color: theme.muted, letterSpacing: '0.2em', marginBottom: '10px' }}>LESSON</div>
            <div style={{ fontSize: '11px', color: theme.text2, lineHeight: '1.6' }}>
              Real breaches often start with secrets accidentally committed to code. Tools like git-secrets and pre-commit hooks catch these before they ship — and note how many different secrets were lying around in there.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
