"""
Tests for RecoverOps Real-Time Recovery Job Tracking and Authoritative Backend Execution.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app import demo_store, state
from app.state import reset_state

client = TestClient(app)


@pytest.fixture(autouse=True)
def _clean_state():
    reset_state()
    demo_store.reset_demo_store()
    yield
    reset_state()
    demo_store.reset_demo_store()


class TestRecoveryJobsTracking:
    def test_start_recovery_creates_and_tracks_job(self):
        """Starting recovery must create a recovery job and track its stages authoritatively."""
        # 1. Trigger simulated outage on safe leaf service
        r_fail = client.post("/simulate/fail/website")
        assert r_fail.status_code == 200
        incident_id = r_fail.json()["incident"]["id"]

        # 2. Start recovery
        r_start = client.post(f"/recovery/start/{incident_id}")
        assert r_start.status_code == 200
        data = r_start.json()
        assert "job_id" in data
        assert data["job_id"] is not None
        assert "job" in data
        job = data["job"]
        assert job["incident_id"] == incident_id
        assert job["service"] == "website"
        assert job["stage"] == "succeeded"
        assert job["status"] == "resolved"
        assert job["completed_at"] is not None
        assert len(job["logs"]) >= 2

        # 3. Retrieve specific job via /recovery/jobs/{job_id}
        r_job = client.get(f"/recovery/jobs/{job['id']}")
        assert r_job.status_code == 200
        fetched_job = r_job.json()["job"]
        assert fetched_job["id"] == job["id"]
        assert fetched_job["stage"] == "succeeded"

        # 4. Retrieve status via /recovery/status/{incident_id}
        r_status = client.get(f"/recovery/status/{incident_id}")
        assert r_status.status_code == 200
        status_data = r_status.json()
        assert status_data["incident_id"] == incident_id
        assert status_data["status"] == "resolved"
        assert status_data["active_job_id"] == job["id"]

    def test_high_risk_recovery_pauses_job_at_awaiting_approval(self):
        """High risk database recovery must pause job stage at awaiting_approval until decided."""
        r_fail = client.post("/simulate/fail/database")
        incident_id = r_fail.json()["incident"]["id"]

        # Start recovery (should pause for approval)
        r_start = client.post(f"/recovery/start/{incident_id}")
        assert r_start.status_code == 200
        job_id = r_start.json()["job_id"]

        # Verify job stage is awaiting_approval
        r_job = client.get(f"/recovery/jobs/{job_id}")
        assert r_job.status_code == 200
        job = r_job.json()["job"]
        assert job["stage"] == "awaiting_approval"
        assert job["status"] == "awaiting_approval"
        assert job["completed_at"] is None
        assert any("approval" in log.lower() for log in job["logs"])

        # Approve and verify completion
        approval_id = r_start.json()["incident"]["pending_approval_id"]
        r_appr = client.post(f"/approvals/{approval_id}/approve", json={"reason": "Operator confirmed DB backup"})
        assert r_appr.status_code == 200

        # Verify job completed successfully
        r_job_after = client.get(f"/recovery/jobs/{job_id}")
        job_after = r_job_after.json()["job"]
        assert job_after["stage"] == "succeeded"
        assert job_after["status"] == "resolved"
        assert job_after["completed_at"] is not None

    def test_failed_recovery_marks_job_as_failed(self):
        """When recovery health verification fails, the job must be authoritatively marked as failed."""
        r_fail = client.post("/simulate/fail/backend_api")
        incident_id = r_fail.json()["incident"]["id"]

        # Configure health check failure override
        client.post(
            "/simulate/configure",
            json={
                "service": "backend_api",
                "health_check_success": False,
                "health_check_error": "Connection probe timed out after 5000ms",
            },
        )

        r_start = client.post(f"/recovery/start/{incident_id}")
        assert r_start.status_code == 200
        job_id = r_start.json()["job_id"]

        r_job = client.get(f"/recovery/jobs/{job_id}")
        job = r_job.json()["job"]
        assert job["stage"] == "failed"
        assert job["status"] == "failed"
        assert "Connection probe timed out" in (job["error"] or "")
        assert job["completed_at"] is not None

    def test_job_not_found_returns_404(self):
        """Querying a non-existent job ID returns 404 Not Found."""
        r = client.get("/recovery/jobs/non-existent-uuid")
        assert r.status_code == 404
        assert "not found" in r.json()["detail"].lower()

    def test_stage_history_and_diagnostics_tracking(self):
        """Recovery job must maintain complete stage_history, evidence, and root_cause data."""
        r_fail = client.post("/simulate/fail/database")
        incident_id = r_fail.json()["incident"]["id"]

        r_start = client.post(f"/recovery/start/{incident_id}")
        assert r_start.status_code == 200
        job_id = r_start.json()["job_id"]

        r_job = client.get(f"/recovery/jobs/{job_id}")
        job = r_job.json()["job"]

        # Check stage history presence and structure
        assert "stage_history" in job
        stages = [h["stage"] for h in job["stage_history"]]
        assert "detecting" in stages
        assert "analyzing" in stages
        assert "planning" in stages
        assert "awaiting_approval" in stages

        # Check evidence and root cause
        assert "evidence" in job
        assert job["evidence"]["target_service"] == "database"
        assert "root_cause" in job
        assert job["root_cause"]["failed_service"] == "database"
        assert "recovery_strategy" in job
        assert job["recovery_strategy"]["risk_level"] == "high_risk"


