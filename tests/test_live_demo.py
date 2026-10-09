"""
BRIDGE – Tests for Live Demo Store, Real HTTP Health Probes,
and Restricted Allowlisted Recovery Adapter.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app import demo_store, live_adapter, state
from app.main import app
from app.state import reset_state

client = TestClient(app)


@pytest.fixture(autouse=True)
def _clean_state():
    """Reset in-memory state and demo store before each test."""
    reset_state()
    demo_store.reset_demo_store()
    yield
    reset_state()
    demo_store.reset_demo_store()


class TestLiveDemoStore:
    def test_demo_store_healthy_initially(self):
        """Demo store initially returns HTTP 200 and complete product list."""
        r_health = client.get("/demo/health")
        assert r_health.status_code == 200
        assert r_health.json()["status"] == "healthy"
        assert r_health.json()["database_connected"] is True

        r_prods = client.get("/demo/products")
        assert r_prods.status_code == 200
        assert r_prods.json()["status"] == "ok"
        assert len(r_prods.json()["products"]) >= 40

    def test_demo_store_genuine_http_503_on_chaos_fail(self):
        """Injecting chaos causes real HTTP 503 on both health and products endpoints."""
        r_fail = client.post("/demo/chaos/fail", json={"reason": "Connection pool timeout"})
        assert r_fail.status_code == 200

        # Health endpoint must genuinely return 503
        r_health = client.get("/demo/health")
        assert r_health.status_code == 503
        data_h = r_health.json()
        assert data_h["status"] == "unhealthy"
        assert "Connection pool timeout" in data_h["error"]

        # Products endpoint must genuinely return 503
        r_prods = client.get("/demo/products")
        assert r_prods.status_code == 503
        data_p = r_prods.json()
        assert data_p["detail"]["error"] == "Products API unavailable"

    def test_live_probe_detects_failure_and_creates_incident(self):
        """Live HTTP probe detects 503 failure and automatically records incident in BRIDGE."""
        client.post("/demo/chaos/fail", json={"reason": "Simulated pool exhaustion"})

        r_probe = client.post("/live/probe?auto_create_incident=true")
        assert r_probe.status_code == 200
        data = r_probe.json()

        assert data["is_healthy"] is False
        assert data["health_probe"]["status_code"] == 503
        assert data["incident"] is not None
        incident_id = data["incident"]["id"]
        assert data["incident"]["failed_service"] == "backend_api"

        # Check that backend_api is marked failed in BRIDGE state
        r_srv = client.get("/services")
        assert r_srv.json()["services"]["backend_api"] == "failed"
        assert r_srv.json()["services"]["order_service"] == "degraded"

        # Check audit event for live probe diagnostics
        r_audit = client.get(f"/audit?incident_id={incident_id}")
        events = r_audit.json()["audit_log"]
        probe_events = [e for e in events if e["event_type"] == "live_http_probe_failure"]
        assert len(probe_events) > 0
        assert probe_events[0]["details"]["observed_http_status"] == 503

    def test_allowlisted_recovery_restores_live_service_and_verifies_200(self):
        """BRIDGE runs allowlisted recovery, restores demo Products API, and verifies HTTP 200."""
        # 1. Trip the live demo store
        client.post("/demo/chaos/fail")
        probe = client.post("/live/probe?auto_create_incident=true").json()
        incident_id = probe["incident"]["id"]

        # Verify live store is currently down
        assert client.get("/demo/health").status_code == 503

        # 2. Execute BRIDGE recovery sequence
        r_rec = client.post(f"/recovery/start/{incident_id}")
        assert r_rec.status_code == 200
        inc = r_rec.json()["incident"]
        assert inc["status"] == "resolved"

        # 3. Verify live endpoints now return HTTP 200
        r_health = client.get("/demo/health")
        assert r_health.status_code == 200
        assert r_health.json()["status"] == "healthy"

        r_prods = client.get("/demo/products")
        assert r_prods.status_code == 200
        assert len(r_prods.json()["products"]) >= 40

    def test_allowlisted_recovery_fails_if_live_verification_fails(self):
        """If live verification returns 503 after recovery action, recovery terminates as failed."""
        client.post("/demo/chaos/fail")
        probe = client.post("/live/probe?auto_create_incident=true").json()
        incident_id = probe["incident"]["id"]

        # Override live verification to simulate an action that succeeded but health probe still failed
        client.post(
            "/simulate/configure",
            json={
                "service": "backend_api",
                "action_success": True,
                "health_check_success": False,
                "health_check_error": "Live HTTP verification returned HTTP 503",
            },
        )

        r_rec = client.post(f"/recovery/start/{incident_id}")
        assert r_rec.status_code == 200
        inc = r_rec.json()["incident"]
        assert inc["status"] == "failed"

        # Verify audit logs failed health check
        r_audit = client.get(f"/audit?incident_id={incident_id}")
        events = r_audit.json()["audit_log"]
        assert any(e["event_type"] == "recovery_failed" for e in events)

    def test_unauthorized_recovery_action_or_target_rejected(self):
        """Allowlisted adapter strictly rejects unauthorized actions and targets."""
        res_action = live_adapter.execute_allowlisted_action("backend_api", "arbitrary_unauthorized_command; rm -rf /")
        assert res_action["success"] is False
        assert "Unauthorized recovery action" in res_action["error"]

        res_target = live_adapter.execute_allowlisted_action("unauthorized_host_service", "restart_service")
        assert res_target["success"] is False
        assert "Unauthorized target service" in res_target["error"]

    def test_blocked_prerequisite_prevents_live_recovery(self):
        """If upstream database is unhealthy, backend_api recovery halts before live restart."""
        # Fail database first
        r_db_fail = client.post("/simulate/fail/database")
        db_inc_id = r_db_fail.json()["incident"]["id"]

        # Break Products API
        client.post("/demo/chaos/fail")

        # Attempt to recover backend_api via an incident while database is failed
        r_api_fail = client.post("/simulate/fail/backend_api")
        api_inc_id = r_api_fail.json()["incident"]["id"]

        r_rec = client.post(f"/recovery/start/{api_inc_id}")
        inc = r_rec.json()["incident"]
        assert inc["status"] == "failed"
        assert any("Dependency gate failed" in step.get("reason", "") for step in inc["recovery_steps"])

