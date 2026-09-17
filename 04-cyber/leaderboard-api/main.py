#!/usr/bin/env python3
"""
main.py — Leaderboard API for the Cyber CTF booth station.

Tracks how fast each player finishes the CTF (see ../cyber_ctf) and serves
the fastest times back for display.

Storage is a single SQLite file (leaderboard.db, created next to this file
on first run) — plenty for a booth's worth of runs, and needs no separate
database server.

Run it:
    pip install -r requirements.txt
    uvicorn main:app --host 0.0.0.0 --port 8000 --reload

Then:
    http://localhost:8000/docs             — interactive API docs
    http://localhost:8000/scores           — top times (JSON)
    http://localhost:8000/scores?mode=hard — top times for one difficulty

Runs are ranked within their difficulty mode, never across modes — see
list_scores() for why.

If ../cyber_ctf/dist exists (built with `npm run build`), this also serves
the built React app at http://localhost:8000/ — one process, one port, no
nginx/serve needed. See the top-level README for the booth deployment this
is meant for. Set STATIC_DIR to point elsewhere; unset/missing just skips
the mount and the API still works on its own.
"""

import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.responses import HTMLResponse

DB_PATH = Path(__file__).parent / "leaderboard.db"
STATIC_DIR = Path(os.environ.get("STATIC_DIR", Path(__file__).parent.parent / "cyber_ctf" / "dist"))

# Difficulty modes the game reports. Ranking is scoped to one of these:
# an EASY run (click-to-explore) is inherently faster than a HARD run
# (type every command), so a single mixed board would just rank by mode.
MODES = ("easy", "hard")

app = FastAPI(title="Cyber CTF Leaderboard", docs_url=None)

# The booth frontend is served from a different origin/port (Vite dev
# server), and later from other Pis on the LAN — allow any origin rather
# than trying to enumerate them.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    with get_db() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS scores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                player_name TEXT NOT NULL,
                elapsed_seconds REAL NOT NULL,
                station_id TEXT,
                mode TEXT,
                completed_at TEXT NOT NULL
            )
            """
        )
        # `mode` was added after the first booth build. Databases created
        # before that need the column bolted on; their existing rows keep
        # mode=NULL and rank among themselves as "unspecified" rather than
        # polluting a real mode's board.
        columns = {row["name"] for row in conn.execute("PRAGMA table_info(scores)")}
        if "mode" not in columns:
            conn.execute("ALTER TABLE scores ADD COLUMN mode TEXT")


init_db()


class ScoreIn(BaseModel):
    player_name: str = Field(min_length=1, max_length=40)
    elapsed_seconds: float = Field(gt=0)
    station_id: str | None = Field(default=None, max_length=40)
    mode: str | None = Field(default=None, description=f"one of {MODES}")

    @field_validator("mode")
    @classmethod
    def known_mode(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.lower()
        if v not in MODES:
            raise ValueError(f"mode must be one of {MODES}")
        return v


class ScoreOut(BaseModel):
    id: int
    player_name: str
    elapsed_seconds: float
    station_id: str | None
    mode: str | None
    completed_at: str
    rank: int

@app.get("/docs", include_in_schema=False)
async def custom_swagger_ui_html() -> HTMLResponse:
    # 1. Generate the standard Swagger UI HTML response framework
    original_response = get_swagger_ui_html(
        openapi_url=app.openapi_url,
        title=f"{app.title} - Swagger UI",
    )
    
    # 2. Extract the raw HTML string
    html_content = original_response.body.decode("utf-8")
    
    # 3. Define your custom dark mode CSS overrides
    swagger_extra_html = """
    <style>
        /* Simple custom overrides or a full dark theme injection */
        html { color-scheme: dark; }
        body { background-color: #1b1b1b !important; color: #f8f8f8 !important; }
        .swagger-ui { filter: invert(1) hue-rotate(180deg); } /* Quick invert trick */
        .swagger-ui .microlight { filter: invert(1) hue-rotate(180deg); } /* Keep code block readable */
        
        /* Optional fix for inverted authorization/dropdown locks and icons */
        .swagger-ui .auth-wrapper .authorize, 
        .swagger-ui .model-box-control { filter: invert(0); }
    </style>
    """
    
    # 4. Inject your style right before the closing body tag
    modified_html = html_content.replace("</body>", f"{swagger_extra_html}</body>")
    
    # 5. Return the modified document safely
    return HTMLResponse(content=modified_html)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/scores", response_model=ScoreOut, status_code=201)
def submit_score(score: ScoreIn):
    completed_at = datetime.now(timezone.utc).isoformat()
    with get_db() as conn:
        cur = conn.execute(
            "INSERT INTO scores (player_name, elapsed_seconds, station_id, mode, completed_at) "
            "VALUES (?, ?, ?, ?, ?)",
            (
                score.player_name.strip(),
                score.elapsed_seconds,
                score.station_id,
                score.mode,
                completed_at,
            ),
        )
        new_id = cur.lastrowid
        # Rank within the same difficulty only. `IS` rather than `=` so that
        # legacy mode=NULL rows compare against each other instead of
        # matching nothing.
        rank = conn.execute(
            "SELECT COUNT(*) + 1 AS rank FROM scores "
            "WHERE elapsed_seconds < ? AND mode IS ?",
            (score.elapsed_seconds, score.mode),
        ).fetchone()["rank"]

    return ScoreOut(
        id=new_id,
        player_name=score.player_name.strip(),
        elapsed_seconds=score.elapsed_seconds,
        station_id=score.station_id,
        mode=score.mode,
        completed_at=completed_at,
        rank=rank,
    )


@app.get("/scores", response_model=list[ScoreOut])
def list_scores(
    limit: int = 10,
    mode: str | None = Query(default=None, description=f"filter to one of {MODES}"),
):
    """Fastest times first.

    `rank` is always a rank *within that row's mode*, so a board filtered to
    one difficulty reads 1, 2, 3 as expected, and an unfiltered board still
    reports each run's standing against its own difficulty rather than
    against an easy-mode player's click-through time.
    """
    if limit < 1 or limit > 100:
        raise HTTPException(400, "limit must be between 1 and 100")
    if mode is not None:
        mode = mode.lower()
        if mode not in MODES:
            raise HTTPException(400, f"mode must be one of {MODES}")

    # RANK() is computed over the whole table before LIMIT, so ranks stay
    # correct instead of being renumbered within the returned page.
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT * FROM (
                SELECT *, RANK() OVER (
                    PARTITION BY mode ORDER BY elapsed_seconds ASC
                ) AS rank
                FROM scores
            )
            WHERE :mode IS NULL OR mode = :mode
            ORDER BY elapsed_seconds ASC
            LIMIT :limit
            """,
            {"mode": mode, "limit": limit},
        ).fetchall()

    return [
        ScoreOut(
            id=row["id"],
            player_name=row["player_name"],
            elapsed_seconds=row["elapsed_seconds"],
            station_id=row["station_id"],
            mode=row["mode"],
            completed_at=row["completed_at"],
            rank=row["rank"],
        )
        for row in rows
    ]


@app.delete("/scores", status_code=204)
def reset_scores(
    mode: str | None = Query(default=None, description=f"wipe only one of {MODES}"),
):
    """Wipe the board — for clearing test runs between booth sessions.

    With no `mode`, every run is deleted. With one, only that difficulty's
    board is cleared, so a botched easy-mode session doesn't cost you the
    day's hard-mode times.
    """
    if mode is not None:
        mode = mode.lower()
        if mode not in MODES:
            raise HTTPException(400, f"mode must be one of {MODES}")

    with get_db() as conn:
        if mode is None:
            conn.execute("DELETE FROM scores")
        else:
            conn.execute("DELETE FROM scores WHERE mode = ?", (mode,))


# Mounted last so it never shadows the API routes above — Starlette matches
# routes in registration order, and a mount only catches what nothing earlier
# claimed. html=True serves dist/index.html for "/"; unbuilt/missing dist
# just means no frontend is served, the API still works standalone.
if STATIC_DIR.is_dir():
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
