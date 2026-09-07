# Cyber Range — Booth Deployment

Two pieces make up the booth station:

- [cyber_ctf/](cyber_ctf) — the React game itself (login → filesystem →
  privilege escalation → p0wned). See its [README](cyber_ctf/README.md) for
  how the challenge plays and how the code is organized.
- [leaderboard-api/](leaderboard-api) — optional FastAPI + SQLite service
  that records run times. See its [README](leaderboard-api/README.md) for
  the API. The game works fine without it; score submission just fails
  silently and the finish screen says so.

This file covers running the whole thing **at the booth** — production
build, serving it all from FastAPI, offline operation, and Raspberry
Pi/DietPi specifics — rather than local development, which the two READMEs
above already cover.

## Running it at the booth

**One process instead of two.** `leaderboard-api/main.py` can serve the
built React app itself — if `cyber_ctf/dist/` exists, FastAPI mounts it as
static files at `/`, alongside the existing `/scores` and `/health` API
routes on the same port. That means one `uvicorn` process, one port, no
nginx/`serve`/`http.server` needed, and one `systemd` unit to babysit
instead of two. This is the recommended booth setup below.

(You can still run the frontend as a separate static server if you'd
rather keep the two pieces fully independent — anything that serves
`cyber_ctf/dist/` works, e.g. `npx serve dist -p 5173` or `vite preview`.
The combined FastAPI setup is just less to manage on a single Pi.)

**Do you need Node on the Pi itself?** No — Node is only needed for the
`npm run build` step, not for serving the result. Build `dist/` on a
laptop and copy it over (`scp`, USB, whatever), and the Pi never needs
Node installed. Python *is* needed on the Pi, since it's what serves both
the app and the API.

Don't run `npm run dev` for the live event — it carries hot-reload/websocket
overhead meant for active development. Build once, copy the output over,
and let FastAPI serve it:

```bash
# on your laptop (or any machine with Node)
cd cyber_ctf
npm install          # one-time, needs internet — see "Offline operation" below
npm run build        # outputs to dist/ (~830KB, ~59KB gzipped JS)

# copy dist/ and leaderboard-api/ to the Pi, e.g.:
# (rsync only creates the last path component, not the whole parent chain,
# so mkdir -p the target dirs first — otherwise it fails with "No such
# file or directory" on a Pi that's never been deployed to before)
ssh dietpi@<pi-ip> mkdir -p /home/dietpi/cyber-ctf/cyber_ctf/dist \
  /home/dietpi/cyber-ctf/leaderboard-api
rsync -avz dist/ dietpi@<pi-ip>:/home/dietpi/cyber-ctf/cyber_ctf/dist/
rsync -avz --exclude venv --exclude __pycache__ --exclude leaderboard.db \
  ../leaderboard-api/ dietpi@<pi-ip>:/home/dietpi/cyber-ctf/leaderboard-api/
```

(See "Getting code onto the Pi" below for why `rsync` of just these two
folders, not a full `git clone` of the repo or a fresh `scp -r` every time
— and for [deploy-to-pi.sh](deploy-to-pi.sh), which wraps this into one
command for repeat deploys.)

On the Pi (first time only — see below for redeploys):

```bash
cd leaderboard-api
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

Then point a fullscreen kiosk browser at `http://localhost:8000` — that's
the game, the API, and (at `/docs`) the interactive API docs, all from one
process. No `--reload` at the booth; that flag is dev-only autoreload.

If you ever need to point the frontend's `dist/` build at a *different*
box than the one serving it (e.g. one shared leaderboard API for multiple
booth Pis), set `VITE_LEADERBOARD_API_URL` before `npm run build` — see
[cyber_ctf/.env.example](cyber_ctf/.env.example). Left at its default, the
built app calls `http://localhost:8000`, which is correct for the combined
single-Pi setup above since everything's on the same origin.

This one process is cheap enough to run as a `systemd` service with
`Restart=on-failure` so the booth self-recovers from a crash without
someone SSHing in to restart it by hand — see the DietPi section below for
a unit file.

## Getting code onto the Pi

**Don't `git clone` this whole repo onto the Pi.** `04-cyber` is one
module in a larger monorepo (`01-hello-gpio`, `02-sensors`, `dashboard`,
etc.) — cloning the lot pulls in everything else for no reason, and it
means installing `git` and pulling full history onto a device that's just
supposed to serve two folders. The Pi doesn't need to be a git client at
all; treat it as a deploy target instead.

**Don't `scp -r` the whole `dist/` folder fresh every time either** — it
works, but it re-copies every file whether it changed or not, which adds
up if you're iterating at the booth (tweak a challenge hint, rebuild,
redeploy, repeat). `rsync` does the same job but only transfers what
changed, so a redeploy after a one-line fix is near-instant instead of
pushing all ~830KB again.

What actually needs to reach the Pi:

- `cyber_ctf/dist/` — the build output. Rebuild on your laptop, rsync over.
- `leaderboard-api/` **source** (`main.py`, `requirements.txt`) — but not
  `venv/` (rebuilt on the Pi once, arch-specific anyway) or
  `leaderboard.db` (that's live data on the Pi; overwriting it from your
  laptop's copy would wipe scores collected at the booth).

[`deploy-to-pi.sh`](deploy-to-pi.sh) wraps all of this into one command —
builds `dist/`, rsyncs both folders with the right excludes, then SSHes in
to `pip install` any new dependencies and restart the `systemd` service:

```bash
./deploy-to-pi.sh dietpi@<pi-ip>
```

For the restart step to work non-interactively, the Pi's user needs
passwordless sudo for just that one command — add this once via
`sudo visudo`:

```
dietpi ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart cyber-ctf.service, /usr/bin/systemctl status cyber-ctf.service
```

(Scoped to those two exact commands, not blanket `NOPASSWD: ALL` — no
reason to widen sudo access on the booth Pi beyond what the deploy script
actually needs.) Without this, drop the `ssh ... systemctl restart` step
from the script and just restart it yourself over SSH after each deploy.

If you'd rather have the Pi pull instead of having your laptop push
(useful if several people are deploying, or you're not on the same LAN as
the Pi), a private git remote + `git pull` on the Pi is a reasonable
alternative — just keep it scoped to `04-cyber` (a sparse checkout, or a
separate small repo for the booth) rather than cloning the whole
monorepo, for the same reason as above.

## Offline operation

Once built, this needs **no internet connection** to run. Confirmed by
checking the actual source, not assuming:

- No CDN scripts, no Google Fonts, no third-party assets — the entire
  frontend is React/ReactDOM bundled into one ~58KB gzipped JS file, plus
  one local PNG logo. Fonts used are all system fonts (monospace stack,
  Comic Sans/cursive for the sticky note).
- The only network call the game makes is to the leaderboard API, and that
  defaults to `http://localhost:8000` — same origin as the combined
  FastAPI setup above, same machine or LAN either way, not the internet.
  Override the host with `VITE_LEADERBOARD_API_URL` before building if the
  API runs on a different box on the booth LAN (see `.env.example`).
- `leaderboard-api` is local SQLite + FastAPI — no external services.

The only step that needs internet is `npm install` / `pip install -r
requirements.txt`, to pull packages the first time. If the booth Pi itself
will never have internet access, run `npm install` + `npm run build` (and
`pip install`) on a machine that does, then copy `cyber_ctf/dist/` and the
`leaderboard-api/venv/` over via USB.

## Running this on a Raspberry Pi with DietPi

The Pi's constraint at the booth is RAM (1GB on a 3B), not CPU — the game
itself is light (no video/canvas, small bundle, cheap CSS animations), and
the API is a single SQLite-backed uvicorn process. The actual bottleneck is
the browser plus whatever the OS runs alongside it, not this app. That's
the case for [DietPi](https://dietpi.com/) over Raspberry Pi OS: it boots
with far fewer background services than even the Lite image, and its
`dietpi-software` tool installs a kiosk browser and lets you pick "boot
straight to Chromium" without hand-rolling X11/openbox/autostart yourself.

### 1. Flash and first boot

- Get the DietPi image for your Pi model from
  [dietpi.com/#downloads](https://dietpi.com/#downloads) and write it with
  Raspberry Pi Imager (or `dd`/balenaEtcher).
- Boot it, SSH in (or use a keyboard/monitor), and let the first-run
  `dietpi-update` / `dietpi-config` prompts finish — set a hostname and,
  if you're on WiFi, the network there.

### 2. Provision the Pi

[`setup-pi.sh`](setup-pi.sh) does everything below in one idempotent run —
safe to re-run any time, including on a Pi you've already set up by hand:

```bash
./setup-pi.sh dietpi@<pi-ip>              # auto-detects the screen resolution via xrandr
./setup-pi.sh dietpi@<pi-ip> 1920x1080    # or set it explicitly
```

It installs Chromium/X11/Python packages via `apt` (skips anything already
present, so it's cheap to re-run), writes the `cyber-ctf.service` systemd
unit with **`User=dietpi` baked in from the start**, adds a sudoers rule
scoped to just `systemctl restart/status cyber-ctf.service` (so
`deploy-to-pi.sh` can restart it without a password prompt), and sets
`SOFTWARE_CHROMIUM_AUTOSTART_URL`/`_RES_X`/`_RES_Y` in `/boot/dietpi.txt`
to `http://127.0.0.1:8000` and the detected resolution.

The `User=dietpi` part matters more than it looks: if the service is ever
started once *without* it (defaulting to root), the files it creates —
`leaderboard.db`, `__pycache__` — end up root-owned, and once you add
`User=dietpi` afterwards, that already-root-owned `leaderboard.db` becomes
unwritable to the dietpi-owned process, so every score submission fails
with `sqlite3.OperationalError: attempt to write a readonly database`
while everything else looks fine (the API still starts, `GET /scores`
still works — only writes fail). This exact bug happened once already
setting this up by hand, which is why `setup-pi.sh` exists.

One thing it doesn't set: which DietPi autostart target actually boots
into Chromium. That's a one-time interactive pick (DietPi doesn't expose
it as a scriptable `dietpi.txt` value that reliably takes effect after
first boot):

```bash
ssh dietpi@<pi-ip>
sudo dietpi-autostart
# pick "Chromium kiosk" (menu number varies by DietPi version — search if needed)
```

### 3. Deploy the app

```bash
./deploy-to-pi.sh dietpi@<pi-ip>
```

Builds `cyber_ctf/dist`, rsyncs it plus `leaderboard-api`'s source to the
Pi, installs any new Python deps into its venv, and restarts the service
(see "Getting code onto the Pi" above for what this does and why).

### 4. Reboot and check

```bash
ssh dietpi@<pi-ip> sudo reboot
```

`/boot/dietpi.txt` changes need a reboot to take effect. After it comes
back, the kiosk should show the game fullscreen at the right resolution.
If it doesn't, work through it top-down: is `cyber-ctf.service` active
(`systemctl status`), does `curl http://127.0.0.1:8000/health` succeed on
the Pi itself, and does `ps aux | grep chromium` show the URL you expect
(catches a stale `https://` or wrong resolution baked into an old config).

### 5. A few RAM/reliability notes

- **Swap**: DietPi defaults to a small `dphys-swapfile`/zram setup that's
  usually fine, but on a 1GB Pi 3B running Chromium for hours, bump it via
  `dietpi-config` → Performance Options → Swapfile Size to 512MB+ as a
  safety net against a kiosk crash under memory pressure — not something
  you should need for normal operation.
- **SD card**: use an A1/A2-rated card. On a 3B the SD reader, not the CPU,
  is the storage bottleneck, and a slow card shows up as sluggish
  browser paging over a multi-hour session.
- **Disable what you don't use**: DietPi ships close to nothing running by
  default, but if you enabled anything during setup you don't need at the
  booth (Bluetooth, a desktop environment, etc.), `dietpi-software` lets
  you uninstall it — every bit of freed RAM goes to Chromium.

None of this is specific to the animations or features added recently —
they're all cheap `setInterval`-driven state updates and CSS
transform/opacity animations, not canvas/WebGL/video, so they don't change
the performance picture on a 3B one way or the other.

If you'd rather use Raspberry Pi OS Lite instead of DietPi, the same
systemd service and Chromium kiosk flags above work unchanged — you'd just
install Chromium/Python via `apt` and wire up the kiosk autostart yourself
via `.xinitrc`/openbox rather than `dietpi-autostart`'s menu.

## Cloning the Pi for multiple booth stations

Once one Pi is fully working (steps 1–4 above done, kiosk confirmed
showing the game), cloning its SD card is faster than re-running setup on
every additional station — everything above is already baked in.

### Before imaging

- **Reset the leaderboard** so the clone doesn't start with another
  station's test scores already on the board:
  ```bash
  ssh dietpi@<pi-ip> "curl -X DELETE http://127.0.0.1:8000/scores"
  ```
- **Decide on hostnames.** Every clone boots with the same hostname
  unless you change it. `AUTO_SETUP_NET_HOSTNAME` in `/boot/dietpi.txt` is
  editable straight from a card reader before first boot (`/boot` is a
  plain FAT32 partition on DietPi's SD card) — worth setting per-station
  if more than one will be on the same LAN at once, since duplicate
  hostnames cause mDNS/`.local`-name confusion.

### Creating the image (from a Mac)

```bash
diskutil list                      # find the card, e.g. /dev/disk4 (NOT /dev/disk4s1)
diskutil unmountDisk /dev/disk4
sudo dd if=/dev/rdisk4 of=~/cyber-ctf-golden.img bs=4m status=progress
gzip ~/cyber-ctf-golden.img         # optional, shrinks a mostly-empty card a lot
```

`/dev/rdisk4` (the raw device) is much faster than `/dev/disk4` for this.
[ApplePi-Baker](https://www.tweaking4all.com/hardware/raspberry-pi/macosx-apple-pi-baker/)
is a GUI alternative built for exactly this workflow if you'd rather not
run `dd` by hand.

### Flashing a clone

```bash
sudo dd if=~/cyber-ctf-golden.img of=/dev/rdisk5 bs=4m status=progress
```

(or Raspberry Pi Imager → "Use custom" → point it at the `.img`/`.img.gz`.)

### After first boot of the clone

- **Regenerate SSH host keys.** A clone boots with identical Dropbear
  host keys to the source Pi — mostly harmless on an isolated booth LAN,
  but it'll trip a "REMOTE HOST IDENTIFICATION HAS CHANGED" warning on any
  laptop that previously SSHed into that same IP address for a different
  physical Pi:
  ```bash
  ssh dietpi@<clone-ip> "sudo rm -f /etc/dropbear/dropbear_*_host_key && sudo systemctl restart dropbear"
  ```
- Confirm the leaderboard is actually empty
  (`curl http://127.0.0.1:8000/scores` → `[]`) and the kiosk is showing
  the game before calling the station ready.

For a single station, `setup-pi.sh` + `deploy-to-pi.sh` on a fresh DietPi
flash is simple enough that imaging doesn't save much — this is worth
doing once you're standing up two or more physical Pis.
