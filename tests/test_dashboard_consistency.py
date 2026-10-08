"""
RecoverOps – Dashboard Data Consistency Test Suite.
Verifies that all overview cards, dependency graph data, incident states,
approvals, and audit logs are 100% consistent across failure injection,
live probing, recovery execution, and approval lifecycles.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app import state
from app.chaos import reset_chaos_state
from app.demo_store import reset_demo_store

client = TestClient(app)


@pytest.fixture(autouse=True)
def _clean_state():
    state.reset_state()
    reset_chaos_state()
    reset_demo_store()
    yield
    state.reset_state()
    reset_chaos_state()
    reset_demo_store()


def test_clean_baseline_dashboard_consistency():
    """
    Verify that in baseline state, all endpoints return coherent, non-contradictory data:
    - 0 active incidents
    - 0 pending approvals
    - All services healthy
    - Assessment reflects truthful readiness
    """
    # 1. Services
    srv_resp = client.get("/services")
    assert srv_resp.status_code == 200
    services = srv_resp.json()["services"]
    for s_name, s_status in services.items():
        assert s_status == "healthy", f"Service {s_name} should be healthy in baseline"

    # 2. Incidents
    inc_resp = client.get("/incidents")
    assert inc_resp.status_code == 200
    incidents = inc_resp.json()["incidents"]
    active_incidents = [i for i in incidents if i["status"] in ("open", "recovering", "awaiting_approval")]
    assert len(active_incidents) == 0

    # 3. Pending approvals
    appr_resp = client.get("/approvals/pending")
    assert appr_resp.status_code == 200
    approvals = appr_resp.json()["pending_approvals"]
    assert len(approvals) == 0

    # 4. Assessment for safe service
    assess_resp = client.post("/recovery/assess", json={"service": "payment_service"})
    assert assess_resp.status_code == 200
    assessment = assess_resp.json()
    assert assessment["readiness_status"] == "READY"
    assert len(assessment["required_approvals"]) == 0


def test_live_probe_failure_dashboard_consistency():
    """
    Inject live store failure, run live probe, and verify that:
    - Live probe creates incident for backend_api
    - Services reflect backend_api failed and downstream order_service degraded
    - Incidents endpoint reflects active incident
    - Recovery execution restores backend_api and resolves incident
    """
    # 1. Fail demo store
    client.post("/demo/chaos/fail", json={"reason": "Simulated DB pool exhaustion"})

    # 2. Run probe
    probe_resp = client.post("/live/probe?auto_create_incident=true")
    assert probe_resp.status_code == 200
    probe_data = probe_resp.json()
    assert not probe_data["is_healthy"]
    inc_id = probe_data["incident"]["id"]
    assert probe_data["incident"]["failed_service"] == "backend_api"

    # 3. Verify service states in dashboard endpoint
    srv_resp = client.get("/services")
    services = srv_resp.json()["services"]
    assert services["backend_api"] == "failed"
    assert services["order_service"] == "degraded"

    # 4. Verify active incident
    inc_resp = client.get("/incidents")
    incidents = inc_resp.json()["incidents"]
    active = [i for i in incidents if i["status"] in ("open", "recovering", "awaiting_approval")]
    assert len(active) == 1
    assert active[0]["id"] == inc_id

    # 5. Recover backend_api
    rec_resp = client.post(f"/recovery/start/{inc_id}")
    assert rec_resp.status_code == 200
    rec_data = rec_resp.json()
    assert rec_data["incident"]["status"] == "resolved"

    # 6. Verify dashboard reflects healthy services and resolved incident
    srv_resp2 = client.get("/services")
    assert srv_resp2.json()["services"]["backend_api"] == "healthy"
    assert srv_resp2.json()["services"]["order_service"] == "healthy"

    inc_resp2 = client.get("/incidents")
    active2 = [i for i in inc_resp2.json()["incidents"] if i["status"] in ("open", "recovering", "awaiting_approval")]
    assert len(active2) == 0


def test_high_risk_approval_dashboard_consistency():
    """
    Test database failure with high-risk approval gate:
    - Failing database pauses recovery for human sign-off
    - Pending approval is visible in /approvals/pending
    - Approving resolves incident and clears approval
    - Audit log reflects approval and recovery transitions
    """
    # 1. Fail database
    inc = state.fail_service("database")
    inc_id = inc["id"]

    # 2. Check service states
    srv_resp = client.get("/services")
    assert srv_resp.json()["services"]["database"] == "failed"

    # 3. Assess recovery
    assess_resp = client.post("/recovery/assess", json={"service": "database", "incident_id": inc_id})
    assert assess_resp.status_code == 200
    assert assess_resp.json()["risk_level"] == "HIGH"

    # 4. Start recovery -> pause for approval
    rec_resp = client.post(f"/recovery/start/{inc_id}")
    assert rec_resp.status_code == 200
    rec_data = rec_resp.json()
    assert rec_data["incident"]["status"] == "awaiting_approval"
    approval_id = rec_data["incident"]["pending_approval_id"]
    assert approval_id is not None

    # 5. Verify pending approvals endpoint
    appr_resp = client.get("/approvals/pending")
    approvals = appr_resp.json()["pending_approvals"]
    assert len(approvals) == 1
    assert approvals[0]["id"] == approval_id
    assert approvals[0]["service"] == "database"

    # 6. Approve
    dec_resp = client.post(f"/approvals/{approval_id}/approve", json={"reason": "Approved in SRE dashboard"})
    assert dec_resp.status_code == 200
    assert dec_resp.json()["approval"]["status"] == "approved"
    assert dec_resp.json()["incident"]["status"] == "resolved"

    # 7. Verify pending approvals endpoint is empty
    appr_resp2 = client.get("/approvals/pending")
    assert len(appr_resp2.json()["pending_approvals"]) == 0

    # 8. Verify service is healthy and incident resolved
    srv_resp2 = client.get("/services")
    assert srv_resp2.json()["services"]["database"] == "healthy"

    # 9. Verify audit log
    audit_resp = client.get("/audit")
    events = audit_resp.json()["audit_log"]
    event_types = [e["event_type"] for e in events]
    assert "approval_requested" in event_types
    assert "approval_approved" in event_types
    assert "recovery_completed" in event_types

