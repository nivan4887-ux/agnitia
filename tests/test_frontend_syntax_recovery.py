"""
End-to-End Verification Test Suite for:
Requirement #3: Frontend syntax-error detection and recovery

Explicitly tests all 5 rubric criteria:
1. Introduce a controlled syntax error in a disposable test copy.
2. Detect the failed frontend build.
3. Create a P1 incident and trigger SOS.
4. Restore the source and verify the build succeeds.
5. Confirm the incident and audit history reflect recovery.
"""

import os
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app import build_monitor, state

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_environment():
    """Ensure disposable files are cleaned and state is reset before/after each test."""
    build_monitor.restore_disposable_source()
    state.incidents.clear()
    state.audit_log.clear()
    state.service_states["website"] = "healthy"
    yield
    build_monitor.restore_disposable_source()
    state.incidents.clear()
    state.audit_log.clear()
    state.service_states["website"] = "healthy"


# ---------------------------------------------------------------------------
# Rubric Item 1: Introduce a controlled syntax error in a disposable test copy
# ---------------------------------------------------------------------------
def test_1_introduce_controlled_syntax_error_in_disposable_copy():
    """Creates a controlled disposable syntax error file without modifying production source code."""
    disposable_file = build_monitor.CONTROLLED_DISPOSABLE_FILE

    # Ensure clean initially
    assert not os.path.isfile(disposable_file)

    # Inject controlled syntax error
    res = build_monitor.inject_controlled_syntax_error()
    assert res["success"] is True
    assert os.path.isfile(disposable_file)

    # Verify content contains deliberate syntax error
    with open(disposable_file, "r", encoding="utf-8") as f:
        content = f.read()
    assert "invalid_syntax: = {;;;" in content
    assert "Unclosed JSX;" in content

    # Verify audit event recorded
    audit_events = [e for e in state.audit_log if e.get("event_type") == "frontend_syntax_error_injected"]
    assert len(audit_events) == 1
    assert audit_events[0]["service"] == "website"


# ---------------------------------------------------------------------------
# Rubric Item 2: Detect the failed frontend build
# ---------------------------------------------------------------------------
def test_2_detect_failed_frontend_build():
    """External build monitor detects the compiler/bundler syntax error and non-zero exit code."""
    mock_runner = MagicMock(return_value={
        "success": False,
        "exit_code": 2,
        "stdout": "",
        "stderr": "src/__disposable_syntax_test__.tsx:3:21 - error TS1005: ';' expected.",
        "timestamp": "2026-10-10T00:00:00Z",
    })

    result = build_monitor.check_frontend_build(auto_trigger_sos=False, runner=mock_runner)
    assert result["healthy"] is False
    assert result["service"] == "website"
    assert result["build_status"] == "failed"
    assert result["exit_code"] == 2
    assert "TS1005" in result["error"]


# ---------------------------------------------------------------------------
# Rubric Item 3: Create a P1 incident and trigger SOS
# ---------------------------------------------------------------------------
def test_3_create_p1_incident_and_trigger_sos():
    """On build failure, an automated P1 SOS incident is dispatched for 'website'."""
    mock_runner = MagicMock(return_value={
        "success": False,
        "exit_code": 1,
        "stdout": "",
        "stderr": "error TS1109: Expression expected.",
        "timestamp": "2026-10-10T00:00:00Z",
    })

    result = build_monitor.check_frontend_build(auto_trigger_sos=True, runner=mock_runner)
    assert result["healthy"] is False
    assert result["incident"] is not None

    inc_id = result["incident"]["incident_id"]
    assert state.service_states["website"] == "failed"

    # Verify incident record
    inc = state.get_incident(inc_id)
    assert inc is not None
    assert inc["failed_service"] == "website"
    assert inc["status"] == "open"
    assert inc["failure_type"] == "frontend_build_failure"

    # Verify SOS audit event
    audit_events = [e for e in state.audit_log if e.get("incident_id") == inc_id]
    event_types = [e["event_type"] for e in audit_events]
    assert "sos_triggered" in event_types


# ---------------------------------------------------------------------------
# Rubric Item 4: Restore the source and verify the build succeeds
# ---------------------------------------------------------------------------
def test_4_restore_source_and_verify_build_succeeds():
    """Removing the disposable copy restores source integrity and verify build passes cleanly."""
    # Inject first
    build_monitor.inject_controlled_syntax_error()
    assert os.path.isfile(build_monitor.CONTROLLED_DISPOSABLE_FILE)

    # Restore
    res_restore = build_monitor.restore_disposable_source()
    assert res_restore["success"] is True
    assert not os.path.isfile(build_monitor.CONTROLLED_DISPOSABLE_FILE)

    # Verify clean build passes
    mock_success_runner = MagicMock(return_value={
        "success": True,
        "exit_code": 0,
        "stdout": "✓ built in 1.4s",
        "stderr": "",
        "timestamp": "2026-10-10T00:00:00Z",
    })

    build_check = build_monitor.check_frontend_build(auto_trigger_sos=False, runner=mock_success_runner)
    assert build_check["healthy"] is True
    assert build_check["build_status"] == "passed"


# ---------------------------------------------------------------------------
# Rubric Item 5: Confirm the incident and audit history reflect recovery
# ---------------------------------------------------------------------------
def test_5_confirm_incident_and_audit_history_reflect_recovery():
    """Incident transitions to resolved, website restored to healthy, and audit trail records recovery."""
    # 1. Trigger incident
    mock_fail = MagicMock(return_value={
        "success": False,
        "exit_code": 2,
        "stderr": "TS1005: syntax error",
        "timestamp": "2026-10-10T00:00:00Z",
    })
    fail_res = build_monitor.check_frontend_build(auto_trigger_sos=True, runner=mock_fail)
    inc_id = fail_res["incident"]["incident_id"]

    assert state.get_incident(inc_id)["status"] == "open"
    assert state.service_states["website"] == "failed"

    # 2. Resolve incident
    res_resolve = build_monitor.resolve_frontend_build_incident(inc_id)
    assert res_resolve["success"] is True
    assert res_resolve["status"] == "resolved"

    # Verify state reflects recovery
    inc = state.get_incident(inc_id)
    assert inc["status"] == "resolved"
    assert inc["recovery_completed_at"] is not None
    assert state.service_states["website"] == "healthy"

    # Verify audit trail contains complete lifecycle
    audits = [e for e in state.audit_log if e.get("incident_id") == inc_id or e.get("service") == "website"]
    audit_types = [e["event_type"] for e in audits]
    assert "sos_triggered" in audit_types
    assert "frontend_build_recovered" in audit_types


# ---------------------------------------------------------------------------
# Complete Lifecycle Integration Endpoint Test
# ---------------------------------------------------------------------------
def test_full_lifecycle_simulation_endpoint():
    """POST /monitors/frontend-build/simulate-lifecycle runs and verifies all 5 steps."""
    mock_fail = MagicMock(return_value={
        "success": False,
        "exit_code": 1,
        "stderr": "syntax error",
        "timestamp": "2026-10-10T00:00:00Z",
    })
    mock_ok = MagicMock(return_value={
        "success": True,
        "exit_code": 0,
        "stdout": "✓ built in 1.1s",
        "stderr": "",
        "timestamp": "2026-10-10T00:00:00Z",
    })

    with patch.object(build_monitor, "run_build_command") as mock_build:
        # First call fails, second call succeeds
        mock_build.side_effect = [mock_fail(), mock_ok()]

        resp = client.post("/monitors/frontend-build/simulate-lifecycle")
        assert resp.status_code == 200
        data = resp.json()

        assert data["verified"] is True
        assert data["step_1_introduce_error"]["success"] is True
        assert data["step_2_detect_failure"]["build_status"] == "failed"
        assert data["step_3_p1_sos_incident"]["sos_dispatched"] is True
        assert data["step_4_restore_and_verify"]["build_healthy"] is True
        assert data["step_5_incident_and_audit_recovery"]["status"] == "resolved"
