"""
BRIDGE – External Frontend Build & Syntax Monitor.

Monitors the frontend build process externally from the Python/FastAPI environment.
Because a frontend with syntax or bundle errors cannot execute in the browser to report its
own failure, this external process detects compiler/type/bundler failures and automatically
dispatches an emergency SOS incident through the unified BRIDGE SOS pipeline.
"""

from __future__ import annotations

import logging
import os
import shutil
import subprocess
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional

from app import sos

logger = logging.getLogger("bridge.build_monitor")

FRONTEND_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "frontend")
)


def run_build_command(
    command: Optional[List[str]] = None,
    cwd: Optional[str] = None,
    timeout_seconds: float = 45.0,
) -> Dict[str, Any]:
    """Execute the frontend build process externally and capture stdout/stderr."""
    target_dir = cwd or FRONTEND_DIR
    cmd = command

    if cmd is None:
        # Detect npm executable (npm.cmd on Windows)
        npm_bin = shutil.which("npm.cmd") or shutil.which("npm") or "npm"
        cmd = [npm_bin, "run", "build"]

    now_iso = datetime.now(timezone.utc).isoformat()

    try:
        proc = subprocess.run(
            cmd,
            cwd=target_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=timeout_seconds,
            shell=os.name == "nt",
        )
        return {
            "success": proc.returncode == 0,
            "exit_code": proc.returncode,
            "stdout": proc.stdout[-1500:] if proc.stdout else "",
            "stderr": proc.stderr[-1500:] if proc.stderr else "",
            "timestamp": now_iso,
        }
    except subprocess.TimeoutExpired as tex:
        return {
            "success": False,
            "exit_code": -1,
            "stdout": tex.stdout or "" if tex.stdout else "",
            "stderr": "Build process timed out after 45 seconds.",
            "timestamp": now_iso,
        }
    except Exception as exc:
        return {
            "success": False,
            "exit_code": -2,
            "stdout": "",
            "stderr": str(exc),
            "timestamp": now_iso,
        }


def check_frontend_build(
    auto_trigger_sos: bool = True,
    runner: Optional[Callable[[], Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Inspect the frontend build externally and trigger an automatic SOS incident if it fails.

    Parameters:
        auto_trigger_sos: If True, automatically creates an SOS incident on build failure.
        runner: Optional test runner mock returning {'success': bool, 'exit_code': int, 'stderr': str}.
    """
    logger.info("Executing external frontend build health check...")
    build_result = runner() if runner is not None else run_build_command()

    if build_result["success"]:
        return {
            "healthy": True,
            "service": "website",
            "build_status": "passed",
            "message": "Frontend build and TypeScript compilation passed cleanly.",
            "timestamp": build_result["timestamp"],
        }

    # Extract concise error summary from stderr or stdout
    err_text = (build_result.get("stderr") or build_result.get("stdout") or "Unknown build error").strip()
    first_lines = "\n".join(err_text.splitlines()[:5])
    reason = f"Frontend build failure detected by external monitor: {first_lines}"

    incident_result: Optional[Dict[str, Any]] = None
    if auto_trigger_sos:
        logger.warning("Frontend build failure detected externally! Triggering automated SOS...")
        incident_result = sos.dispatch_sos_incident(
            service="website",
            reason=reason,
            reporter="external_build_monitor",
            failure_type="frontend_build_failure",
            metadata={
                "exit_code": build_result["exit_code"],
                "error_output": first_lines,
                "detected_at": build_result["timestamp"],
            },
            auto_trigger_recovery=False,  # Website requires inspection or code review
        )

    return {
        "healthy": False,
        "service": "website",
        "build_status": "failed",
        "error": reason,
        "exit_code": build_result["exit_code"],
        "incident": incident_result,
        "timestamp": build_result["timestamp"],
    }

