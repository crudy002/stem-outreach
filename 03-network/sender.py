#!/usr/bin/env python3
"""
sender.py — Creates packets, resolves the target via the coordinator, and
sends them over UDP.

ARCHITECTURE
Previously the sender needed two separate arguments: --target (raw IP for
the socket) and --target-id (cosmetic node ID for the dashboard). That
split was fragile — you had to keep them in sync manually.

Now the coordinator is the single source of truth for addresses:
  1. The receiver registers its node ID + UDP port with the coordinator.
     The coordinator records its IP automatically from the HTTP connection.
  2. The sender registers itself, then asks the coordinator for the target
     node's IP and port by node ID.
  3. The UDP packet goes directly Pi-to-Pi as before; only the address
     lookup goes through the coordinator.

Everything at the application layer uses node IDs. Raw IPs are an
implementation detail that never surfaces in commands or the dashboard.

Run it:
    python sender.py --target PI-RECV
    python sender.py --target PI-02 --id PI-01 --coordinator 192.168.1.10:8080
    python sender.py --target PI-RECV --interactive
    python sender.py --target PI-RECV --count 5
"""

import socket
import json
import time
import argparse
import urllib.request
import urllib.error
from datetime import datetime

DEFAULT_COORDINATOR = "127.0.0.1:8080"
DEFAULT_TARGET_ID = "PI-RECV"
TRAVEL_DELAY_SECONDS = 1.0
RESOLVE_RETRIES = 10
RESOLVE_DELAY = 2.0


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
        pass  # coordinator offline - fine, UDP demo still works


def resolve_target(coordinator, target_id):
    """
    Ask the coordinator for target_id's current IP and UDP port.
    Retries up to RESOLVE_RETRIES times with RESOLVE_DELAY seconds between
    attempts so the sender can start before the receiver if needed.
    Returns (ip, port) or raises SystemExit if the target never appears.
    """
    url = f"http://{coordinator}/nodes/{target_id}"
    for attempt in range(RESOLVE_RETRIES):
        try:
            with urllib.request.urlopen(url, timeout=2.0) as r:
                data = json.loads(r.read().decode("utf-8"))
            ip = data.get("ip")
            port = data.get("port")
            if ip and port:
                return ip, int(port)
            print(f"  [{timestamp()}] {target_id} registered but missing ip/port, retrying...")
        except urllib.error.HTTPError as e:
            if e.code == 404:
                print(f"  [{timestamp()}] waiting for {target_id} to register "
                      f"({attempt + 1}/{RESOLVE_RETRIES})...")
            else:
                print(f"  [{timestamp()}] coordinator error {e.code}, retrying...")
        except Exception:
            print(f"  [{timestamp()}] coordinator unreachable, retrying "
                  f"({attempt + 1}/{RESOLVE_RETRIES})...")
        if attempt < RESOLVE_RETRIES - 1:
            time.sleep(RESOLVE_DELAY)

    raise SystemExit(
        f"\nERROR: {target_id} never appeared in the coordinator after "
        f"{RESOLVE_RETRIES} attempts. Is the receiver running and pointing "
        f"at the same coordinator?"
    )


def build_packet(sequence_number):
    return {
        "seq": sequence_number,
        "sent_at": timestamp(),
        "message": "Hello from the sender!",
        "ttl": 4,
    }


def main():
    parser = argparse.ArgumentParser(description="UDP packet sender")
    parser.add_argument("--target", default=DEFAULT_TARGET_ID,
                        help="target receiver's node ID (coordinator resolves "
                             "the actual IP:port)")
    parser.add_argument("--id", default="PI-SEND",
                        help="this node's ID on the coordinator/dashboard")
    parser.add_argument("--coordinator", default=DEFAULT_COORDINATOR,
                        help="coordinator address as host:port")
    parser.add_argument("--count", type=int, default=1,
                        help="packets to send per trigger (default 1)")
    parser.add_argument("--interactive", action="store_true",
                        help="keep running; press ENTER (optionally type a "
                             "number first) to send packets on demand")
    args = parser.parse_args()

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

    print("=" * 56)
    print("  PACKET SENDER")
    print(f"  Node id    : {args.id}")
    print(f"  Target     : {args.target}  (resolved via coordinator)")
    print(f"  Coordinator: {args.coordinator}")
    print("=" * 56)

    # Register so the dashboard shows this node immediately.
    report(args.coordinator, args.id, "register")

    seq = 0

    def send_batch(count):
        nonlocal seq
        # Re-resolve the target's address on every batch so the sender
        # automatically picks up a new IP if the receiver restarts.
        target_ip, target_port = resolve_target(args.coordinator, args.target)
        print(f"  → {args.target} resolved to {target_ip}:{target_port}")

        for _ in range(count):
            seq += 1
            packet = build_packet(seq)
            print(f"\n[{timestamp()}] Packet #{seq} created:")
            print(f"  {packet}")
            print(f"[{timestamp()}] Sending... watch it travel ({TRAVEL_DELAY_SECONDS}s)")
            time.sleep(TRAVEL_DELAY_SECONDS)

            sock.sendto(json.dumps(packet).encode("utf-8"), (target_ip, target_port))
            report(args.coordinator, args.id, "send",
                   detail=f"sent packet #{seq} to {args.target}")
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
