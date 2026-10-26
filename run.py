"""اجرای تودولیست با یک کلیک ▶ در VS Code.

سرور FastAPI را روی اولین پورت آزاد بالا می‌آورد و مرورگر را باز می‌کند.
"""
from __future__ import annotations

import os
import socket
import threading
import webbrowser
from pathlib import Path

import uvicorn

ROOT = Path(__file__).resolve().parent
os.chdir(ROOT)


def free_port(start: int = 8080, tries: int = 20) -> int:
    for port in range(start, start + tries):
        with socket.socket() as sock:
            if sock.connect_ex(("127.0.0.1", port)) != 0:
                return port
    return start


def main() -> None:
    port = int(os.environ.get("PORT") or free_port())
    url = f"http://127.0.0.1:{port}/"
    print(f"Server: {url}")
    print("Docs:   " + url + "docs")
    print("Stop:   Ctrl + C")
    threading.Timer(1.2, lambda: webbrowser.open(url)).start()
    uvicorn.run("app.main:app", host="127.0.0.1", port=port, reload=False, log_level="info")


if __name__ == "__main__":
    main()
