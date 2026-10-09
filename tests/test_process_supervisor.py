"""
BRIDGE – Unit and Integration Tests for Standalone Process Supervisor.

Tests process lifecycle (start, stop, restart, status, duplicate prevention,
timeout cleanup, and safe fixed-path invocation).
"""

import os
import time
import pytest

from app.supervisor import StandaloneSupervisor, STANDALONE_SCRIPT_PATH


@pytest.fixture
def test_supervisor():
    """Create an isolated supervisor instance on an ephemeral test port with clean teardown."""
    test_port = 8992
    sup = StandaloneSupervisor(port=test_port)
    sup.stop_service()
    yield sup
    sup.stop_service()


def test_supervisor_fixed_entrypoint_exists():
    """Verify that the supervisor is bound strictly to the repository's standalone server entrypoint."""
    assert STANDALONE_SCRIPT_PATH.exists(), f"Entrypoint script {STANDALONE_SCRIPT_PATH} must exist"
    assert STANDALONE_SCRIPT_PATH.name == "server.py"


def test_supervisor_start_stop_lifecycle(test_supervisor):
    """Test standard process launch, inspection, and termination."""
    assert not test_supervisor.is_running()
    assert test_supervisor.get_pid() is None

    # 1. Start process
    res = test_supervisor.start_service()
    assert res["success"] is True
    assert res["action"] == "started"
    child_pid = res["pid"]
    assert child_pid > 0
    assert child_pid != os.getpid()
    assert test_supervisor.is_running()
    assert test_supervisor.get_pid() == child_pid

    # 2. Status inspection
    status = test_supervisor.get_status()
    assert status["running"] is True
    assert status["pid"] == child_pid
    assert status["port"] == test_supervisor.port
    assert status["control_backend_pid"] == os.getpid()
    assert len(status["recent_logs"]) > 0

    # 3. Duplicate start prevention
    dup_res = test_supervisor.start_service()
    assert dup_res["success"] is True
    assert dup_res["action"] == "already_running"
    assert dup_res["pid"] == child_pid

    # 4. Stop service
    stop_res = test_supervisor.stop_service()
    assert stop_res["success"] is True
    assert stop_res["action"] == "stopped"
    assert not test_supervisor.is_running()
    assert test_supervisor.get_pid() is None

    # 5. Duplicate stop idempotency
    dup_stop = test_supervisor.stop_service()
    assert dup_stop["success"] is True
    assert dup_stop["action"] == "already_stopped"


def test_supervisor_restart_assigns_new_pid(test_supervisor):
    """Verify that restarting cleanly stops the old process and spawns a fresh OS process."""
    res1 = test_supervisor.start_service()
    old_pid = res1["pid"]

    res2 = test_supervisor.restart_service()
    new_pid = res2["pid"]

    assert res2["success"] is True
    assert new_pid > 0
    assert new_pid != old_pid
    assert test_supervisor.is_running()
    assert test_supervisor.get_pid() == new_pid

