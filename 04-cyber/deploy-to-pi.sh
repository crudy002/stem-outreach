#!/usr/bin/env bash
# Build the React app and sync it + the leaderboard API to the booth Pi.
#
# Run this from your laptop (needs Node); the Pi itself never needs Node.
# Only changed files are transferred (rsync, not a full re-copy), and the
# Pi's venv/leaderboard.db are left alone so re-deploys don't reinstall
# dependencies or wipe scores.
#
# Usage:
#   ./deploy-to-pi.sh dietpi@<pi-ip>
#   PI_REMOTE_DIR=/home/dietpi/cyber-ctf ./deploy-to-pi.sh dietpi@<pi-ip>

set -euo pipefail

PI_HOST="${1:?usage: deploy-to-pi.sh <user@host> (e.g. dietpi@192.168.1.42)}"
REMOTE_DIR="${PI_REMOTE_DIR:-/home/dietpi/cyber-ctf}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Building cyber_ctf/dist"
(cd "$SCRIPT_DIR/cyber_ctf" && npm install && npm run build)

echo "==> Ensuring remote directories exist"
ssh "$PI_HOST" "mkdir -p $REMOTE_DIR/cyber_ctf/dist $REMOTE_DIR/leaderboard-api"

echo "==> Syncing cyber_ctf/dist to $PI_HOST:$REMOTE_DIR/cyber_ctf/dist"
rsync -avz --delete \
  "$SCRIPT_DIR/cyber_ctf/dist/" \
  "$PI_HOST:$REMOTE_DIR/cyber_ctf/dist/"

echo "==> Syncing leaderboard-api to $PI_HOST:$REMOTE_DIR/leaderboard-api"
rsync -avz \
  --exclude venv \
  --exclude __pycache__ \
  --exclude leaderboard.db \
  --exclude .env \
  "$SCRIPT_DIR/leaderboard-api/" \
  "$PI_HOST:$REMOTE_DIR/leaderboard-api/"

echo "==> Installing any new Python deps and restarting the service on the Pi"
ssh "$PI_HOST" "
  set -e
  cd $REMOTE_DIR/leaderboard-api
  test -d venv || python3 -m venv venv
  ./venv/bin/pip install -q -r requirements.txt
  sudo systemctl restart cyber-ctf.service
  sudo systemctl --no-pager status cyber-ctf.service
"

echo "==> Done. Check http://<pi-ip>:8000"
