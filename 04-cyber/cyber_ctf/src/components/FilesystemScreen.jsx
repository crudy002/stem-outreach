import { FILE_TREE } from '../hooks/useTerminal';
import { FileBrowserSidebar } from './FileBrowserSidebar';

export function FilesystemScreen({ terminal, mode }) {
  const {
    FLAG,
    terminalOutput,
    command,
    setCommand,
    foundCreds,
    sudoPrompt,
    copiedFlag,
    terminalRef,
    commandInputRef,
    promptPath,
    handleTerminalKeyDown,
    copyToClipboard,
    viewFile,
    unlockRoot,
    assisted,
    strugglingBadly,
    callForBackup,
  } = terminal;
  const easy = mode === 'easy';

  const fillInSudo = () => {
    setCommand('sudo su');
    commandInputRef.current?.focus();
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: easy ? '200px 1fr 320px' : '1fr 320px', gap: '20px' }}>
      {easy && <FileBrowserSidebar tree={FILE_TREE} onSelectFile={viewFile} />}

      <div
        onClick={() => commandInputRef.current && commandInputRef.current.focus()}
        style={{ background: '#081320', border: '1px solid #1f3354', borderRadius: '4px', padding: '20px', height: '480px', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px', paddingBottom: '10px', borderBottom: '1px solid #152942' }}>
          <span style={{ fontSize: '11px', color: '#5a7090', letterSpacing: '0.2em' }}>SHELL // admin@target</span>
          <span style={{ fontSize: '11px', color: '#4ade80' }}>● CONNECTED</span>
        </div>

        <div ref={terminalRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', fontSize: '12.5px', lineHeight: '1.7', color: '#c8d4e3', whiteSpace: 'pre-wrap', marginBottom: '12px' }}>
          <div style={{ color: '#5a7090', marginBottom: '10px' }}>
            Welcome to TARGET-01. Type 'help' for available commands.{'\n'}
            Hint: try 'ls' to see what's around.
          </div>
          {terminalOutput.map((line, i) => (
            <div key={i} style={{ color: line.type === 'cmd' ? '#5b9bd5' : '#c8d4e3', marginBottom: line.type === 'out' ? '8px' : '0' }}>
              {line.text}
              {line.flag && (
                <div style={{ marginTop: '6px' }}>
                  <button
                    onClick={() => copyToClipboard(FLAG)}
                    style={{ background: 'transparent', border: '1px solid #2a4870', color: copiedFlag ? '#4ade80' : '#5b9bd5', padding: '4px 10px', fontFamily: 'inherit', fontSize: '10px', letterSpacing: '0.1em', cursor: 'pointer', borderRadius: '2px' }}
                  >
                    {copiedFlag ? '✓ Copied!' : '📋 Copy Flag'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid #152942', paddingTop: '12px' }}>
          <span style={{ color: sudoPrompt !== null ? '#fbbf24' : '#5b9bd5', fontSize: '13px', whiteSpace: 'nowrap' }}>
            {sudoPrompt !== null ? '[sudo] password for user:' : `admin@target:${promptPath()}$`}
          </span>
          <input
            ref={commandInputRef}
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleTerminalKeyDown}
            type={sudoPrompt !== null ? 'password' : 'text'}
            autoFocus
            style={{ flex: 1, background: 'transparent', border: 'none', color: '#c8d4e3', fontFamily: 'inherit', fontSize: '13px', outline: 'none' }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ background: '#0f1f33', border: '1px solid #1f3354', borderRadius: '4px', padding: '16px' }}>
          <div style={{ fontSize: '11px', color: '#5a7090', letterSpacing: '0.2em', marginBottom: '12px' }}>OBJECTIVES</div>
          <div style={{ fontSize: '12px', lineHeight: '1.8' }}>
            <div style={{ color: foundCreds ? '#4ade80' : '#c8d4e3' }}>{foundCreds ? '✓' : '◯'} Locate credentials file</div>
            <div style={{ color: foundCreds ? '#fbbf24' : '#3a4a66' }}>◯ Run 'sudo su' and enter the password</div>
          </div>
        </div>

        {strugglingBadly && !assisted && (
          <div style={{ background: '#1a1408', border: '1px solid #7a5a10', borderRadius: '4px', padding: '16px' }}>
            <div style={{ fontSize: '11px', color: '#fbbf24', letterSpacing: '0.2em', marginBottom: '8px' }}>📡 STUCK?</div>
            <div style={{ fontSize: '12px', color: '#c8b088', lineHeight: '1.6', marginBottom: '10px' }}>
              HQ can take over and finish the mission for you. You'll still see it through — this run just won't count for the leaderboard.
            </div>
            <button
              onClick={callForBackup}
              style={{ width: '100%', background: 'transparent', border: '1px solid #fbbf24', color: '#fbbf24', padding: '8px 12px', fontFamily: 'inherit', fontSize: '10px', letterSpacing: '0.15em', cursor: 'pointer', borderRadius: '2px' }}
            >
              CALL FOR BACKUP
            </button>
          </div>
        )}

        <div style={{ background: '#0f1f33', border: '1px solid #1f3354', borderRadius: '4px', padding: '16px' }}>
          <div style={{ fontSize: '11px', color: '#fbbf24', letterSpacing: '0.2em', marginBottom: '10px' }}>⚠ INTEL DROP</div>
          {!foundCreds ? (
            <div style={{ fontSize: '12px', color: '#8da3c0', lineHeight: '1.6' }}>
              {easy ? (
                <>Click through the files on the left. Devs sometimes leave secrets in plain text.</>
              ) : (
                <>Try <span style={{ color: '#5b9bd5' }}>ls config/</span>. Devs sometimes leave secrets in plain text. Tab-complete file names, and use ↑/↓ to reuse past commands.</>
              )}
            </div>
          ) : (
            <div style={{ fontSize: '12px', color: '#8da3c0', lineHeight: '1.6' }}>
              {easy ? (
                <>Found the password. Ready to escalate to root?</>
              ) : (
                <>Got the password? Use the <span style={{ color: '#5b9bd5' }}>📋 Copy Flag</span> button on that output, then run <span style={{ color: '#5b9bd5' }}>sudo su</span> and paste it (Ctrl/Cmd+V) when prompted.</>
              )}
              {sudoPrompt === null && (
                <button
                  onClick={(e) => { e.stopPropagation(); easy ? unlockRoot() : fillInSudo(); }}
                  style={{ display: 'block', marginTop: '10px', background: 'transparent', border: '1px solid #2a4870', color: '#5b9bd5', padding: '6px 12px', fontFamily: 'inherit', fontSize: '10px', letterSpacing: '0.1em', cursor: 'pointer', borderRadius: '2px' }}
                >
                  {easy ? "🔓 Unlock Root Access" : "⌨ Fill in 'sudo su'"}
                </button>
              )}
            </div>
          )}
        </div>

        <div style={{ background: '#0f1f33', border: '1px solid #1f3354', borderRadius: '4px', padding: '16px' }}>
          <div style={{ fontSize: '11px', color: '#5a7090', letterSpacing: '0.2em', marginBottom: '10px' }}>LESSON</div>
          <div style={{ fontSize: '11px', color: '#8da3c0', lineHeight: '1.6' }}>
            Real breaches often start with secrets accidentally committed to code. Tools like git-secrets and pre-commit hooks catch these before they ship.
          </div>
        </div>
      </div>
    </div>
  );
}
