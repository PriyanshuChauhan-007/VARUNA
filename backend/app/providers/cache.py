"""
Resilient SQLite and Memory Cache for Open-Meteo and ERA5 responses.
Protects against API rate limits and enables instant offline deterministic reproducibility.
"""
import sqlite3
import json
import time
from typing import Optional, Dict, Any
from pathlib import Path
from ..config import CACHE_DIR

DB_PATH = CACHE_DIR / "weather_cache.sqlite3"

def init_cache():
    """Initialize SQLite caching schema."""
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS response_cache (
                cache_key TEXT PRIMARY KEY,
                data_json TEXT NOT NULL,
                cached_at REAL NOT NULL,
                ttl_seconds REAL NOT NULL
            )
        """)
        conn.commit()

init_cache()

def get_cached_response(cache_key: str) -> Optional[Dict[str, Any]]:
    """Retrieve cached JSON payload if not expired."""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT data_json, cached_at, ttl_seconds FROM response_cache WHERE cache_key = ?",
                (cache_key,)
            )
            row = cursor.fetchone()
            if not row:
                return None
            data_json, cached_at, ttl_seconds = row
            # If ttl_seconds < 0, it never expires (e.g. historical archive)
            if ttl_seconds > 0 and (time.time() - cached_at) > ttl_seconds:
                return None
            return json.loads(data_json)
    except Exception:
        return None

def set_cached_response(cache_key: str, data: Dict[str, Any], ttl_seconds: float = 3600.0):
    """Store JSON payload in cache with TTL."""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO response_cache (cache_key, data_json, cached_at, ttl_seconds)
                VALUES (?, ?, ?, ?)
                """,
                (cache_key, json.dumps(data), time.time(), ttl_seconds)
            )
            conn.commit()
    except Exception:
        pass
