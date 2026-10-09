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


# ---------------------------------------------------------------------------
# Controlled Disposable Syntax Error Verification Framework
# ---------------------------------------------------------------------------

CONTROLLED_DISPOSABLE_FILE = os.path.join(
    FRONTEND_DIR, "src", "__disposable_syntax_test__.tsx"
)

CONTROLLED_SYNTAX_ERROR_CONTENT = """// CONTROLLED DISPOSABLE SYNTAX ERROR TEST FIXTURE (BRIDGE)
// This file is deliberately malformed to verify external build failure detection.
export const DisposableBrokenComponent = () => {
    const invalid_syntax: = {;;;
    return <div>Unclosed JSX;
};
"""


def inject_controlled_syntax_error(
    target_path: Optional[str] = None,
) -> Dict[str, Any]:
    """Step 1: Introduce a controlled syntax error in a disposable test copy."""
    from app import state

    file_path = target_path or CONTROLLED_DISPOSABLE_FILE
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(CONTROLLED_SYNTAX_ERROR_CONTENT)

    now_iso = datetime.now(timezone.utc).isoformat()
    state.record_audit_event(
        incident_id=None,
        event_type="frontend_syntax_error_injected",
        service="website",
        details={
            "file": os.path.basename(file_path),
            "disposable_path": file_path,
            "injected_at": now_iso,
        },
    )
    logger.info("Injected controlled syntax error into disposable test copy: %s", file_path)
    return {
        "success": True,
        "file_path": file_path,
        "injected_at": now_iso,
    }


def restore_disposable_source(
    target_path: Optional[str] = None,
) -> Dict[str, Any]:
    """Step 4a: Safely restore the source by removing the disposable syntax error copy."""
    from app import state

    file_path = target_path or CONTROLLED_DISPOSABLE_FILE
    existed = os.path.isfile(file_path)
    if existed:
        try:
            os.remove(file_path)
        except OSError as exc:
            logger.warning("Failed to remove disposable file: %s", exc)

    now_iso = datetime.now(timezone.utc).isoformat()
    state.record_audit_event(
        incident_id=None,
        event_type="frontend_source_restored",
        service="website",
        details={
            "file": os.path.basename(file_path),
            "removed": existed,
            "restored_at": now_iso,
        },
    )
    logger.info("Restored frontend source by removing disposable copy: %s", file_path)
    return {
        "success": True,
        "file_path": file_path,
        "removed": existed,
        "restored_at": now_iso,
    }


def resolve_frontend_build_incident(
    incident_id: str,
) -> Dict[str, Any]:
    """Step 5: Mark the frontend incident resolved and record recovery in audit history."""
    from app import state

    inc = state.get_incident(incident_id)
    now_iso = datetime.now(timezone.utc).isoformat()

    if inc:
        inc["status"] = "resolved"
        inc["recovery_completed_at"] = now_iso
        state.save_incident(inc)

    with state.state_lock:
        state.service_states["website"] = "healthy"
        state.save_service_states(state.service_states)

    state.record_audit_event(
        incident_id=incident_id,
        event_type="frontend_build_recovered",
        service="website",
        details={
            "incident_id": incident_id,
            "resolved_at": now_iso,
            "verified_status": "healthy",
        },
    )
    logger.info("Frontend build incident %s resolved and audited.", incident_id)
    return {
        "success": True,
        "incident_id": incident_id,
        "status": "resolved",
        "resolved_at": now_iso,
    }


def run_disposable_syntax_error_lifecycle(
    runner_failure: Optional[Callable[[], Dict[str, Any]]] = None,
    runner_success: Optional[Callable[[], Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Execute the full 5-step verification lifecycle for frontend syntax error detection and recovery.
    
    1. Introduce controlled syntax error in a disposable test copy.
    2. Detect the failed frontend build.
    3. Create a P1 incident and trigger SOS.
    4. Restore the source and verify the build succeeds.
    5. Confirm the incident and audit history reflect recovery.
    """
    from app import state

    steps_report: Dict[str, Any] = {}

    # Step 1: Introduce syntax error
    step1 = inject_controlled_syntax_error()
    steps_report["step_1_introduce_error"] = step1

    try:
        # Step 2 & 3: Detect failure and create P1 SOS incident
        step2_3 = check_frontend_build(auto_trigger_sos=True, runner=runner_failure)
        steps_report["step_2_detect_failure"] = {
            "healthy": step2_3["healthy"],
            "build_status": step2_3["build_status"],
            "exit_code": step2_3["exit_code"],
        }
        incident_info = step2_3.get("incident")
        inc_id = incident_info.get("incident_id") if incident_info else None
        steps_report["step_3_p1_sos_incident"] = {
            "incident_id": inc_id,
            "service": "website",
            "failure_type": "frontend_build_failure",
            "sos_dispatched": incident_info is not None,
        }
    finally:
        # Step 4: Restore source
        step4_restore = restore_disposable_source()
        step4_build = check_frontend_build(auto_trigger_sos=False, runner=runner_success)
        steps_report["step_4_restore_and_verify"] = {
            "source_restored": step4_restore["success"],
            "build_healthy": step4_build["healthy"],
            "build_status": step4_build["build_status"],
        }

    # Step 5: Confirm incident & audit history reflect recovery
    if inc_id:
        step5_resolve = resolve_frontend_build_incident(inc_id)
        steps_report["step_5_incident_and_audit_recovery"] = step5_resolve

    # Aggregate audit trail
    recent_audits = [
        e for e in state.audit_log
        if e.get("service") == "website" or (inc_id and e.get("incident_id") == inc_id)
    ][-5:]
    steps_report["audit_trail"] = recent_audits
    steps_report["verified"] = (
        steps_report.get("step_2_detect_failure", {}).get("build_status") == "failed"
        and steps_report.get("step_3_p1_sos_incident", {}).get("sos_dispatched") is True
        and steps_report.get("step_4_restore_and_verify", {}).get("build_healthy") is True
    )

    return steps_report


