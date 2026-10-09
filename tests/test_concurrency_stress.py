"""
BRIDGE – Multi-Threaded Concurrency and Stress Verification Suite.
"""

from __future__ import annotations

import concurrent.futures
import threading
from typing import Any
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.chaos import reset_chaos_state, activate_scenario, get_active_scenario
from app.state import reset_state, state_lock, incidents, audit_log, approvals, service_states, fail_service
from app.engine import start_recovery, process_approval

client = TestClient(app)


class TestConcurrencySafety:
    def setup_method(self):
        reset_state()
        reset_chaos_state()

    def teardown_method(self):
        reset_state()
        reset_chaos_state()

    def test_concurrent_recovery_requests_race(self):
        """Verify that 20 concurrent threads trying to recover the same incident execute cleanly without duplicate state transitions."""
        inc = fail_service("backend_api")
        inc_id = inc["id"]

        results = []
        errors = []

        def worker():
            try:
                res = client.post(f"/recovery/start/{inc_id}")
                return res.status_code, res.json()
            except Exception as e:
                return 500, str(e)

        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(worker) for _ in range(20)]
            for f in concurrent.futures.as_completed(futures):
                status_code, data = f.result()
                results.append((status_code, data))

        # All requests must return valid HTTP status codes (200 OK or 400 Bad Request if already recovering/resolved)
        assert len(results) == 20
        assert all(code in (200, 400) for code, _ in results)

        # Check final incident state
        final_inc = next((i for i in incidents if i["id"] == inc_id), None)
        assert final_inc is not None
        assert final_inc["status"] in ("resolved", "recovering")
        # Ensure audit log is not corrupted
        assert len(audit_log) > 0

    def test_concurrent_probe_and_injection_race(self):
        """Verify concurrent probes and chaos injections maintain thread-safe state."""
        def inject_worker(sc_id: str):
            return client.post("/demo/chaos/inject", json={"scenario_id": sc_id}).status_code

        def probe_worker():
            return client.post("/live/probe?auto_create_incident=false").status_code

        scenarios = ["scenario_a_catalog_db", "scenario_b_api_timeout", "scenario_c_inventory_failure"]

        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
            inject_futs = [executor.submit(inject_worker, scenarios[i % len(scenarios)]) for i in range(15)]
            probe_futs = [executor.submit(probe_worker) for _ in range(15)]

            for f in concurrent.futures.as_completed(inject_futs + probe_futs):
                status_code = f.result()
                assert status_code == 200

        status_res = client.get("/demo/chaos/status").json()
        assert "subsystems" in status_res

    def test_concurrent_approval_decisions_race(self):
        """Verify that multiple concurrent approve/reject calls on the same approval ID result in exactly one winner and 400 for subsequent calls."""
        inc = fail_service("database")
        inc_id = inc["id"]

        # Run recovery up to high-risk approval pause
        rec_res = client.post(f"/recovery/start/{inc_id}").json()
        assert rec_res["incident"]["status"] == "awaiting_approval"
        approval_id = rec_res["incident"]["pending_approval_id"]
        assert approval_id is not None

        approval_results = []

        def approve_worker():
            res = client.post(f"/approvals/{approval_id}/approve")
            return res.status_code

        def reject_worker():
            res = client.post(f"/approvals/{approval_id}/reject")
            return res.status_code

        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
            futs = [executor.submit(approve_worker if i % 2 == 0 else reject_worker) for i in range(10)]
            for f in concurrent.futures.as_completed(futs):
                approval_results.append(f.result())

        # Exactly ONE request must succeed (HTTP 200) and all other 9 must receive HTTP 400 Bad Request
        successes = [code for code in approval_results if code == 200]
        rejections = [code for code in approval_results if code == 400]
        assert len(successes) == 1, f"Expected exactly 1 winning decision, got: {approval_results}"
        assert len(rejections) == 9
