"""
RecoverOps – Adversarial Test Suite for Safety, Truthfulness, Concurrency, and State Consistency.
"""

import threading
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app import demo_store, state, live_adapter, graph, playbooks
from app.state import reset_state

client = TestClient(app)


@pytest.fixture(autouse=True)
def _clean_state():
    reset_state()
    demo_store.reset_demo_store()
    yield
    reset_state()
    demo_store.reset_demo_store()


class TestAdversarialRisks:
    # 1. Recovery Truthfulness
    def test_recovery_never_resolves_when_health_verification_fails(self):
        """If health verification fails, recovery MUST NOT be marked resolved or service healthy."""
        client.post("/demo/chaos/fail")
        probe = client.post("/live/probe?auto_create_incident=true").json()
        inc_id = probe["incident"]["id"]

        # Configure simulated health check failure
        client.post(
            "/simulate/configure",
            json={
                "service": "backend_api",
                "health_check_success": False,
                "health_check_error": "Fatal probe failure: HTTP 503",
            },
        )

        res = client.post(f"/recovery/start/{inc_id}")
        assert res.status_code == 200
        incident = res.json()["incident"]

        # MUST be marked failed, NOT resolved
        assert incident["status"] == "failed"
        assert state.service_states["backend_api"] == "failed"

        # Check audit log does NOT contain recovery_completed
        audit = client.get(f"/audit?incident_id={inc_id}").json()["audit_log"]
        event_types = [e["event_type"] for e in audit]
        assert "recovery_failed" in event_types
        assert "recovery_completed" not in event_types

    # 2. Target Correctness
    def test_live_verification_rejects_non_live_targets(self):
        """verify_live_service_health only validates designated services and fails for others."""
        res_db = live_adapter.verify_live_service_health("database")
        assert res_db["passed"] is False
        assert "no configured live HTTP verification probe" in res_db["message"]

        res_unknown = live_adapter.verify_live_service_health("unknown_service")
        assert res_unknown["passed"] is False

    # 3. State Consistency on Exceptions
    def test_unhandled_action_exception_maintains_consistent_state(self):
        """Unhandled exception during action sets service failed, incident failed, and emits audit event."""
        res_fail = client.post("/simulate/fail/backend_api")
        inc_id = res_fail.json()["incident"]["id"]

        # Monkeypatch execute_simulated_action to raise runtime exception
        def _exploding_action(*args, **kwargs):
            raise RuntimeError("Database socket dropped unexpectedly")

        orig = playbooks.execute_simulated_action
        playbooks.execute_simulated_action = _exploding_action
        try:
            res_rec = client.post(f"/recovery/start/{inc_id}")
            assert res_rec.status_code == 200
            inc = res_rec.json()["incident"]
            assert inc["status"] == "failed"
            assert state.service_states["backend_api"] == "failed"

            audit = client.get(f"/audit?incident_id={inc_id}").json()["audit_log"]
            assert any(e["event_type"] == "recovery_failed" for e in audit)
        finally:
            playbooks.execute_simulated_action = orig

    # 4. Stale Assessments Fingerprint Check
    def test_stale_fingerprint_flagged_upon_state_change(self):
        """If dependency state shifts after assessment, stale fingerprint is detected."""
        client.post("/simulate/fail/backend_api")
        inc_id = client.get("/incidents").json()["incidents"][0]["id"]

        # Initial assessment
        res_assess_1 = client.post("/recovery/assess", json={"incident_id": inc_id})
        fp_1 = res_assess_1.json()["state_fingerprint"]
        assert res_assess_1.json()["readiness_status"] == "READY"

        # Now trip database
        client.post("/simulate/fail/database")

        # Second assessment passing the old fingerprint
        res_assess_2 = client.post(
            "/recovery/assess",
            json={"incident_id": inc_id, "expected_state_fingerprint": fp_1},
        )
        data_2 = res_assess_2.json()
        assert data_2["readiness_status"] == "BLOCKED"
        assert any(f["code"] == "STALE_ASSESSMENT" for f in data_2["findings"])

    # 5. Concurrency Race Conditions
    def test_concurrent_recovery_requests_strictly_prevent_duplicates(self):
        """Concurrent requests on the same incident only allow 1 winner; all others receive 409."""
        client.post("/simulate/fail/backend_api")
        inc_id = client.get("/incidents").json()["incidents"][0]["id"]

        results = []
        errors = []

        def _worker():
            try:
                r = client.post(f"/recovery/start/{inc_id}")
                if r.status_code == 200:
                    results.append(r.json())
                else:
                    errors.append(r.status_code)
            except Exception as e:
                errors.append(str(e))

        threads = [threading.Thread(target=_worker) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        # Exactly one thread successfully initiates recovery
        assert len(results) == 1
        # All 9 concurrent attempts are blocked with 409 Conflict (or 400 if already resolved)
        assert len(errors) == 9
        assert all(code in (400, 409) for code in errors)

    # 6. Approval Safety
    def test_database_approval_safety_lifecycle(self):
        """Database recovery strictly halts, rejects invalid IDs, and cannot resume without approval."""
        client.post("/simulate/fail/database")
        inc_id = client.get("/incidents").json()["incidents"][0]["id"]

        # Start recovery -> must halt
        r_start = client.post(f"/recovery/start/{inc_id}")
        assert r_start.status_code == 200
        assert r_start.json()["incident"]["status"] == "awaiting_approval"

        # Duplicate recovery attempt while awaiting approval returns 409
        r_dup = client.post(f"/recovery/start/{inc_id}")
        assert r_dup.status_code == 409
        assert "awaiting approval" in r_dup.json()["detail"]

        # Rejecting with wrong approval ID returns 404
        r_bad_appr = client.post("/approvals/bad-id-123/reject")
        assert r_bad_appr.status_code == 404

        # Proper approval resume
        pending = client.get("/approvals/pending").json()["pending_approvals"]
        assert len(pending) == 1
        appr_id = pending[0]["id"]

        r_approve = client.post(f"/approvals/{appr_id}/approve", json={"reason": "Approved"})
        assert r_approve.status_code == 200
        assert r_approve.json()["incident"]["status"] == "resolved"

        # Second approval attempt on already decided approval returns 400
        r_repeat = client.post(f"/approvals/{appr_id}/approve")
        assert r_repeat.status_code == 400

    # 7. Failure Injection on Allowlisted Adapters
    def test_allowlisted_adapter_rejects_unauthorized_commands(self):
        """Allowlisted adapter strictly rejects shell injection and arbitrary actions."""
        res_inj1 = live_adapter.execute_allowlisted_action("backend_api", "rm -rf /; sudo reboot")
        assert res_inj1["success"] is False
        assert "Unauthorized recovery action" in res_inj1["error"]

        res_inj2 = live_adapter.execute_allowlisted_action("unregistered_service", "restart_service")
        assert res_inj2["success"] is False
        assert "Unauthorized target service" in res_inj2["error"]

    # 8. Audit Integrity
    def test_audit_log_chronology_and_event_completeness(self):
        """Audit events record complete execution metadata with timestamps and proper order."""
        client.post("/demo/chaos/fail")
        probe = client.post("/live/probe?auto_create_incident=true").json()
        inc_id = probe["incident"]["id"]

        client.post(f"/recovery/start/{inc_id}")

        audit = client.get(f"/audit?incident_id={inc_id}").json()["audit_log"]
        event_types = [e["event_type"] for e in audit]

        # Verify exact sequence
        assert "incident_created" in event_types
        assert "live_http_probe_failure" in event_types
        assert "recovery_started" in event_types
        assert "dependency_check_passed" in event_types
        assert "recovery_action_executed" in event_types
        assert "health_check" in event_types
        assert "recovery_completed" in event_types
        assert event_types[-1] == "recovery_completed"

