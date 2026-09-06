import { useEffect, useRef, useState } from 'react';

// Semi-meaningful fake syslog noise. `flag` lines are the ones a real SOC
// analyst would circle — a few even echo the player's own actions earlier
// in the run, tying back to the "defenders would see this" lesson.
const LOG_POOL = [
  { text: 'sshd[2291]: Accepted password for admin from 10.0.4.17 port 51022', flag: true },
  { text: 'kernel: [ 4021.882211] eth0: link becomes ready', flag: false },
  { text: 'CRON[1187]: (root) CMD (/usr/lib/php/sessionclean)', flag: false },
  { text: 'sudo: admin : TTY=pts/0 ; PWD=/home/admin ; USER=root ; COMMAND=/bin/su', flag: true },
  { text: 'systemd[1]: Started Daily apt download activities.', flag: false },
  { text: 'auditd[812]: SYSCALL arch=x86_64 syscall=execve success=yes exe=/bin/cat', flag: true },
  { text: 'nginx: 10.0.4.17 - - "GET /config/credentials.txt HTTP/1.1" 200 214', flag: true },
  { text: 'dhclient[601]: DHCPACK from 10.0.4.1', flag: false },
  { text: 'systemd-logind[733]: New session 14 of user admin.', flag: false },
  { text: "fail2ban.actions[901]: WARNING [sshd] 10.0.4.17 already banned", flag: false },
  { text: 'ntpd[522]: synchronized to 129.6.15.28, stratum 1', flag: false },
  { text: 'audit: PROCTITLE proctitle="sudo su"', flag: true },
  { text: 'kernel: [ 4032.114402] TCP: request_sock_TCP: Possible SYN flooding', flag: false },
  { text: 'sshd[2291]: pam_unix(sshd:session): session opened for user admin', flag: false },
  { text: 'named[441]: client 10.0.4.9#53: query: pool.ntp.org IN A', flag: false },
  { text: 'auditd[812]: SYSCALL arch=x86_64 syscall=setuid success=yes exe=/bin/su', flag: true },
  { text: 'smartd[398]: Device: /dev/sda, SMART Usage Attribute: 194 Temperature_Celsius', flag: false },
];

function pad(n) { return String(n).padStart(2, '0'); }

export function LogsOverlay({ onClose }) {
  const [lines, setLines] = useState([]);
  const scrollRef = useRef(null);
  const clockRef = useRef(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      clockRef.current = new Date(clockRef.current.getTime() + 1000 + Math.random() * 4000);
      const entry = LOG_POOL[Math.floor(Math.random() * LOG_POOL.length)];
      const t = clockRef.current;
      const stamp = `${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}`;
      setLines((prev) => [...prev.slice(-30), { ...entry, stamp, id: prev.length + Math.random() }]);
    }, 220);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [lines]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(4, 9, 18, 0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: '#0f1f33', border: '1px solid #2a4870', borderRadius: '4px', padding: '24px', width: '640px', maxWidth: '92vw' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ fontSize: '13px', color: '#8da3c0', letterSpacing: '0.15em' }}>📜 /var/log/syslog — LIVE TAIL</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#5a7090', fontSize: '16px', cursor: 'pointer' }}>✕</button>
        </div>

        <div
          ref={scrollRef}
          style={{
            background: '#081320', border: '1px solid #1f3354', borderRadius: '2px',
            padding: '14px', height: '320px', overflowY: 'auto',
            fontSize: '11.5px', lineHeight: '1.8',
          }}
        >
          {lines.length === 0 && (
            <div style={{ color: '#3a4a66' }}>connecting to log stream…</div>
          )}
          {lines.map((l) => (
            <div key={l.id} style={{ color: l.flag ? '#fbbf24' : '#5a7090', whiteSpace: 'pre-wrap' }}>
              <span style={{ color: '#3a4a66' }}>{l.stamp}</span>{' '}
              {l.flag && <span style={{ color: '#ef4444' }}>[FLAGGED] </span>}
              {l.text}
            </div>
          ))}
          <span className="cursor" />
        </div>

        <div style={{ marginTop: '14px', fontSize: '11px', color: '#5a7090', lineHeight: '1.6' }}>
          Yellow lines are what a SOC analyst's alerting rules would catch — including your own login and <code>sudo su</code> a minute ago. Nothing you do here is invisible.
        </div>
      </div>
    </div>
  );
}
