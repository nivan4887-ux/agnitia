"""
RecoverOps – Recovery Confidence & Risk Gate.

Performs deterministic, rule-based assessment of recovery readiness,
evaluating dependency health, graph cycles, blast radius, high-risk playbooks,
and state staleness.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any

from app import graph, playbooks, state


def compute_state_fingerprint(incident_id: str | None = None) -> str:
    """Compute a deterministic fingerprint of current service states and incident state."""
    with state.state_lock:
        data: dict[str, Any] = {
            "services": {k: state.service_states[k] for k in sorted(state.service_states.keys())},
        }
        if incident_id:
            inc = state.get_incident(incident_id)
            if inc:
                data["incident_status"] = inc.get("status")
                data["current_step_index"] = inc.get("current_step_index")
                data["pending_approval_id"] = inc.get("pending_approval_id")

        serialized = json.dumps(data, sort_keys=True)
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()[:16]


def assess_recovery_readiness(
    service_name: str | None = None,
    incident_id: str | None = None,
    expected_state_fingerprint: str | None = None,
) -> dict[str, Any]:
    """Assess recovery readiness deterministically using graph topology, playbooks, and state."""
    with state.state_lock:
        dep_graph = graph.build_graph()
        now_iso = datetime.now(timezone.utc).isoformat()
        current_fingerprint = compute_state_fingerprint(incident_id)

        findings: list[dict[str, Any]] = []
        required_approvals: list[dict[str, Any]] = []
        blocked_actions: list[dict[str, Any]] = []

        # 1. Resolve Target Service & Incident Context
        incident: dict[str, Any] | None = None
        target_service = service_name

        if incident_id:
            incident = state.get_incident(incident_id)
            if not incident:
                return {
                    "readiness_status": "BLOCKED",
                    "risk_level": "HIGH",
                    "summary": f"Incident '{incident_id}' not found.",
                    "findings": [{
                        "severity": "critical",
                        "code": "INCIDENT_NOT_FOUND",
                        "message": f"Incident '{incident_id}' does not exist in state.",
                        "affected_service": None,
                    }],
                    "required_approvals": [],
                    "blocked_actions": [{
                        "service": "unknown",
                        "reason": f"Incident '{incident_id}' not found",
                    }],
                    "recommended_next_step": "Verify incident ID or select an active incident.",
                    "assessed_at": now_iso,
                    "state_fingerprint": current_fingerprint,
                }
            target_service = incident["failed_service"]

        if not target_service:
            return {
                "readiness_status": "BLOCKED",
                "risk_level": "HIGH",
                "summary": "No target service or incident provided for assessment.",
                "findings": [{
                    "severity": "critical",
                    "code": "MISSING_TARGET",
                    "message": "Specify a valid service name or incident ID to assess recovery readiness.",
                    "affected_service": None,
                }],
                "required_approvals": [],
                "blocked_actions": [],
                "recommended_next_step": "Select a target service to evaluate.",
                "assessed_at": now_iso,
                "state_fingerprint": current_fingerprint,
            }

        # 2. Staleness Check
        is_stale = False
        if expected_state_fingerprint and expected_state_fingerprint != current_fingerprint:
            is_stale = True
            findings.append({
                "severity": "warning",
                "code": "STALE_ASSESSMENT",
                "message": "System state or incident status changed since previous assessment.",
                "affected_service": target_service,
            })

        # 3. Target Service Validity Check
        if target_service not in dep_graph.nodes:
            findings.append({
                "severity": "critical",
                "code": "INVALID_SERVICE",
                "message": f"Target service '{target_service}' is not defined in dependency topology.",
                "affected_service": target_service,
            })
            return {
                "readiness_status": "BLOCKED",
                "risk_level": "HIGH",
                "target_service": target_service,
                "summary": f"Service '{target_service}' is invalid.",
                "findings": findings,
                "required_approvals": [],
                "blocked_actions": [{
                    "service": target_service,
                    "reason": "Unknown service not in topology graph",
                }],
                "recommended_next_step": "Check topology configuration for valid service identifiers.",
                "assessed_at": now_iso,
                "state_fingerprint": current_fingerprint,
            }

        # 4. Cycle Detection Check
        cycles = graph.detect_cycles(dep_graph)
        if cycles:
            findings.append({
                "severity": "critical",
                "code": "CYCLE_DETECTED",
                "message": f"Circular dependency cycle detected in topology: {cycles}",
                "affected_service": target_service,
            })
            return {
                "readiness_status": "BLOCKED",
                "risk_level": "HIGH",
                "target_service": target_service,
                "summary": "Dependency graph contains circular cycles.",
                "findings": findings,
                "required_approvals": [],
                "blocked_actions": [{
                    "service": target_service,
                    "reason": f"Cyclic dependency detected: {cycles}",
                }],
                "recommended_next_step": "Resolve topology cycle in graph definitions before initiating recovery.",
                "assessed_at": now_iso,
                "state_fingerprint": current_fingerprint,
            }

        # 5. Determine Recovery Sequence & Downstream Blast Radius
        recovery_order = graph.recovery_order(dep_graph, target_service)
        downstream = graph.get_downstream_dependents(dep_graph, target_service)

        findings.append({
            "severity": "info",
            "code": "PLAN_SEQUENCE",
            "message": f"Topological recovery sequence calculated: {' -> '.join(recovery_order)}",
            "affected_service": target_service,
        })

        # 6. Check Upstream Prerequisites for Target Service
        # If any upstream prerequisite of the target service is NOT healthy,
        # and is NOT part of the recovery order, the plan is blocked because
        # the target service cannot safely start until upstream dependencies are healthy.
        upstream_prereqs = graph.get_prerequisites(dep_graph, target_service)
        unhealthy_upstream = [
            p for p in upstream_prereqs
            if state.service_states.get(p) != "healthy" and p not in recovery_order
        ]

        if unhealthy_upstream:
            for u in unhealthy_upstream:
                findings.append({
                    "severity": "error",
                    "code": "UNHEALTHY_UPSTREAM_DEPENDENCY",
                    "message": (
                        f"Target service '{target_service}' depends on '{u}', "
                        f"which is currently in state '{state.service_states.get(u)}'."
                    ),
                    "affected_service": u,
                })
                blocked_actions.append({
                    "service": target_service,
                    "reason": f"Upstream dependency '{u}' is unhealthy ({state.service_states.get(u)})",
                })

        # 7. Check Incident Lifecycle State (if incident provided)
        if incident:
            inc_status = incident.get("status")
            if inc_status == "resolved":
                findings.append({
                    "severity": "info",
                    "code": "INCIDENT_RESOLVED",
                    "message": f"Incident '{incident['id']}' is already resolved.",
                    "affected_service": target_service,
                })
                return {
                    "readiness_status": "READY",
                    "risk_level": "LOW",
                    "target_service": target_service,
                    "recovery_order": recovery_order,
                    "summary": f"Incident '{incident['id']}' is already resolved and all services are healthy.",
                    "findings": findings,
                    "required_approvals": [],
                    "blocked_actions": [],
                    "recommended_next_step": "No action needed. System is operating normally.",
                    "assessed_at": now_iso,
                    "state_fingerprint": current_fingerprint,
                }
            elif inc_status == "recovering":
                findings.append({
                    "severity": "warning",
                    "code": "RECOVERY_IN_PROGRESS",
                    "message": f"Incident '{incident['id']}' is currently executing recovery steps.",
                    "affected_service": target_service,
                })
                blocked_actions.append({
                    "service": target_service,
                    "reason": "Recovery is actively in progress",
                })
            elif inc_status == "awaiting_approval":
                findings.append({
                    "severity": "warning",
                    "code": "APPROVAL_PENDING",
                    "message": (
                        f"Incident '{incident['id']}' is paused waiting for operator approval "
                        f"(Approval ID: {incident.get('pending_approval_id')})."
                    ),
                    "affected_service": target_service,
                })

        # 8. Check Playbooks & High-Risk Approval Requirements in Sequence
        has_high_risk = False
        for svc in recovery_order:
            playbook = playbooks.get_playbook(svc)
            risk = playbook.get("risk_level", "safe")
            if risk == "high_risk":
                has_high_risk = True
                # Check if already approved in this incident
                is_approved = False
                if incident:
                    is_approved = any(
                        a["incident_id"] == incident["id"]
                        and a["service"] == svc
                        and a["status"] == "approved"
                        for a in state.approvals
                    )
                if not is_approved:
                    req_approval = {
                        "service": svc,
                        "action": playbook.get("action", "unknown_action"),
                        "risk_level": "high_risk",
                        "description": playbook.get("description", ""),
                    }
                    required_approvals.append(req_approval)
                    findings.append({
                        "severity": "warning",
                        "code": "HIGH_RISK_ACTION_REQUIRED",
                        "message": (
                            f"Service '{svc}' recovery action '{playbook.get('action')}' "
                            f"is classified as HIGH RISK and will require manual human approval."
                        ),
                        "affected_service": svc,
                    })

        # 9. Compute Overall Readiness Status, Risk Level, Summary, and Next Step
        if blocked_actions or unhealthy_upstream:
            readiness_status = "BLOCKED"
        elif required_approvals or (incident and incident.get("status") == "awaiting_approval"):
            readiness_status = "NEEDS_APPROVAL"
        else:
            readiness_status = "READY"

        # Risk level determination
        if has_high_risk or len(downstream) >= 3 or blocked_actions:
            risk_level = "HIGH"
        elif len(downstream) > 0:
            risk_level = "MEDIUM"
        else:
            risk_level = "LOW"

        # Summary and Next Step Synthesis
        if readiness_status == "BLOCKED":
            summary = (
                f"Recovery is BLOCKED for '{target_service}'. "
                f"{len(blocked_actions)} blocker(s) identified, including unhealthy upstream dependencies."
            )
            recommended_next_step = (
                f"Resolve upstream dependency issues ({', '.join(unhealthy_upstream)}) "
                "before starting recovery for this service."
            )
        elif readiness_status == "NEEDS_APPROVAL":
            summary = (
                f"Recovery plan for '{target_service}' is validated but REQUIRES HUMAN APPROVAL "
                f"for {len(required_approvals)} high-risk operation(s)."
            )
            recommended_next_step = (
                "Review high-risk playbooks in the Approval Center and authorize the recovery step."
            )
        else:
            summary = (
                f"Recovery plan for '{target_service}' is READY with {risk_level} risk. "
                "All upstream prerequisites and safe playbook gates are verified."
            )
            recommended_next_step = "Proceed with automated sequential recovery execution."

        return {
            "readiness_status": readiness_status,
            "risk_level": risk_level,
            "target_service": target_service,
            "recovery_order": recovery_order,
            "downstream_impact": downstream,
            "summary": summary,
            "findings": findings,
            "required_approvals": required_approvals,
            "blocked_actions": blocked_actions,
            "recommended_next_step": recommended_next_step,
            "is_stale": is_stale,
            "state_fingerprint": current_fingerprint,
            "assessed_at": now_iso,
        }

