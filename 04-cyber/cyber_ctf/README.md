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

1. Login screen: try anything — it tells you when you're wrong. The intel
   panel hints: `admin` / `password`.
2. Terminal: `ls`, then `ls config/`, then `cat config/credentials.txt`.
   Copy the flag from that file.
3. `sudo <that flag>` elevates you.
4. Pick "INJECT PAYLOAD" to win the final flag.
5. RESET in the header puts you back to login for the next kid.

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
