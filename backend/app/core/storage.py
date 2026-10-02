import json
import os
import sqlite3
from pathlib import Path
from datetime import datetime, timezone, timedelta

ROOT = Path(__file__).resolve().parents[2]
DATA = Path(os.environ.get("JINGGAO_DATA_DIR", str(ROOT / "data"))).resolve()
DATA.mkdir(parents=True, exist_ok=True)
(DATA / "uploads").mkdir(exist_ok=True)
(DATA / "reports").mkdir(exist_ok=True)
DB = DATA / "jinggao.sqlite3"


def now():
    return datetime.now(timezone(timedelta(hours=8))).isoformat(timespec="seconds")


def connect():
    con = sqlite3.connect(DB, timeout=30)
    con.execute("PRAGMA journal_mode=WAL")
    return con


def init():
    with connect() as con:
        for table in ["tasks", "runs", "documents", "rulesets"]:
            con.execute(
                f"CREATE TABLE IF NOT EXISTS {table} (id TEXT PRIMARY KEY, payload TEXT NOT NULL)"
            )


def save(table, obj):
    assert table in ["tasks", "runs", "documents", "rulesets"]
    with connect() as con:
        con.execute(
            f"INSERT OR REPLACE INTO {table} VALUES (?, ?)",
            (obj["id"], json.dumps(obj, ensure_ascii=False)),
        )
    return obj


def get(table, id):
    assert table in ["tasks", "runs", "documents", "rulesets"]
    with connect() as con:
        row = con.execute(f"SELECT payload FROM {table} WHERE id=?", (id,)).fetchone()
    return json.loads(row[0]) if row else None


def all_items(table):
    assert table in ["tasks", "runs", "documents", "rulesets"]
    with connect() as con:
        rows = con.execute(
            f"SELECT payload FROM {table} ORDER BY rowid DESC"
        ).fetchall()
    return [json.loads(row[0]) for row in rows]
