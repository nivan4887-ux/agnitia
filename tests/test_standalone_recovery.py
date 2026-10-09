"""
BRIDGE – End-to-End Tests for Python Operating-System Process Recovery.

Tests real TCP HTTP probing, failure detection, incident creation, process restart
orchestration via StandaloneSupervisor, live HTTP 200 verification, and audit trail.
"""

import os
import time
import pytest
from fastapi.testclient import TestClient

from app import live_adapter, state, supervisor
from app.main import app


@pytest.fixture(autouse=True)
def clean_system():
    """Ensure clean state and terminate any leftover supervised processes before and after tests."""
    state.reset_state()
    supervisor.supervisor.stop_service()
    yield
    supervisor.supervisor.stop_service()
    state.reset_state()


@pytest.fixture
def client():
    return TestClient(app)


def test_standalone_endpoints_lifecycle(client):
    """Test start, status, probe, fail, and stop endpoints."""
    # 1. Initial status when stopped
    status_resp = client.get("/standalone/status")
    assert status_resp.status_code == 200
    data = status_resp.json()
    assert data["supervisor"]["running"] is False
    assert data["is_healthy"] is False

    # 2. Start standalone process
    start_resp = client.post("/standalone/start")
    assert start_resp.status_code == 200
    start_data = start_resp.json()
    assert start_data["success"] is True
    pid = start_data["pid"]
    assert pid > 0

    # Wait briefly for server socket bind
    time.sleep(0.3)

    # 3. Status when running and healthy
    status_resp2 = client.get("/standalone/status")
    assert status_resp2.status_code == 200
    data2 = status_resp2.json()
    assert data2["supervisor"]["running"] is True
    assert data2["supervisor"]["pid"] == pid
    assert data2["is_healthy"] is True
    assert data2["health_probe"]["status_code"] == 200
    assert data2["products_probe"]["products_returned"] > 0

    # 4. Inject fault via POST /standalone/fail
    fail_resp = client.post("/standalone/fail")
    assert fail_resp.status_code == 200

    # 5. Probe detects fault and creates incident
    probe_resp = client.post("/standalone/probe?auto_create_incident=true")
    assert probe_resp.status_code == 200
    probe_data = probe_resp.json()
    assert probe_data["is_healthy"] is False
    assert probe_data["health_probe"]["status_code"] == 503
    assert probe_data["incident"] is not None
    incident_id = probe_data["incident"]["id"]
    assert probe_data["incident"]["failed_service"] == "standalone_service"

    # 6. Stop standalone process
    stop_resp = client.post("/standalone/stop")
    assert stop_resp.status_code == 200
    assert stop_resp.json()["success"] is True


def test_standalone_os_process_recovery_end_to_end(client):
    """Full End-to-End Recovery Flow for Real Python OS Process."""
    # 1. Launch standalone process
    start_res = supervisor.supervisor.start_service()
    assert start_res["success"] is True
    initial_pid = start_res["pid"]
    time.sleep(0.3)

    # 2. Verify initial real TCP HTTP 200
    initial_probe = live_adapter.probe_standalone_health()
    assert initial_probe["healthy"] is True
    assert initial_probe["status_code"] == 200
    assert initial_probe["pid"] == initial_pid

    # 3. Inject fault into the process
    fail_res = client.post("/standalone/fail")
    assert fail_res.status_code == 200

    # 4. Run probe to detect failure and generate incident
    probe_res = live_adapter.run_standalone_health_probe(auto_create_incident=True)
    assert probe_res["is_healthy"] is False
    assert probe_res["health_probe"]["status_code"] == 503
    incident = probe_res["incident"]
    assert incident is not None
    incident_id = incident["id"]

    assert state.service_states["standalone_service"] == "failed"

    # 5. Trigger sequential recovery on the incident
    rec_res = client.post(f"/recovery/start/{incident_id}")
    assert rec_res.status_code == 200
    rec_data = rec_res.json()
    assert rec_data["incident"]["status"] == "resolved"
    assert rec_data["job"]["status"] == "resolved"
    assert rec_data["job"]["stage"] == "succeeded"

    # 6. Verify service state updated to healthy
    assert state.service_states["standalone_service"] == "healthy"

    # 7. Verify new process PID is different from initial faulted PID
    current_status = supervisor.supervisor.get_status()
    assert current_status["running"] is True
    new_pid = current_status["pid"]
    assert new_pid != initial_pid

    # 8. Verify real TCP HTTP is genuinely responding 200
    post_probe = live_adapter.probe_standalone_health()
    assert post_probe["healthy"] is True
    assert post_probe["status_code"] == 200
    assert post_probe["pid"] == new_pid

    # 9. Verify audit trail records the process restart event and resolution
    audit_resp = client.get(f"/audit?incident_id={incident_id}")
    events = [e["event_type"] for e in audit_resp.json()["audit_log"]]
    assert "incident_created" in events
    assert "standalone_http_probe_failure" in events
    assert "recovery_started" in events
    assert "recovery_completed" in events


def test_standalone_recovery_failure_when_process_cannot_start(client, monkeypatch):
    """Negative test: If supervisor fails to start the process, recovery fails cleanly and incident is marked failed."""
    # 1. Create failed incident for standalone_service
    incident = state.fail_service("standalone_service")
    incident_id = incident["id"]

    # 2. Mock supervisor.restart_service to simulate an OS-level execution error
    def mock_failing_restart(*args, **kwargs):
        return {"success": False, "error": "Simulated OS Spawn Error: Permission Denied"}

    monkeypatch.setattr(supervisor.supervisor, "restart_service", mock_failing_restart)

    # 3. Trigger recovery
    rec_res = client.post(f"/recovery/start/{incident_id}")
    assert rec_res.status_code == 200
    rec_data = rec_res.json()
    assert rec_data["incident"]["status"] == "failed"
    assert rec_data["job"]["status"] == "failed"
    assert rec_data["job"]["stage"] == "failed"
    assert "Simulated OS Spawn Error" in rec_data["job"]["error"]

    # 4. Standalone service remains failed
    assert state.service_states["standalone_service"] == "failed"
