"""
BRIDGE – Safe Dedicated Python Process Supervisor for Standalone Demo Service.

Manages the lifecycle (start, stop, inspect, restart) of ONLY the specifically
configured standalone demo service process.
"""

from __future__ import annotations

import atexit
import os
import subprocess
import sys
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# Constant repository-fixed entrypoint (prevents arbitrary executable injection)
ROOT_DIR = Path(__file__).resolve().parent.parent
STANDALONE_SCRIPT_PATH = (ROOT_DIR / "standalone_service" / "server.py").resolve()
DEFAULT_PORT = int(os.environ.get("STANDALONE_SERVICE_PORT", "8001"))


class StandaloneSupervisor:
    """Safe, single-process supervisor specifically bound to the standalone demo service."""

    def __init__(self, port: int = DEFAULT_PORT) -> None:
        self._port = port
        self._process: subprocess.Popen[str] | None = None
        self._lock = threading.Lock()
        self._logs: list[str] = []
        self._started_at: str | None = None

    @property
    def port(self) -> int:
        return self._port

    def is_running(self) -> bool:
        """Check if the supervised child process is actively running."""
        with self._lock:
            if self._process is None:
                return False
            # poll() returns None if process is still running
            poll_result = self._process.poll()
            if poll_result is not None:
                # Process terminated unexpectedly
                self._process = None
                return False
            return True

    def get_pid(self) -> int | None:
        """Return PID of the supervised child process, or None if stopped."""
        with self._lock:
            if self._process and self._process.poll() is None:
                return self._process.pid
            return None

    def get_status(self) -> dict[str, Any]:
        """Inspect the current operational status of the standalone demo process."""
        with self._lock:
            running = self._process is not None and self._process.poll() is None
            pid = self._process.pid if running else None
            exit_code = self._process.poll() if self._process else None

            return {
                "running": running,
                "pid": pid,
                "control_backend_pid": os.getpid(),
                "port": self._port,
                "entrypoint": str(STANDALONE_SCRIPT_PATH),
                "started_at": self._started_at,
                "exit_code": exit_code,
                "log_history_count": len(self._logs),
                "recent_logs": self._logs[-10:],
            }

    def start_service(self, port: int | None = None) -> dict[str, Any]:
        """Start the standalone demo process if not already running."""
        with self._lock:
            if port is not None:
                self._port = port

            # 1. Prevent duplicate instances
            if self._process is not None and self._process.poll() is None:
                return {
                    "success": True,
                    "action": "already_running",
                    "pid": self._process.pid,
                    "port": self._port,
                    "message": f"Standalone demo service is already running on PID {self._process.pid}",
                }

            if not STANDALONE_SCRIPT_PATH.exists():
                raise FileNotFoundError(f"Fixed entrypoint script not found: {STANDALONE_SCRIPT_PATH}")

            now_iso = datetime.now(timezone.utc).isoformat()
            # 2. Launch using fixed Python executable and fixed script path (shell=False)
            cmd = [
                sys.executable,
                str(STANDALONE_SCRIPT_PATH),
                "--port",
                str(self._port),
                "--host",
                "127.0.0.1",
            ]

            try:
                proc = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    bufsize=1,
                    shell=False,  # CRITICAL: Prevent arbitrary shell injection
                )

                # Ensure child PID is never confused with control backend
                if proc.pid == os.getpid():
                    proc.kill()
                    raise RuntimeError("Child PID collision with control backend PID")

                self._process = proc
                self._started_at = now_iso
                log_entry = f"[{now_iso}] Started standalone demo process on PID {proc.pid} (Port {self._port})"
                self._logs.append(log_entry)

                # Start background log reader thread
                def _drain_output(p: subprocess.Popen[str]):
                    try:
                        if p.stdout:
                            for line in iter(p.stdout.readline, ""):
                                if line:
                                    clean_line = line.strip()
                                    with self._lock:
                                        self._logs.append(clean_line)
                                        if len(self._logs) > 200:
                                            self._logs.pop(0)
                    except Exception:
                        pass

                threading.Thread(target=_drain_output, args=(proc,), daemon=True).start()

                # Brief wait to verify it did not instantly crash
                time.sleep(0.15)
                if proc.poll() is not None:
                    exit_code = proc.poll()
                    self._process = None
                    raise RuntimeError(f"Standalone demo service failed immediately on start (Exit code {exit_code})")

                return {
                    "success": True,
                    "action": "started",
                    "pid": proc.pid,
                    "port": self._port,
                    "message": f"Successfully launched standalone demo service on PID {proc.pid}",
                }

            except Exception as e:
                self._logs.append(f"[{datetime.now(timezone.utc).isoformat()}] Failed to launch demo service: {e}")
                raise

    def stop_service(self, timeout: float = 4.0) -> dict[str, Any]:
        """Gracefully terminate the supervised process, escalating to kill on timeout."""
        with self._lock:
            if self._process is None or self._process.poll() is not None:
                self._process = None
                return {
                    "success": True,
                    "action": "already_stopped",
                    "message": "Standalone demo service is not currently running.",
                }

            proc = self._process
            pid = proc.pid
            now_iso = datetime.now(timezone.utc).isoformat()

            try:
                # 1. Graceful SIGTERM
                proc.terminate()
                try:
                    proc.wait(timeout=timeout)
                except subprocess.TimeoutExpired:
                    # 2. Forced SIGKILL on timeout
                    proc.kill()
                    proc.wait(timeout=2.0)

                self._logs.append(f"[{now_iso}] Terminated standalone demo process PID {pid}")
                self._process = None

                return {
                    "success": True,
                    "action": "stopped",
                    "pid": pid,
                    "message": f"Successfully stopped standalone demo process (PID {pid})",
                }

            except Exception as exc:
                self._logs.append(f"[{now_iso}] Error terminating PID {pid}: {exc}")
                self._process = None
                return {
                    "success": False,
                    "error": str(exc),
                }

    def restart_service(self, port: int | None = None, timeout: float = 4.0) -> dict[str, Any]:
        """Safely stop and start the supervised standalone process."""
        self.stop_service(timeout=timeout)
        time.sleep(0.1)
        return self.start_service(port=port)


# Global singleton supervisor
supervisor = StandaloneSupervisor()

# Ensure child process is terminated when BRIDGE process exits
atexit.register(supervisor.stop_service)

