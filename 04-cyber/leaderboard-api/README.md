# Leaderboard API

Small FastAPI + SQLite service that records how fast each player finishes
the [Cyber CTF](../cyber_ctf) and serves back the fastest times.

Currently runs standalone on one machine (e.g. your laptop, or one of the
Pis) reachable over localhost. Pointing multiple Pis at one shared instance
over the LAN is a later step — nothing here assumes that yet.

## Run it

```bash
cd 04-cyber/leaderboard-api
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Interactive docs: http://localhost:8000/docs

A `leaderboard.db` SQLite file is created next to `main.py` on first run
(gitignored).

## Also serves the built frontend

If `../cyber_ctf/dist/` exists (run `npm run build` in `cyber_ctf/` first),
this app mounts it as static files at `/` — so the same `uvicorn` process
serves the React app *and* the API on one port, no separate static server
needed. Set `STATIC_DIR` to point somewhere else, or just don't build
`dist/` if you want this to run as an API-only service. See the top-level
[README](../README.md) for the booth deployment this is meant for.

## One board per difficulty

Runs are ranked **within their difficulty mode, never across modes**. A
`rookie` player tapping coloured blocks finishes far faster than a `hard`
player typing every command, so a single mixed board would rank by mode
and a hard-mode player would never reach the top of it.

Every score therefore carries a `mode` of `rookie`, `easy` or `hard`, and
the `rank` the API returns is always that run's standing among runs of the
same mode. The game submits the mode it was played on and asks for one
mode's board at a time.

Rows written before this existed have `mode: null`. They are kept, and
rank among themselves rather than polluting a real mode's board.

## API

- `GET /health` — `{"status": "ok"}`
- `POST /scores` — record a completed run
  ```json
  { "player_name": "Alex", "elapsed_seconds": 47.3, "mode": "hard", "station_id": "pi-1" }
  ```
  `mode` is optional but should always be sent — omitting it files the run
  under the unranked legacy group. An unknown mode is rejected with a 422.
  `station_id` is optional too (single-station setup today), and is there so
  results can be told apart once multiple Pis share this backend.
  Returns the created row plus its `rank` within that mode.
- `GET /scores?limit=10&mode=hard` — fastest times first (default limit 10,
  max 100). Without `mode`, every run is returned, each still carrying its
  own per-mode rank. An unknown mode is rejected with a 400.
- `DELETE /scores` — wipes the board (for clearing test runs between
  sessions). `DELETE /scores?mode=rookie` clears just that difficulty, so a
  botched rookie session doesn't cost you the day's hard-mode times.

## Schema changes

`init_db()` creates the table and then adds any column a database made by
an older version is missing (currently `mode`). Starting the service against
an existing `leaderboard.db` migrates it in place — no dump/restore, and no
losing the scores already on it.
