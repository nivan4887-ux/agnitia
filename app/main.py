"""
RecoverOps – FastAPI application and route definitions.
"""

from __future__ import annotations

from typing import Any, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app import demo_store, engine, graph, live_adapter, risk_gate, state

app = FastAPI(
    title="RecoverOps",
    description="Dependency-aware incident recovery platform – backend API.",
    version="0.2.0",
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


# ---------------------------------------------------------------------------
# Existing Milestone 1 Routes (Preserved)
# ---------------------------------------------------------------------------

@app.get("/")
def health():
    """Basic health check."""
    return {"status": "ok", "service": "RecoverOps"}


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
    incident = state.fail_service(service_name)
    return {"incident": incident}


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


@app.post("/recovery/start/{incident_id}")
def start_recovery_endpoint(incident_id: str):
    """Start sequential dependency-aware recovery for an incident."""
    incident = engine.start_recovery(incident_id)
    return {"incident": incident}


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

