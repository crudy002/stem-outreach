# Cyber Range — CTF Prototype

A standalone React app for the booth's cybersecurity challenge station.
Single-page experience: mission briefing → login → file system →
privilege escalation → "p0wned".

The whole thing is a scripted attack chain a kid can finish in a couple of
minutes, where every step maps to a real-world mistake: a password on a
sticky note, a secret committed in plain text, and a privilege boundary
that doesn't check anything.

## Run it

```bash
cd 04-cyber/cyber_ctf
npm install        # first time only (slow on a Pi — be patient)
npm run dev
```

Vite prints two URLs:

- `http://localhost:5173` — open on the Pi itself
- `http://<pi-ip>:5173` — open from a laptop/phone on the same WiFi

Either works. The booth display is just a fullscreen browser pointed at one
of these. For the actual event, don't use `npm run dev` — build once and let
FastAPI serve the output. See the [booth deployment guide](../README.md).

## Difficulty modes

The mode is picked on the briefing screen, before the clock starts. All
three end at the same flag; they differ in how much typing stands between
the player and it.

| Mode     | How you play                                            | Aimed at        |
|----------|---------------------------------------------------------|-----------------|
| `rookie` | Tap big file blocks, then pick a one-time access code    | Youngest kids   |
| `easy`   | Click files in a browser sidebar, one-click root unlock  | Middle ground   |
| `hard`   | Type every command in the simulated shell                | Anyone who can type |

**Each mode has its own leaderboard.** A rookie tapping blocks will always
be faster than someone typing `cat config/credentials.txt` by hand, so a
single mixed board would just rank players by difficulty. Scores are
submitted with their mode and ranked only against the same mode. The board
on the briefing screen follows whichever difficulty is currently selected.

## How to play it (for testing)

1. **Briefing screen** — enter a callsign and pick a difficulty. The
   callsign is the name on the leaderboard. The clock starts when the
   intro finishes, not when you type the name.
2. **Login screen** — the username and password are **randomised per
   playthrough** from a small pool, so repeat visitors can't muscle-memory
   their way in. Whatever the current pair is, it's written on the sticky
   note in the right-hand panel. That's the lesson.
3. **File system** — the goal is `config/credentials.txt`, which contains
   the flag `ctf{w34k_p455w0rd5_4r3_b4d}`.
   - `hard`: `ls`, `ls config/`, then `cat config/credentials.txt` (or
     `grep password config/credentials.txt`). The shell also supports `cd`,
     `pwd`, `head`, `find`, `file`, `whoami`, `id`, `history`, `man <cmd>`,
     `clear`, `help`, Tab-completion, and ↑/↓ for command history.
   - `easy`: click the file in the sidebar; it runs `cat` for you.
   - `rookie`: tap the file block. Every file teaches a one-line lesson when
     opened, not just the one holding the password.
4. **Escalate** — use the 📋 Copy Flag button on that output, then:
   - `hard`: run `sudo su` and paste the flag at the masked password prompt
     (3 attempts, like a real terminal).
   - `easy`: hit "🔓 Unlock Root Access", which types it in for you.
   - `rookie`: memorise the one-time access code and pick it from three
     options.
5. **Elevated terminal** — VIEW LOGS and DOWNLOAD DATA are flavour with
   their own animations; **INJECT PAYLOAD** ends the run. The clock stops
   at root access, not at this click, so poking at the other two costs
   nothing.
6. **Finish screen** — shows the time, submits it to the leaderboard, and
   reports the rank within that difficulty.
7. **RESET** in the header returns to the briefing screen for the next kid,
   and rolls a fresh set of login credentials.

### The escape hatch

After a few failed commands or sudo attempts, a "📡 STUCK?" panel offers
**CALL FOR BACKUP**: HQ takes over and plays out the rest of the mission so
nobody is stranded at the booth with a queue behind them. Those runs are
marked `assisted` and deliberately **not** submitted to the leaderboard —
the finish screen says so.

## Leaderboard

Optional. If [`../leaderboard-api`](../leaderboard-api) isn't running, the
game plays fine; score submission fails silently and the finish screen
says the server couldn't be reached.

Point it at a non-default host with `VITE_LEADERBOARD_API_URL`, and label
which station a score came from with `VITE_STATION_ID` — see
[.env.example](.env.example). Both are read at **build** time, not run
time, so changing them means rebuilding `dist/`.

## Where things live

```
cyber_ctf/
├── index.html                  # html shell
├── vite.config.js              # dev server config (host:true for LAN access)
├── package.json                # (the npm package is still named "ctf-app")
├── public/navsea-logo.png
└── src/
    ├── main.jsx                # React bootstrap
    ├── App.jsx                 # stage machine, timer, leaderboard calls
    ├── theme.jsx               # colour themes (incl. a high-contrast one for glare)
    ├── modes.js                # the three difficulties, shared by picker + board
    ├── hooks/
    │   └── useTerminal.js      # the fake file system and shell — start here
    └── components/             # one file per screen/overlay
```

The two files worth knowing: **`useTerminal.js`** holds the fake file
system, the command parser, and the flag, so that's where you go to change
what the challenge actually *is*. **`App.jsx`** owns which stage is on
screen, the run timer, and leaderboard submission.

(This used to all live in one `App.jsx`. It was split up once it stopped
fitting on a screen; the behaviour didn't change.)
