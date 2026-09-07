#!/usr/bin/env python3
"""
receiver.py — Listens for "packets" over UDP, and reports to the coordinator.

This is the visualization-aware version of the receiver. It does everything
the original did (listen for UDP packets, print them), and ALSO sends a
short status report to the coordinator server over HTTP so the React
dashboard can show this node lighting up when a packet arrives.

The coordinator reporting is best-effort: if the coordinator isn't running,
the report quietly fails and the core UDP demo still works exactly as before.

Run it:
    python receiver.py
    python receiver.py --port 6000 --id PI-02 --coordinator 192.168.1.10:8080
"""

import socket
import sys
import os
import json
import argparse
import threading
import subprocess
import urllib.request
from datetime import datetime

DEFAULT_PORT = 5005
LISTEN_ADDRESS = "0.0.0.0"
DEFAULT_COORDINATOR = "127.0.0.1:8080"


def _gui_available():
    """Return True if we have a shot at showing a desktop dialog."""
    if sys.platform == "darwin":
        return True  # macOS always has osascript
    if sys.platform.startswith("linux"):
        return bool(os.environ.get("DISPLAY") or os.environ.get("WAYLAND_DISPLAY"))
    return False


def show_gui_notification(seq, sender_ip, payload):
    """Pop a non-blocking desktop dialog/notification if a display is available."""
    if not _gui_available():
        return

    title = "Packet Received!"
    msg_line = payload.get("message", "")
    body = f"Packet #{seq} from {sender_ip}\n{msg_line}" if msg_line else f"Packet #{seq} from {sender_ip}"

    def _show():
        # macOS: use osascript display notification (non-modal, appears in NC)
        if sys.platform == "darwin":
            try:
                subprocess.run(
                    ["osascript", "-e",
                     f'display notification "{body}" with title "{title}"'],
                    timeout=3, capture_output=True,
                )
                return
            except Exception:
                pass

        # Linux / fallback: tkinter modal dialog
        try:
            import tkinter as tk
            from tkinter import messagebox
            root = tk.Tk()
            root.withdraw()
            root.attributes("-topmost", True)
            messagebox.showinfo(title, body, parent=root)
            root.destroy()
        except Exception:
            pass

    threading.Thread(target=_show, daemon=True).start()


def timestamp():
    now = datetime.now()
    return now.strftime("%H:%M:%S.") + f"{now.microsecond // 1000:03d}"


def report(coordinator, node_id, action, detail="", port=None):
    """
    Tell the coordinator what we just did. Best-effort: any failure is
    swallowed so the core UDP demo never breaks just because the dashboard
    server happens to be off.

    port is included on registration so the coordinator can store this
    node's UDP address and hand it to senders on request.
    """
    body = {
        "node_id": node_id,
        "role": "receiver",
        "action": action,
        "detail": detail,
    }
    if port is not None:
        body["port"] = port
    payload = json.dumps(body).encode("utf-8")
    try:
        req = urllib.request.Request(
            f"http://{coordinator}/",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        urllib.request.urlopen(req, timeout=1.0).read()
    except Exception:
        pass  # coordinator offline - fine, keep going


def main():
    parser = argparse.ArgumentParser(description="UDP packet receiver")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT,
                        help="UDP port to listen on")
    parser.add_argument("--id", default="PI-RECV",
                        help="node id shown on the dashboard")
    parser.add_argument("--coordinator", default=DEFAULT_COORDINATOR,
                        help="coordinator address as host:port")
    args = parser.parse_args()

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind((LISTEN_ADDRESS, args.port))

    print("=" * 52)
    print("  PACKET RECEIVER - online")
    print(f"  Node id   : {args.id}")
    print(f"  UDP port  : {args.port}")
    print(f"  Coordinator: {args.coordinator}")
    print("  Waiting for packets... (Ctrl+C to stop)")
    print("=" * 52)

    # Announce ourselves so the dashboard shows this node right away,
    # even before any packet arrives. Include our UDP port so senders
    # can look us up by node ID without needing to know our IP.
    report(args.coordinator, args.id, "register", port=args.port)

    packet_count = 0
    try:
        while True:
            raw_data, sender_address = sock.recvfrom(1024)
            packet_count += 1
            sender_ip, sender_port = sender_address

            try:
                payload = json.loads(raw_data.decode("utf-8"))
            except (json.JSONDecodeError, UnicodeDecodeError):
                payload = {"message": raw_data.decode("utf-8", errors="replace")}

            seq = payload.get("seq", "?")
            print(f"\n[{timestamp()}] PACKET #{packet_count} RECEIVED")
            print(f"  from   : {sender_ip}:{sender_port}")
            print(f"  payload: {payload}")

            # Report the arrival so the dashboard can flash this node.
            report(args.coordinator, args.id, "receive",
                   detail=f"got packet #{seq} from {sender_ip}")

            # Show a desktop notification/dialog if a display is available.
            show_gui_notification(seq, sender_ip, payload)

            # --- HARDWARE HOOK ---------------------------------------------
            # Wire an LED here later:  led.on(); sleep(0.5); led.off()
            # ---------------------------------------------------------------

    except KeyboardInterrupt:
        print(f"\n\nReceiver stopped. Handled {packet_count} packet(s).")
    finally:
        sock.close()


if __name__ == "__main__":
    main()
