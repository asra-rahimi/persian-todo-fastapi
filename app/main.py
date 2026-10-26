"""بک‌اند تودولیست: FastAPI + SQLite."""
from __future__ import annotations

from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import db

BASE = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE / "static"

app = FastAPI(title="کارهای من", version="2.0.0", description="تودولیست با بک‌اند")
db.init()


# ---------- مدل‌های ورودی ----------
class TodoIn(BaseModel):
    text: str = Field(min_length=1, max_length=140, description="متن کار")
    prio: Literal["high", "med", "low"] = "med"
    tag: str = Field(default="personal", max_length=20)


class TodoPatch(BaseModel):
    text: str | None = Field(default=None, min_length=1, max_length=140)
    done: bool | None = None
    prio: Literal["high", "med", "low"] | None = None
    tag: str | None = Field(default=None, max_length=20)


# ---------- مسیرهای API ----------
@app.get("/api/todos")
def list_todos(
    status: Literal["all", "active", "done"] = "all",
    tag: str | None = None,
    q: str | None = None,
) -> dict:
    return {"todos": db.list_todos(status, tag, q)}


@app.post("/api/todos", status_code=201)
def create_todo(payload: TodoIn) -> dict:
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=422, detail="متن کار نمی‌تواند خالی باشد.")
    return db.create(text, payload.prio, payload.tag)


@app.patch("/api/todos/{todo_id}")
def update_todo(todo_id: int, payload: TodoPatch) -> dict:
    fields = payload.model_dump(exclude_unset=True)
    if "text" in fields:
        fields["text"] = (fields["text"] or "").strip()
        if not fields["text"]:
            raise HTTPException(status_code=422, detail="متن کار نمی‌تواند خالی باشد.")

    todo = db.update(todo_id, fields)
    if todo is None:
        raise HTTPException(status_code=404, detail="کار پیدا نشد.")
    return todo


@app.delete("/api/todos/{todo_id}", status_code=204)
def delete_todo(todo_id: int) -> Response:
    if not db.delete(todo_id):
        raise HTTPException(status_code=404, detail="کار پیدا نشد.")
    return Response(status_code=204)


@app.post("/api/todos/clear-done")
def clear_done() -> dict:
    return {"deleted": db.clear_done()}


@app.get("/api/stats")
def stats() -> dict:
    todos = db.list_todos()
    total = len(todos)
    done = sum(1 for t in todos if t["done"])
    return {
        "total": total,
        "done": done,
        "active": total - done,
        "percent": round(done / total * 100) if total else 0,
    }


# ---------- فرانت ----------
# این خط باید آخر باشد: هر مسیر دیگری را به فایل‌های استاتیک می‌سپارد.
app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
