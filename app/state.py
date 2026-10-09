"""
BRIDGE – In-memory state management for services, incidents, approvals,
audit logs, and simulation overrides.
"""

from __future__ import annotations

import logging
import threading
import uuid
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger("bridge.state")

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
recovery_jobs: dict[str, dict[str, Any]] = {}
_sos_idempotency_cache: dict[str, dict[str, Any]] = {}


def get_sos_idempotency_record(key: str) -> dict[str, Any] | None:
    """Retrieve cached SOS incident response by idempotency key."""
    with state_lock:
        return _sos_idempotency_cache.get(key)


def record_sos_idempotency(key: str, data: dict[str, Any]) -> None:
    """Cache SOS incident response by idempotency key."""
    with state_lock:
        import copy
        _sos_idempotency_cache[key] = copy.deepcopy(data)


def reset_state() -> None:
    """Reset all in-memory state – useful for tests."""
    global service_states, incidents, approvals, audit_log, simulation_overrides, recovery_jobs
    with state_lock:
        service_states.clear()
        service_states.update(_new_state())
        incidents.clear()
        approvals.clear()
        audit_log.clear()
        simulation_overrides.clear()
        recovery_jobs.clear()
        _sos_idempotency_cache.clear()
        try:
            from app import demo_store
            demo_store.reset_demo_store()
        except ImportError:
            pass


def restore_state_from_db() -> bool:
    """Safely restore persisted state from MongoDB into in-memory containers.

    Loads state via db.load_all_state() and updates in-memory containers in place,
    preserving container identities. Falls back gracefully if MongoDB is unavailable
    or unconfigured. Validates types and required identifiers to prevent corrupting state.
    """
    try:
        from app import db
        data = db.load_all_state()
    except Exception as exc:
        logger.warning(
            "Failed to load state from MongoDB during startup: %s. Continuing in in-memory mode.",
            exc,
        )
        return False

    if not isinstance(data, dict) or not data:
        logger.info("No prior state found in MongoDB. Retaining default in-memory state.")
        return False

    restored_any = False
    with state_lock:
        # 1. Restore service states only if valid non-empty dict mapping strings to strings
        loaded_states = data.get("service_states")
        if isinstance(loaded_states, dict):
            valid_states = {
                str(k): str(v)
                for k, v in loaded_states.items()
                if isinstance(k, str) and k.strip() and isinstance(v, str) and v.strip()
            }
            if valid_states:
                service_states.clear()
                service_states.update(valid_states)
                restored_any = True

        # 2. Restore incidents only if valid dicts with non-empty 'id'
        loaded_incidents = data.get("incidents")
        if isinstance(loaded_incidents, list):
            valid_incidents = [
                inc for inc in loaded_incidents
                if isinstance(inc, dict) and isinstance(inc.get("id"), str) and inc["id"].strip()
            ]
            if valid_incidents:
                incidents.clear()
                incidents.extend(valid_incidents)
                restored_any = True

        # 3. Restore approvals only if valid dicts with non-empty 'id'
        loaded_approvals = data.get("approvals")
        if isinstance(loaded_approvals, list):
            valid_approvals = [
                appr for appr in loaded_approvals
                if isinstance(appr, dict) and isinstance(appr.get("id"), str) and appr["id"].strip()
            ]
            if valid_approvals:
                approvals.clear()
                approvals.extend(valid_approvals)
                restored_any = True

        # 4. Restore recovery jobs only if valid dicts with non-empty 'id'
        loaded_jobs = data.get("recovery_jobs")
        valid_jobs = {}
        if isinstance(loaded_jobs, dict):
            valid_jobs = {
                str(k): v
                for k, v in loaded_jobs.items()
                if isinstance(k, str) and k.strip() and isinstance(v, dict) and (v.get("id") == k or bool(v.get("id")))
            }
        elif isinstance(loaded_jobs, list):
            valid_jobs = {
                str(v["id"]): v
                for v in loaded_jobs
                if isinstance(v, dict) and isinstance(v.get("id"), str) and v["id"].strip()
            }
        if valid_jobs:
            recovery_jobs.clear()
            recovery_jobs.update(valid_jobs)
            restored_any = True

        # 5. Restore audit log only if valid dicts with non-empty 'id'
        loaded_audit = data.get("audit_log")
        if isinstance(loaded_audit, list):
            valid_audit = [
                evt for evt in loaded_audit
                if isinstance(evt, dict) and isinstance(evt.get("id"), str) and evt["id"].strip()
            ]
            if valid_audit:
                audit_log.clear()
                audit_log.extend(valid_audit)
                restored_any = True

        if restored_any:
            logger.info("Successfully restored state from MongoDB.")
        else:
            logger.info("No valid records found in MongoDB payload. Retaining default in-memory state.")
        return restored_any


def save_incident(incident: dict[str, Any]) -> bool:
    """Save an incident record to MongoDB. Returns True if persisted to DB, False if in-memory fallback."""
    try:
        from app import db
        persisted = bool(db.save_incident(incident))
        if not persisted:
            logger.debug("Incident %s held in-memory (database persistence unavailable).", incident.get("id"))
        return persisted
    except Exception as exc:
        logger.warning("Failed to persist incident %s: %s", incident.get("id"), exc)
        return False


def save_approval(approval: dict[str, Any]) -> bool:
    """Save an approval record to MongoDB. Returns True if persisted to DB, False if in-memory fallback."""
    try:
        from app import db
        persisted = bool(db.save_approval(approval))
        if not persisted:
            logger.debug("Approval %s held in-memory (database persistence unavailable).", approval.get("id"))
        return persisted
    except Exception as exc:
        logger.warning("Failed to persist approval %s: %s", approval.get("id"), exc)
        return False


def save_service_states(states: dict[str, str]) -> bool:
    """Save service states snapshot to MongoDB. Returns True if persisted to DB, False if in-memory fallback."""
    try:
        from app import db
        persisted = bool(db.save_service_states(states))
        if not persisted:
            logger.debug("Service states held in-memory (database persistence unavailable).")
        return persisted
    except Exception as exc:
        logger.warning("Failed to persist service states: %s", exc)
        return False


def save_recovery_job(job: dict[str, Any]) -> bool:
    """Save a recovery job to MongoDB. Returns True if persisted to DB, False if in-memory fallback."""
    try:
        from app import db
        persisted = bool(db.save_recovery_job(job))
        if not persisted:
            logger.debug("Recovery job %s held in-memory (database persistence unavailable).", job.get("id"))
        return persisted
    except Exception as exc:
        logger.warning("Failed to persist recovery job %s: %s", job.get("id"), exc)
        return False


def save_audit_event(event: dict[str, Any]) -> bool:
    """Save an audit event to MongoDB. Returns True if persisted to DB, False if in-memory fallback."""
    try:
        from app import db
        persisted = bool(db.save_audit_event(event))
        if not persisted:
            logger.debug("Audit event %s held in-memory (database persistence unavailable).", event.get("id"))
        return persisted
    except Exception as exc:
        logger.warning("Failed to persist audit event %s: %s", event.get("id"), exc)
        return False


def create_recovery_job(
    incident_id: str,
    service: str,
    recovery_order: list[str],
) -> dict[str, Any]:
    """Create a new tracked recovery job."""
    job_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()
    job = {
        "id": job_id,
        "incident_id": incident_id,
        "service": service,
        "stage": "detecting",  # "detecting" | "analyzing" | "planning" | "reviewing" | "awaiting_approval" | "executing" | "running" | "verifying" | "succeeded" | "failed" | "aborted"
        "status": "recovering",
        "current_step": recovery_order[0] if recovery_order else service,
        "current_step_index": 0,
        "total_steps": len(recovery_order),
        "recovery_order": recovery_order,
        "action": None,
        "evidence": {
            "incident_id": incident_id,
            "target_service": service,
            "detected_at": now_iso,
        },
        "root_cause": None,
        "recovery_strategy": None,
        "changeset_id": None,
        "stage_history": [
            {
                "stage": "detecting",
                "timestamp": now_iso,
                "message": f"Incident detected on service '{service}'. Initiating telemetry analysis.",
            }
        ],
        "logs": [f"[{now_iso}] Recovery job {job_id} queued for incident {incident_id}."],
        "health_check_result": None,
        "created_at": now_iso,
        "updated_at": now_iso,
        "completed_at": None,
        "error": None,
    }
    recovery_jobs[job_id] = job
    save_recovery_job(job)
    return job


def get_recovery_job(job_id: str) -> dict[str, Any] | None:
    """Retrieve a recovery job by its ID."""
    return recovery_jobs.get(job_id)


def get_jobs_for_incident(incident_id: str) -> list[dict[str, Any]]:
    """Get all recovery jobs associated with an incident."""
    return [job for job in recovery_jobs.values() if job.get("incident_id") == incident_id]


def update_recovery_job(
    job_id: str,
    stage: str | None = None,
    status: str | None = None,
    current_step: str | None = None,
    current_step_index: int | None = None,
    action: str | None = None,
    log_message: str | None = None,
    health_check_result: dict[str, Any] | None = None,
    evidence: dict[str, Any] | None = None,
    root_cause: dict[str, Any] | None = None,
    recovery_strategy: dict[str, Any] | None = None,
    changeset_id: str | None = None,
    error: str | None = None,
    completed: bool = False,
) -> dict[str, Any] | None:
    """Update progress and stage of a recovery job."""
    job = recovery_jobs.get(job_id)
    if not job:
        return None

    now_iso = datetime.now(timezone.utc).isoformat()
    if stage is not None:
        if job.get("stage") != stage:
            if "stage_history" not in job:
                job["stage_history"] = []
            job["stage_history"].append({
                "stage": stage,
                "timestamp": now_iso,
                "message": log_message or f"Transitioned to stage: {stage}",
            })
        job["stage"] = stage
    if status is not None:
        job["status"] = status
    if current_step is not None:
        job["current_step"] = current_step
    if current_step_index is not None:
        job["current_step_index"] = current_step_index
    if action is not None:
        job["action"] = action
    if health_check_result is not None:
        job["health_check_result"] = health_check_result
    if evidence is not None:
        job["evidence"] = evidence
    if root_cause is not None:
        job["root_cause"] = root_cause
    if recovery_strategy is not None:
        job["recovery_strategy"] = recovery_strategy
    if changeset_id is not None:
        job["changeset_id"] = changeset_id
    if error is not None:
        job["error"] = error
    if log_message:
        job["logs"].append(f"[{now_iso}] {log_message}")
    if completed:
        job["completed_at"] = now_iso

    job["updated_at"] = now_iso
    save_recovery_job(job)
    return job



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
    save_audit_event(event)

    if incident_id:
        for inc in incidents:
            if inc["id"] == incident_id:
                if "audit_log" not in inc:
                    inc["audit_log"] = []
                inc["audit_log"].append(event)
                save_incident(inc)
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
    save_approval(approval)
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
        save_incident(incident)
        save_service_states(service_states)

        record_audit_event(
            incident_id=incident_id,
            event_type="incident_created",
            service=service_name,
            details={"affected_services": affected},
        )

        return incident
