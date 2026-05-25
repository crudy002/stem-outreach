import React, { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Network Coordinator Dashboard
 *
 * Two modes:
 *   - SIMULATION (default): generates fake nodes + traffic in-browser so the
 *     dashboard works with no Pi and no server. Good for demos and design.
 *   - LIVE: polls a real coordinator.py server at the URL you enter, e.g.
 *     http://192.168.1.10:8080  -- the dashboard polls <url>/state twice a
 *     second and renders whatever the coordinator reports.
 */

const POLL_INTERVAL_MS = 500;

export default function CoordinatorDashboard() {
  const [mode, setMode] = useState('simulation'); // 'simulation' | 'live'
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [liveUrl, setLiveUrl] = useState('http://192.168.1.10:8080');
  const [urlDraft, setUrlDraft] = useState('http://192.168.1.10:8080');
  const [connError, setConnError] = useState(null);
  const [removeError, setRemoveError] = useState(null);

  const [nodes, setNodes] = useState([]);
  const [events, setEvents] = useState([]);
  const [flash, setFlash] = useState({}); // node_id -> 'send' | 'receive'
  const [travelers, setTravelers] = useState([]); // animated packets

  const logRef = useRef(null);
  const simStateRef = useRef(null);
  const lastEventIdRef = useRef(0);

  // --- node layout: positions on the canvas ---------------------------------
  const nodeLayout = {
    'PI-01': { x: 18, y: 50 },
    'PI-02': { x: 82, y: 50 },
    'PI-03': { x: 50, y: 18 },
    'PI-04': { x: 50, y: 82 },
    'PI-RECV': { x: 82, y: 50 },
    'PI-SEND': { x: 18, y: 50 },
  };
  const fallbackPos = (i) => {
    const angle = (i / 6) * Math.PI * 2;
    return { x: 50 + Math.cos(angle) * 32, y: 50 + Math.sin(angle) * 32 };
  };

  // --- SIMULATION engine ----------------------------------------------------
  useEffect(() => {
    if (mode !== 'simulation') return;

    // seed two nodes
    simStateRef.current = {
      nodes: {
        'PI-01': { role: 'sender', sent: 0, received: 0 },
        'PI-02': { role: 'receiver', sent: 0, received: 0 },
      },
      events: [],
      counter: 0,
    };
    setConnError(null);

    const pushEvent = (kind, node, detail) => {
      const s = simStateRef.current;
      s.counter += 1;
      const now = new Date();
      const time =
        String(now.getHours()).padStart(2, '0') + ':' +
        String(now.getMinutes()).padStart(2, '0') + ':' +
        String(now.getSeconds()).padStart(2, '0') + '.' +
        String(now.getMilliseconds()).padStart(3, '0');
      s.events.push({ id: s.counter, time, kind, node, detail });
      if (s.events.length > 50) s.events.shift();
    };

    pushEvent('register', 'PI-02', 'receiver joined');
    pushEvent('register', 'PI-01', 'sender joined');

    const publish = () => {
      const s = simStateRef.current;
      setNodes(
        Object.entries(s.nodes).map(([id, n]) => ({
          id, role: n.role, online: true,
          packets_sent: n.sent, packets_received: n.received,
        }))
      );
      setEvents([...s.events]);
    };
    publish();

    // every ~2.5s, simulate a packet send
    const tick = setInterval(() => {
      const s = simStateRef.current;
      const seq = s.nodes['PI-01'].sent + 1;
      s.nodes['PI-01'].sent = seq;
      pushEvent('send', 'PI-01', `sent packet #${seq} to PI-02`);
      publish();
      animatePacket('PI-01', 'PI-02');
      triggerFlash('PI-01', 'send');

      // arrival ~1s later
      setTimeout(() => {
        s.nodes['PI-02'].received += 1;
        pushEvent('receive', 'PI-02', `got packet #${seq} from PI-01`);
        publish();
        triggerFlash('PI-02', 'receive');
      }, 1000);
    }, 2500);

    return () => clearInterval(tick);
  }, [mode]);

  // --- LIVE polling ---------------------------------------------------------
  useEffect(() => {
    if (mode !== 'live') return;
    lastEventIdRef.current = 0;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`${liveUrl}/state`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setConnError(null);
        setNodes(data.nodes || []);
        setEvents(data.events || []);

        // detect brand-new events and animate them
        const fresh = (data.events || []).filter(
          (e) => e.id > lastEventIdRef.current
        );
        if (fresh.length) {
          lastEventIdRef.current = Math.max(...fresh.map((e) => e.id));
          fresh.forEach((e) => {
            if (e.kind === 'send') {
              triggerFlash(e.node, 'send');
              const target = resolveTarget(e.detail, e.node, data.nodes);
              if (target) {
                animatePacket(e.node, target);
              } else {
                console.warn(
                  `[dashboard] no destination for event ${e.id} ` +
                  `("${e.detail}") - skipping packet animation`
                );
              }
            } else if (e.kind === 'receive') {
              triggerFlash(e.node, 'receive');
            }
          });
        }
      } catch (err) {
        if (!cancelled) setConnError(err.message);
      }
    };

    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [mode, liveUrl]);

  // Work out where a 'send' packet is headed, for the animation.
  //   1. Best case: the event detail names a registered node id directly
  //      (the sender was run with --target-id). Use that.
  //   2. Fallback: detail only had an IP, so no id matched. If there is
  //      exactly ONE receiver registered, assume that's the destination.
  //      Covers the common small-booth setup of one obvious receiver.
  //   3. Give up: return null, and the caller logs a notice.
  const resolveTarget = (detail, fromNode, nodeList) => {
    if (detail) {
      const named = nodeList.find(
        (n) => n.id !== fromNode && detail.includes(n.id)
      );
      if (named) return named.id;
    }
    const receivers = nodeList.filter((n) => n.role === 'receiver');
    if (receivers.length === 1) return receivers[0].id;
    return null;
  };

  const triggerFlash = useCallback((nodeId, kind) => {
    setFlash((f) => ({ ...f, [nodeId]: kind }));
    setTimeout(() => {
      setFlash((f) => {
        const next = { ...f };
        delete next[nodeId];
        return next;
      });
    }, 700);
  }, []);

  const animatePacket = useCallback((fromId, toId) => {
    const id = Math.random().toString(36).slice(2);
    setTravelers((t) => [...t, { id, fromId, toId, progress: 0 }]);
    const steps = 40;
    let step = 0;
    const iv = setInterval(() => {
      step += 1;
      setTravelers((t) =>
        t.map((p) => (p.id === id ? { ...p, progress: step / steps } : p))
      );
      if (step >= steps) {
        clearInterval(iv);
        setTravelers((t) => t.filter((p) => p.id !== id));
      }
    }, 25);
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [events]);

  const removeNode = useCallback(async (nodeId) => {
    setRemoveError(null);
    try {
      const res = await fetch(`${liveUrl}/nodes/${encodeURIComponent(nodeId)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
    } catch (err) {
      setRemoveError(`Failed to remove ${nodeId}: ${err.message}`);
    }
  }, [liveUrl]);

  const posFor = (id, index) => nodeLayout[id] || fallbackPos(index);

  const onlineCount = nodes.filter((n) => n.online).length;
  const totalSent = nodes.reduce((s, n) => s + (n.packets_sent || 0), 0);
  const totalRecv = nodes.reduce((s, n) => s + (n.packets_received || 0), 0);

  return (
    <div style={S.page}>
      <style>{`
        @keyframes blink { 0%,49%{opacity:1} 50%,100%{opacity:0.25} }
        @keyframes ringpulse { 0%{r:4;opacity:0.7} 100%{r:11;opacity:0} }
      `}</style>

      {/* Header */}
      <div style={S.header}>
        <div>
          <div style={S.kicker}>STEM OUTREACH // NETWORK COORDINATOR</div>
          <div style={S.title}>LIVE TOPOLOGY DASHBOARD</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <ModeButton active={mode === 'simulation'} onClick={() => setMode('simulation')}>
            ◇ SIMULATION
          </ModeButton>
          <ModeButton active={mode === 'live'} onClick={() => setMode('live')}>
            ● LIVE
          </ModeButton>
          <ModeButton active={settingsOpen} onClick={() => setSettingsOpen((o) => !o)}>
            ⚙ SETTINGS
          </ModeButton>
        </div>
      </div>

      {/* Live connection bar */}
      {mode === 'live' && (
        <div style={S.connBar}>
          <span style={S.connLabel}>COORDINATOR URL</span>
          <input
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setLiveUrl(urlDraft)}
            style={S.urlInput}
            placeholder="http://192.168.1.10:8080"
          />
          <button style={S.connectBtn} onClick={() => setLiveUrl(urlDraft)}>
            CONNECT
          </button>
          <span style={{
            fontSize: 11,
            color: connError ? '#ef4444' : '#4ade80',
            letterSpacing: '0.1em',
          }}>
            {connError ? `✕ ${connError}` : '● POLLING /state'}
          </span>
        </div>
      )}

      {/* Settings panel */}
      {settingsOpen && (
        <div style={S.settingsPanel}>
          <div style={S.panelHead}>
            <span style={S.panelTitle}>NODE MANAGEMENT</span>
            {mode !== 'live' && (
              <span style={{ fontSize: 11, color: '#fbbf24', letterSpacing: '0.1em' }}>
                ⚠ LIVE MODE REQUIRED — connect to a coordinator to manage nodes
              </span>
            )}
          </div>
          {removeError && (
            <div style={{ color: '#ef4444', fontSize: 11, marginBottom: 8 }}>{removeError}</div>
          )}
          {mode === 'live' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
              {nodes.length === 0 && (
                <div style={{ color: '#3d4a63', fontSize: 11 }}>no registered nodes</div>
              )}
              {nodes.map((n) => (
                <div key={n.id} style={S.settingsRow}>
                  <span style={{
                    width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                    background: n.online ? '#4ade80' : '#3d4a63',
                  }} />
                  <span style={{ color: '#d4dce5', fontWeight: 'bold', width: 80 }}>{n.id}</span>
                  <span style={{ color: '#5a6b80', width: 60 }}>{n.role}</span>
                  <span style={{ color: '#a78bfa', width: 48 }}>↑{n.packets_sent}</span>
                  <span style={{ color: '#4ade80', flex: 1 }}>↓{n.packets_received}</span>
                  <button
                    style={S.removeBtn}
                    onClick={() => removeNode(n.id)}
                  >
                    REMOVE
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={S.grid}>
        {/* Topology canvas */}
        <div style={S.panel}>
          <div style={S.panelHead}>
            <span style={S.panelTitle}>TOPOLOGY</span>
            <span style={S.panelMeta}>{onlineCount}/{nodes.length} ONLINE</span>
          </div>

          <svg viewBox="0 0 100 100" style={{ width: '100%', height: 420 }}>
            <defs>
              <pattern id="g" width="5" height="5" patternUnits="userSpaceOnUse">
                <path d="M5 0L0 0 0 5" fill="none" stroke="#16203a" strokeWidth="0.12" />
              </pattern>
            </defs>
            <rect width="100" height="100" fill="url(#g)" />

            {/* links between every sender and every receiver */}
            {nodes.map((sNode, si) => {
              if (sNode.role !== 'sender') return null;
              return nodes.map((rNode, ri) => {
                if (rNode.role !== 'receiver') return null;
                const a = posFor(sNode.id, si);
                const b = posFor(rNode.id, ri);
                return (
                  <line key={`${sNode.id}-${rNode.id}`}
                    x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    stroke="#243154" strokeWidth="0.25"
                    strokeDasharray="1 0.6" />
                );
              });
            })}

            {/* packets in flight */}
            {travelers.map((p) => {
              const fi = nodes.findIndex((n) => n.id === p.fromId);
              const ti = nodes.findIndex((n) => n.id === p.toId);
              const a = posFor(p.fromId, fi < 0 ? 0 : fi);
              const b = posFor(p.toId, ti < 0 ? 1 : ti);
              const x = a.x + (b.x - a.x) * p.progress;
              const y = a.y + (b.y - a.y) * p.progress;
              return (
                <g key={p.id}>
                  <circle cx={x} cy={y} r="2.6" fill="none"
                    stroke="#fbbf24" strokeWidth="0.2" opacity="0.5" />
                  <circle cx={x} cy={y} r="1.3" fill="#fbbf24" />
                </g>
              );
            })}

            {/* nodes */}
            {nodes.map((node, i) => {
              const p = posFor(node.id, i);
              const f = flash[node.id];
              const baseColor = node.role === 'sender' ? '#a78bfa'
                : node.role === 'receiver' ? '#4ade80' : '#7280a0';
              const color = !node.online ? '#3d4a63'
                : f === 'send' ? '#fbbf24'
                : f === 'receive' ? '#00e5ff'
                : baseColor;
              return (
                <g key={node.id}>
                  {f && (
                    <circle cx={p.x} cy={p.y} fill="none"
                      stroke={color} strokeWidth="0.35">
                      <animate attributeName="r" from="4" to="11"
                        dur="0.7s" repeatCount="1" />
                      <animate attributeName="opacity" from="0.7" to="0"
                        dur="0.7s" repeatCount="1" />
                    </circle>
                  )}
                  <rect x={p.x - 5} y={p.y - 3.5} width="10" height="7"
                    rx="0.6" fill="#0d1424" stroke={color} strokeWidth="0.3" />
                  <circle cx={p.x - 3.6} cy={p.y - 2} r="0.5" fill={color} />
                  <circle cx={p.x - 2.3} cy={p.y - 2} r="0.5"
                    fill={node.online ? color : '#243154'} />
                  <text x={p.x} y={p.y + 0.4} fontSize="2"
                    fill={color} textAnchor="middle"
                    fontFamily="monospace" fontWeight="bold">
                    {node.id}
                  </text>
                  <text x={p.x} y={p.y + 2.4} fontSize="1.4"
                    fill="#5a6b80" textAnchor="middle" fontFamily="monospace">
                    {node.role}
                  </text>
                </g>
              );
            })}

            {nodes.length === 0 && (
              <text x="50" y="50" fontSize="3" fill="#3d4a63"
                textAnchor="middle" fontFamily="monospace">
                waiting for nodes...
              </text>
            )}
          </svg>
        </div>

        {/* Side: stats + nodes + log */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={S.panel}>
            <div style={S.panelTitle}>TELEMETRY</div>
            <div style={{ display: 'flex', gap: 14, marginTop: 12 }}>
              <Stat label="NODES" value={nodes.length} color="#d4dce5" />
              <Stat label="TX" value={totalSent} color="#a78bfa" />
              <Stat label="RX" value={totalRecv} color="#4ade80" />
            </div>
          </div>

          <div style={S.panel}>
            <div style={S.panelTitle}>REGISTERED NODES</div>
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {nodes.map((n) => (
                <div key={n.id} style={S.nodeRow}>
                  <span style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: n.online ? '#4ade80' : '#3d4a63',
                    animation: n.online ? 'blink 1.6s infinite' : 'none',
                  }} />
                  <span style={{ color: '#d4dce5', fontWeight: 'bold', width: 64 }}>
                    {n.id}
                  </span>
                  <span style={{ color: '#5a6b80', flex: 1 }}>{n.role}</span>
                  <span style={{ color: '#a78bfa' }}>↑{n.packets_sent}</span>
                  <span style={{ color: '#4ade80' }}>↓{n.packets_received}</span>
                </div>
              ))}
              {nodes.length === 0 && (
                <div style={{ color: '#3d4a63', fontSize: 11 }}>no nodes yet</div>
              )}
            </div>
          </div>

          <div style={{ ...S.panel, flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={S.panelTitle}>EVENT LOG</span>
              <span style={S.panelMeta}>{events.length} EVT</span>
            </div>
            <div ref={logRef} style={S.log}>
              {events.map((e) => (
                <div key={e.id} style={{ display: 'flex', gap: 7, marginBottom: 2 }}>
                  <span style={{ color: '#3d4a63', flexShrink: 0 }}>{e.time}</span>
                  <span style={{
                    color: e.kind === 'send' ? '#a78bfa'
                      : e.kind === 'receive' ? '#00e5ff'
                      : '#fbbf24',
                    flexShrink: 0, width: 58,
                  }}>
                    {e.kind.toUpperCase()}
                  </span>
                  <span style={{ color: '#7280a0' }}>{e.node}: {e.detail}</span>
                </div>
              ))}
              {events.length === 0 && (
                <div style={{ color: '#3d4a63' }}>no events yet</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={S.footer}>
        <span>
          {mode === 'simulation'
            ? 'SIMULATION MODE // generating fake traffic in-browser'
            : `LIVE MODE // polling ${liveUrl}/state every ${POLL_INTERVAL_MS}ms`}
        </span>
        <span>STEM_OUTREACH_v0.2</span>
      </div>
    </div>
  );
}

function ModeButton({ active, children, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: active ? '#00e5ff' : 'transparent',
      color: active ? '#0a0e1a' : '#5a6b80',
      border: `1px solid ${active ? '#00e5ff' : '#243154'}`,
      padding: '7px 14px', fontFamily: 'inherit', fontSize: 11,
      letterSpacing: '0.15em', fontWeight: 'bold', cursor: 'pointer',
      borderRadius: 2,
    }}>
      {children}
    </button>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 10, color: '#5a6b80', letterSpacing: '0.1em' }}>{label}</div>
      <div style={{ fontSize: 26, color, fontWeight: 'bold' }}>
        {String(value).padStart(2, '0')}
      </div>
    </div>
  );
}

const S = {
  page: {
    minHeight: '100vh', background: '#0a0e1a', color: '#d4dce5',
    fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', padding: 24,
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    borderBottom: '1px solid #1e2a3f', paddingBottom: 14, marginBottom: 18,
  },
  kicker: { fontSize: 11, letterSpacing: '0.3em', color: '#5a6b80', marginBottom: 4 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#00e5ff', letterSpacing: '0.05em' },
  connBar: {
    display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18,
    background: '#0d1424', border: '1px solid #1e2a3f', borderRadius: 4, padding: '12px 16px',
  },
  connLabel: { fontSize: 10, color: '#5a6b80', letterSpacing: '0.2em' },
  urlInput: {
    flex: 1, background: '#06090f', border: '1px solid #243154', color: '#00e5ff',
    padding: '8px 12px', fontFamily: 'inherit', fontSize: 12, outline: 'none', borderRadius: 2,
  },
  connectBtn: {
    background: 'transparent', border: '1px solid #00e5ff', color: '#00e5ff',
    padding: '8px 16px', fontFamily: 'inherit', fontSize: 11, letterSpacing: '0.15em',
    fontWeight: 'bold', cursor: 'pointer', borderRadius: 2,
  },
  grid: { display: 'grid', gridTemplateColumns: '1fr 340px', gap: 18 },
  panel: { background: '#0d1424', border: '1px solid #1e2a3f', borderRadius: 4, padding: 16 },
  panelHead: { display: 'flex', justifyContent: 'space-between', marginBottom: 6 },
  panelTitle: { fontSize: 11, color: '#5a6b80', letterSpacing: '0.2em' },
  panelMeta: { fontSize: 11, color: '#5a6b80' },
  nodeRow: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 },
  log: {
    height: 220, overflowY: 'auto', fontSize: 10.5, lineHeight: 1.7, marginTop: 10,
  },
  footer: {
    marginTop: 18, display: 'flex', justifyContent: 'space-between',
    fontSize: 10, color: '#3d4a63', letterSpacing: '0.12em',
  },
  settingsPanel: {
    background: '#0d1424', border: '1px solid #1e2a3f', borderRadius: 4,
    padding: 16, marginBottom: 18,
  },
  settingsRow: {
    display: 'flex', alignItems: 'center', gap: 10, fontSize: 11.5,
    padding: '4px 0', borderBottom: '1px solid #131d30',
  },
  removeBtn: {
    background: 'transparent', border: '1px solid #ef4444', color: '#ef4444',
    padding: '3px 10px', fontFamily: 'inherit', fontSize: 10,
    letterSpacing: '0.1em', fontWeight: 'bold', cursor: 'pointer', borderRadius: 2,
  },
};
