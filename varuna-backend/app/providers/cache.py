from __future__ import annotations

import json
import sqlite3
import time
from pathlib import Path
from typing import Any

from ..config import CACHE_DB_PATH, CACHE_TTL_LIVE_S

_SCHEMA = """
CREATE TABLE IF NOT EXISTS cache (
    key        TEXT PRIMARY KEY,
    kind       TEXT NOT NULL,          -- 'live' | 'archive'
    payload    TEXT NOT NULL,
    fetched_at REAL NOT NULL
);
"""


class ResponseCache:
    def __init__(self, db_path: Path = CACHE_DB_PATH):
        self.db_path = Path(db_path)
        self._conn: sqlite3.Connection | None = None

    @property
    def conn(self) -> sqlite3.Connection:
        if self._conn is None:
            self._conn = sqlite3.connect(
                str(self.db_path), timeout=15, check_same_thread=False
            )
            self._conn.execute(_SCHEMA)
            self._conn.commit()
        return self._conn

    def put(self, key: str, payload: Any, kind: str = "live") -> None:
        self.conn.execute(
            "INSERT INTO cache(key, kind, payload, fetched_at) VALUES(?,?,?,?) "
            "ON CONFLICT(key) DO UPDATE SET payload=excluded.payload, "
            "kind=excluded.kind, fetched_at=excluded.fetched_at",
            (key, kind, json.dumps(payload), time.time()),
        )
        self.conn.commit()

    def get(self, key: str, kind: str = "live", ttl_s: float | None = None) -> Any | None:
        row = self.conn.execute(
            "SELECT payload, fetched_at FROM cache WHERE key=?", (key,)
        ).fetchone()
        if row is None:
            return None
        payload, fetched_at = row
        if kind == "live":
            ttl = CACHE_TTL_LIVE_S if ttl_s is None else ttl_s
            if time.time() - fetched_at > ttl:
                return None
        return json.loads(payload)

    def get_stale(self, key: str) -> Any | None:
        row = self.conn.execute(
            "SELECT payload FROM cache WHERE key=?", (key,)
        ).fetchone()
        return json.loads(row[0]) if row else None

    def close(self) -> None:
        if self._conn is not None:
            self._conn.close()
            self._conn = None


CACHE = ResponseCache()
