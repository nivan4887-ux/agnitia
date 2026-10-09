"""
BRIDGE – Simulated Recovery Playbooks and Risk Classification.
"""

from __future__ import annotations

from typing import Any

# Default recovery playbook definitions per service.
DEFAULT_PLAYBOOKS: dict[str, dict[str, Any]] = {
    "database": {
        "action": "restore_backup_and_restart",
        "risk_level": "high_risk",
        "description": "Simulate restoring database from backup snapshot and cluster restart",
        "health_check_type": "database_ping_and_replication_check",
    },
    "backend_api": {
        "action": "restart_service",
        "risk_level": "safe",
        "description": "Simulate restarting backend API process and reconnecting connection pools",
        "health_check_type": "http_health_endpoint",
    },
    "order_service": {
        "action": "restart_service",
        "risk_level": "safe",
        "description": "Simulate restarting order service workers and re-syncing message queue",
        "health_check_type": "worker_heartbeat_and_queue_probe",
    },
    "payment_service": {
        "action": "restart_service",
        "risk_level": "safe",
        "description": "Simulate restarting payment gateway integration workers",
        "health_check_type": "gateway_handshake_probe",
    },
    "website": {
        "action": "clear_cache_and_restart",
        "risk_level": "safe",
        "description": "Simulate purging frontend edge cache and restarting web ingress pods",
        "health_check_type": "synthetic_ui_probe",
    },
    "standalone_service": {
        "action": "restart_python_demo_service",
        "risk_level": "safe",
        "description": "Restart independent Python OS process via supervisor and verify over real HTTP",
        "health_check_type": "real_http_health_probe",
    },
}


def get_playbook(service: str) -> dict[str, Any]:
    """Retrieve the playbook configuration for *service*, taking into account

    any active simulation overrides.
    """
    from app.state import simulation_overrides

    base = DEFAULT_PLAYBOOKS.get(
        service,
        {
            "action": "generic_restart",
            "risk_level": "safe",
            "description": f"Generic restart for {service}",
            "health_check_type": "generic_ping",
        },
    ).copy()

    if service in simulation_overrides:
        override = simulation_overrides[service]
        if "risk_level" in override and override["risk_level"] is not None:
            base["risk_level"] = override["risk_level"]
        if "action" in override and override["action"] is not None:
            base["action"] = override["action"]
        if "description" in override and override["description"] is not None:
            base["description"] = override["description"]

    return base


def execute_simulated_action(service: str, playbook: dict[str, Any]) -> dict[str, Any]:
    """Execute the recovery action for *service* using allowlisted adapter or simulation."""
    from app.state import simulation_overrides
    from app import live_adapter

    override = simulation_overrides.get(service, {})
    success = override.get("action_success", True)
    error_msg = override.get("action_error", None)

    if not success:
        return {
            "success": False,
            "action": playbook.get("action", "unknown_action"),
            "risk_level": playbook.get("risk_level", "safe"),
            "message": error_msg or f"Simulated failure executing {playbook.get('action')} on {service}",
        }

    # Execute allowlisted live adapter for live demo targets
    live_res = live_adapter.execute_allowlisted_action(service, playbook.get("action", "restart_service"))
    if not live_res.get("success"):
        return {
            "success": False,
            "action": playbook.get("action", "unknown_action"),
            "risk_level": playbook.get("risk_level", "safe"),
            "message": live_res.get("error", "Allowlisted adapter execution failed"),
        }

    return {
        "success": True,
        "action": playbook.get("action", "unknown_action"),
        "risk_level": playbook.get("risk_level", "safe"),
        "message": f"Successfully executed action '{playbook.get('action')}' on {service}",
    }


def run_simulated_health_check(service: str, playbook: dict[str, Any]) -> dict[str, Any]:
    """Execute the post-recovery health check for *service*, verifying live HTTP probes when applicable."""
    from app.state import simulation_overrides
    from app import live_adapter

    override = simulation_overrides.get(service, {})
    passed = override.get("health_check_success", None)
    error_msg = override.get("health_check_error", None)

    check_type = playbook.get("health_check_type", "synthetic_probe")

    # If an explicit simulation override was set, honor it
    if passed is not None:
        if not passed:
            return {
                "passed": False,
                "health_check_type": check_type,
                "message": error_msg or f"Health check failed for {service} ({check_type})",
            }
        return {
            "passed": True,
            "health_check_type": check_type,
            "message": f"Health check passed for {service} ({check_type})",
        }

    # Live HTTP probe verification for designated demo services
    if service in ("backend_api", "standalone_service"):
        return live_adapter.verify_live_service_health(service)

    return {
        "passed": True,
        "health_check_type": check_type,
        "message": f"Health check passed for {service} ({check_type})",
    }


