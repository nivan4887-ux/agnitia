"""
BRIDGE – Independent Standalone Python Demo Service.

Runs as a separate operating-system process from the BRIDGE control backend.
Exposes real HTTP endpoints (/health, /products, /fail, /restore, /stop)
on a configurable TCP port.
"""

from __future__ import annotations

import argparse
import json
import os
import signal
import sys
import threading
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any

# Sample standalone catalog products
STANDALONE_PRODUCTS = [
    {
        "id": f"std-prod-{i:03d}",
        "name": f"Standalone Couture Piece {i}",
        "price": 4500 + (i * 250),
        "category": "Independent Collection",
        "in_stock": True,
        "stock_count": 25,
    }
    for i in range(1, 49)
]

# Service runtime state
_service_lock = threading.Lock()
_is_healthy: bool = True
_failure_reason: str = ""
_server_instance: HTTPServer | None = None


def get_health_state() -> tuple[bool, str]:
    with _service_lock:
        return _is_healthy, _failure_reason


def set_health_state(healthy: bool, reason: str = "") -> None:
    global _is_healthy, _failure_reason
    with _service_lock:
        _is_healthy = healthy
        _failure_reason = reason


class StandaloneServiceHandler(BaseHTTPRequestHandler):
    server_version = "BRIDGEDemoService/1.0"

    def log_message(self, format: str, *args: Any) -> None:
        now_iso = datetime.now(timezone.utc).isoformat()
        sys.stderr.write(f"[{now_iso}] [PID {os.getpid()}] {format % args}\n")
        sys.stderr.flush()

    def _send_json(self, status_code: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Service-PID", str(os.getpid()))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        path = self.path.split("?")[0]
        now_iso = datetime.now(timezone.utc).isoformat()
        healthy, reason = get_health_state()

        if path in ("/health", "/api/health"):
            if not healthy:
                self._send_json(
                    503,
                    {
                        "status": "unhealthy",
                        "service": "standalone_service",
                        "pid": os.getpid(),
                        "error": reason or "Service degraded by failure injection",
                        "timestamp": now_iso,
                    },
                )
                return

            self._send_json(
                200,
                {
                    "status": "healthy",
                    "service": "standalone_service",
                    "pid": os.getpid(),
                    "timestamp": now_iso,
                },
            )
            return

        if path in ("/products", "/api/products"):
            if not healthy:
                self._send_json(
                    503,
                    {
                        "status": "unhealthy",
                        "service": "standalone_service",
                        "error": reason or "Products catalog unavailable",
                        "pid": os.getpid(),
                        "timestamp": now_iso,
                    },
                )
                return

            self._send_json(
                200,
                {
                    "status": "ok",
                    "service": "standalone_service",
                    "products": STANDALONE_PRODUCTS,
                    "item_count": len(STANDALONE_PRODUCTS),
                    "pid": os.getpid(),
                    "timestamp": now_iso,
                },
            )
            return

        self._send_json(404, {"error": f"Endpoint '{path}' not found", "pid": os.getpid()})

    def do_POST(self) -> None:
        path = self.path.split("?")[0]
        now_iso = datetime.now(timezone.utc).isoformat()

        if path in ("/fail", "/api/fail"):
            content_len = int(self.headers.get("Content-Length", 0))
            reason = "Simulated unhandled worker exception"
            if content_len > 0:
                try:
                    body = json.loads(self.rfile.read(content_len).decode("utf-8"))
                    reason = body.get("reason", reason)
                except Exception:
                    pass

            set_health_state(False, reason)
            self.log_message(f"Controlled failure injected: {reason}")
            self._send_json(
                200,
                {
                    "status": "failure_injected",
                    "service": "standalone_service",
                    "reason": reason,
                    "pid": os.getpid(),
                    "timestamp": now_iso,
                },
            )
            return

        if path in ("/restore", "/api/restore"):
            set_health_state(True, "")
            self.log_message("Service manually restored to healthy baseline")
            self._send_json(
                200,
                {
                    "status": "restored",
                    "service": "standalone_service",
                    "pid": os.getpid(),
                    "timestamp": now_iso,
                },
            )
            return

        if path in ("/stop", "/api/stop", "/shutdown"):
            self._send_json(
                200,
                {
                    "status": "shutting_down",
                    "service": "standalone_service",
                    "pid": os.getpid(),
                    "timestamp": now_iso,
                },
            )
            self.log_message("Shutdown requested via HTTP endpoint")

            def _delayed_shutdown():
                if _server_instance:
                    _server_instance.shutdown()

            threading.Thread(target=_delayed_shutdown, daemon=True).start()
            return

        self._send_json(404, {"error": f"Endpoint '{path}' not found", "pid": os.getpid()})


def run_server(port: int = 8001, host: str = "127.0.0.1") -> None:
    global _server_instance
    server_address = (host, port)
    httpd = HTTPServer(server_address, StandaloneServiceHandler)
    _server_instance = httpd

    pid = os.getpid()
    now_iso = datetime.now(timezone.utc).isoformat()
    sys.stderr.write(f"[{now_iso}] [PID {pid}] Standalone Demo Service started on http://{host}:{port}\n")
    sys.stderr.flush()

    def _handle_sigterm(signum, frame):
        sys.stderr.write(f"[{datetime.now(timezone.utc).isoformat()}] [PID {pid}] Received signal {signum}, shutting down...\n")
        sys.stderr.flush()
        httpd.shutdown()

    signal.signal(signal.SIGTERM, _handle_sigterm)
    signal.signal(signal.SIGINT, _handle_sigterm)

    try:
        httpd.serve_forever()
    finally:
        httpd.server_close()
        sys.stderr.write(f"[{datetime.now(timezone.utc).isoformat()}] [PID {pid}] Standalone Demo Service stopped.\n")
        sys.stderr.flush()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="BRIDGE Standalone Demo Service")
    parser.add_argument("--port", type=int, default=int(os.environ.get("STANDALONE_SERVICE_PORT", "8001")), help="Port to listen on")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Host interface to bind")
    args = parser.parse_args()
    run_server(port=args.port, host=args.host)

