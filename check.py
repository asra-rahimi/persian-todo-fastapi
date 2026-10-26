"""تست دودی بک‌اند: CRUD، اعتبارسنجی و سرو شدن فرانت.

روی یک دیتابیس موقت اجرا می‌شود تا داده‌های واقعی دست‌نخورده بمانند.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

# باید قبل از ایمپورت app تنظیم شود
TMP_DB = ROOT / "data" / "_test_todos.db"
TMP_DB.parent.mkdir(exist_ok=True)
if TMP_DB.exists():
    TMP_DB.unlink()
os.environ["TODO_DB"] = str(TMP_DB)

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

client = TestClient(app)
failures: list[str] = []


def check(name: str, condition: bool, detail: str = "") -> None:
    if condition:
        print(f"  PASS  {name}")
    else:
        failures.append(name)
        print(f"  FAIL  {name}  {detail}")


print("۱) سلامت و فهرست اولیه")
r = client.get("/api/todos")
check("GET /api/todos", r.status_code == 200, str(r.status_code))
check("داده‌ی نمونه وجود دارد", len(r.json()["todos"]) >= 5, str(len(r.json()["todos"])))

print("۲) ایجاد")
r = client.post("/api/todos", json={"text": "تست از پایتون", "prio": "high", "tag": "uni"})
created = r.json()
check("POST /api/todos → 201", r.status_code == 201, str(r.status_code))
check("متن درست برگشت", created.get("text") == "تست از پایتون", str(created))
check("شناسه دارد", isinstance(created.get("id"), int), str(created.get("id")))

todo_id = created["id"]

print("۳) ویرایش")
r = client.patch(f"/api/todos/{todo_id}", json={"done": True})
check("PATCH done", r.status_code == 200 and r.json()["done"] is True, r.text[:200])
r = client.patch(f"/api/todos/{todo_id}", json={"text": "متن ویرایش‌شده"})
check("PATCH text", r.status_code == 200 and r.json()["text"] == "متن ویرایش‌شده", r.text[:200])

print("۴) فیلتر و جست‌وجو")
r = client.get("/api/todos", params={"status": "done"})
check("فیلتر done", all(t["done"] for t in r.json()["todos"]), "کار انجام‌نشده در نتیجه")
r = client.get("/api/todos", params={"q": "ویرایش‌شده"})
check("جست‌وجو", len(r.json()["todos"]) == 1, str(len(r.json()["todos"])))

print("۵) اعتبارسنجی")
r = client.post("/api/todos", json={"text": ""})
check("متن خالی → 422", r.status_code == 422, str(r.status_code))
r = client.patch("/api/todos/999999", json={"done": True})
check("شناسه‌ی ناموجود → 404", r.status_code == 404, str(r.status_code))

print("۶) حذف")
r = client.delete(f"/api/todos/{todo_id}")
check("DELETE → 204", r.status_code == 204, str(r.status_code))
r = client.patch(f"/api/todos/{todo_id}", json={"done": False})
check("بعد از حذف → 404", r.status_code == 404, str(r.status_code))

print("۷) فرانت و آمار")
r = client.get("/")
check("GET / (HTML)", r.status_code == 200 and "کارهای من" in r.text, str(r.status_code))
r = client.get("/app.js")
check("GET /app.js", r.status_code == 200, str(r.status_code))
r = client.get("/api/stats")
check("GET /api/stats", r.status_code == 200 and "percent" in r.json(), r.text[:150])

print("۸) پاک کردن انجام‌شده‌ها")
r = client.post("/api/todos/clear-done")
check("clear-done", r.status_code == 200 and r.json()["deleted"] >= 1, r.text[:150])

TMP_DB.unlink(missing_ok=True)

print()
if failures:
    print(f"❌ {len(failures)} تست شکست خورد: {failures}")
    raise SystemExit(1)
print("✅ همه‌ی تست‌ها قبول شدند.")
