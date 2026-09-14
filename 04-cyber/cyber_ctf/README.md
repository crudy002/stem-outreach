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

### The search

The root password **moves between playthroughs**. It lands in one of five
files, one of which is in a folder that only exists on those runs, so a
repeat visitor can't skip the searching by remembering a path.

Several other files hold **decoy secrets** that look just as much like the
answer: a wifi password, a service account's database password, an API key,
and an old root password that a log says was already rotated out. None of
them opens `sudo`. Finding *a* secret is not the same as finding *the*
secret, which is the lesson.

Every password-shaped value in command output gets its own copy chip, so
the copy button itself never gives the answer away. What separates the
modes is the **🦸 superhero badge**:

- `rookie` and `easy` badge the one that actually works, and in `easy` the
  root unlock button stays disabled until that specific value is copied.
  Copying a decoy does nothing.
- `hard` badges nothing. Every chip looks identical and the player has to
  read the labels and work out which secret is the root password.

Guessing wrong isn't a dead end: `sudo` allows three attempts and says
"Sorry, try again", and enough failures surface the CALL FOR BACKUP panel
described below.

**Each mode has its own leaderboard.** A rookie tapping blocks will always
be faster than someone typing `grep password config/backup.conf` by hand, so a
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
3. **File system** — find the root password, `ctf{w34k_p455w0rd5_4r3_b4d}`.
   **It is not in the same file twice** (see "The search" below), so there's
   no single path to memorise.
   - `hard`: `ls`, then `cd`/`ls` into each folder and `cat` what looks
     promising. `grep password <file>` is the fast way. The shell also
     supports `pwd`, `head`, `find`, `file`, `whoami`, `id`, `history`,
     `man <cmd>`, `clear`, `help`, Tab-completion, and ↑/↓ for history.
   - `easy`: click files in the sidebar; each one runs `cat` for you.
   - `rookie`: tap the file blocks. Every file teaches a one-line lesson
     when opened, not just the one holding the password.
4. **Escalate** — copy the root password using the chip under that output,
   then:
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

The two files worth knowing: **`useTerminal.js`** holds the file system,
the hiding spots, the decoys, the command parser, and the flag, so that's
where you go to change what the challenge actually *is*. **`App.jsx`** owns
which stage is on screen, the run timer, and leaderboard submission.

To add a hiding spot or a decoy, edit `HIDING_SPOTS` or `BASE_FILES` at the
top of `useTerminal.js`. Each entry carries its own body text and the
one-line lesson rookie mode shows, and directory markers are derived from
the paths, so a spot in a brand-new folder works without touching anything
else.

(This used to all live in one `App.jsx`. It was split up once it stopped
fitting on a screen; the behaviour didn't change.)
