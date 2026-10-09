"""
BRIDGE – Recovery execution engine.

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

    state.save_incident(incident)
    state.save_service_states(state.service_states)


def execute_recovery(
    incident: dict[str, Any],
    approved_step_index: int | None = None,
    job_id: str | None = None,
) -> dict[str, Any]:
    """Execute sequential recovery plan for *incident* with lifecycle stage tracking."""
    if not job_id:
        job_id = incident.get("active_job_id")

    try:
        with state.state_lock:
            dep_graph = graph.build_graph()

            if incident.get("recovery_started_at") is None:
                incident["recovery_started_at"] = datetime.now(timezone.utc).isoformat()

            if not incident.get("recovery_order"):
                order = graph.recovery_order(dep_graph, incident["failed_service"])
                incident["recovery_order"] = order

            incident["status"] = "recovering"

            # 1. DETECTING & ANALYZING Stage Metadata
            prereqs_initial = graph.get_prerequisites(dep_graph, incident["failed_service"])
            downstream_initial = graph.get_downstream_dependents(dep_graph, incident["failed_service"])
            root_cause_info = {
                "failed_service": incident["failed_service"],
                "prerequisites": prereqs_initial,
                "downstream_impact": downstream_initial,
                "recovery_order": incident["recovery_order"],
            }

            if job_id:
                state.update_recovery_job(
                    job_id,
                    stage="analyzing",
                    status="recovering",
                    current_step_index=incident["current_step_index"],
                    current_step=incident["recovery_order"][incident["current_step_index"]]
                    if incident["current_step_index"] < len(incident["recovery_order"])
                    else incident["failed_service"],
                    root_cause=root_cause_info,
                    log_message=f"[ANALYZING] Topologically evaluated DAG for '{incident['failed_service']}'. Recovery sequence: {' → '.join(incident['recovery_order'])}.",
                )

            state.record_audit_event(
                incident_id=incident["id"],
                event_type="recovery_started",
                service=incident["failed_service"],
                details={
                    "recovery_order": incident["recovery_order"],
                    "starting_step_index": incident["current_step_index"],
                    "job_id": job_id,
                },
            )

        while True:
            with state.state_lock:
                if incident["current_step_index"] >= len(incident["recovery_order"]):
                    break
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
                    if job_id:
                        state.update_recovery_job(
                            job_id,
                            stage="failed",
                            status="failed",
                            error=reason,
                            log_message=f"[FAILED] Dependency check failed: {reason}",
                            completed=True,
                        )
                    _finalize_incident(incident, status="failed", failure_reason=reason)
                    return incident

                state.record_audit_event(
                    incident_id=incident["id"],
                    event_type="dependency_check_passed",
                    service=service,
                    details={"service": service, "prerequisites": prereqs},
                )

                # 2. Planning & Risk Classification
                playbook = playbooks.get_playbook(service)
                risk_level = playbook.get("risk_level", "safe")
                strategy_type = "runtime"

                if job_id:
                    state.update_recovery_job(
                        job_id,
                        stage="planning",
                        action=playbook.get("action"),
                        recovery_strategy={
                            "type": strategy_type,
                            "service": service,
                            "action": playbook.get("action"),
                            "risk_level": risk_level,
                            "description": playbook.get("description", ""),
                        },
                        log_message=f"[PLANNING] Selected allowlisted {strategy_type} playbook '{playbook.get('action')}' (Risk: {risk_level.upper()}) for '{service}'.",
                    )

                if risk_level == "high_risk" and approved_step_index != step_idx:
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
                        if job_id:
                            state.update_recovery_job(
                                job_id,
                                stage="awaiting_approval",
                                status="awaiting_approval",
                                action=playbook.get("action"),
                                log_message=f"[AWAITING_APPROVAL] High-risk action '{playbook.get('action')}' on '{service}' paused for operator sign-off.",
                            )
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
                        state.save_incident(incident)
                        return incident

                # Mark service state as recovering & transition to EXECUTING
                state.service_states[service] = "recovering"
                if job_id:
                    state.update_recovery_job(
                        job_id,
                        stage="executing",
                        status="recovering",
                        current_step=service,
                        current_step_index=step_idx,
                        action=playbook.get("action"),
                        log_message=f"[EXECUTING] Executing recovery action '{playbook.get('action')}' on '{service}' (Step {step_idx + 1}/{len(incident['recovery_order'])})...",
                    )
                state.save_incident(incident)
                state.save_service_states(state.service_states)

            # 3. Playbook Action Execution
            try:
                action_result = playbooks.execute_simulated_action(service, playbook)
            except Exception as act_exc:
                with state.state_lock:
                    state.service_states[service] = "failed"
                    err_msg = f"Unhandled exception during recovery of '{service}': {act_exc}"
                    incident["recovery_steps"].append({
                        "service": service,
                        "status": "failed",
                        "reason": err_msg,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    })
                    if job_id:
                        state.update_recovery_job(
                            job_id,
                            stage="failed",
                            status="failed",
                            error=err_msg,
                            log_message=err_msg,
                            completed=True,
                        )
                    _finalize_incident(incident, status="failed", failure_reason=err_msg)
                    return incident

            with state.state_lock:
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
                    if job_id:
                        state.update_recovery_job(
                            job_id,
                            stage="failed",
                            status="failed",
                            error=action_result.get("message"),
                            log_message=f"Recovery action failed: {action_result.get('message')}",
                            completed=True,
                        )
                    _finalize_incident(incident, status="failed", failure_reason=action_result.get("message"))
                    return incident

                if job_id:
                    state.update_recovery_job(
                        job_id,
                        stage="verifying",
                        log_message=f"Action '{playbook.get('action')}' executed successfully on '{service}'. Initiating live health check verification probes...",
                    )

            # 4. Post-Recovery Health Check Verification
            try:
                health_result = playbooks.run_simulated_health_check(service, playbook)
            except Exception as hc_exc:
                with state.state_lock:
                    state.service_states[service] = "failed"
                    err_msg = f"Unhandled exception during recovery of '{service}': {hc_exc}"
                    incident["recovery_steps"].append({
                        "service": service,
                        "status": "failed",
                        "reason": err_msg,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    })
                    if job_id:
                        state.update_recovery_job(
                            job_id,
                            stage="failed",
                            status="failed",
                            error=err_msg,
                            log_message=err_msg,
                            completed=True,
                        )
                    _finalize_incident(incident, status="failed", failure_reason=err_msg)
                    return incident

            with state.state_lock:
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
                    if job_id:
                        state.update_recovery_job(
                            job_id,
                            stage="failed",
                            status="failed",
                            error=health_result.get("message"),
                            health_check_result=health_result,
                            log_message=f"Health check verification failed: {health_result.get('message')}",
                            completed=True,
                        )
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
                if job_id:
                    state.update_recovery_job(
                        job_id,
                        health_check_result=health_result,
                        log_message=f"Health verification passed for '{service}': {health_result.get('message')}",
                    )
                incident["current_step_index"] += 1
                state.save_incident(incident)
                state.save_service_states(state.service_states)

        with state.state_lock:
            if job_id:
                state.update_recovery_job(
                    job_id,
                    stage="succeeded",
                    status="resolved",
                    completed=True,
                    log_message="All recovery sequence steps and health verification probes verified successfully.",
                )
            _finalize_incident(incident, status="resolved")
            return incident

    except Exception as setup_exc:
        with state.state_lock:
            err_msg = f"Recovery setup exception: {setup_exc}"
            if job_id:
                state.update_recovery_job(
                    job_id,
                    stage="failed",
                    status="failed",
                    error=err_msg,
                    completed=True,
                )
            _finalize_incident(incident, status="failed", failure_reason=err_msg)
            return incident


def start_recovery(incident_id: str) -> dict[str, Any]:
    """Validate and start recovery for an existing incident."""
    with state.state_lock:
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

        # If retrying a failed or aborted incident, cleanly reset step pointers
        if incident["status"] in ("failed", "aborted"):
            incident["current_step_index"] = 0
            incident["recovery_steps"] = []
            incident["recovery_started_at"] = None
            incident["recovery_completed_at"] = None
            incident["total_recovery_duration_seconds"] = None
            incident["pending_approval_id"] = None

        incident["status"] = "recovering"
        if incident.get("recovery_started_at") is None:
            incident["recovery_started_at"] = datetime.now(timezone.utc).isoformat()

        job = state.create_recovery_job(
            incident_id=incident_id,
            service=incident["failed_service"],
            recovery_order=incident.get("recovery_order", []),
        )
        incident["active_job_id"] = job["id"]

    return execute_recovery(incident, job_id=job["id"])


def process_approval(
    approval_id: str,
    decision: str,
    reason: str | None = None,
) -> dict[str, Any]:
    """Process an approval decision (approve or reject) and resume or halt recovery."""
    with state.state_lock:
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

        if incident["status"] != "awaiting_approval":
            raise HTTPException(
                status_code=400,
                detail=f"Incident '{incident['id']}' is not awaiting approval (current status: '{incident['status']}')",
            )

        if incident.get("pending_approval_id") != approval_id:
            raise HTTPException(
                status_code=400,
                detail=f"Approval '{approval_id}' is not the active pending approval for incident '{incident['id']}'",
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
        state.save_approval(approval)
        state.save_incident(incident)

        job_id = incident.get("active_job_id")

        if decision == "reject":
            if job_id:
                state.update_recovery_job(
                    job_id,
                    stage="aborted",
                    status="aborted",
                    error=reason or f"Approval rejected for '{approval['service']}'",
                    log_message=f"Recovery aborted due to operator rejection: {reason}",
                    completed=True,
                )
            _finalize_incident(
                incident,
                status="aborted",
                failure_reason=reason or f"Approval rejected for '{approval['service']}'",
            )
            return {"approval": approval, "incident": incident}
        else:
            incident["status"] = "recovering"
            incident["pending_approval_id"] = None
            if job_id:
                state.update_recovery_job(
                    job_id,
                    stage="running",
                    status="recovering",
                    log_message=f"Approval granted by operator: {reason or 'Approved'}. Resuming recovery sequence...",
                )

    resumed_incident = execute_recovery(
        incident,
        approved_step_index=incident["current_step_index"],
        job_id=job_id,
    )
    return {"approval": approval, "incident": resumed_incident}
