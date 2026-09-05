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
    http://localhost:8000/docs   — interactive API docs
    http://localhost:8000/scores — top times (JSON)
"""

import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.responses import HTMLResponse

DB_PATH = Path(__file__).parent / "leaderboard.db"

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
                completed_at TEXT NOT NULL
            )
            """
        )


init_db()


class ScoreIn(BaseModel):
    player_name: str = Field(min_length=1, max_length=40)
    elapsed_seconds: float = Field(gt=0)
    station_id: str | None = Field(default=None, max_length=40)


class ScoreOut(BaseModel):
    id: int
    player_name: str
    elapsed_seconds: float
    station_id: str | None
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


@app.get("/")
def read_root():
    return {"Hello": "World"}

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/scores", response_model=ScoreOut, status_code=201)
def submit_score(score: ScoreIn):
    completed_at = datetime.now(timezone.utc).isoformat()
    with get_db() as conn:
        cur = conn.execute(
            "INSERT INTO scores (player_name, elapsed_seconds, station_id, completed_at) "
            "VALUES (?, ?, ?, ?)",
            (score.player_name.strip(), score.elapsed_seconds, score.station_id, completed_at),
        )
        new_id = cur.lastrowid
        rank = conn.execute(
            "SELECT COUNT(*) + 1 AS rank FROM scores WHERE elapsed_seconds < ?",
            (score.elapsed_seconds,),
        ).fetchone()["rank"]

    return ScoreOut(
        id=new_id,
        player_name=score.player_name.strip(),
        elapsed_seconds=score.elapsed_seconds,
        station_id=score.station_id,
        completed_at=completed_at,
        rank=rank,
    )


@app.get("/scores", response_model=list[ScoreOut])
def list_scores(limit: int = 10):
    if limit < 1 or limit > 100:
        raise HTTPException(400, "limit must be between 1 and 100")

    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM scores ORDER BY elapsed_seconds ASC LIMIT ?",
            (limit,),
        ).fetchall()

    return [
        ScoreOut(
            id=row["id"],
            player_name=row["player_name"],
            elapsed_seconds=row["elapsed_seconds"],
            station_id=row["station_id"],
            completed_at=row["completed_at"],
            rank=i + 1,
        )
        for i, row in enumerate(rows)
    ]


@app.delete("/scores", status_code=204)
def reset_scores():
    """Wipe the board — for clearing test runs between booth sessions."""
    with get_db() as conn:
        conn.execute("DELETE FROM scores")
