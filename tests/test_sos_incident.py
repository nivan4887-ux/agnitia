"""
BRIDGE – Unit & Integration Tests for Mobile-Friendly SOS Incident Trigger.

Tests:
1. SOS incident creation, payload validation, and service state cascading.
2. Audit logging with event_type="sos_triggered".
3. Idempotent deduplication using idempotency_key to prevent duplicate submissions from rapid clicks.
4. Validation rejection for missing or invalid service names.
5. Invariant check: SOS incidents remain in 'open' status without bypass of safety/approval gates.
6. Integration with persistence layer and state reset fixture.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

from app import state
from app.graph import SERVICES
from app.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_state():
    """Ensure state is clean before and after each test."""
    state.reset_state()
    yield
    state.reset_state()


def test_sos_trigger_success_lifecycle():
    """POST /incidents/sos creates an open P1 incident, cascades degradation, and records audit event."""
    payload = {
        "service": "backend_api",
        "reason": "Production 503 response spike detected on mobile monitoring",
        "reporter": "oncall_sre_mobile",
    }
    resp = client.post("/incidents/sos", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["status"] == "ok"
    assert "incident_id" in data
    assert data["current_status"] == "open"
    assert data["service"] == "backend_api"
    assert data["duplicate"] is False

    inc_id = data["incident_id"]

    # Verify memory state
    inc = state.get_incident(inc_id)
    assert inc is not None
    assert inc["failed_service"] == "backend_api"
    assert inc["status"] == "open"
    assert "website" in inc["affected_services"]
    assert "order_service" in inc["affected_services"]

    # Verify service states: backend_api is failed, downstream website is degraded
    assert state.service_states["backend_api"] == "failed"
    assert state.service_states["website"] == "degraded"

    # Verify audit event recorded
    sos_audit = [e for e in state.audit_log if e.get("event_type") == "sos_triggered"]
    assert len(sos_audit) >= 1
    latest_evt = sos_audit[-1]
    assert latest_evt["incident_id"] == inc_id
    assert latest_evt["details"]["reporter"] == "oncall_sre_mobile"
    assert latest_evt["details"]["severity"] == "P1_CRITICAL"


def test_sos_alias_endpoint():
    """POST /sos alias endpoint functions identically to /incidents/sos."""
    resp = client.post("/sos", json={"service": "payment_service", "reason": "Payment gateway timeout"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["service"] == "payment_service"
    assert data["current_status"] == "open"
    assert state.service_states["payment_service"] == "failed"


def test_sos_rejects_missing_or_invalid_service():
    """POST /incidents/sos rejects empty or non-existent service names with HTTP 400."""
    # Empty service
    resp_empty = client.post("/incidents/sos", json={"service": "   "})
    assert resp_empty.status_code == 400
    assert "Target service name is required" in resp_empty.json()["detail"]

    # Invalid service
    resp_invalid = client.post("/incidents/sos", json={"service": "unknown_microservice_xyz"})
    assert resp_invalid.status_code == 400
    assert "Unknown service 'unknown_microservice_xyz'" in resp_invalid.json()["detail"]


def test_sos_duplicate_prevention_via_idempotency_key():
    """Rapid repeated submissions with the same idempotency_key return duplicate indicator without creating multiple incidents."""
    idempotency_key = "sos_key_test_dup_9999"
    payload = {
        "service": "database",
        "reason": "Database connection exhaustion",
        "idempotency_key": idempotency_key,
    }

    # First click
    resp1 = client.post("/incidents/sos", json=payload)
    assert resp1.status_code == 200
    data1 = resp1.json()
    inc1_id = data1["incident_id"]
    assert data1["duplicate"] is False
    assert len(state.incidents) == 1

    # Rapid second click (e.g. double-tap on mobile)
    resp2 = client.post("/incidents/sos", json=payload)
    assert resp2.status_code == 200
    data2 = resp2.json()

    # Second response returns the same incident and duplicate flag
    assert data2["duplicate"] is True
    assert data2["incident_id"] == inc1_id
    assert "Duplicate SOS submission detected" in data2["message"]

    # Only one incident created in state
    assert len(state.incidents) == 1


def test_sos_does_not_auto_resolve_or_bypass_risk_gates():
    """Triggering SOS leaves incident in 'open' status and does NOT automatically execute dangerous recovery."""
    payload = {"service": "database", "reason": "Core database failure"}
    resp = client.post("/incidents/sos", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    # Must be OPEN, never auto-resolved
    assert data["current_status"] == "open"
    assert data["incident"]["status"] == "open"

    # Approvals should NOT be auto-generated or auto-approved yet
    assert len(state.approvals) == 0
    # Recovery jobs should not be running yet
    assert len(state.recovery_jobs) == 0


def test_sos_persists_to_mongodb_layer():
    """SOS trigger invokes persistence layer for incident and audit records."""
    mock_save_inc = MagicMock(return_value=True)
    mock_save_audit = MagicMock(return_value=True)

    with patch("app.state.save_incident", mock_save_inc), patch("app.state.save_audit_event", mock_save_audit):
        resp = client.post("/incidents/sos", json={"service": "database", "reason": "Database connection drop"})
        assert resp.status_code == 200
        assert mock_save_inc.called
        assert mock_save_audit.called
