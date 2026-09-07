#!/usr/bin/env bash
# One-time provisioning for a fresh DietPi Pi: installs the kiosk/service
# packages, writes the systemd unit and sudoers rule, and sets the kiosk
# URL + resolution in /boot/dietpi.txt. Safe to re-run (idempotent).
#
# Run this once per new Pi, BEFORE the first deploy-to-pi.sh. It does not
# push the app itself (deploy-to-pi.sh does that) — this only prepares the
# system so that first deploy actually has something to restart into.
#
# Why this exists: doing this by hand (as we did for the first Pi) is easy
# to get subtly wrong — e.g. starting the service once without `User=`
# baked in creates root-owned files that silently break score submission
# later (see leaderboard-api's README/git history for that exact bug), and
# DietPi's default kiosk resolution (1280x720) rarely matches the actual
# screen. This script bakes in the versions of those settings we know work.
#
# Usage:
#   ./setup-pi.sh dietpi@<pi-ip> [WIDTHxHEIGHT]
#   ./setup-pi.sh dietpi@192.168.1.155 1920x1080
#
# If WIDTHxHEIGHT is omitted, it's auto-detected from the Pi's own `xrandr`
# output (requires the display to already be connected and X previously
# started at least once — DietPi's Chromium install does this). Falls back
# to 1920x1080 if detection fails.

set -euo pipefail

PI_HOST="${1:?usage: setup-pi.sh <user@host> [WIDTHxHEIGHT] (e.g. dietpi@192.168.1.42 1920x1080)}"
RES="${2:-}"
REMOTE_DIR="${PI_REMOTE_DIR:-/home/dietpi/cyber-ctf}"
REMOTE_USER="${PI_REMOTE_USER:-dietpi}"

echo "==> Installing kiosk + Python packages (skips anything already present)"
ssh "$PI_HOST" "sudo apt-get update -qq && sudo apt-get install -y --no-install-recommends \
  chromium xserver-xorg xinit x11-xserver-utils python3-venv python3-pip"

if [ -z "$RES" ]; then
  echo "==> No resolution given, detecting via xrandr"
  RES="$(ssh "$PI_HOST" "DISPLAY=:0 xrandr 2>/dev/null | grep -oE '[0-9]+x[0-9]+\+0\+0' | head -1 | grep -oE '^[0-9]+x[0-9]+'" || true)"
  if [ -z "$RES" ]; then
    echo "    Could not detect a resolution (is the display connected and X ever started?). Defaulting to 1920x1080."
    RES="1920x1080"
  else
    echo "    Detected $RES"
  fi
fi
RES_X="${RES%x*}"
RES_Y="${RES#*x}"

echo "==> Creating remote directories and fixing ownership"
ssh "$PI_HOST" "mkdir -p $REMOTE_DIR/cyber_ctf/dist $REMOTE_DIR/leaderboard-api && sudo chown -R $REMOTE_USER:$REMOTE_USER $REMOTE_DIR"

echo "==> Writing systemd unit (cyber-ctf.service)"
ssh "$PI_HOST" "sudo tee /etc/systemd/system/cyber-ctf.service > /dev/null" <<UNIT
[Unit]
Description=Cyber CTF (leaderboard API + built frontend)
After=network.target

[Service]
Type=simple
User=$REMOTE_USER
WorkingDirectory=$REMOTE_DIR/leaderboard-api
ExecStart=$REMOTE_DIR/leaderboard-api/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=on-failure
RestartSec=2

[Install]
WantedBy=multi-user.target
UNIT

echo "==> Writing sudoers rule (passwordless restart/status for this one service)"
ssh "$PI_HOST" "echo '$REMOTE_USER ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart cyber-ctf.service, /usr/bin/systemctl status cyber-ctf.service' | sudo tee /etc/sudoers.d/cyber-ctf > /dev/null && sudo visudo -c -f /etc/sudoers.d/cyber-ctf"

echo "==> Setting kiosk URL + resolution ($RES_X x $RES_Y) in /boot/dietpi.txt"
ssh "$PI_HOST" "sudo sed -i \
  -e 's|^SOFTWARE_CHROMIUM_AUTOSTART_URL=.*|SOFTWARE_CHROMIUM_AUTOSTART_URL=http://127.0.0.1:8000|' \
  -e 's|^SOFTWARE_CHROMIUM_RES_X=.*|SOFTWARE_CHROMIUM_RES_X=$RES_X|' \
  -e 's|^SOFTWARE_CHROMIUM_RES_Y=.*|SOFTWARE_CHROMIUM_RES_Y=$RES_Y|' \
  /boot/dietpi.txt"

echo "==> Reloading systemd (unit not started yet — nothing to run until deploy-to-pi.sh pushes the app)"
ssh "$PI_HOST" "sudo systemctl daemon-reload && sudo systemctl enable cyber-ctf.service"

cat <<EOF

==> Done. Next steps:
    1. ./deploy-to-pi.sh $PI_HOST     # push the app and start the service
    2. sudo reboot                    # (on the Pi) apply the kiosk URL/resolution and launch Chromium
EOF
