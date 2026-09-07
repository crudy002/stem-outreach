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

## API

- `GET /health` — `{"status": "ok"}`
- `POST /scores` — record a completed run
  ```json
  { "player_name": "Alex", "elapsed_seconds": 47.3, "station_id": "pi-1" }
  ```
  `station_id` is optional today (single-station setup) but is there so
  results can be told apart once multiple Pis share this backend.
  Returns the created row plus its current `rank`.
- `GET /scores?limit=10` — fastest times first (default limit 10, max 100)
- `DELETE /scores` — wipes the board (for clearing test runs between
  sessions)
