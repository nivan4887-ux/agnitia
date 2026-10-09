"""
BRIDGE – Unit & Integration Tests for Automated SOS Incident Triggering.

Requirements tested:
1. Automatic creation of SOS incident when monitored failure is detected (no manual click needed).
2. External frontend build monitor detecting build/syntax failures outside client runtime.
3. Single unified SOS pipeline (app.sos.dispatch_sos_incident) for all monitored failures.
4. Persistence of incident and audit events using state/database mechanisms.
5. Preserving approval gates: high-risk auto-recovery halts at awaiting_approval.
6. Phone notification via Telegram Bot API with honest provider acceptance verification.
7. Deduplication for repeated reports of the same active failure, permitting new incident once resolved.
8. Monitoring endpoints (/monitors/frontend-build/check, /notifications/status).
"""

from __future__ import annotations

import json
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from app import build_monitor, notifications, sos, state
from app.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_state():
    """Ensure state is clean before and after each test."""
    state.reset_state()
    yield
    state.reset_state()


# ---------------------------------------------------------------------------
# 1. External Build Monitor Tests
# ---------------------------------------------------------------------------

def test_external_build_monitor_detects_clean_build():
    """External build monitor returns healthy status when build succeeds."""
    mock_runner = MagicMock(return_value={
        "success": True,
        "exit_code": 0,
        "stdout": "vite v5.4.19 building for production...\n✓ built in 1.2s",
        "stderr": "",
        "timestamp": "2026-10-09T12:00:00Z",
    })

    result = build_monitor.check_frontend_build(auto_trigger_sos=True, runner=mock_runner)
    assert result["healthy"] is True
    assert result["service"] == "website"
    assert result["build_status"] == "passed"
    assert len(state.incidents) == 0


def test_external_build_monitor_triggers_automated_sos_on_failure():
    """External build monitor detects syntax/bundler error and automatically dispatches SOS for 'website'."""
    error_msg = "src/App.tsx:42:15 - error TS2304: Cannot find name 'UndefinedComponent'."
    mock_runner = MagicMock(return_value={
        "success": False,
        "exit_code": 2,
        "stdout": "",
        "stderr": error_msg,
        "timestamp": "2026-10-09T12:00:00Z",
    })

    result = build_monitor.check_frontend_build(auto_trigger_sos=True, runner=mock_runner)

    assert result["healthy"] is False
    assert result["service"] == "website"
    assert result["build_status"] == "failed"
    assert result["incident"] is not None

    inc_id = result["incident"]["incident_id"]
    assert state.service_states["website"] == "failed"

    # Verify incident fields
    inc = state.get_incident(inc_id)
    assert inc is not None
    assert inc["failed_service"] == "website"
    assert inc["status"] == "open"
    assert inc["failure_type"] == "frontend_build_failure"
    assert inc["metadata"]["exit_code"] == 2

    # Verify audit log
    audit_events = [e for e in state.audit_log if e.get("incident_id") == inc_id]
    event_types = [e["event_type"] for e in audit_events]
    assert "sos_triggered" in event_types


def test_build_monitor_endpoint():
    """POST /monitors/frontend-build/check endpoint triggers build check and reports status."""
    with patch("app.build_monitor.run_build_command") as mock_run:
        mock_run.return_value = {
            "success": True,
            "exit_code": 0,
            "stdout": "Build passed",
            "stderr": "",
            "timestamp": "2026-10-09T12:00:00Z",
        }
        resp = client.post("/monitors/frontend-build/check")
        assert resp.status_code == 200
        data = resp.json()
        assert data["healthy"] is True
        assert data["build_status"] == "passed"


# ---------------------------------------------------------------------------
# 2. Automated Live Failure Detection & Single SOS Pathway
# ---------------------------------------------------------------------------

def test_live_probe_auto_sos_trigger():
    """Live HTTP probe failure triggers automated SOS via the unified SOS pathway."""
    from app.live_adapter import run_live_health_probe
    from app import demo_store

    demo_store.set_demo_state(is_healthy=False, reason="Connection pool timeout")

    probe_result = run_live_health_probe(auto_create_incident=True)
    assert probe_result["is_healthy"] is False
    assert probe_result["incident"] is not None

    inc_id = probe_result["incident"]["id"]
    assert probe_result["incident"]["failed_service"] == "backend_api"
    assert state.service_states["backend_api"] == "failed"
    assert state.service_states["website"] == "degraded"

    # Both generic SOS trigger and specific probe failure diagnostic are logged
    audit_types = [e["event_type"] for e in state.audit_log if e.get("incident_id") == inc_id]
    assert "sos_triggered" in audit_types
    assert "live_http_probe_failure" in audit_types


# ---------------------------------------------------------------------------
# 3. Deduplication vs Post-Resolution New Incident Creation
# ---------------------------------------------------------------------------

def test_sos_deduplication_for_active_failure():
    """Repeated alerts for an existing active failure are deduplicated and suppressed."""
    # First failure detected
    res1 = sos.dispatch_sos_incident(
        service="backend_api",
        reason="500 Internal Server Error",
        reporter="automated_monitor",
    )
    assert res1["duplicate"] is False
    inc_id1 = res1["incident_id"]
    assert len(state.incidents) == 1

    # Second failure detected for the same active service
    res2 = sos.dispatch_sos_incident(
        service="backend_api",
        reason="Repeated 500 error spike",
        reporter="automated_monitor",
    )
    assert res2["duplicate"] is True
    assert res2["incident_id"] == inc_id1
    assert "Active failure already exists" in res2["message"]
    assert res2["notification"]["status"] == "deduplicated_active_failure"
    assert len(state.incidents) == 1


def test_sos_allows_new_incident_after_prior_is_resolved():
    """Once a prior incident is resolved, a new failure creates a new distinct incident."""
    # First failure
    res1 = sos.dispatch_sos_incident(service="order_service", reason="Queue stall")
    inc_id1 = res1["incident_id"]
    assert res1["duplicate"] is False

    # Resolve the first incident
    with state.state_lock:
        inc1 = state.get_incident(inc_id1)
        inc1["status"] = "resolved"
        state.service_states["order_service"] = "healthy"

    # Second failure occurs later
    res2 = sos.dispatch_sos_incident(service="order_service", reason="New memory spike")
    inc_id2 = res2["incident_id"]
    assert res2["duplicate"] is False
    assert inc_id2 != inc_id1
    assert len(state.incidents) == 2


# ---------------------------------------------------------------------------
# 4. Telegram Notification & Provider Acceptance Verification
# ---------------------------------------------------------------------------

def test_notification_unconfigured_mode():
    """Without environment variables, notifications report unconfigured without claiming false delivery."""
    with patch.dict("os.environ", {}, clear=True):
        res = notifications.notify_sos_destination(
            incident_id="INC-TEST-001",
            service="backend_api",
            reason="High latency",
        )
        assert res["provider"] == "telegram"
        assert res["accepted"] is False
        assert res["status"] == "unconfigured"


def test_notification_successful_provider_acceptance():
    """Notification reports accepted=True only when Telegram API responds HTTP 200 with ok=true."""
    mock_response = MagicMock()
    mock_response.getcode.return_value = 200
    mock_response.read.return_value = json.dumps({"ok": True, "result": {"message_id": 88421}}).encode("utf-8")
    mock_response.__enter__.return_value = mock_response

    env_vars = {
        "TELEGRAM_BOT_TOKEN": "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
        "TELEGRAM_CHAT_ID": "987654321",
        "TELEGRAM_PHONE_DESTINATION": "+1234567890",
    }

    with patch.dict("os.environ", env_vars), patch("urllib.request.urlopen", return_value=mock_response):
        res = notifications.notify_sos_destination(
            incident_id="INC-TEL-001",
            service="database",
            reason="Replica lag critical",
        )
        assert res["accepted"] is True
        assert res["status"] == "accepted_by_provider"
        assert res["message_id"] == 88421
        assert res["destination"] == "+1234567890"


def test_notification_handles_provider_rejection():
    """Notification reports accepted=False when Telegram returns an API rejection."""
    mock_response = MagicMock()
    mock_response.getcode.return_value = 200
    mock_response.read.return_value = json.dumps({
        "ok": False,
        "error_code": 400,
        "description": "Bad Request: chat not found",
    }).encode("utf-8")
    mock_response.__enter__.return_value = mock_response

    env_vars = {
        "TELEGRAM_BOT_TOKEN": "valid_token",
        "TELEGRAM_CHAT_ID": "non_existent_chat",
    }

    with patch.dict("os.environ", env_vars), patch("urllib.request.urlopen", return_value=mock_response):
        res = notifications.notify_sos_destination(
            incident_id="INC-TEL-002",
            service="payment_service",
            reason="Gateway 504",
        )
        assert res["accepted"] is False
        assert res["status"] == "rejected_by_provider"
        assert "chat not found" in res["error"]


def test_notification_status_endpoint():
    """GET /notifications/status reports current notification gateway status."""
    resp = client.get("/notifications/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["provider"] == "telegram"
    assert "configured" in data


# ---------------------------------------------------------------------------
# 5. Risk and Approval Gate Preservation
# ---------------------------------------------------------------------------

def test_automated_sos_recovery_halts_at_awaiting_approval_for_high_risk():
    """When auto_trigger_recovery=True on a high-risk service (database), it halts at awaiting_approval."""
    res = sos.dispatch_sos_incident(
        service="database",
        reason="Disk I/O lockup",
        reporter="storage_monitor",
        auto_trigger_recovery=True,
    )

    inc_id = res["incident_id"]
    inc = state.get_incident(inc_id)
    assert inc is not None

    # Database is high risk: must NOT execute recovery actions automatically
    assert inc["status"] == "awaiting_approval"
    assert res["current_status"] == "awaiting_approval"

    # Must have generated an approval requirement
    approvals = [a for a in state.approvals if a.get("incident_id") == inc_id]
    assert len(approvals) >= 1
    assert approvals[0]["status"] == "pending"
    assert approvals[0]["service"] == "database"


# ---------------------------------------------------------------------------
# 6. Twilio Automated Voice Call Tests
# ---------------------------------------------------------------------------

def test_twilio_voice_call_unconfigured():
    """Twilio voice call reports unconfigured without crashing when credentials are missing."""
    with patch.dict("os.environ", {}, clear=True):
        res = notifications.notify_twilio_voice_call(
            incident_id="INC-CALL-001",
            service="database",
            reason="Outage",
        )
        assert res["provider"] == "twilio_voice"
        assert res["accepted"] is False
        assert res["status"] == "unconfigured"


def test_twilio_voice_call_success_mocked():
    """Twilio voice call reports accepted=True and call_queued on HTTP 201 with call SID."""
    mock_resp = MagicMock()
    mock_resp.getcode.return_value = 201
    mock_resp.read.return_value = json.dumps({"sid": "CA99887766", "status": "queued"}).encode("utf-8")
    mock_resp.__enter__.return_value = mock_resp

    env_vars = {
        "TWILIO_ACCOUNT_SID": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "TWILIO_AUTH_TOKEN": "secret_token",
        "TWILIO_FROM_NUMBER": "+1234567890",
        "TWILIO_TO_NUMBER": "+919876543210",
    }

    with patch.dict("os.environ", env_vars), patch("urllib.request.urlopen", return_value=mock_resp):
        res = notifications.notify_twilio_voice_call(
            incident_id="INC-CALL-002",
            service="backend_api",
            reason="High error rate",
        )
        assert res["accepted"] is True
        assert res["status"] == "call_queued"
        assert res["call_sid"] == "CA99887766"
        assert res["destination"] == "+919876543210"


def test_twilio_voice_call_endpoint():
    """POST /notifications/call-test endpoint executes voice call verification."""
    with patch("app.notifications.notify_twilio_voice_call") as mock_call:
        mock_call.return_value = {
            "provider": "twilio_voice",
            "accepted": True,
            "status": "call_queued",
            "call_sid": "CA112233",
        }
        resp = client.post("/notifications/call-test")
        assert resp.status_code == 200
        assert resp.json()["accepted"] is True


