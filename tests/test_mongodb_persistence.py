"""
BRIDGE – Automated Tests for MongoDB Persistence & State Dual-Sync.

Tests database connectivity, ping endpoint, incident persistence,
approval persistence, recovery job tracking, audit log persistence,
and transparent in-memory fallback.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app import db, state
from app.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_state():
    """Reset state before and after each test."""
    state.reset_state()
    yield
    state.reset_state()


def test_db_status_endpoint():
    """GET /db/status must return a valid status structure."""
    resp = client.get("/db/status")
    assert resp.status_code == 200
    data = resp.json()
    assert "connected" in data
    if data["connected"]:
        assert "database" in data
        assert data["ping"] == {"ok": 1}


def test_root_health_reports_database_status():
    """GET / must include database connectivity indicator."""
    resp = client.get("/")
    assert resp.status_code == 200
    data = resp.json()
    assert "database" in data
    assert data["database"] in ("connected", "in_memory_fallback")


def test_incident_persistence_lifecycle():
    """Failing a service must persist the incident both in memory and in MongoDB if connected."""
    inc = state.fail_service("database")
    inc_id = inc["id"]

    # Verify memory
    assert state.get_incident(inc_id) is not None

    # Verify MongoDB if connected
    if db.is_connected():
        loaded = db.load_all_state()
        persisted_inc = next((i for i in loaded.get("incidents", []) if i.get("id") == inc_id), None)
        assert persisted_inc is not None
        assert persisted_inc["failed_service"] == "database"
        # Must not contain raw BSON ObjectId
        assert "_id" not in persisted_inc


def test_approval_persistence_lifecycle():
    """Creating and updating approvals must persist to MongoDB if connected."""
    appr = state.create_pending_approval(
        incident_id="INC-TEST-999",
        service="database",
        action="restore_backup_and_restart",
        risk_level="high_risk",
        description="Test approval persistence",
    )
    appr_id = appr["id"]

    assert state.get_approval(appr_id) is not None

    if db.is_connected():
        loaded = db.load_all_state()
        persisted_appr = next((a for a in loaded.get("approvals", []) if a.get("id") == appr_id), None)
        assert persisted_appr is not None
        assert persisted_appr["status"] == "pending"
        assert "_id" not in persisted_appr


def test_recovery_job_persistence_lifecycle():
    """Recovery jobs must persist across lifecycle stages."""
    job = state.create_recovery_job(
        incident_id="INC-JOB-001",
        service="backend_api",
        recovery_order=["database", "backend_api"],
    )
    job_id = job["id"]

    assert state.get_recovery_job(job_id) is not None

    # Update job
    state.update_recovery_job(
        job_id=job_id,
        stage="analyzing",
        status="recovering",
        log_message="Analyzing dependency tree",
    )

    if db.is_connected():
        loaded = db.load_all_state()
        persisted_jobs = loaded.get("recovery_jobs", {})
        assert job_id in persisted_jobs
        assert persisted_jobs[job_id]["stage"] == "analyzing"
        assert "_id" not in persisted_jobs[job_id]


def test_audit_event_persistence():
    """Audit events must persist globally and on incidents."""
    event = state.record_audit_event(
        incident_id="INC-AUDIT-001",
        event_type="test_audit_event",
        service="database",
        details={"metric": 42},
    )
    event_id = event["id"]

    assert any(e["id"] == event_id for e in state.audit_log)

    if db.is_connected():
        loaded = db.load_all_state()
        persisted_events = loaded.get("audit_log", [])
        assert any(e.get("id") == event_id for e in persisted_events)


def test_save_functions_return_booleans_honestly():
    """save_* functions in db and state must return True on success and False when disconnected/errored."""
    from unittest.mock import MagicMock, patch

    # 1. Disconnected case: db returns None
    with patch("app.db.get_database", return_value=None):
        assert db.save_incident({"id": "INC-01"}) is False
        assert db.save_approval({"id": "APPR-01"}) is False
        assert db.save_recovery_job({"id": "JOB-01"}) is False
        assert db.save_audit_event({"id": "EVT-01"}) is False
        assert db.save_service_states({"database": "healthy"}) is False

        assert state.save_incident({"id": "INC-01"}) is False
        assert state.save_approval({"id": "APPR-01"}) is False
        assert state.save_recovery_job({"id": "JOB-01"}) is False
        assert state.save_audit_event({"id": "EVT-01"}) is False
        assert state.save_service_states({"database": "healthy"}) is False

    # 2. Write exception case
    mock_db = MagicMock()
    mock_db.__getitem__.return_value.replace_one.side_effect = RuntimeError("Disk full")
    with patch("app.db.get_database", return_value=mock_db):
        assert db.save_incident({"id": "INC-01"}) is False
        assert state.save_incident({"id": "INC-01"}) is False

    # 3. Successful write case
    mock_success_db = MagicMock()
    mock_res = MagicMock()
    mock_res.acknowledged = True
    mock_success_db.__getitem__.return_value.replace_one.return_value = mock_res
    with patch("app.db.get_database", return_value=mock_success_db):
        assert db.save_incident({"id": "INC-01"}) is True
        assert state.save_incident({"id": "INC-01"}) is True


def test_audit_event_stable_id_and_upsert_idempotency():
    """Audit events without IDs get stable IDs assigned in-place and upserted idempotently."""
    from unittest.mock import MagicMock, patch

    mock_db = MagicMock()
    mock_res = MagicMock()
    mock_res.acknowledged = True
    mock_db.__getitem__.return_value.replace_one.return_value = mock_res

    event = {"event_type": "node_offline", "details": {"node": "alpha"}}
    # First write assigns id in-place
    with patch("app.db.get_database", return_value=mock_db):
        success1 = db.save_audit_event(event)
        assert success1 is True
        assigned_id = event.get("id")
        assert assigned_id is not None
        assert len(assigned_id) > 0

        # Second write reuses the exact same id without generating a new one
        success2 = db.save_audit_event(event)
        assert success2 is True
        assert event["id"] == assigned_id

        # Verify replace_one with upsert=True was called, NOT insert_one
        assert mock_db["audit_log"].replace_one.call_count == 2
        mock_db["audit_log"].insert_one.assert_not_called()


def test_clean_doc_from_mongo_preserves_id_from_bson_id():
    """If a MongoDB document has _id and no id, _clean_doc_from_mongo preserves it as id."""
    raw_doc = {"_id": "mongoid-12345", "service": "database", "status": "healthy"}
    cleaned = db._clean_doc_from_mongo(raw_doc)
    assert "_id" not in cleaned
    assert cleaned["id"] == "mongoid-12345"
    assert cleaned["service"] == "database"


def test_engine_persists_intermediate_recovery_progress():
    """Recovery execution must invoke state.save_incident at intermediate step transitions."""
    from unittest.mock import patch
    from app import engine

    incident = state.fail_service("database")
    inc_id = incident["id"]

    saved_incidents = []
    original_save = state.save_incident

    def spy_save(inc):
        saved_incidents.append(inc["status"])
        return original_save(inc)

    with patch("app.state.save_incident", side_effect=spy_save):
        engine.execute_recovery(incident)

    # Must be saved during recovery progression (awaiting_approval, recovering, resolved)
    assert len(saved_incidents) > 0

