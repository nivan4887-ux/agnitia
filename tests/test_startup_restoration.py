"""
BRIDGE – Unit Tests for Safe MongoDB Startup State Restoration.

Validates that restore_state_from_db() restores incidents, approvals,
recovery jobs, audit events, and service states safely without clear/delete
operations, handles missing/empty data and exceptions gracefully, and preserves
global container identities.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch
import pytest

from app import state
from app.graph import SERVICES


@pytest.fixture(autouse=True)
def clean_state():
    """Ensure in-memory clean state before and after each test."""
    state.reset_state()
    yield
    state.reset_state()


def test_restore_state_from_db_all_five_categories():
    """Verify restoring incidents, approvals, recovery jobs, audit logs, and service states."""
    mock_data = {
        "service_states": {s: "degraded" if s == "backend_api" else "healthy" for s in SERVICES},
        "incidents": [{"id": "INC-RESTORE-001", "status": "open", "failed_service": "backend_api"}],
        "approvals": [{"id": "APPR-RESTORE-001", "status": "pending", "service": "database"}],
        "recovery_jobs": {"JOB-RESTORE-001": {"id": "JOB-RESTORE-001", "stage": "analyzing", "status": "recovering"}},
        "audit_log": [{"id": "EVT-RESTORE-001", "event_type": "incident_created"}],
    }

    # Verify identities before restore
    orig_incidents = state.incidents
    orig_approvals = state.approvals
    orig_jobs = state.recovery_jobs
    orig_audit = state.audit_log
    orig_states = state.service_states

    with patch("app.db.load_all_state", return_value=mock_data):
        success = state.restore_state_from_db()
        assert success is True

    # Check identities are preserved in place
    assert state.incidents is orig_incidents
    assert state.approvals is orig_approvals
    assert state.recovery_jobs is orig_jobs
    assert state.audit_log is orig_audit
    assert state.service_states is orig_states

    # Check contents
    assert len(state.incidents) == 1
    assert state.incidents[0]["id"] == "INC-RESTORE-001"
    assert len(state.approvals) == 1
    assert state.approvals[0]["id"] == "APPR-RESTORE-001"
    assert "JOB-RESTORE-001" in state.recovery_jobs
    assert len(state.audit_log) == 1
    assert state.service_states["backend_api"] == "degraded"


def test_restore_state_from_db_empty_result():
    """Empty result or empty dictionary does not error and retains default healthy state."""
    with patch("app.db.load_all_state", return_value={}):
        success = state.restore_state_from_db()
        assert success is False

    assert all(st == "healthy" for st in state.service_states.values())
    assert len(state.incidents) == 0
    assert len(state.approvals) == 0
    assert len(state.recovery_jobs) == 0
    assert len(state.audit_log) == 0


def test_restore_state_from_db_load_exception():
    """Load exception logs warning and continues safely without crashing."""
    with patch("app.db.load_all_state", side_effect=RuntimeError("MongoDB connection timeout")):
        success = state.restore_state_from_db()
        assert success is False

    assert all(st == "healthy" for st in state.service_states.values())


def test_restore_state_does_not_call_delete_or_clear():
    """Restoration must never invoke database deletion or collection clearing."""
    mock_db = MagicMock()
    with patch("app.db.clear_collections", mock_db.clear_collections):
        with patch("app.db.load_all_state", return_value={}):
            state.restore_state_from_db()
            mock_db.clear_collections.assert_not_called()


def test_reset_state_preserves_identities_and_clears_safely():
    """reset_state() must clear in-memory containers, reset service states, and preserve references."""
    orig_incidents = state.incidents
    orig_states = state.service_states

    state.fail_service("database")
    assert len(state.incidents) > 0
    assert state.service_states["database"] == "failed"

    mock_db = MagicMock()
    with patch("app.db.clear_collections", mock_db.clear_collections):
        state.reset_state()
        mock_db.clear_collections.assert_not_called()

    assert state.incidents is orig_incidents
    assert state.service_states is orig_states
    assert len(state.incidents) == 0
    assert all(st == "healthy" for st in state.service_states.values())


def test_restore_state_idempotent():
    """Invoking restoration multiple times must safely overwrite in-memory containers without duplicating items."""
    mock_data = {
        "service_states": {s: "healthy" for s in SERVICES},
        "incidents": [{"id": "INC-001", "status": "open"}],
        "approvals": [{"id": "APPR-001", "status": "pending"}],
        "recovery_jobs": {"JOB-001": {"id": "JOB-001"}},
        "audit_log": [{"id": "EVT-001", "event_type": "test"}],
    }
    with patch("app.db.load_all_state", return_value=mock_data):
        state.restore_state_from_db()
        state.restore_state_from_db()

    assert len(state.incidents) == 1
    assert len(state.approvals) == 1
    assert len(state.recovery_jobs) == 1
    assert len(state.audit_log) == 1


def test_restore_state_partial_collections():
    """Missing collections in loaded payload must preserve default in-memory containers."""
    mock_data = {
        "incidents": [{"id": "INC-PARTIAL-001", "status": "open"}],
    }
    with patch("app.db.load_all_state", return_value=mock_data):
        success = state.restore_state_from_db()
        assert success is True

    # Incidents restored
    assert len(state.incidents) == 1
    assert state.incidents[0]["id"] == "INC-PARTIAL-001"

    # Untouched containers retain valid defaults
    assert all(st == "healthy" for st in state.service_states.values())
    assert len(state.approvals) == 0
    assert len(state.recovery_jobs) == 0
    assert len(state.audit_log) == 0


def test_restore_state_malformed_and_contaminated_elements():
    """Malformed collections and contaminated list elements must be safely filtered."""
    mock_data = {
        # Invalid service_states type (string instead of dict)
        "service_states": "corrupted_non_dict_string",
        # Incidents with None, non-dict, and missing-id elements
        "incidents": [
            None,
            12345,
            "not_a_dict",
            {"missing_id": True},
            {"id": "   "},
            {"id": "INC-CLEAN-001", "status": "open"},
        ],
        # Approvals with invalid elements
        "approvals": [
            None,
            {},
            {"id": "APPR-CLEAN-001", "status": "pending"},
        ],
        # Recovery jobs with invalid keys/values
        "recovery_jobs": {
            "": {"id": ""},
            "JOB-NONE": None,
            "JOB-CLEAN-001": {"id": "JOB-CLEAN-001", "status": "recovering"},
        },
        # Audit log with invalid items
        "audit_log": [
            "bad_string_event",
            {"no_id": True},
            {"id": "EVT-CLEAN-001", "event_type": "incident_created"},
        ],
    }

    with patch("app.db.load_all_state", return_value=mock_data):
        success = state.restore_state_from_db()
        assert success is True

    # service_states defaults retained because payload was invalid
    assert all(st == "healthy" for st in state.service_states.values())

    # Only clean elements restored
    assert len(state.incidents) == 1
    assert state.incidents[0]["id"] == "INC-CLEAN-001"

    assert len(state.approvals) == 1
    assert state.approvals[0]["id"] == "APPR-CLEAN-001"

    assert len(state.recovery_jobs) == 1
    assert "JOB-CLEAN-001" in state.recovery_jobs

    assert len(state.audit_log) == 1
    assert state.audit_log[0]["id"] == "EVT-CLEAN-001"


def test_restore_state_completely_invalid_payload():
    """Non-dict payload from load_all_state must return False and retain in-memory state."""
    with patch("app.db.load_all_state", return_value="invalid_payload_not_dict"):
        success = state.restore_state_from_db()
        assert success is False

    assert all(st == "healthy" for st in state.service_states.values())
    assert len(state.incidents) == 0

