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

The actual packet traffic between Pis is UNCHANGED — it still goes Pi-to-Pi
over UDP. The Pis simply *also* tell the coordinator what they're up to.

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
# Shared state. Because ThreadingHTTPServer handles each request on its own
# thread, every read/write of this state is wrapped in a lock so two threads
# can't trip over each other.
# ---------------------------------------------------------------------------
state_lock = threading.Lock()

# nodes: { node_id: {"role": ..., "last_seen": ..., "packets_sent": int,
#                    "packets_received": int} }
nodes = {}

# events: a rolling list of recent things that happened, newest last.
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
        "kind": kind,          # "register" | "send" | "receive"
        "node": node_id,
        "detail": detail,
    })
    # Keep only the most recent MAX_EVENTS so memory stays bounded.
    if len(events) > MAX_EVENTS:
        del events[0:len(events) - MAX_EVENTS]


def snapshot():
    """Build the full picture the dashboard wants. Caller must hold lock."""
    cutoff = time.time() - NODE_TIMEOUT
    node_list = []
    for node_id, info in nodes.items():
        node_list.append({
            "id": node_id,
            "role": info["role"],
            "online": info["last_seen"] >= cutoff,
            "packets_sent": info["packets_sent"],
            "packets_received": info["packets_received"],
            "last_seen": info["last_seen"],
        })
    return {
        "server_time": time.time(),
        "nodes": sorted(node_list, key=lambda n: n["id"]),
        "events": list(events),
    }


class Handler(BaseHTTPRequestHandler):
    # Silence the default per-request console spam; we log our own lines.
    def log_message(self, *args):
        pass

    def _send_json(self, payload, status=200):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        # CORS header so the React dashboard can call us from a browser
        # even when it's served from a different origin.
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        # Browsers send a preflight OPTIONS request before a POST; approve it.
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.end_headers()

    def do_GET(self):
        # The dashboard polls this endpoint to get the live picture.
        if self.path == "/state":
            with state_lock:
                self._send_json(snapshot())
        elif self.path == "/" or self.path == "/health":
            self._send_json({"status": "coordinator online"})
        else:
            self._send_json({"error": "not found"}, status=404)

    def do_DELETE(self):
        # DELETE /nodes/<node_id>  — remove a node from the registry.
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
        # The Pis POST here to report what they're doing.
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length) if length else b"{}"
        try:
            msg = json.loads(raw.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            self._send_json({"error": "bad json"}, status=400)
            return

        node_id = msg.get("node_id", "UNKNOWN")
        role = msg.get("role", "unknown")
        action = msg.get("action", "")   # "register" | "send" | "receive"
        detail = msg.get("detail", "")

        with state_lock:
            # First time we've seen this node? Create its record.
            if node_id not in nodes:
                nodes[node_id] = {
                    "role": role,
                    "last_seen": time.time(),
                    "packets_sent": 0,
                    "packets_received": 0,
                }
                record_event("register", node_id, f"{role} joined")
                print(f"[{now_ts()}] + {node_id} registered as {role}")

            node = nodes[node_id]
            node["last_seen"] = time.time()
            node["role"] = role  # allow role to update

            if action == "send":
                node["packets_sent"] += 1
                record_event("send", node_id, detail)
                print(f"[{now_ts()}]   {node_id} SEND  {detail}")
            elif action == "receive":
                node["packets_received"] += 1
                record_event("receive", node_id, detail)
                print(f"[{now_ts()}]   {node_id} RECV  {detail}")
            elif action == "register":
                # Pure heartbeat / (re)registration; nothing extra to do.
                pass

        self._send_json({"ok": True})


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PORT
    # ThreadingHTTPServer handles each request on its own thread, so a slow
    # client can't freeze the whole server.
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)

    print("=" * 56)
    print("  COORDINATOR — online")
    print(f"  Listening on port {port}")
    print(f"  Dashboard should poll:  http://<this-pi-ip>:{port}/state")
    print("  Press Ctrl+C to stop.")
    print("=" * 56)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nCoordinator stopped.")
        server.shutdown()


if __name__ == "__main__":
    main()
