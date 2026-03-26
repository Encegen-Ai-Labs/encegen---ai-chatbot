"""
database.py — SQLite setup using aiosqlite (async)
Creates leads.db automatically on first run.
"""

import aiosqlite
import os
from contextlib import asynccontextmanager

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "leads.db")

CREATE_LEADS_TABLE = """
CREATE TABLE IF NOT EXISTS leads (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT,
    email         TEXT,
    phone         TEXT,
    company       TEXT,
    industry      TEXT,
    requirements  TEXT,
    services      TEXT,
    budget_range  TEXT,
    timeline      TEXT,
    source        TEXT    DEFAULT 'chatbot',
    status        TEXT    DEFAULT 'new',
    notes         TEXT    DEFAULT '',
    transcript    TEXT,
    created_at    TEXT    DEFAULT (datetime('now', 'localtime')),
    updated_at    TEXT    DEFAULT (datetime('now', 'localtime'))
);
"""

@asynccontextmanager
async def get_db():
    """
    Async context manager — always use as:
        async with get_db() as db:
            ...
    Automatically commits on success, rolls back on error, closes on exit.
    """
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    try:
        yield db
        await db.commit()
    except Exception:
        await db.rollback()
        raise
    finally:
        await db.close()

async def init_db():
    """Called once at startup to create the schema."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("PRAGMA journal_mode=WAL;")
        await db.execute(CREATE_LEADS_TABLE)
        await db.commit()
    print(f"✅  Database ready → {DB_PATH}")
