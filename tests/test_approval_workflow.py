"""
BRIDGE – Comprehensive Approval Center End-to-End Test Suite.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app import state
from app.chaos import reset_chaos_state

client = TestClient(app)


class TestApprovalCenterEndToEnd:
    def setup_method(self):
        state.reset_state()
        reset_chaos_state()

    def teardown_method(self):
        state.reset_state()
        reset_chaos_state()

    def test_database_recovery_pauses_at_high_risk_and_creates_pending_approval(self):
        """Verify that starting recovery on a database outage pauses and creates a genuine pending approval."""
        inc = state.fail_service("database")
        inc_id = inc["id"]

        # Start recovery
        rec_res = client.post(f"/recovery/start/{inc_id}")
        assert rec_res.status_code == 200
        rec_data = rec_res.json()
        assert rec_data["incident"]["status"] == "awaiting_approval"
        approval_id = rec_data["incident"]["pending_approval_id"]
        assert approval_id is not None

        # Verify /approvals/pending returns this exact approval
        pend_res = client.get("/approvals/pending")
        assert pend_res.status_code == 200
        pend_list = pend_res.json()["pending_approvals"]
        assert len(pend_list) == 1
        apprv = pend_list[0]
        assert apprv["id"] == approval_id
        assert apprv["service"] == "database"
        assert apprv["action"] == "restore_backup_and_restart"
        assert apprv["risk_level"] == "high_risk"
        assert apprv["status"] == "pending"

    def test_approve_action_resumes_and_resolves_recovery(self):
        """Verify that approving a pending database recovery resumes execution and resolves the incident upon health verification."""
        inc = state.fail_service("database")
        inc_id = inc["id"]

        # Start recovery to hit approval pause
        rec_res = client.post(f"/recovery/start/{inc_id}").json()
        approval_id = rec_res["incident"]["pending_approval_id"]

        # Approve
        apprv_res = client.post(
            f"/approvals/{approval_id}/approve",
            json={"reason": "Approved by lead SRE in Approval Center"},
        )
        assert apprv_res.status_code == 200
        apprv_data = apprv_res.json()
        assert apprv_data["approval"]["status"] == "approved"
        assert apprv_data["approval"]["decision_reason"] == "Approved by lead SRE in Approval Center"
        assert apprv_data["incident"]["status"] == "resolved"
        assert state.service_states["database"] == "healthy"

        # Pending approvals list is now empty
        pend_list = client.get("/approvals/pending").json()["pending_approvals"]
        assert len(pend_list) == 0

        # Audit log contains approval_granted and action execution events
        event_types = [e["event_type"] for e in state.audit_log if e.get("incident_id") == inc_id]
        assert "approval_requested" in event_types
        assert "approval_approved" in event_types
        assert "health_check" in event_types
        assert "recovery_completed" in event_types

    def test_reject_action_aborts_recovery_and_prevents_execution(self):
        """Verify that rejecting a pending approval aborts recovery, marks incident aborted, and does not execute the action."""
        inc = state.fail_service("database")
        inc_id = inc["id"]

        # Start recovery to hit approval pause
        rec_res = client.post(f"/recovery/start/{inc_id}").json()
        approval_id = rec_res["incident"]["pending_approval_id"]

        # Reject
        rej_res = client.post(
            f"/approvals/{approval_id}/reject",
            json={"reason": "Blocked due to active customer maintenance window"},
        )
        assert rej_res.status_code == 200
        rej_data = rej_res.json()
        assert rej_data["approval"]["status"] == "rejected"
        assert rej_data["incident"]["status"] == "aborted"
        # Service remains failed
        assert state.service_states["database"] == "failed"

        # Pending list is now empty
        pend_list = client.get("/approvals/pending").json()["pending_approvals"]
        assert len(pend_list) == 0

        # Audit log records approval_rejected and recovery_aborted
        event_types = [e["event_type"] for e in state.audit_log if e.get("incident_id") == inc_id]
        assert "approval_rejected" in event_types
        assert "recovery_aborted" in event_types

    def test_unknown_approval_id_returns_404(self):
        """Verify that attempting to approve or reject an unknown ID (like old mock-1) returns HTTP 404."""
        apprv_res = client.post("/approvals/mock-1/approve")
        assert apprv_res.status_code == 404
        assert "not found" in apprv_res.text.lower()

        rej_res = client.post("/approvals/mock-1/reject")
        assert rej_res.status_code == 404
        assert "not found" in rej_res.text.lower()

    def test_duplicate_decision_on_decided_approval_returns_400(self):
        """Verify that once an approval is approved or rejected, subsequent decisions on the same approval return HTTP 400."""
        inc = state.fail_service("database")
        inc_id = inc["id"]
        rec_res = client.post(f"/recovery/start/{inc_id}").json()
        approval_id = rec_res["incident"]["pending_approval_id"]

        # First approval succeeds
        res1 = client.post(f"/approvals/{approval_id}/approve")
        assert res1.status_code == 200

        # Second approval on same ID is rejected with 400
        res2 = client.post(f"/approvals/{approval_id}/approve")
        assert res2.status_code == 400
        assert "already approved" in res2.text.lower()

        # Reject on already approved is also 400
        res3 = client.post(f"/approvals/{approval_id}/reject")
        assert res3.status_code == 400
        assert "already approved" in res3.text.lower()
