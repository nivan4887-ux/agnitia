"""
BRIDGE – Multi-Scenario Chaos Engine Test Suite.
Tests all 8 Scenarios (A through H), unknown scenario rejection, inventory failure,
checkout failure, payment degradation, recovery verification failure, and reset.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app import demo_store, chaos, state
from app.state import reset_state

client = TestClient(app)


@pytest.fixture(autouse=True)
def _clean_state():
    reset_state()
    chaos.reset_chaos_state()
    yield
    reset_state()
    chaos.reset_chaos_state()


class TestMultiScenarioChaos:
    def test_list_all_scenarios(self):
        """All 8 registered scenarios are returned with complete metadata."""
        res = client.get("/demo/scenarios")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "ok"
        scenarios = data["scenarios"]
        assert len(scenarios) == 9

        scenario_ids = [s["id"] for s in scenarios]
        assert "scenario_a_catalog_db" in scenario_ids
        assert "scenario_b_api_timeout" in scenario_ids
        assert "scenario_c_inventory_failure" in scenario_ids
        assert "scenario_d_checkout_failure" in scenario_ids
        assert "scenario_e_payment_degraded" in scenario_ids
        assert "scenario_f_backend_api_down" in scenario_ids
        assert "scenario_g_verification_failure" in scenario_ids
        assert "scenario_h_upstream_dependency_failure" in scenario_ids
        assert "scenario_i_malformed_data" in scenario_ids

    def test_unknown_scenario_rejected(self):
        """Injecting an unregistered scenario ID returns HTTP 400 Bad Request."""
        res = client.post("/demo/chaos/inject", json={"scenario_id": "malicious_unregistered_scenario"})
        assert res.status_code == 400
        assert "Unknown chaos scenario ID" in res.json()["detail"]

    def test_scenario_a_catalog_db_failure(self):
        """Scenario A causes HTTP 503 ERR_DB_POOL_EXHAUSTED and recovery restores catalog."""
        res_inj = client.post("/demo/chaos/inject", json={"scenario_id": "scenario_a_catalog_db"})
        assert res_inj.status_code == 200
        assert res_inj.json()["status"] == "scenario_injected"

        # Catalog returns 503
        res_prod = client.get("/demo/products")
        assert res_prod.status_code == 503
        assert res_prod.json()["detail"]["error_code"] == "ERR_DB_POOL_EXHAUSTED"

        # Live probe creates incident
        probe = client.post("/live/probe?auto_create_incident=true").json()
        assert probe["is_healthy"] is False
        inc_id = probe["incident"]["id"]

        # Recover
        res_rec = client.post(f"/recovery/start/{inc_id}")
        assert res_rec.status_code == 200
        assert res_rec.json()["incident"]["status"] == "resolved"

        # Catalog back online
        assert client.get("/demo/products").status_code == 200

    def test_scenario_b_api_timeout(self):
        """Scenario B causes HTTP 504 Gateway Timeout and recovery restores normal latency."""
        res_inj = client.post("/demo/chaos/inject", json={"scenario_id": "scenario_b_api_timeout"})
        assert res_inj.status_code == 200

        res_prod = client.get("/demo/products")
        assert res_prod.status_code == 504
        assert res_prod.json()["detail"]["error_code"] == "ERR_PRODUCT_API_TIMEOUT"

        # Reset clears timeout
        client.post("/demo/chaos/reset")
        assert client.get("/demo/products").status_code == 200

    def test_scenario_c_inventory_failure(self):
        """Scenario C causes inventory failure while products remain browsable."""
        client.post("/demo/chaos/inject", json={"scenario_id": "scenario_c_inventory_failure"})

        # Products are still browsable
        res_prod = client.get("/demo/products")
        assert res_prod.status_code == 200

        # Inventory check returns 503
        res_inv = client.get("/demo/inventory/prod-m-101")
        assert res_inv.status_code == 503
        assert res_inv.json()["detail"]["error_code"] == "ERR_INVENTORY_UNAVAILABLE"

        res_bulk = client.post("/demo/inventory/check", json={"product_ids": ["prod-m-101", "prod-w-101"]})
        assert res_bulk.status_code == 503

        # Reset restores inventory
        client.post("/demo/chaos/reset")
        assert client.get("/demo/inventory/prod-m-101").status_code == 200

    def test_scenario_d_checkout_failure(self):
        """Scenario D causes checkout submission failure while cart management works."""
        client.post("/demo/chaos/inject", json={"scenario_id": "scenario_d_checkout_failure"})

        # Products work
        assert client.get("/demo/products").status_code == 200

        # Checkout returns 503
        res_checkout = client.post(
            "/demo/checkout",
            json={
                "items": [{"id": "prod-m-101", "quantity": 1}],
                "shipping_address": {"city": "Mumbai", "pincode": "400001"},
                "payment_method": "UPI",
                "subtotal": 8499.0,
                "total": 8499.0,
            },
        )
        assert res_checkout.status_code == 503
        assert res_checkout.json()["detail"]["error_code"] == "ERR_CHECKOUT_UNAVAILABLE"

        # Reset restores checkout
        client.post("/demo/chaos/reset")
        res_ok = client.post(
            "/demo/checkout",
            json={
                "items": [{"id": "prod-m-101", "quantity": 1}],
                "shipping_address": {"city": "Mumbai", "pincode": "400001"},
                "payment_method": "UPI",
                "subtotal": 8499.0,
                "total": 8499.0,
            },
        )
        assert res_ok.status_code == 200
        assert "ORD-AGN-" in res_ok.json()["order_id"]

    def test_scenario_e_payment_degraded(self):
        """Scenario E causes payment gateway processing failure."""
        client.post("/demo/chaos/inject", json={"scenario_id": "scenario_e_payment_degraded"})

        res_pay = client.post(
            "/demo/payment/process",
            json={
                "order_id": "ORD-12345",
                "amount": 4999.0,
                "payment_method": "Credit Card",
            },
        )
        assert res_pay.status_code == 503
        assert res_pay.json()["detail"]["error_code"] == "ERR_PAYMENT_GATEWAY_UNAVAILABLE"

        client.post("/demo/chaos/reset")
        res_pay_ok = client.post(
            "/demo/payment/process",
            json={
                "order_id": "ORD-12345",
                "amount": 4999.0,
                "payment_method": "Credit Card",
            },
        )
        assert res_pay_ok.status_code == 200
        assert res_pay_ok.json()["status"] == "payment_approved"

    def test_scenario_f_backend_api_down(self):
        """Scenario F causes core backend API service failure."""
        client.post("/demo/chaos/inject", json={"scenario_id": "scenario_f_backend_api_down"})

        res_health = client.get("/demo/health")
        assert res_health.status_code == 503
        assert res_health.json()["error_code"] == "ERR_BACKEND_API_DOWN"

    def test_scenario_g_recovery_verification_failure(self):
        """Scenario G executes recovery action but verification fails, preventing false resolution."""
        client.post("/demo/chaos/inject", json={"scenario_id": "scenario_g_verification_failure"})

        probe = client.post("/live/probe?auto_create_incident=true").json()
        inc_id = probe["incident"]["id"]

        # Recovery attempt must fail
        res_rec = client.post(f"/recovery/start/{inc_id}")
        assert res_rec.status_code == 200
        assert res_rec.json()["incident"]["status"] == "failed"

        # Check audit log records failure
        audit = client.get(f"/audit?incident_id={inc_id}").json()["audit_log"]
        assert any(e["event_type"] == "recovery_failed" for e in audit)

    def test_scenario_h_upstream_dependency_failure(self):
        """Scenario H fails upstream database and blocks downstream recovery."""
        client.post("/demo/chaos/inject", json={"scenario_id": "scenario_h_upstream_dependency_failure"})

        # Database must be failed
        assert state.service_states["database"] == "failed"

        # Recovery assessment for backend_api must be BLOCKED
        assess = client.post("/recovery/assess", json={"service": "backend_api"}).json()
        assert assess["readiness_status"] == "BLOCKED"
        assert any("database" in b["reason"] for b in assess["blocked_actions"])

    def test_chaos_reset_restores_all_subsystems(self):
        """Reset clears all active faults and returns clean status."""
        client.post("/demo/chaos/inject", json={"scenario_id": "scenario_a_catalog_db"})
        assert client.get("/demo/products").status_code == 503

        res_reset = client.post("/demo/chaos/reset")
        assert res_reset.status_code == 200
        assert res_reset.json()["status"] == "reset"

        # Subsystems status
        status_res = client.get("/demo/chaos/status").json()
        assert status_res["active_scenario"] is None
        assert all(v == "healthy" for v in status_res["subsystems"].values())
