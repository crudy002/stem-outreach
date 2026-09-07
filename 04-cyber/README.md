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
build, offline operation, and Raspberry Pi specifics — rather than local
development, which the two READMEs above already cover.

## Running it at the booth

**Do you need Node/Python installed on the Pi itself?** Not necessarily —
Node is only needed for the `npm run build` step below, not for serving the
result, so if you build on a laptop and copy `cyber_ctf/dist/` over via
USB/`scp`, the Pi needs no Node at all. Python is only needed for the
leaderboard API, which is optional. The leanest booth setup for a
RAM-constrained Pi: build `dist/` elsewhere, copy it over, serve it with
nginx (or another non-Node static server) — nothing but a browser and a
static file server actually needs to run on the Pi.

Don't run `npm run dev` for the live event — it carries hot-reload/websocket
overhead meant for active development. Build once and serve the static
output instead:

```bash
cd cyber_ctf
npm install        # one-time, needs internet — see "Offline operation" below
npm run build       # outputs to dist/
npx serve dist -p 5173      # or: vite preview, or python3 -m http.server 5173 --directory dist
```

Point a fullscreen kiosk browser at `http://localhost:5173`.

If you're running the leaderboard API too, drop `--reload` (that flag is
dev-only autoreload, not needed once the code isn't changing) and let it
run continuously:

```bash
cd leaderboard-api
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000
```

Both processes are cheap enough to run as `systemd` services with
`Restart=on-failure` if you want the booth to self-recover from a crash
without someone SSHing in to restart it by hand.

## Offline operation

Once built, this needs **no internet connection** to run. Confirmed by
checking the actual source, not assuming:

- No CDN scripts, no Google Fonts, no third-party assets — the entire
  frontend is React/ReactDOM bundled into one ~58KB gzipped JS file, plus
  one local PNG logo. Fonts used are all system fonts (monospace stack,
  Comic Sans/cursive for the sticky note).
- The only network call the game makes is to the leaderboard API, and that
  defaults to `http://localhost:8000` — same machine or LAN, not the
  internet. Override the host with `VITE_LEADERBOARD_API_URL` if the API
  runs on a different box on the booth LAN (see `.env.example`).
- `leaderboard-api` is local SQLite + FastAPI — no external services.

The only step that needs internet is `npm install` / `pip install -r
requirements.txt`, to pull packages the first time. If the booth Pi itself
will never have internet access, run `npm install` + `npm run build` (and
`pip install`) on a machine that does, then copy `cyber_ctf/dist/` and the
`leaderboard-api/venv/` over via USB.

## Running this on a Raspberry Pi 3B

The 3B's constraint is RAM (1GB total, quad-core Cortex-A53), not CPU — the
game itself is light (no video/canvas, small bundle, cheap CSS animations),
so the actual bottleneck at the booth will be the browser plus everything
else running alongside it, not this app.

**OS recommendation: Raspberry Pi OS Lite (64-bit), not the Desktop image.**

- The 3B is 64-bit capable hardware, so use the 64-bit build — better
  package support and performance ceiling for Chromium/Node than 32-bit.
- **Lite**, not the full Desktop image: the Desktop image bundles LXDE, a
  panel, PCManFM, Bluetooth/print manager, etc. — services you don't need
  for a single fullscreen kiosk, and on 1GB of RAM that overhead is exactly
  the RAM you want free for Chromium instead. Add just what a kiosk needs
  on top of Lite:

  ```bash
  sudo apt install --no-install-recommends xserver-xorg x11-xserver-utils \
    xinit openbox chromium-browser
  ```

  Then autostart Chromium in kiosk mode from `.xinitrc` (or a systemd unit
  that runs `startx`), pointed at the local `serve`/`http.server` port:

  ```bash
  chromium-browser --kiosk --noerrdialogs --disable-infobars \
    --disable-session-crashed-bubble --overscroll-history-navigation=0 \
    http://localhost:5173
  ```

- **Bump the swap file.** Raspberry Pi OS defaults to a 100MB swapfile via
  `dphys-swapfile`; on 1GB of RAM, Chromium's memory spikes can hit that
  ceiling over a multi-hour event. Bump `CONF_SWAPSIZE` to 512–1024 in
  `/etc/dphys-swapfile` and `sudo systemctl restart dphys-swapfile`. It's a
  safety net against a kiosk crash, not something you'll rely on for normal
  operation if the Lite+openbox setup above is followed.
- **Use a decent SD card** (A1/A2-rated). The Pi 3B's SD reader is the
  storage bottleneck, not the CPU — a slow card shows up as sluggish
  browser paging/caching over a long session.
- If you'd rather not hand-roll the X11/openbox/autostart setup,
  [DietPi](https://dietpi.com/) is a lighter-than-Raspberry-Pi-OS distro
  built for exactly this (`dietpi-software` has a turnkey "Chromium kiosk"
  option) — worth considering if kiosk setup, not the game, is where you'd
  rather not spend time.

None of this is specific to the animations or features added recently —
they're all cheap `setInterval`-driven state updates and CSS
transform/opacity animations, not canvas/WebGL/video, so they don't change
the performance picture on a 3B one way or the other.
