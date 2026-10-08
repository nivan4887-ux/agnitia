"""
RecoverOps – In-memory state management for services, incidents, approvals,
audit logs, and simulation overrides.
"""

from __future__ import annotations

import threading
import uuid
from datetime import datetime, timezone
from typing import Any

# Global re-entrant lock for all state transitions and recovery orchestration
state_lock = threading.RLock()


def _new_state() -> dict[str, str]:
    """Initial state: every service is healthy."""
    from app.graph import SERVICES
    return {s: "healthy" for s in SERVICES}


# Module-level mutable in-memory state
service_states: dict[str, str] = _new_state()
incidents: list[dict[str, Any]] = []
approvals: list[dict[str, Any]] = []
audit_log: list[dict[str, Any]] = []
simulation_overrides: dict[str, dict[str, Any]] = {}


def reset_state() -> None:
    """Reset all in-memory state – useful for tests."""
    global service_states, incidents, approvals, audit_log, simulation_overrides
    with state_lock:
        service_states = _new_state()
        incidents.clear()
        approvals.clear()
        audit_log.clear()
        simulation_overrides.clear()



def record_audit_event(
    incident_id: str | None,
    event_type: str,
    service: str | None = None,
    details: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Record an audit event globally and on the corresponding incident if found."""
    event = {
        "id": str(uuid.uuid4()),
        "incident_id": incident_id,
        "event_type": event_type,
        "service": service,
        "details": details or {},
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    audit_log.append(event)

    if incident_id:
        for inc in incidents:
            if inc["id"] == incident_id:
                if "audit_log" not in inc:
                    inc["audit_log"] = []
                inc["audit_log"].append(event)
                break

    return event


def get_incident(incident_id: str) -> dict[str, Any] | None:
    """Find an incident by its ID."""
    for inc in incidents:
        if inc["id"] == incident_id:
            return inc
    return None


def get_approval(approval_id: str) -> dict[str, Any] | None:
    """Find an approval by its ID."""
    for apprv in approvals:
        if apprv["id"] == approval_id:
            return apprv
    return None


def create_pending_approval(
    incident_id: str,
    service: str,
    action: str,
    risk_level: str,
    description: str,
) -> dict[str, Any]:
    """Create a pending approval record."""
    approval = {
        "id": str(uuid.uuid4()),
        "incident_id": incident_id,
        "service": service,
        "action": action,
        "risk_level": risk_level,
        "description": description,
        "status": "pending",  # "pending" | "approved" | "rejected"
        "created_at": datetime.now(timezone.utc).isoformat(),
        "decided_at": None,
        "decision_reason": None,
    }
    approvals.append(approval)
    return approval


def set_simulation_override(
    service: str,
    action_success: bool = True,
    health_check_success: bool = True,
    risk_level: str | None = None,
    action_error: str | None = None,
    health_check_error: str | None = None,
) -> None:
    """Set simulation behavior override for testing."""
    simulation_overrides[service] = {
        "action_success": action_success,
        "health_check_success": health_check_success,
        "risk_level": risk_level,
        "action_error": action_error,
        "health_check_error": health_check_error,
    }


def fail_service(service_name: str) -> dict[str, Any]:
    """Mark *service_name* and its downstream dependents as degraded.

    Returns the created incident record.
    """
    with state_lock:
        from app.graph import build_graph, get_downstream_dependents

        graph = build_graph()
        affected = [service_name] + get_downstream_dependents(graph, service_name)

        service_states[service_name] = "failed"
        for dep in affected:
            if dep != service_name:
                service_states[dep] = "degraded"

        incident_id = str(uuid.uuid4())
        now_iso = datetime.now(timezone.utc).isoformat()
        incident = {
            "id": incident_id,
            "failed_service": service_name,
            "affected_services": affected,
            "status": "open",  # "open" | "recovering" | "awaiting_approval" | "resolved" | "failed" | "aborted"
            "created_at": now_iso,
            "recovery_started_at": None,
            "recovery_completed_at": None,
            "total_recovery_duration_seconds": None,
            "recovery_order": [],
            "current_step_index": 0,
            "recovery_steps": [],
            "pending_approval_id": None,
            "audit_log": [],
        }
        incidents.append(incident)

        record_audit_event(
            incident_id=incident_id,
            event_type="incident_created",
            service=service_name,
            details={"affected_services": affected},
        )

        return incident
