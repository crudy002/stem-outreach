# Cyber Range — CTF Prototype

A standalone React app for the booth's cybersecurity challenge station.
Single-page experience: login → file system → privilege escalation → "p0wned".

## Run it

```bash
cd ctf-app
npm install        # first time only (slow on a Pi — be patient)
npm run dev
```

Vite prints two URLs:

- `http://localhost:5173` — open on the Pi itself
- `http://<pi-ip>:5173` — open from a laptop/phone on the same WiFi

Either works. The booth display would just be a fullscreen browser pointed
at one of these.

## How to play it (for testing)

1. Enter a callsign on the mission briefing screen — this starts the clock
   and is the name recorded on the leaderboard.
2. Login screen: try anything — it tells you when you're wrong. The intel
   panel hints: `admin` / `password`.
3. Terminal: `ls`, then `ls config/`, then `cat config/credentials.txt`
   (or `grep password config/credentials.txt`). Copy the flag from that
   file. The shell also supports `cd`, `pwd`, `head`, `find`, `file`,
   `whoami`, `id`, `history`, `man <cmd>`, Tab-completion, and ↑/↓ to
   recall previous commands.
4. `sudo su` prompts for a password (masked input, 3 attempts, just like
   a real terminal) — enter the flag from credentials.txt.
5. Pick "INJECT PAYLOAD" to win the final flag.
6. The finish screen records the run time to the leaderboard API (see
   [../leaderboard-api](../leaderboard-api)) and shows your rank; the
   🏆 LEADERBOARD button (header, or on the finish screen) shows the
   fastest times.
7. RESET in the header puts you back to the callsign screen for the next
   kid.

The leaderboard integration is optional — if `../leaderboard-api` isn't
running, the game still plays fine; score submission just fails silently
with a note on the finish screen. Point it at a non-default API host with
`VITE_LEADERBOARD_API_URL` (see `.env.example`).

## Where things live

```
ctf-app/
├── index.html          # html shell
├── vite.config.js      # dev server config (host:true for LAN access)
├── package.json
└── src/
    ├── main.jsx        # React bootstrap
    └── App.jsx         # the entire CTF experience
```

Everything CTF-specific is in `src/App.jsx`. Challenges, hints, the fake
file system, and the win conditions are all in one file so you can iterate
fast at a booth.
