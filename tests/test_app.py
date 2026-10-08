"""
RecoverOps – Comprehensive test suite.
Covers Milestone 1 (graph, failure simulation, endpoints)
and Milestone 2 (recovery execution engine, dependency gates, playbooks,
risk classifications, approvals, audit logs, and timing).
"""

from __future__ import annotations

import concurrent.futures
import threading

import pytest
from fastapi.testclient import TestClient


from app import state
from app.graph import (
    DEPENDENCIES,
    SERVICES,
    build_graph,
    detect_cycles,
    get_downstream_dependents,
    get_prerequisites,
    recovery_order,
)
from app.main import app
from app.state import reset_state


@pytest.fixture(autouse=True)
def _clean_state():
    """Reset in-memory state before every test."""
    reset_state()
    yield
    reset_state()


client = TestClient(app)


# ===========================================================================
# Milestone 1: Dependency Graph Unit Tests
# ===========================================================================

class TestGraph:
    def test_graph_has_all_services(self):
        g = build_graph()
        assert set(g.nodes) == set(SERVICES)

    def test_graph_has_all_edges(self):
        g = build_graph()
        for u, v in DEPENDENCIES:
            assert g.has_edge(u, v), f"Missing edge {u} → {v}"

    def test_graph_is_acyclic(self):
        g = build_graph()
        assert detect_cycles(g) == []

    def test_downstream_of_database(self):
        g = build_graph()
        deps = set(get_downstream_dependents(g, "database"))
        assert deps == {"backend_api", "order_service", "payment_service", "website"}

    def test_downstream_of_website_is_empty(self):
        g = build_graph()
        assert get_downstream_dependents(g, "website") == []

    def test_prerequisites_of_services(self):
        g = build_graph()
        assert get_prerequisites(g, "database") == []
        assert get_prerequisites(g, "backend_api") == ["database"]
        assert set(get_prerequisites(g, "website")) == {"order_service", "payment_service"}

    def test_recovery_order_respects_dependencies(self):
        g = build_graph()
        order = recovery_order(g, "database")
        idx = {s: i for i, s in enumerate(order)}
        assert idx["database"] < idx["backend_api"]
        assert idx["backend_api"] < idx["order_service"]
        assert idx["backend_api"] < idx["payment_service"]
        assert idx["order_service"] < idx["website"]
        assert idx["payment_service"] < idx["website"]

    def test_recovery_order_single_leaf(self):
        g = build_graph()
        order = recovery_order(g, "website")
        assert order == ["website"]

    def test_cycle_detection(self):
        g = build_graph()
        g.add_edge("website", "database")
        cycles = detect_cycles(g)
        assert len(cycles) > 0


# ===========================================================================
# Milestone 1: Basic API Endpoints
# ===========================================================================

class TestMilestone1API:
    def test_health(self):
        r = client.get("/")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

    def test_list_services(self):
        r = client.get("/services")
        assert r.status_code == 200
        services = r.json()["services"]
        assert all(v == "healthy" for v in services.values())

    def test_list_dependencies(self):
        r = client.get("/dependencies")
        assert r.status_code == 200
        data = r.json()
        assert set(data["nodes"]) == set(SERVICES)
        assert len(data["edges"]) == len(DEPENDENCIES)

    def test_simulate_failure(self):
        r = client.post("/simulate/fail/database")
        assert r.status_code == 200
        incident = r.json()["incident"]
        assert incident["failed_service"] == "database"
        assert "backend_api" in incident["affected_services"]

        r2 = client.get("/services")
        states = r2.json()["services"]
        assert states["database"] == "failed"
        assert states["backend_api"] == "degraded"

    def test_simulate_failure_unknown_service(self):
        r = client.post("/simulate/fail/nonexistent")
        assert r.status_code == 404

    def test_incidents_recorded(self):
        client.post("/simulate/fail/backend_api")
        r = client.get("/incidents")
        assert r.status_code == 200
        incidents = r.json()["incidents"]
        assert len(incidents) == 1
        assert incidents[0]["failed_service"] == "backend_api"

    def test_recovery_plan(self):
        r = client.get("/recovery/plan/backend_api")
        assert r.status_code == 200
        order = r.json()["recovery_order"]
        assert order[0] == "backend_api"
        assert "website" in order
        assert "order_service" in order
        assert "payment_service" in order

    def test_recovery_plan_unknown_service(self):
        r = client.get("/recovery/plan/nonexistent")
        assert r.status_code == 404

    def test_recovery_plan_leaf_service(self):
        r = client.get("/recovery/plan/website")
        assert r.status_code == 200
        assert r.json()["recovery_order"] == ["website"]


# ===========================================================================
# Milestone 2: Recovery Execution, Dependency Gates, Approvals, and Audits
# ===========================================================================

class TestMilestone2RecoveryEngine:
    def test_safe_service_recovery_automatic_success(self):
        """Website failure is safe; it should recover automatically without approval."""
        r_fail = client.post("/simulate/fail/website")
        assert r_fail.status_code == 200
        incident_id = r_fail.json()["incident"]["id"]

        r_rec = client.post(f"/recovery/start/{incident_id}")
        assert r_rec.status_code == 200
        incident = r_rec.json()["incident"]
        assert incident["status"] == "resolved"
        assert incident["recovery_started_at"] is not None
        assert incident["recovery_completed_at"] is not None
        assert incident["total_recovery_duration_seconds"] is not None
        assert incident["total_recovery_duration_seconds"] >= 0

        # Verify website is healthy again
        r_srv = client.get("/services")
        assert r_srv.json()["services"]["website"] == "healthy"

    def test_high_risk_requires_approval_and_resumes(self):
        """Database restore is high_risk. Recovery must pause until explicit approval."""
        r_fail = client.post("/simulate/fail/database")
        incident_id = r_fail.json()["incident"]["id"]

        # 1. Start recovery -> should pause at database step awaiting approval
        r_start = client.post(f"/recovery/start/{incident_id}")
        assert r_start.status_code == 200
        incident = r_start.json()["incident"]
        assert incident["status"] == "awaiting_approval"
        approval_id = incident["pending_approval_id"]
        assert approval_id is not None

        # 2. Check pending approvals list
        r_pend = client.get("/approvals/pending")
        assert r_pend.status_code == 200
        pending = r_pend.json()["pending_approvals"]
        assert len(pending) == 1
        assert pending[0]["id"] == approval_id
        assert pending[0]["service"] == "database"
        assert pending[0]["risk_level"] == "high_risk"

        # 3. Approve the action
        r_apprv = client.post(
            f"/approvals/{approval_id}/approve",
            json={"reason": "Operator verified snapshot readiness"},
        )
        assert r_apprv.status_code == 200
        res = r_apprv.json()
        assert res["approval"]["status"] == "approved"
        assert res["incident"]["status"] == "resolved"

        # 4. Verify all affected services recovered to healthy in dependency order
        r_srv = client.get("/services")
        services = r_srv.json()["services"]
        for s in SERVICES:
            assert services[s] == "healthy"

    def test_approval_rejection_halts_recovery(self):
        """Rejecting an approval aborts recovery and keeps services non-healthy."""
        r_fail = client.post("/simulate/fail/database")
        incident_id = r_fail.json()["incident"]["id"]

        r_start = client.post(f"/recovery/start/{incident_id}")
        approval_id = r_start.json()["incident"]["pending_approval_id"]

        r_rej = client.post(
            f"/approvals/{approval_id}/reject",
            json={"reason": "Corrupted snapshot, cannot restore"},
        )
        assert r_rej.status_code == 200
        res = r_rej.json()
        assert res["approval"]["status"] == "rejected"
        assert res["incident"]["status"] == "aborted"

        # Services must remain failed/degraded
        r_srv = client.get("/services")
        states = r_srv.json()["services"]
        assert states["database"] == "failed"
        assert states["backend_api"] == "degraded"

    def test_dependency_gate_blocks_recovery_when_prereq_unhealthy(self):
        """If a prerequisite is not healthy, dependent service recovery must halt with a recorded reason."""
        # Fail backend_api (which cascades to order_service, payment_service, website)
        r_fail = client.post("/simulate/fail/backend_api")
        incident_id = r_fail.json()["incident"]["id"]

        # Break prerequisite: simulate failure on backend_api recovery action
        client.post(
            "/simulate/configure",
            json={
                "service": "backend_api",
                "action_success": False,
                "action_error": "Connection refused to database pool",
            },
        )

        r_start = client.post(f"/recovery/start/{incident_id}")
        incident = r_start.json()["incident"]
        assert incident["status"] == "failed"

        # Now try to recover website in a separate incident while backend_api is still failed
        # Manually create another incident on website
        r_fail_web = client.post("/simulate/fail/website")
        web_incident_id = r_fail_web.json()["incident"]["id"]

        # Make order_service unhealthy too
        state.service_states["order_service"] = "failed"

        r_web_rec = client.post(f"/recovery/start/{web_incident_id}")
        web_inc = r_web_rec.json()["incident"]
        assert web_inc["status"] == "failed"
        assert any(
            "Dependency gate failed" in step.get("reason", "")
            for step in web_inc["recovery_steps"]
        )

    def test_simulated_health_check_failure(self):
        """Simulated health check failure fails the step and terminates recovery."""
        r_fail = client.post("/simulate/fail/website")
        incident_id = r_fail.json()["incident"]["id"]

        # Configure health check failure for website
        client.post(
            "/simulate/configure",
            json={
                "service": "website",
                "action_success": True,
                "health_check_success": False,
                "health_check_error": "HTTP 503 Service Unavailable on synthetic probe",
            },
        )

        r_start = client.post(f"/recovery/start/{incident_id}")
        incident = r_start.json()["incident"]
        assert incident["status"] == "failed"
        assert state.service_states["website"] == "failed"

        # Check audit event for health check failure
        r_audit = client.get(f"/audit?incident_id={incident_id}")
        events = r_audit.json()["audit_log"]
        health_events = [e for e in events if e["event_type"] == "health_check"]
        assert len(health_events) > 0
        assert health_events[0]["details"]["passed"] is False

    def test_duplicate_recovery_prevented(self):
        """Cannot start recovery if already in progress, awaiting approval, or resolved."""
        r_fail = client.post("/simulate/fail/database")
        incident_id = r_fail.json()["incident"]["id"]

        # 1. Start -> becomes awaiting_approval
        client.post(f"/recovery/start/{incident_id}")

        # 2. Attempt duplicate start while awaiting approval -> 409
        r_dup = client.post(f"/recovery/start/{incident_id}")
        assert r_dup.status_code == 409

        # 3. Approve to resolve it
        apprv_id = client.get("/approvals/pending").json()["pending_approvals"][0]["id"]
        client.post(f"/approvals/{apprv_id}/approve")

        # 4. Attempt start on resolved incident -> 400
        r_res = client.post(f"/recovery/start/{incident_id}")
        assert r_res.status_code == 400

    def test_unknown_incident_and_approval_404(self):
        r1 = client.post("/recovery/start/nonexistent-uuid")
        assert r1.status_code == 404

        r2 = client.get("/incidents/nonexistent-uuid")
        assert r2.status_code == 404

        r3 = client.post("/approvals/nonexistent-uuid/approve")
        assert r3.status_code == 404

        r4 = client.post("/approvals/nonexistent-uuid/reject")
        assert r4.status_code == 404

    def test_reprocessing_decided_approval_returns_400(self):
        r_fail = client.post("/simulate/fail/database")
        incident_id = r_fail.json()["incident"]["id"]
        client.post(f"/recovery/start/{incident_id}")

        apprv_id = client.get("/approvals/pending").json()["pending_approvals"][0]["id"]
        client.post(f"/approvals/{apprv_id}/approve")

        # Try to approve again
        r_again = client.post(f"/approvals/{apprv_id}/approve")
        assert r_again.status_code == 400

    def test_audit_trail_completeness(self):
        """Verify audit trail contains all required events across the lifecycle."""
        r_fail = client.post("/simulate/fail/database")
        incident_id = r_fail.json()["incident"]["id"]

        client.post(f"/recovery/start/{incident_id}")
        apprv_id = client.get("/approvals/pending").json()["pending_approvals"][0]["id"]
        client.post(f"/approvals/{apprv_id}/approve")

        r_audit = client.get(f"/audit?incident_id={incident_id}")
        events = r_audit.json()["audit_log"]
        event_types = [e["event_type"] for e in events]

        assert "incident_created" in event_types
        assert "recovery_started" in event_types
        assert "approval_requested" in event_types
        assert "approval_approved" in event_types
        assert "recovery_action_executed" in event_types
        assert "health_check" in event_types
        assert "recovery_completed" in event_types

    def test_timing_tracking(self):
        """Ensure incident and recovery timing metadata is recorded."""
        r_fail = client.post("/simulate/fail/website")
        incident_id = r_fail.json()["incident"]["id"]

        r_start = client.post(f"/recovery/start/{incident_id}")
        inc = r_start.json()["incident"]

        assert inc["created_at"] is not None
        assert inc["recovery_started_at"] is not None
        assert inc["recovery_completed_at"] is not None
        assert isinstance(inc["total_recovery_duration_seconds"], (int, float))

    def test_action_unhandled_exception_marks_service_and_incident_failed(self, monkeypatch):
        """If an action raises an unhandled exception, service must be marked failed and not stuck in recovering."""
        r_fail = client.post("/simulate/fail/website")
        incident_id = r_fail.json()["incident"]["id"]

        def mock_execute_action(service, playbook):
            raise RuntimeError("Unexpected simulated crash in action execution")

        from app import playbooks
        monkeypatch.setattr(playbooks, "execute_simulated_action", mock_execute_action)

        r_rec = client.post(f"/recovery/start/{incident_id}")
        assert r_rec.status_code == 200
        inc = r_rec.json()["incident"]
        assert inc["status"] == "failed"
        assert inc["recovery_completed_at"] is not None
        assert isinstance(inc["total_recovery_duration_seconds"], (int, float))

        # Crucial invariant: Service state must NOT remain 'recovering'
        r_srv = client.get("/services")
        assert r_srv.json()["services"]["website"] == "failed"

    def test_health_check_unhandled_exception_marks_service_and_incident_failed(self, monkeypatch):
        """If a health check probe raises an unhandled exception, service must be marked failed."""
        r_fail = client.post("/simulate/fail/website")
        incident_id = r_fail.json()["incident"]["id"]

        def mock_health_check(service, playbook):
            raise ConnectionResetError("Synthetic probe socket reset")

        from app import playbooks
        monkeypatch.setattr(playbooks, "run_simulated_health_check", mock_health_check)

        r_rec = client.post(f"/recovery/start/{incident_id}")
        assert r_rec.status_code == 200
        inc = r_rec.json()["incident"]
        assert inc["status"] == "failed"
        assert state.service_states["website"] == "failed"

    def test_approval_decision_on_non_awaiting_incident_rejected(self):
        """Cannot approve an action if the parent incident is not in awaiting_approval state."""
        r_fail = client.post("/simulate/fail/database")
        incident_id = r_fail.json()["incident"]["id"]
        client.post(f"/recovery/start/{incident_id}")

        apprv_id = client.get("/approvals/pending").json()["pending_approvals"][0]["id"]

        # Manually alter incident status to something other than awaiting_approval
        target_incident = state.get_incident(incident_id)
        assert target_incident is not None
        target_incident["status"] = "aborted"

        r_apprv = client.post(f"/approvals/{apprv_id}/approve")
        assert r_apprv.status_code == 400
        assert "not awaiting approval" in r_apprv.json()["detail"]

    def test_retry_failed_incident_resets_steps_and_recovers_cleanly(self):
        """A failed incident can be retried and will reset execution pointers for a clean recovery."""
        r_fail = client.post("/simulate/fail/website")
        incident_id = r_fail.json()["incident"]["id"]

        # Fail first attempt
        client.post(
            "/simulate/configure",
            json={
                "service": "website",
                "action_success": False,
                "action_error": "Temporary network timeout",
            },
        )
        r_first = client.post(f"/recovery/start/{incident_id}")
        assert r_first.json()["incident"]["status"] == "failed"
        assert state.service_states["website"] == "failed"

        # Fix condition and retry recovery on same incident
        client.post(
            "/simulate/configure",
            json={
                "service": "website",
                "action_success": True,
            },
        )
        r_retry = client.post(f"/recovery/start/{incident_id}")
        assert r_retry.status_code == 200
        retry_inc = r_retry.json()["incident"]
        assert retry_inc["status"] == "resolved"
        assert state.service_states["website"] == "healthy"

    def test_concurrent_recovery_start_deterministic(self, monkeypatch):
        """Verify that concurrent recovery-start requests are serialized:
        one receives 200 and the concurrent in-flight request receives 409 Conflict.
        """
        r_fail = client.post("/simulate/fail/website")
        incident_id = r_fail.json()["incident"]["id"]

        from app import playbooks
        action_started = threading.Event()
        release_action = threading.Event()

        original_execute_action = playbooks.execute_simulated_action

        def mock_execute_action(service, playbook):
            action_started.set()
            release_action.wait(timeout=5.0)
            return original_execute_action(service, playbook)

        monkeypatch.setattr(playbooks, "execute_simulated_action", mock_execute_action)

        try:
            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
                fut1 = executor.submit(client.post, f"/recovery/start/{incident_id}")
                assert action_started.wait(timeout=5.0), "Thread 1 did not reach action execution"

                fut2 = executor.submit(client.post, f"/recovery/start/{incident_id}")
                res2 = fut2.result(timeout=5.0)

                release_action.set()
                res1 = fut1.result(timeout=5.0)

            assert res1.status_code == 200
            assert res1.json()["incident"]["status"] == "resolved"
            assert res2.status_code == 409
            assert "already in progress" in res2.json()["detail"]
        finally:
            release_action.set()

    def test_setup_exception_finalizes_incident_as_failed(self, monkeypatch):
        """Unexpected exception during recovery setup finalizes incident as failed with audit trail."""
        r_fail = client.post("/simulate/fail/website")
        incident_id = r_fail.json()["incident"]["id"]

        from app import graph
        def mock_recovery_order(graph, service):
            raise ValueError("Corrupted DAG topology encountered during setup")

        monkeypatch.setattr(graph, "recovery_order", mock_recovery_order)

        r_rec = client.post(f"/recovery/start/{incident_id}")
        assert r_rec.status_code == 200
        inc = r_rec.json()["incident"]
        assert inc["status"] == "failed"
        assert inc["recovery_completed_at"] is not None
        assert isinstance(inc["total_recovery_duration_seconds"], (int, float))

        # Check audit event
        r_audit = client.get(f"/audit?incident_id={incident_id}")
        events = r_audit.json()["audit_log"]
        failed_events = [e for e in events if e["event_type"] == "recovery_failed"]
        assert len(failed_events) > 0
        assert "Recovery setup exception" in failed_events[0]["details"]["reason"]

    def test_approval_decision_mismatched_pending_approval_id_rejected(self):
        """Cannot process an approval that does not match the incident's active pending_approval_id."""
        r_fail = client.post("/simulate/fail/database")
        incident_id = r_fail.json()["incident"]["id"]
        client.post(f"/recovery/start/{incident_id}")

        apprv_id = client.get("/approvals/pending").json()["pending_approvals"][0]["id"]

        # Manually alter incident's pending_approval_id to a different ID
        target_incident = state.get_incident(incident_id)
        assert target_incident is not None
        target_incident["pending_approval_id"] = "mismatched-approval-uuid"

        r_apprv = client.post(f"/approvals/{apprv_id}/approve")
        assert r_apprv.status_code == 400
        assert "not the active pending approval" in r_apprv.json()["detail"]
