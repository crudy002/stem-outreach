#!/usr/bin/env python3
"""
sender.py - Creates a "packet", sends it over UDP, and reports to the coordinator.

This is the visualization-aware version of the sender. It does everything the
original did (build a packet, pause, fire it over UDP), and ALSO reports to
the coordinator server so the React dashboard can show this node sending.

The coordinator reporting is best-effort: if the coordinator isn't running,
the report quietly fails and the core UDP demo still works as before.

TWO DIFFERENT "TARGETS"
There are two distinct ideas here, and they are NOT the same thing:
  --target     WHERE the packet physically goes. Must be routable by the
               network: an IP address (127.0.0.1, 192.168.1.50) or a real
               hostname. This is what socket.sendto() actually uses.
  --target-id  WHAT to call that destination on the dashboard. A friendly
               node ID like "PI-RECV". Purely cosmetic - it only exists so
               the visualization can draw the packet going to the right box.
               The network never sees this.

Run it:
    python sender.py --target 127.0.0.1 --target-id PI-RECV
    python sender.py --target 192.168.1.50 --target-id PI-02 --id PI-01
    python sender.py --target 127.0.0.1 --count 5
"""

import socket
import sys
import json
import time
import argparse
import urllib.request
from datetime import datetime

DEFAULT_PORT = 5005
DEFAULT_TARGET = "127.0.0.1"
DEFAULT_COORDINATOR = "127.0.0.1:8080"
TRAVEL_DELAY_SECONDS = 1.0


def timestamp():
    now = datetime.now()
    return now.strftime("%H:%M:%S.") + f"{now.microsecond // 1000:03d}"


def report(coordinator, node_id, action, detail=""):
    """Best-effort status report to the coordinator. Failure is swallowed."""
    payload = json.dumps({
        "node_id": node_id,
        "role": "sender",
        "action": action,
        "detail": detail,
    }).encode("utf-8")
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


def build_packet(sequence_number):
    """Assemble the packet contents as a simple dictionary."""
    return {
        "seq": sequence_number,
        "sent_at": timestamp(),
        "message": "Hello from the sender!",
        "ttl": 4,
    }


def main():
    parser = argparse.ArgumentParser(description="UDP packet sender")
    parser.add_argument("--target", default=DEFAULT_TARGET,
                        help="receiver IP address or hostname (routable)")
    parser.add_argument("--target-id", dest="target_id", default=None,
                        help="receiver's node id for the dashboard "
                             "(e.g. PI-RECV); cosmetic only")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT,
                        help="receiver UDP port")
    parser.add_argument("--id", default="PI-SEND",
                        help="this node's id shown on the dashboard")
    parser.add_argument("--coordinator", default=DEFAULT_COORDINATOR,
                        help="coordinator address as host:port")
    parser.add_argument("--count", type=int, default=1,
                        help="how many packets to send per trigger")
    parser.add_argument("--interactive", action="store_true",
                        help="keep running; press ENTER (optionally type a "
                             "number first) to send packets on demand")
    args = parser.parse_args()

    # For the dashboard label, prefer the explicit --target-id. If it wasn't
    # given, fall back to the raw --target (an IP) so the report still has
    # *something* - the dashboard's own fallback will handle the rest.
    target_label = args.target_id if args.target_id else args.target

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

    print("=" * 52)
    print("  PACKET SENDER")
    print(f"  Node id    : {args.id}")
    print(f"  Target     : {args.target}:{args.port}")
    print(f"  Target id  : {target_label}  (dashboard label)")
    print(f"  Coordinator: {args.coordinator}")
    print("=" * 52)

    # Announce ourselves so the dashboard shows this node right away.
    report(args.coordinator, args.id, "register")

    seq = 0

    def send_batch(count):
        nonlocal seq
        for _ in range(count):
            seq += 1
            packet = build_packet(seq)
            print(f"\n[{timestamp()}] Packet #{seq} created:")
            print(f"  {packet}")
            print(f"[{timestamp()}] Sending... watch it travel ({TRAVEL_DELAY_SECONDS}s)")
            time.sleep(TRAVEL_DELAY_SECONDS)

            message_bytes = json.dumps(packet).encode("utf-8")
            sock.sendto(message_bytes, (args.target, args.port))
            report(args.coordinator, args.id, "send",
                   detail=f"sent packet #{seq} to {target_label}")
            print(f"[{timestamp()}] Packet #{seq} sent!")

            if _ < count - 1:
                time.sleep(0.5)

    if args.interactive:
        print("\nINTERACTIVE MODE — press ENTER to send packet(s).")
        print("  Type a number before ENTER to send that many (e.g. '3 ENTER').")
        print("  Type 'q' and ENTER to quit.\n")
        try:
            while True:
                raw = input("» ").strip()
                if raw.lower() == "q":
                    break
                try:
                    count = int(raw) if raw else args.count
                    count = max(1, count)
                except ValueError:
                    print("  (enter a number or just press ENTER)")
                    continue
                send_batch(count)
        except (KeyboardInterrupt, EOFError):
            pass
        print("\nDone.")
    else:
        send_batch(args.count)
        print("\nDone.")

    sock.close()


if __name__ == "__main__":
    main()
