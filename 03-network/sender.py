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
                        help="how many packets to send")
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

    for seq in range(1, args.count + 1):
        packet = build_packet(seq)
        print(f"\n[{timestamp()}] Packet #{seq} created:")
        print(f"  {packet}")

        # The deliberate pause - a packet takes TIME to travel.
        print(f"[{timestamp()}] Sending... watch it travel ({TRAVEL_DELAY_SECONDS}s)")
        time.sleep(TRAVEL_DELAY_SECONDS)

        message_bytes = json.dumps(packet).encode("utf-8")
        # Note: socket.sendto uses args.target (the routable address),
        # NEVER target_label. A node id is not something the network
        # can resolve.
        sock.sendto(message_bytes, (args.target, args.port))

        # Report the send. The detail string includes target_label so the
        # dashboard's guessTarget() can find the destination node id.
        report(args.coordinator, args.id, "send",
               detail=f"sent packet #{seq} to {target_label}")

        print(f"[{timestamp()}] Packet #{seq} sent!")

        # Small gap between packets when sending several.
        if seq < args.count:
            time.sleep(0.5)

    print("\nDone.")
    sock.close()


if __name__ == "__main__":
    main()
