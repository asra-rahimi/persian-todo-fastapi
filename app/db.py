"""لایه‌ی داده: SQLite خالص، بدون ORM."""
from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = Path(os.environ.get("TODO_DB") or (ROOT / "data" / "todos.db"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS todos (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    text       TEXT    NOT NULL,
    done       INTEGER NOT NULL DEFAULT 0,
    prio       TEXT    NOT NULL DEFAULT 'med',
    tag        TEXT    NOT NULL DEFAULT 'personal',
    created_at TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_todos_done ON todos(done);
CREATE INDEX IF NOT EXISTS idx_todos_tag  ON todos(tag);
"""

SEED = [
    ("تمرین FastAPI را تمام کن", "high", "uni", 0),
    ("اسلایدهای ارائه را آماده کن", "med", "uni", 0),
    ("دیتابیس پروژه را بکاپ بگیر", "low", "work", 1),
    ("ویدیو دمو را ضبط کن", "med", "work", 0),
    ("شیر و نان بخر", "low", "shop", 0),
    ("لینک مخزن را برای استاد بفرست", "low", "personal", 1),
]


@contextmanager
def connect():
    """اتصال کوتاه‌عمر: تراکنش را کامیت و اتصال را حتماً می‌بندد."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB_PATH, timeout=5)
    con.row_factory = sqlite3.Row
    try:
        with con:  # commit / rollback خودکار
            yield con
    finally:
        con.close()


def init() -> None:
    """ساخت جدول‌ها و مقدار اولیه — فقط بار اول که فایل ساخته می‌شود."""
    first_time = not DB_PATH.exists()
    with connect() as con:
        con.executescript(SCHEMA)
        if first_time:
            now = datetime.now().isoformat(timespec="seconds")
            con.executemany(
                "INSERT INTO todos (text, prio, tag, done, created_at) VALUES (?,?,?,?,?)",
                [(text, prio, tag, done, now) for text, prio, tag, done in SEED],
            )


def _row(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "text": row["text"],
        "done": bool(row["done"]),
        "prio": row["prio"],
        "tag": row["tag"],
        "created_at": row["created_at"],
    }


def list_todos(status: str = "all", tag: str | None = None, q: str | None = None) -> list[dict]:
    where: list[str] = []
    params: list[object] = []

    if status == "active":
        where.append("done = 0")
    elif status == "done":
        where.append("done = 1")
    if tag:
        where.append("tag = ?")
        params.append(tag)
    if q:
        where.append("text LIKE ?")
        params.append(f"%{q}%")

    sql = "SELECT * FROM todos"
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY id DESC"

    with connect() as con:
        return [_row(r) for r in con.execute(sql, params)]


def get(todo_id: int) -> dict | None:
    with connect() as con:
        row = con.execute("SELECT * FROM todos WHERE id = ?", (todo_id,)).fetchone()
    return _row(row) if row else None


def create(text: str, prio: str, tag: str) -> dict:
    now = datetime.now().isoformat(timespec="seconds")
    with connect() as con:
        cur = con.execute(
            "INSERT INTO todos (text, prio, tag, done, created_at) VALUES (?,?,?,0,?)",
            (text, prio, tag, now),
        )
        todo_id = cur.lastrowid
    return get(todo_id)  # type: ignore[return-value]


def update(todo_id: int, fields: dict) -> dict | None:
    if not fields:
        return get(todo_id)

    allowed = {"text", "done", "prio", "tag"}
    payload = {k: (int(v) if k == "done" else v) for k, v in fields.items() if k in allowed}
    if not payload:
        return get(todo_id)

    assignments = ", ".join(f"{key} = ?" for key in payload)
    values = [*payload.values(), todo_id]

    with connect() as con:
        cur = con.execute(f"UPDATE todos SET {assignments} WHERE id = ?", values)
        if cur.rowcount == 0:
            return None
    return get(todo_id)


def delete(todo_id: int) -> bool:
    with connect() as con:
        cur = con.execute("DELETE FROM todos WHERE id = ?", (todo_id,))
        return cur.rowcount > 0


def clear_done() -> int:
    with connect() as con:
        cur = con.execute("DELETE FROM todos WHERE done = 1")
        return cur.rowcount
