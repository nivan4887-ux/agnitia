"""
RecoverOps – Recovery execution engine.

Handles sequential dependency-aware recovery execution, prerequisite validation gates,
playbook action simulation, simulated health checks, risk approval pauses,
and audit tracking.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException

from app import graph, playbooks, state


def _finalize_incident(
    incident: dict[str, Any],
    status: str,
    failure_reason: str | None = None,
) -> None:
    """Mark recovery complete or terminated and calculate duration."""
    incident["status"] = status
    incident["pending_approval_id"] = None
    now_iso = datetime.now(timezone.utc).isoformat()
    incident["recovery_completed_at"] = now_iso

    if incident.get("recovery_started_at"):
        start_dt = datetime.fromisoformat(incident["recovery_started_at"])
        end_dt = datetime.fromisoformat(now_iso)
        duration = max(0.0, (end_dt - start_dt).total_seconds())
        incident["total_recovery_duration_seconds"] = duration

    if status == "resolved":
        state.record_audit_event(
            incident_id=incident["id"],
            event_type="recovery_completed",
            details={
                "total_recovery_duration_seconds": incident.get("total_recovery_duration_seconds"),
            },
        )
    elif status == "failed":
        state.record_audit_event(
            incident_id=incident["id"],
            event_type="recovery_failed",
            details={
                "reason": failure_reason,
                "total_recovery_duration_seconds": incident.get("total_recovery_duration_seconds"),
            },
        )
    elif status == "aborted":
        state.record_audit_event(
            incident_id=incident["id"],
            event_type="recovery_aborted",
            details={
                "reason": failure_reason,
                "total_recovery_duration_seconds": incident.get("total_recovery_duration_seconds"),
            },
        )


def execute_recovery(
    incident: dict[str, Any],
    approved_step_index: int | None = None,
) -> dict[str, Any]:
    """Execute sequential recovery plan for *incident*."""
    dep_graph = graph.build_graph()

    # If recovery has not started yet, initialize timestamps and planned order
    if incident.get("recovery_started_at") is None:
        incident["recovery_started_at"] = datetime.now(timezone.utc).isoformat()

    if not incident.get("recovery_order"):
        order = graph.recovery_order(dep_graph, incident["failed_service"])
        incident["recovery_order"] = order

    incident["status"] = "recovering"

    state.record_audit_event(
        incident_id=incident["id"],
        event_type="recovery_started",
        service=incident["failed_service"],
        details={
            "recovery_order": incident["recovery_order"],
            "starting_step_index": incident["current_step_index"],
        },
    )

    while incident["current_step_index"] < len(incident["recovery_order"]):
        step_idx = incident["current_step_index"]
        service = incident["recovery_order"][step_idx]

        # 1. Dependency Gate Check: Verify all prerequisites are healthy
        prereqs = graph.get_prerequisites(dep_graph, service)
        unhealthy = [p for p in prereqs if state.service_states.get(p) != "healthy"]

        if unhealthy:
            reason = (
                f"Dependency gate failed: Prerequisite services {unhealthy} "
                f"are not healthy for '{service}'"
            )
            state.record_audit_event(
                incident_id=incident["id"],
                event_type="dependency_check_failed",
                service=service,
                details={
                    "service": service,
                    "prerequisites": prereqs,
                    "unhealthy_prerequisites": unhealthy,
                    "reason": reason,
                },
            )
            incident["recovery_steps"].append({
                "service": service,
                "status": "failed",
                "reason": reason,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
            _finalize_incident(incident, status="failed", failure_reason=reason)
            return incident

        state.record_audit_event(
            incident_id=incident["id"],
            event_type="dependency_check_passed",
            service=service,
            details={"service": service, "prerequisites": prereqs},
        )

        # 2. Risk Classification & Approval Enforcement
        playbook = playbooks.get_playbook(service)
        risk_level = playbook.get("risk_level", "safe")

        if risk_level == "high_risk" and approved_step_index != step_idx:
            # Check if this service action has already been explicitly approved
            already_approved = any(
                a["incident_id"] == incident["id"]
                and a["service"] == service
                and a["status"] == "approved"
                for a in state.approvals
            )
            if not already_approved:
                approval = state.create_pending_approval(
                    incident_id=incident["id"],
                    service=service,
                    action=playbook.get("action", "unknown_action"),
                    risk_level=risk_level,
                    description=playbook.get("description", ""),
                )
                incident["status"] = "awaiting_approval"
                incident["pending_approval_id"] = approval["id"]
                state.record_audit_event(
                    incident_id=incident["id"],
                    event_type="approval_requested",
                    service=service,
                    details={
                        "approval_id": approval["id"],
                        "action": playbook.get("action"),
                        "risk_level": risk_level,
                        "description": playbook.get("description"),
                    },
                )
                return incident

        # 3. Simulated Playbook Action Execution
        state.service_states[service] = "recovering"
        action_result = playbooks.execute_simulated_action(service, playbook)
        state.record_audit_event(
            incident_id=incident["id"],
            event_type="recovery_action_executed",
            service=service,
            details=action_result,
        )

        if not action_result["success"]:
            state.service_states[service] = "failed"
            incident["recovery_steps"].append({
                "service": service,
                "action": playbook.get("action"),
                "status": "failed",
                "reason": action_result.get("message"),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
            _finalize_incident(incident, status="failed", failure_reason=action_result.get("message"))
            return incident

        # 4. Simulated Post-Recovery Health Check Verification
        health_result = playbooks.run_simulated_health_check(service, playbook)
        state.record_audit_event(
            incident_id=incident["id"],
            event_type="health_check",
            service=service,
            details=health_result,
        )

        if not health_result["passed"]:
            state.service_states[service] = "failed"
            incident["recovery_steps"].append({
                "service": service,
                "action": playbook.get("action"),
                "status": "failed",
                "reason": health_result.get("message"),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
            _finalize_incident(incident, status="failed", failure_reason=health_result.get("message"))
            return incident

        # Step succeeded – mark service healthy and advance
        state.service_states[service] = "healthy"
        incident["recovery_steps"].append({
            "service": service,
            "action": playbook.get("action"),
            "status": "healthy",
            "health_check": health_result,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        incident["current_step_index"] += 1

    _finalize_incident(incident, status="resolved")
    return incident


def start_recovery(incident_id: str) -> dict[str, Any]:
    """Validate and start recovery for an existing incident."""
    incident = state.get_incident(incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail=f"Incident '{incident_id}' not found")

    if incident["status"] == "recovering":
        raise HTTPException(
            status_code=409,
            detail=f"Recovery is already in progress for incident '{incident_id}'",
        )

    if incident["status"] == "awaiting_approval":
        raise HTTPException(
            status_code=409,
            detail=f"Incident '{incident_id}' is currently paused awaiting approval",
        )

    if incident["status"] == "resolved":
        raise HTTPException(
            status_code=400,
            detail=f"Incident '{incident_id}' is already resolved",
        )

    return execute_recovery(incident)


def process_approval(
    approval_id: str,
    decision: str,
    reason: str | None = None,
) -> dict[str, Any]:
    """Process an approval decision (approve or reject) and resume or halt recovery."""
    approval = state.get_approval(approval_id)
    if not approval:
        raise HTTPException(status_code=404, detail=f"Approval '{approval_id}' not found")

    if approval["status"] != "pending":
        raise HTTPException(
            status_code=400,
            detail=f"Approval '{approval_id}' is already {approval['status']}",
        )

    if decision not in ("approve", "reject"):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid decision '{decision}'. Must be 'approve' or 'reject'.",
        )

    incident = state.get_incident(approval["incident_id"])
    if not incident:
        raise HTTPException(
            status_code=404,
            detail=f"Incident '{approval['incident_id']}' for approval '{approval_id}' not found",
        )

    now_iso = datetime.now(timezone.utc).isoformat()
    approval["status"] = "approved" if decision == "approve" else "rejected"
    approval["decided_at"] = now_iso
    approval["decision_reason"] = reason

    state.record_audit_event(
        incident_id=incident["id"],
        event_type=f"approval_{approval['status']}",
        service=approval["service"],
        details={
            "approval_id": approval_id,
            "decision": decision,
            "reason": reason,
        },
    )

    if decision == "reject":
        _finalize_incident(
            incident,
            status="aborted",
            failure_reason=reason or f"Approval rejected for '{approval['service']}'",
        )
        return {"approval": approval, "incident": incident}
    else:
        incident["status"] = "recovering"
        incident["pending_approval_id"] = None
        resumed_incident = execute_recovery(
            incident,
            approved_step_index=incident["current_step_index"],
        )
        return {"approval": approval, "incident": resumed_incident}

