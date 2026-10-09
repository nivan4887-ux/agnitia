"""
BRIDGE – Backend Recovery & Intelligent Dependency Governance Engine – FastAPI application.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
import json
from typing import Any, Optional

import os
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app import build_monitor, code_changes, data_integrity, db, demo_store, engine, graph, live_adapter, notifications, risk_gate, sos, state, supervisor


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Safe MongoDB startup restoration
    state.restore_state_from_db()
    yield


app = FastAPI(
    title="BRIDGE",
    description=(
        "Backend Recovery & Intelligent Dependency Governance Engine — "
        "dependency-aware incident recovery platform that detects service failures, "
        "analyzes upstream dependencies, coordinates controlled recovery workflows, "
        "verifies service health, and maintains an auditable record of recovery operations."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(demo_store.router)

dep_graph = graph.build_graph()



# ---------------------------------------------------------------------------
# Request Schemas
# ---------------------------------------------------------------------------

class ApprovalDecisionRequest(BaseModel):
    reason: Optional[str] = None


class SimulationConfigRequest(BaseModel):
    service: str
    action_success: bool = True
    health_check_success: bool = True
    risk_level: Optional[str] = None
    action_error: Optional[str] = None
    health_check_error: Optional[str] = None


class RecoveryAssessRequest(BaseModel):
    service: Optional[str] = None
    incident_id: Optional[str] = None
    expected_state_fingerprint: Optional[str] = None


class ProposeChangeSetRequest(BaseModel):
    title: str
    description: str
    file_patches: dict[str, str]
    service: str = "backend_api"
    incident_id: Optional[str] = None


class FileReviewRequest(BaseModel):
    file_path: str
    decision: str  # "accepted" | "rejected" | "pending"


class SOSIncidentRequest(BaseModel):
    service: str = "backend_api"
    reason: Optional[str] = "Manual operator emergency SOS trigger"
    reporter: Optional[str] = "operator"
    idempotency_key: Optional[str] = None


# ---------------------------------------------------------------------------
# Existing Milestone 1 Routes (Preserved)
# ---------------------------------------------------------------------------

@app.get("/")
def health():
    """Basic health check."""
    return {
        "status": "ok",
        "service": "BRIDGE",
        "tagline": "Detect. Recover. Verify.",
        "full_form": "Backend Recovery & Intelligent Dependency Governance Engine",
        "database": "connected" if db.is_connected() else "in_memory_fallback",
    }


@app.get("/db/status")
def db_status():
    """Return MongoDB persistence layer status."""
    return db.ping()


@app.get("/services")
def list_services():
    """Return current state of every service."""
    return {"services": state.service_states}


@app.get("/dependencies")
def list_dependencies():
    """Return the dependency graph as lists of nodes and edges."""
    return {
        "nodes": list(dep_graph.nodes),
        "edges": [{"from": u, "to": v} for u, v in dep_graph.edges],
    }


@app.post("/simulate/fail/{service_name}")
def simulate_failure(service_name: str):
    """Simulate a failure in *service_name* and cascade to dependents."""
    if service_name not in dep_graph.nodes:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown service: '{service_name}'",
        )
    sos_res = sos.dispatch_sos_incident(
        service=service_name,
        reason=f"Manual failure simulation injected on '{service_name}'",
        reporter="manual_simulation",
        failure_type="simulated_failure",
    )
    return {"incident": sos_res.get("incident")}


@app.post("/incidents/sos")
@app.post("/sos")
def trigger_sos_incident(payload: Optional[SOSIncidentRequest] = None):
    """Trigger an emergency Priority-1 SOS incident for a service through the unified pipeline.

    Validates target service, ensures idempotent execution against rapid repeated clicks,
    deduplicates against active failures, persists to MongoDB, dispatches Telegram mobile
    alerts, and honors approval gates.
    """
    data = payload or SOSIncidentRequest()
    service = (data.service or "").strip()

    if not service:
        raise HTTPException(
            status_code=400,
            detail="Target service name is required for SOS alert.",
        )

    if service not in dep_graph.nodes:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown service '{service}'. Valid services: {list(dep_graph.nodes)}",
        )

    reason = (data.reason or "Manual operator emergency SOS trigger").strip()
    reporter = (data.reporter or "operator").strip()
    idempotency_key = (data.idempotency_key or "").strip()

    result = sos.dispatch_sos_incident(
        service=service,
        reason=reason,
        reporter=reporter,
        failure_type="manual_sos",
        idempotency_key=idempotency_key or None,
        auto_trigger_recovery=False,
    )

    return result


@app.post("/monitors/frontend-build/check")
def check_frontend_build_endpoint(auto_trigger: bool = Query(True)):
    """Run external frontend build/TypeScript verification and trigger SOS on failure."""
    return build_monitor.check_frontend_build(auto_trigger_sos=auto_trigger)


@app.post("/monitors/frontend-build/simulate-lifecycle")
def simulate_frontend_syntax_lifecycle_endpoint():
    """Execute end-to-end 5-step verification lifecycle for frontend syntax error detection and recovery."""
    return build_monitor.run_disposable_syntax_error_lifecycle()


@app.post("/monitors/frontend-build/inject-syntax-error")
def inject_syntax_error_endpoint():
    """Introduce a controlled syntax error in a disposable test copy."""
    return build_monitor.inject_controlled_syntax_error()


@app.post("/monitors/frontend-build/restore")
def restore_frontend_source_endpoint():
    """Restore the source by safely removing the disposable test copy."""
    return build_monitor.restore_disposable_source()


@app.post("/monitors/frontend-build/resolve/{incident_id}")
def resolve_frontend_incident_endpoint(incident_id: str):
    """Confirm the incident and audit history reflect recovery."""
    return build_monitor.resolve_frontend_build_incident(incident_id=incident_id)


@app.get("/monitors/frontend-build/status")
def get_frontend_build_status():
    """Return health and status of the frontend build environment."""
    return {
        "frontend_dir": build_monitor.FRONTEND_DIR,
        "exists": os.path.isdir(build_monitor.FRONTEND_DIR),
        "disposable_test_file_present": os.path.isfile(build_monitor.CONTROLLED_DISPOSABLE_FILE),
    }



@app.get("/notifications/status")
def get_notification_status():
    """Return mobile phone notification gateway configuration status."""
    return notifications.get_notification_config()


@app.post("/notifications/test")
def test_notification():
    """Trigger a test emergency SOS alert to the configured phone destination."""
    return notifications.notify_sos_destination(
        incident_id="INC-ALARM-TEST",
        service="backend_api",
        reason="Manual Verification: BRIDGE Real-Time Mobile Alarm Test",
        current_status="open",
        affected_services=["backend_api", "order_service", "website"],
        failure_type="manual_alarm_test",
    )


@app.post("/notifications/call-test")
def test_voice_call_notification():
    """Trigger a test emergency automated voice call via Twilio."""
    return notifications.notify_twilio_voice_call(
        incident_id="INC-CALL-TEST",
        service="backend_api",
        reason="Manual Verification: BRIDGE Voice Siren Test",
    )


@app.get("/incidents")
def list_incidents():
    """Return all recorded incidents."""
    return {"incidents": state.incidents}


@app.get("/recovery/plan/{service_name}")
def recovery_plan(service_name: str):
    """Return a dependency-aware recovery order for *service_name*."""
    if service_name not in dep_graph.nodes:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown service: '{service_name}'",
        )

    cycles = graph.detect_cycles(dep_graph)
    if cycles:
        raise HTTPException(
            status_code=500,
            detail=f"Dependency cycle detected: {cycles}",
        )

    order = graph.recovery_order(dep_graph, service_name)
    return {
        "service": service_name,
        "recovery_order": order,
    }


@app.post("/recovery/assess")
def assess_recovery(payload: Optional[RecoveryAssessRequest] = None):
    """Assess recovery readiness deterministically using graph topology, playbooks, and state."""
    service_name = payload.service if payload else None
    incident_id = payload.incident_id if payload else None
    fingerprint = payload.expected_state_fingerprint if payload else None

    result = risk_gate.assess_recovery_readiness(
        service_name=service_name,
        incident_id=incident_id,
        expected_state_fingerprint=fingerprint,
    )
    return result


# ---------------------------------------------------------------------------
# Milestone 2 Recovery Engine & Approval Routes
# ---------------------------------------------------------------------------

@app.get("/incidents/{incident_id}")
def get_incident(incident_id: str):
    """Retrieve full details of a specific incident."""
    incident = state.get_incident(incident_id)
    if not incident:
        raise HTTPException(
            status_code=404,
            detail=f"Incident '{incident_id}' not found",
        )
    return {"incident": incident}


@app.post("/recovery/propose-repair/{incident_id}")
def propose_repair_endpoint(incident_id: str):
    """Generate an authoritative proposed source code repair change set for an incident."""
    try:
        cs = code_changes.generate_incident_patch(incident_id)
        inc = state.get_incident(incident_id)
        return {
            "incident": inc,
            "changeset": cs,
        }
    except KeyError as ke:
        raise HTTPException(status_code=404, detail=str(ke))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/recovery/start/{incident_id}")
def start_recovery_endpoint(incident_id: str):
    """Start sequential dependency-aware recovery for an incident."""
    incident = engine.start_recovery(incident_id)
    jobs = state.get_jobs_for_incident(incident_id)
    latest_job = jobs[-1] if jobs else None
    return {
        "incident": incident,
        "job_id": latest_job["id"] if latest_job else None,
        "job": latest_job,
    }


@app.get("/recovery/jobs/{job_id}")
def get_recovery_job_endpoint(job_id: str):
    """Retrieve details, stage progression, and diagnostic logs for a recovery job."""
    job = state.get_recovery_job(job_id)
    if not job:
        raise HTTPException(
            status_code=404,
            detail=f"Recovery job '{job_id}' not found",
        )
    return {"job": job}


@app.get("/recovery/status/{incident_id}")
def get_recovery_status_endpoint(incident_id: str):
    """Retrieve recovery status and active job for an incident."""
    incident = state.get_incident(incident_id)
    if not incident:
        raise HTTPException(
            status_code=404,
            detail=f"Incident '{incident_id}' not found",
        )
    jobs = state.get_jobs_for_incident(incident_id)
    latest_job = jobs[-1] if jobs else None
    return {
        "incident_id": incident_id,
        "status": incident.get("status"),
        "active_job_id": incident.get("active_job_id"),
        "job": latest_job,
        "jobs": jobs,
    }



@app.get("/approvals")
def list_approvals(status: Optional[str] = Query(None)):
    """List all approvals, optionally filtered by status ('pending', 'approved', 'rejected')."""
    if status:
        filtered = [a for a in state.approvals if a.get("status") == status]
        return {"approvals": filtered}
    return {"approvals": state.approvals}


@app.get("/approvals/pending")
def list_pending_approvals():
    """List only pending approvals waiting for operator action."""
    pending = [a for a in state.approvals if a.get("status") == "pending"]
    return {"pending_approvals": pending}


@app.post("/approvals/{approval_id}/approve")
def approve_action_endpoint(
    approval_id: str,
    payload: Optional[ApprovalDecisionRequest] = None,
):
    """Approve a pending high-risk action and resume recovery execution."""
    reason = payload.reason if payload else None
    result = engine.process_approval(approval_id, decision="approve", reason=reason)
    return result


@app.post("/approvals/{approval_id}/reject")
def reject_action_endpoint(
    approval_id: str,
    payload: Optional[ApprovalDecisionRequest] = None,
):
    """Reject a pending high-risk action and abort recovery execution."""
    reason = payload.reason if payload else None
    result = engine.process_approval(approval_id, decision="reject", reason=reason)
    return result


@app.get("/audit")
def list_audit_events(incident_id: Optional[str] = Query(None)):
    """Retrieve audit events, optionally filtered by incident_id."""
    if incident_id:
        filtered = [e for e in state.audit_log if e.get("incident_id") == incident_id]
        return {"audit_log": filtered}
    return {"audit_log": state.audit_log}


@app.post("/simulate/configure")
def configure_simulation(payload: SimulationConfigRequest):
    """Configure simulated recovery and health check outcomes for testing."""
    if payload.service not in dep_graph.nodes:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown service: '{payload.service}'",
        )

    state.set_simulation_override(
        service=payload.service,
        action_success=payload.action_success,
        health_check_success=payload.health_check_success,
        risk_level=payload.risk_level,
        action_error=payload.action_error,
        health_check_error=payload.health_check_error,
    )
    return {"status": "configured", "service": payload.service}


@app.post("/live/probe")
def run_live_probe_endpoint(auto_create_incident: bool = Query(True)):
    """Execute live HTTP health and products probe, auto-creating a real incident on failure."""
    result = live_adapter.run_live_health_probe(auto_create_incident=auto_create_incident)
    return result


# ---------------------------------------------------------------------------
# Standalone Dedicated Python OS Process Endpoints
# ---------------------------------------------------------------------------

@app.get("/standalone/status")
def get_standalone_status(port: Optional[int] = None):
    """Retrieve operational and process supervisor diagnostics for standalone Python demo service."""
    status_info = supervisor.supervisor.get_status()
    probe_health = live_adapter.probe_standalone_health(port=port)
    probe_products = live_adapter.probe_standalone_products(port=port)
    return {
        "supervisor": status_info,
        "health_probe": probe_health,
        "products_probe": probe_products,
        "is_healthy": probe_health.get("healthy") and probe_products.get("healthy"),
    }


@app.post("/standalone/start")
def start_standalone_process(port: Optional[int] = None):
    """Start the standalone Python demo service process via the safe supervisor."""
    try:
        res = supervisor.supervisor.start_service(port=port)
        return res
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/standalone/stop")
def stop_standalone_process():
    """Stop the standalone Python demo service process via the safe supervisor."""
    res = supervisor.supervisor.stop_service()
    return res


@app.post("/standalone/restart")
def restart_standalone_process(port: Optional[int] = None):
    """Restart the standalone Python demo service process via the safe supervisor."""
    try:
        res = supervisor.supervisor.restart_service(port=port)
        return res
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/standalone/fail")
def fail_standalone_service(port: Optional[int] = None):
    """Inject failure into the independent Python process via HTTP."""
    import urllib.error
    import urllib.request

    target_port = port or supervisor.supervisor.port
    url = f"http://127.0.0.1:{target_port}/fail"
    try:
        req = urllib.request.Request(url, data=b"", headers={"User-Agent": "BRIDGE/1.0"}, method="POST")
        with urllib.request.urlopen(req, timeout=2.0) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return {"status": "fault_injected", "response": data}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to inject fault into standalone service: {exc}")


@app.post("/standalone/probe")
def probe_standalone_service(auto_create_incident: bool = Query(True), port: Optional[int] = None):
    """Run real TCP HTTP health and products probe against standalone process."""
    result = live_adapter.run_standalone_health_probe(auto_create_incident=auto_create_incident, port=port)
    return result


# ---------------------------------------------------------------------------
# Codex-Style Multi-File Code Change & Patch Review Endpoints
# ---------------------------------------------------------------------------

@app.get("/code-changes")
def list_code_changes(incident_id: Optional[str] = Query(None)):
    """List all proposed code change sets, optionally filtered by incident_id."""
    changesets = code_changes.list_changesets(incident_id=incident_id)
    return {"changesets": changesets}


@app.get("/code-changes/{changeset_id}")
def get_code_changeset(changeset_id: str):
    """Retrieve full details, files, and diffs for a specific code change set."""
    cs = code_changes.get_changeset(changeset_id)
    if not cs:
        raise HTTPException(
            status_code=404,
            detail=f"Code change set '{changeset_id}' not found",
        )
    return {"changeset": cs}


@app.post("/code-changes/propose")
def propose_code_changeset(payload: ProposeChangeSetRequest):
    """Propose a multi-file code change set without modifying the working tree."""
    try:
        cs = code_changes.create_changeset(
            title=payload.title,
            description=payload.description,
            file_patches=payload.file_patches,
            service=payload.service,
            incident_id=payload.incident_id,
        )
        return {"changeset": cs}
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to propose code change set: {exc}")


@app.post("/code-changes/{changeset_id}/file-review")
def review_file_endpoint(changeset_id: str, payload: FileReviewRequest):
    """Review and accept, reject, or reset an individual file in a change set."""
    try:
        cs = code_changes.review_file(
            changeset_id=changeset_id,
            file_path=payload.file_path,
            decision=payload.decision,
        )
        return {"changeset": cs}
    except KeyError as ke:
        raise HTTPException(status_code=404, detail=str(ke))
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/code-changes/{changeset_id}/accept-all")
def accept_all_endpoint(changeset_id: str):
    """Mark all files in the change set as accepted for application."""
    try:
        cs = code_changes.accept_all_files(changeset_id=changeset_id)
        return {"changeset": cs}
    except KeyError as ke:
        raise HTTPException(status_code=404, detail=str(ke))
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/code-changes/{changeset_id}/reject-all")
def reject_all_endpoint(changeset_id: str):
    """Mark all files in the change set as rejected without touching the disk."""
    try:
        cs = code_changes.reject_all_files(changeset_id=changeset_id)
        return {"changeset": cs}
    except KeyError as ke:
        raise HTTPException(status_code=404, detail=str(ke))
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/code-changes/{changeset_id}/apply")
def apply_changeset_endpoint(changeset_id: str):
    """Safely apply accepted files after verifying SHA-256 hashes and run validation checks."""
    try:
        cs = code_changes.apply_changeset(changeset_id=changeset_id)
        return {
            "status": "applied",
            "changeset": cs,
            "validation_results": cs.get("validation_results"),
        }
    except KeyError as ke:
        raise HTTPException(status_code=404, detail=str(ke))
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except RuntimeError as re:
        # Conflict / stale hash mismatch
        raise HTTPException(status_code=409, detail=str(re))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to apply change set: {exc}")


# ---------------------------------------------------------------------------
# Data Integrity Gate & Dead-Letter Quarantine Endpoints
# ---------------------------------------------------------------------------

@app.get("/integrity/status")
def get_integrity_status_endpoint():
    """Return status of Primary DB (intact valid records) vs Quarantine Vault."""
    return data_integrity.get_integrity_status()


class IngestRecordRequest(BaseModel):
    item_name: str
    customer_email: str
    amount: Any
    quantity: Any
    currency: Optional[str] = "USD"
    id: Optional[str] = None


@app.post("/integrity/ingest")
def ingest_record_endpoint(body: IngestRecordRequest):
    """Ingest a record through the Data Integrity Gate."""
    payload = body.model_dump()
    result = data_integrity.ingest_record(payload)
    return result


@app.post("/integrity/inject-malformed")
def inject_malformed_endpoint(scenario: str = Query("negative_price", description="Type of corruption")):
    """Inject a deliberately malformed record to demonstrate automatic quarantine."""
    return data_integrity.inject_malformed_record(scenario=scenario)


class RecoverRecordRequest(BaseModel):
    repaired_payload: Optional[dict[str, Any]] = None


@app.post("/integrity/quarantine/{quarantine_id}/recover")
def recover_quarantined_endpoint(quarantine_id: str, body: Optional[RecoverRecordRequest] = None):
    """Safely sanitize, re-validate, and promote a quarantined record to the primary database."""
    repaired = body.repaired_payload if body else None
    res = data_integrity.recover_quarantined_record(quarantine_id=quarantine_id, repaired_payload=repaired)
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error", "Failed to recover record"))
    return res


@app.delete("/integrity/quarantine/{quarantine_id}")
def purge_quarantined_endpoint(quarantine_id: str):
    """Purge a toxic/corrupt record from quarantine vault."""
    res = data_integrity.purge_quarantined_record(quarantine_id=quarantine_id)
    if not res.get("success"):
        raise HTTPException(status_code=404, detail=res.get("error", "Not found"))
    return res


@app.post("/integrity/reset")
def reset_integrity_endpoint():
    """Reset data integrity stores to clean baseline for demonstrations."""
    return data_integrity.reset_integrity_store()



