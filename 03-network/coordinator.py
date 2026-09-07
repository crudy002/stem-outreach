#!/usr/bin/env python3
"""
coordinator.py — The middle piece between the Pis and the browser.

WHY THIS EXISTS
A web browser cannot open a raw UDP socket, so it can't watch the packets
that sender.py and receiver.py fire at each other directly. This little
server solves that:

    - The Pis (sender/receiver) POST short status reports here over HTTP.
    - The React dashboard GETs the current picture from here.
    - This server just holds the live state in memory in between.

REGISTRATION ARCHITECTURE
Nodes identify themselves by node ID (e.g. "PI-01", "PI-RECV"). When they
POST to register, the coordinator records:
  - their IP automatically from the HTTP connection source address
  - their UDP port from the payload (receivers only)

After that, everything is addressed by node ID. Senders query
  GET /nodes/<node_id>
to resolve a target's current IP:port before firing UDP packets. No node
needs to hard-code another node's IP.

ENDPOINTS
  GET  /state              full snapshot (polled by the dashboard)
  GET  /nodes/<id>         single node record (ip, port, role, online)
  GET  /health             liveness check
  POST /                   status report from a Pi (register/send/receive)
  POST /reset              clear all nodes, events, and counters
  DELETE /nodes/<id>       remove one node from the registry

It uses only Python's standard library — nothing to pip install.

Run it:
    python coordinator.py            # listen on port 8080
    python coordinator.py 9000       # listen on a specific port

Then point the dashboard at  http://<this-pi-ip>:8080
"""

import sys
import json
import time
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

DEFAULT_PORT = 8080

# How long a node can stay quiet before we consider it offline (seconds).
NODE_TIMEOUT = 10.0

# ---------------------------------------------------------------------------
# Shared state — wrapped in a lock because ThreadingHTTPServer handles each
# request on its own thread.
# ---------------------------------------------------------------------------
state_lock = threading.Lock()

# nodes: { node_id: {"role": str, "ip": str, "port": int|None,
#                    "last_seen": float, "packets_sent": int,
#                    "packets_received": int} }
nodes = {}

# events: rolling list of recent things that happened, newest last.
events = []
MAX_EVENTS = 50
event_counter = 0


def now_ts():
    """Wall-clock time as HH:MM:SS.mmm for human-readable logs."""
    lt = time.localtime()
    ms = int((time.time() % 1) * 1000)
    return f"{lt.tm_hour:02d}:{lt.tm_min:02d}:{lt.tm_sec:02d}.{ms:03d}"


def record_event(kind, node_id, detail):
    """Add an entry to the rolling event log. Caller must hold state_lock."""
    global event_counter
    event_counter += 1
    events.append({
        "id": event_counter,
        "time": now_ts(),
        "kind": kind,
        "node": node_id,
        "detail": detail,
    })
    if len(events) > MAX_EVENTS:
        del events[0:len(events) - MAX_EVENTS]


def node_snapshot(node_id, info, cutoff):
    """Build the per-node dict included in /state and /nodes/<id>."""
    return {
        "id": node_id,
        "role": info["role"],
        "ip": info.get("ip"),
        "port": info.get("port"),
        "online": info["last_seen"] >= cutoff,
        "packets_sent": info["packets_sent"],
        "packets_received": info["packets_received"],
        "last_seen": info["last_seen"],
    }


def snapshot():
    """Build the full picture the dashboard wants. Caller must hold lock."""
    cutoff = time.time() - NODE_TIMEOUT
    node_list = [
        node_snapshot(nid, info, cutoff) for nid, info in nodes.items()
    ]
    return {
        "server_time": time.time(),
        "nodes": sorted(node_list, key=lambda n: n["id"]),
        "events": list(events),
    }


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass  # silence default per-request noise; we print our own lines

    def _send_json(self, payload, status=200):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.end_headers()

    def do_GET(self):
        if self.path == "/state":
            with state_lock:
                self._send_json(snapshot())

        elif self.path.startswith("/nodes/"):
            node_id = self.path[len("/nodes/"):]
            with state_lock:
                if node_id in nodes:
                    cutoff = time.time() - NODE_TIMEOUT
                    self._send_json(node_snapshot(node_id, nodes[node_id], cutoff))
                else:
                    self._send_json({"error": "node not found"}, status=404)

        elif self.path in ("/", "/health"):
            self._send_json({"status": "coordinator online"})

        else:
            self._send_json({"error": "not found"}, status=404)

    def do_DELETE(self):
        # DELETE /nodes/<node_id>  — remove a single node from the registry.
        if self.path.startswith("/nodes/"):
            node_id = self.path[len("/nodes/"):]
            with state_lock:
                if node_id in nodes:
                    del nodes[node_id]
                    record_event("deregister", node_id, "removed via dashboard")
                    print(f"[{now_ts()}] - {node_id} removed via dashboard")
                    self._send_json({"ok": True})
                else:
                    self._send_json({"error": "node not found"}, status=404)
        else:
            self._send_json({"error": "not found"}, status=404)

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length) if length else b"{}"
        try:
            msg = json.loads(raw.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            self._send_json({"error": "bad json"}, status=400)
            return

        # POST /reset — wipe all nodes, events, and counters.
        if self.path == "/reset":
            global event_counter
            with state_lock:
                nodes.clear()
                events.clear()
                event_counter = 0
            print(f"[{now_ts()}] *** RESET — all nodes, events, and telemetry cleared ***")
            self._send_json({"ok": True})
            return

        node_id = msg.get("node_id", "UNKNOWN")
        role = msg.get("role", "unknown")
        action = msg.get("action", "")   # "register" | "send" | "receive"
        detail = msg.get("detail", "")

        # IP is taken from the HTTP connection itself — the node never needs
        # to know or report its own address.
        source_ip = self.client_address[0]

        with state_lock:
            if node_id not in nodes:
                nodes[node_id] = {
                    "role": role,
                    "ip": source_ip,
                    # Receivers send their UDP port in the registration payload;
                    # senders don't listen so they send None.
                    "port": msg.get("port"),
                    "last_seen": time.time(),
                    "packets_sent": 0,
                    "packets_received": 0,
                }
                record_event("register", node_id, f"{role} joined from {source_ip}")
                port_str = f":{msg['port']}" if msg.get("port") else ""
                print(f"[{now_ts()}] + {node_id} registered as {role} ({source_ip}{port_str})")

            node = nodes[node_id]
            node["last_seen"] = time.time()
            node["role"] = role
            # Refresh IP and port in case the node restarted on a new address.
            node["ip"] = source_ip
            if msg.get("port") is not None:
                node["port"] = msg["port"]

            if action == "send":
                node["packets_sent"] += 1
                record_event("send", node_id, detail)
                print(f"[{now_ts()}]   {node_id} SEND  {detail}")
            elif action == "receive":
                node["packets_received"] += 1
                record_event("receive", node_id, detail)
                print(f"[{now_ts()}]   {node_id} RECV  {detail}")
            # "register" action: IP/port already refreshed above, nothing more to do.

        self._send_json({"ok": True})


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PORT
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)

    print("=" * 60)
    print("  COORDINATOR — online")
    print(f"  Listening on port {port}")
    print(f"  Dashboard → http://<this-pi-ip>:{port}/state")
    print(f"  Node lookup → GET http://<this-pi-ip>:{port}/nodes/<id>")
    print(f"  Reset all  → POST http://<this-pi-ip>:{port}/reset")
    print("  Press Ctrl+C to stop.")
    print("=" * 60)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nCoordinator stopped.")
        server.shutdown()


if __name__ == "__main__":
    main()
