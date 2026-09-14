# STEM Outreach — Raspberry Pi Sandbox

A development sandbox for building hands-on STEM demos that run on Raspberry Pi
hardware. Built for K-12 community outreach events: the goal is a real "wow,
I want to do this" moment, backed by code that actually teaches something.

## Status

| Module          | What it does                                   | State           | Hardware needed   |
|-----------------|------------------------------------------------|-----------------|-------------------|
| `01-hello-gpio` | Button presses, blinking LEDs, sound — real I/O | Written, untested on hardware | Breadboard, LED, button |
| `02-sensors`    | Reads sensors, shows live data                 | Not started     | Sensors           |
| `03-network`    | Sends "packets" between Pis + live dashboard   | Works on localhost | None           |
| `04-cyber`      | Cyber range CTF: a booth-ready hacking game with a leaderboard | **Furthest along — deployable** | None (a screen) |
| `05-radio`      | Live RF spectrum in the terminal, FM audio     | Working, uncommitted edits | RTL-SDR dongle |
| `dashboard`     | React booth display for `03-network`           | In progress     | None              |
| `shared`        | Reusable helpers                               | —               | —                 |

`04-cyber` is the one module with a full deployment story — build script,
Pi provisioning, systemd, kiosk mode. If you only stand up one station,
stand up that one. It has [its own README](04-cyber/README.md).

## Project layout

```
stem-outreach/
├── README.md
├── 01-hello-gpio/      # hardware basics (needs breadboard + LED)
├── 02-sensors/         # sensor demos (needs sensors)
├── 03-network/         # packet send/receive — NO hardware needed
│   ├── sender.py
│   ├── receiver.py
│   └── coordinator.py  # HTTP server the dashboard polls
├── 04-cyber/           # the CTF booth station — NO hardware needed
│   ├── cyber_ctf/      # the React game
│   ├── leaderboard-api/ # FastAPI + SQLite run times
│   ├── setup-pi.sh     # provision a fresh DietPi
│   └── deploy-to-pi.sh # build + rsync + restart
├── 05-radio/           # RTL-SDR spectrum viewer (needs a dongle)
├── dashboard/          # React booth display for 03-network
├── shared/             # shared helper code
└── venv/               # python virtual environment (not committed)
```

## Setup

Recent Raspberry Pi OS blocks system-wide `pip install`, so we use a virtual
environment. One-time setup:

```bash
cd ~/stem-outreach
python3 -m venv venv
source venv/bin/activate
```

You'll need to run `source venv/bin/activate` each new terminal session.
Your prompt shows `(venv)` when it's active.

The network module uses only the Python standard library — nothing to install.

## Running the network demo

The network module is the foundation for the booth's packet-visualization
station. It needs **no hardware** — sender and receiver talk over the network,
or over localhost on a single Pi for testing.

Open two terminals (both with the venv active).

Terminal 1 — start the receiver (it waits and listens):

```bash
python 03-network/receiver.py
```

Terminal 2 — send a packet to it:

```bash
python 03-network/sender.py
```

On one Pi, the default `127.0.0.1` (localhost) works. To send between two Pis,
pass the receiver's IP:

```bash
python 03-network/sender.py 192.168.1.50
```

Find a Pi's IP with `hostname -I`.

## The teaching idea

A network packet is invisible. These demos make it visible: a button press
creates a packet, the packet travels (with a deliberate delay so kids can see
it isn't instant), and arrival triggers something physical — an LED, a sound.
The booth display shows the same hops on screen as an animation.

UDP is used on purpose: it's connectionless, so each packet is one discrete,
visible thing — which is exactly the mental model we want kids to walk away with.

## The visualization dashboard

`coordinator.py` is a small HTTP server (stdlib only). The sender and
receiver POST short status reports to it; a React dashboard polls its
`/state` endpoint twice a second and renders the live topology.

The packet traffic between Pis is unchanged — still UDP, Pi-to-Pi. The
coordinator only observes. If it's not running, the reporting fails
silently and the core demo still works.

To run the full visualized demo, three terminals:

```bash
python 03-network/coordinator.py                          # 1: the server
python 03-network/receiver.py --id PI-02                  # 2: a receiver
python 03-network/sender.py --id PI-01 --count 5          # 3: send packets
```

Then open the React dashboard. It defaults to SIMULATION mode (works with
no Pi at all); switch to LIVE mode and enter `http://<pi-ip>:8080` to see
real traffic.

## Roadmap

Network station:

- [x] Folder structure + venv
- [x] Network sender / receiver working over localhost
- [x] Coordinator server + React dashboard (live topology view)
- [ ] Tested between two Pis
- [ ] GPIO: received packet lights an LED
- [ ] Multi-hop chain (packet routed through 3-4 Pis)
- [ ] Booth display polished for event use

Cyber station (see [04-cyber/TODO.txt](04-cyber/TODO.txt) for detail):

- [x] CTF game: login → filesystem → escalation → payload
- [x] Three difficulty modes, each with its own leaderboard
- [x] One-process deployment, Pi provisioning, kiosk mode
- [ ] Fail states — getting caught by intrusion detection
- [ ] Lock down `DELETE /scores` before running on public WiFi
