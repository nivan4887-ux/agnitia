"""
BRIDGE – Unified SOS Incident Dispatcher and Monitoring Pipeline.

Single authoritative pathway for creating SOS incidents from both manual triggers
and automated monitors (HTTP health probes, external frontend build monitors).
Enforces deduplication, audit persistence, phone notifications via Telegram,
and integration with the recovery engine while strictly honoring approval gates.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from app import engine, notifications, risk_gate, state

logger = logging.getLogger("bridge.sos")


def get_active_incident_for_service(service: str) -> Optional[Dict[str, Any]]:
    """Return active (unresolved) incident for *service*, or None."""
    with state.state_lock:
        active_statuses = {"open", "recovering", "awaiting_approval"}
        for inc in reversed(state.incidents):
            if inc.get("failed_service") == service and inc.get("status") in active_statuses:
                return inc
        return None


def dispatch_sos_incident(
    service: str,
    reason: str,
    reporter: str = "automated_monitor",
    failure_type: str = "monitored_failure",
    metadata: Optional[Dict[str, Any]] = None,
    idempotency_key: Optional[str] = None,
    auto_trigger_recovery: bool = False,
) -> Dict[str, Any]:
    """Execute the unified SOS incident dispatch workflow.

    1. Checks idempotency and deduplicates against active unresolved failures on the same service.
    2. Allows new incident creation once prior incident is resolved/closed.
    3. Fails service, cascades dependencies, and persists incident + audit records.
    4. Dispatches mobile phone alert via Telegram Bot API with honest provider acceptance tracking.
    5. Optionally initiates sequential recovery while strictly honoring risk and approval gates.
    """
    clean_service = (service or "").strip()
    if not clean_service:
        raise ValueError("Target service name is required for SOS dispatch.")

    clean_reason = (reason or "Monitored failure detected by BRIDGE").strip()
    clean_reporter = (reporter or "automated_monitor").strip()
    key = (idempotency_key or "").strip()

    # 1. Check idempotency key if provided
    if key:
        cached = state.get_sos_idempotency_record(key)
        if cached:
            return {
                **cached,
                "duplicate": True,
                "message": f"Duplicate SOS submission detected. Returning existing incident '{cached.get('incident_id')}'.",
            }

    # 2. Check for active unresolved incident on this service (deduplication)
    active_inc = get_active_incident_for_service(clean_service)
    if active_inc is not None:
        logger.info(
            "SOS alert deduplicated: active incident %s already open for service '%s'.",
            active_inc.get("id"),
            clean_service,
        )
        dedup_response = {
            "status": "ok",
            "incident_id": active_inc.get("id"),
            "current_status": active_inc.get("status"),
            "incident": active_inc,
            "service": clean_service,
            "message": (
                f"Active failure already exists for service '{clean_service}' (Incident: {active_inc.get('id')}). "
                f"Duplicate notification alert suppressed."
            ),
            "duplicate": True,
            "notification": {
                "provider": "telegram",
                "accepted": False,
                "status": "deduplicated_active_failure",
                "error": None,
            },
        }
        if key:
            state.record_sos_idempotency(key, dedup_response)
        return dedup_response

    # 3. Create incident through standard fail_service workflow
    incident = state.fail_service(clean_service)
    incident["failure_type"] = failure_type
    if metadata:
        incident["metadata"] = metadata

    # 4. Record SOS audit event
    audit_evt = state.record_audit_event(
        incident_id=incident["id"],
        event_type="sos_triggered",
        service=clean_service,
        details={
            "reason": clean_reason,
            "reporter": clean_reporter,
            "failure_type": failure_type,
            "idempotency_key": key or None,
            "affected_services": incident.get("affected_services", []),
            "severity": "P1_CRITICAL",
            "metadata": metadata or {},
        },
    )

    # 5. Dispatch phone notification via Telegram Bot API
    notif_result = notifications.notify_sos_destination(
        incident_id=incident["id"],
        service=clean_service,
        reason=clean_reason,
        current_status=incident["status"],
        affected_services=incident.get("affected_services", []),
        failure_type=failure_type,
    )

    # 5b. Dispatch automated Twilio emergency voice call if configured
    notif_cfg = notifications.get_notification_config()
    if notif_cfg.get("twilio_configured"):
        call_result = notifications.notify_twilio_voice_call(
            incident_id=incident["id"],
            service=clean_service,
            reason=clean_reason,
        )
        state.record_audit_event(
            incident_id=incident["id"],
            event_type="sos_voice_call_dispatched" if call_result.get("accepted") else "sos_voice_call_failed",
            service=clean_service,
            details=call_result,
        )
        incident["voice_call_status"] = call_result

    # Record notification audit log
    state.record_audit_event(
        incident_id=incident["id"],
        event_type="sos_notification_dispatched" if notif_result["accepted"] else "sos_notification_failed",
        service=clean_service,
        details=notif_result,
    )

    incident["notification_status"] = notif_result

    state.save_incident(incident)

    # 6. Recovery workflow integration (if requested)
    recovery_initiated = False
    if auto_trigger_recovery:
        try:
            # Starts recovery which analyzes readiness and halts at awaiting_approval if high_risk
            updated_incident = engine.start_recovery(incident["id"])
            incident = updated_incident
            recovery_initiated = True
        except Exception as rec_exc:
            logger.warning("Automated recovery initiation encountered exception: %s", rec_exc)

    response = {
        "status": "ok",
        "incident_id": incident["id"],
        "current_status": incident["status"],
        "incident": incident,
        "service": clean_service,
        "message": f"SOS incident created for '{clean_service}'. Current status is {incident['status']}.",
        "audit_event_id": audit_evt["id"],
        "notification": notif_result,
        "duplicate": False,
        "recovery_initiated": recovery_initiated,
    }

    if key:
        state.record_sos_idempotency(key, response)

    return response

