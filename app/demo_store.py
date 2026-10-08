"""
RecoverOps – Isolated Demo Store and Controlled Products API.

Provides real HTTP endpoints for a local demonstration mini-store,
supporting genuine HTTP 200 / 503 health responses and controlled fault injection.
"""

from __future__ import annotations

import threading
from typing import Any
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel

router = APIRouter(prefix="/demo", tags=["Demo Mini-Store"])

_lock = threading.Lock()

# Initial catalog data
DEMO_PRODUCTS = [
    {
        "id": "prod-101",
        "name": "SRE Incident Runbook (Hardcover)",
        "price": 49.99,
        "category": "Documentation",
        "in_stock": True,
        "stock_count": 120,
        "description": "Comprehensive runbooks for production incident triage, dependency cascades, and root-cause analysis.",
    },
    {
        "id": "prod-102",
        "name": "Chaos Monkey Plush Mascot",
        "price": 24.50,
        "category": "Swag",
        "in_stock": True,
        "stock_count": 85,
        "description": "Soft and friendly reminder to always test upstream dependencies before deploying to production.",
    },
    {
        "id": "prod-103",
        "name": "Zero-Downtime Pipeline Token",
        "price": 99.00,
        "category": "Platform",
        "in_stock": True,
        "stock_count": 34,
        "description": "Hardware security key configured for automated dependency verification and canary promotions.",
    },
    {
        "id": "prod-104",
        "name": "Kubernetes Cluster Emergency Bell",
        "price": 18.00,
        "category": "Hardware",
        "in_stock": True,
        "stock_count": 210,
        "description": "Physical brass bell to alert the team when a critical database backup restore requires approval.",
    },
]

# In-memory demo store state
_demo_state: dict[str, Any] = {
    "is_healthy": True,
    "failure_reason": "",
    "error_code": None,
}


def get_demo_state() -> dict[str, Any]:
    with _lock:
        return _demo_state.copy()


def set_demo_state(is_healthy: bool, reason: str = "", error_code: str | None = None) -> None:
    with _lock:
        _demo_state["is_healthy"] = is_healthy
        _demo_state["failure_reason"] = reason
        _demo_state["error_code"] = error_code


def reset_demo_store() -> None:
    with _lock:
        _demo_state["is_healthy"] = True
        _demo_state["failure_reason"] = ""
        _demo_state["error_code"] = None


class ChaosFailRequest(BaseModel):
    reason: str | None = None


@router.get("/products")
def get_products():
    """Return the product catalog, or HTTP 503 if the Products API is down."""
    state = get_demo_state()
    if not state["is_healthy"]:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error": "Products API unavailable",
                "reason": state["failure_reason"] or "Database connection pool exhausted",
                "error_code": state["error_code"] or "ERR_DB_POOL_EXHAUSTED",
                "service": "products_api",
            },
        )
    return {
        "status": "ok",
        "service": "products_api",
        "products": DEMO_PRODUCTS,
        "item_count": len(DEMO_PRODUCTS),
    }


@router.get("/health")
def get_demo_health():
    """Return genuine HTTP 200 when healthy, or HTTP 503 when the demo service is down."""
    state = get_demo_state()
    if not state["is_healthy"]:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "unhealthy",
                "service": "backend_api_products",
                "database_connected": False,
                "error": state["failure_reason"] or "Database connection pool exhausted (503 Service Unavailable)",
                "error_code": state["error_code"] or "ERR_DB_POOL_EXHAUSTED",
            },
        )
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "status": "healthy",
            "service": "backend_api_products",
            "database_connected": True,
            "latency_ms": 12,
        },
    )


@router.post("/chaos/fail")
def inject_chaos_failure(payload: ChaosFailRequest | None = None):
    """Safely inject a real HTTP 503 failure into the isolated Demo Products API only."""
    reason = payload.reason if payload and payload.reason else "Simulated Outage: Products API database connection pool exhausted"
    set_demo_state(is_healthy=False, reason=reason, error_code="ERR_DB_POOL_EXHAUSTED")
    return {
        "status": "failure_injected",
        "service": "backend_api_products",
        "reason": reason,
        "target_endpoint": "/demo/products",
        "expected_http_status": 503,
    }


@router.post("/chaos/restore")
def restore_demo_service():
    """Allowlisted internal endpoint to restore the Demo Products API."""
    set_demo_state(is_healthy=True, reason="")
    return {
        "status": "restored",
        "service": "backend_api_products",
        "message": "Products API and database connection pool restored to healthy state",
    }

