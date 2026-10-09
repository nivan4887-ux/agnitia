"""
BRIDGE – Isolated Demo Store and Controlled Products API.

Provides real HTTP endpoints for a realistic fashion e-commerce website,
supporting distinct fault injection scenarios (catalog DB exhaustion, timeout,
inventory failure, checkout failure, payment degradation, and live health verification).
"""

from __future__ import annotations

import threading
import time
from typing import Any
from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.catalog_data import DEMO_PRODUCTS
from app import chaos

router = APIRouter(prefix="/demo", tags=["Demo Mini-Store"])

_lock = threading.RLock()

# --- BRIDGE DB Connection Pool & Circuit Breaker Policy ---
DB_POOL_MAX_ACTIVE: int = 50
DB_POOL_ACQUIRE_TIMEOUT_SEC: float = 10.0
DB_POOL_DRAIN_ON_ERROR: bool = True
DB_CIRCUIT_BREAKER_RETRIES: int = 3
# ------------------------------------------------------------

# Subsystem health states
_demo_state: dict[str, Any] = {
    "is_healthy": True,
    "failure_reason": "",
    "error_code": None,
    "status_code": 503,
}

_inventory_state: dict[str, Any] = {
    "is_healthy": True,
    "failure_reason": "",
    "error_code": None,
}

_checkout_state: dict[str, Any] = {
    "is_healthy": True,
    "failure_reason": "",
    "error_code": None,
}

_payment_state: dict[str, Any] = {
    "is_healthy": True,
    "failure_reason": "",
    "error_code": None,
}


def get_demo_state() -> dict[str, Any]:
    with _lock:
        return _demo_state.copy()


def set_demo_state(
    is_healthy: bool,
    reason: str = "",
    error_code: str | None = None,
    status_code: int = 503,
) -> None:
    with _lock:
        _demo_state["is_healthy"] = is_healthy
        _demo_state["failure_reason"] = reason
        _demo_state["error_code"] = error_code
        _demo_state["status_code"] = status_code


def set_inventory_healthy(is_healthy: bool, reason: str = "", error_code: str | None = None) -> None:
    with _lock:
        _inventory_state["is_healthy"] = is_healthy
        _inventory_state["failure_reason"] = reason
        _inventory_state["error_code"] = error_code


def set_checkout_healthy(is_healthy: bool, reason: str = "", error_code: str | None = None) -> None:
    with _lock:
        _checkout_state["is_healthy"] = is_healthy
        _checkout_state["failure_reason"] = reason
        _checkout_state["error_code"] = error_code


def set_payment_healthy(is_healthy: bool, reason: str = "", error_code: str | None = None) -> None:
    with _lock:
        _payment_state["is_healthy"] = is_healthy
        _payment_state["failure_reason"] = reason
        _payment_state["error_code"] = error_code


def reset_demo_store() -> None:
    with _lock:
        _demo_state["is_healthy"] = True
        _demo_state["failure_reason"] = ""
        _demo_state["error_code"] = None
        _demo_state["status_code"] = 503
        _inventory_state["is_healthy"] = True
        _inventory_state["failure_reason"] = ""
        _inventory_state["error_code"] = None
        _checkout_state["is_healthy"] = True
        _checkout_state["failure_reason"] = ""
        _checkout_state["error_code"] = None
        _payment_state["is_healthy"] = True
        _payment_state["failure_reason"] = ""
        _payment_state["error_code"] = None


# Request Models
class ChaosFailRequest(BaseModel):
    reason: str | None = None


class ChaosInjectRequest(BaseModel):
    scenario_id: str


class CheckoutRequest(BaseModel):
    items: list[dict[str, Any]]
    shipping_address: dict[str, Any]
    payment_method: str
    coupon_code: str | None = None
    subtotal: float
    total: float


class PaymentProcessRequest(BaseModel):
    order_id: str
    amount: float
    payment_method: str


class InventoryCheckRequest(BaseModel):
    product_ids: list[str]


# -------------------------------------------------------------
# Products & Catalog Endpoints
# -------------------------------------------------------------

@router.get("/products")
def get_products(
    category: str | None = Query(None),
    search: str | None = Query(None),
    sort: str | None = Query(None),
    limit: int = Query(60, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """Return product catalog, or HTTP 503/504 if catalog or backend is down."""
    state = get_demo_state()
    if not state["is_healthy"]:
        status_code = state.get("status_code", status.HTTP_503_SERVICE_UNAVAILABLE)
        # Handle simulated bounded timeout if configured
        if status_code == 504:
            time.sleep(0.05)  # 50ms bounded simulated latency
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail={
                    "error": "Gateway Timeout: Product API response latency breached 5000ms threshold",
                    "reason": state["failure_reason"] or "Upstream microservice timed out",
                    "error_code": state["error_code"] or "ERR_PRODUCT_API_TIMEOUT",
                    "service": "backend_api",
                },
            )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error": "Products API unavailable",
                "reason": state["failure_reason"] or "Database connection pool exhausted",
                "error_code": state["error_code"] or "ERR_DB_POOL_EXHAUSTED",
                "service": "products_api",
            },
        )

    # Filter catalog
    filtered = list(DEMO_PRODUCTS)

    if category and category.lower() != "all":
        filtered = [p for p in filtered if p.get("category", "").lower() == category.lower()]

    if search:
        q = search.lower()
        filtered = [
            p for p in filtered
            if q in p.get("name", "").lower() or q in p.get("description", "").lower() or q in p.get("category", "").lower()
        ]

    # Sort catalog
    if sort == "price-asc":
        filtered.sort(key=lambda x: x.get("price", 0))
    elif sort == "price-desc":
        filtered.sort(key=lambda x: x.get("price", 0), reverse=True)
    elif sort == "rating":
        filtered.sort(key=lambda x: x.get("rating", 0), reverse=True)
    elif sort == "newest":
        filtered.sort(key=lambda x: x.get("id", ""), reverse=True)

    paginated = filtered[offset : offset + limit]

    return {
        "status": "ok",
        "service": "products_api",
        "products": paginated,
        "item_count": len(paginated),
        "total_available": len(filtered),
    }


@router.get("/products/{product_id}")
def get_product_by_id(product_id: str):
    """Retrieve product detail by ID."""
    state = get_demo_state()
    if not state["is_healthy"]:
        raise HTTPException(
            status_code=state.get("status_code", 503),
            detail={
                "error": "Product detail unavailable",
                "reason": state["failure_reason"],
                "error_code": state["error_code"] or "ERR_DB_POOL_EXHAUSTED",
            },
        )

    for p in DEMO_PRODUCTS:
        if p["id"] == product_id:
            return {"status": "ok", "product": p}

    raise HTTPException(status_code=404, detail=f"Product '{product_id}' not found")


# -------------------------------------------------------------
# Inventory & Stock Verification Endpoints
# -------------------------------------------------------------

@router.get("/inventory/{product_id}")
def check_single_inventory(product_id: str):
    """Check inventory for a specific product."""
    with _lock:
        if not _inventory_state["is_healthy"]:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={
                    "error": "Inventory service unavailable",
                    "reason": _inventory_state["failure_reason"] or "Warehouse inventory cluster unreachable",
                    "error_code": _inventory_state["error_code"] or "ERR_INVENTORY_UNAVAILABLE",
                    "service": "order_service",
                },
            )

    for p in DEMO_PRODUCTS:
        if p["id"] == product_id:
            return {
                "status": "ok",
                "product_id": product_id,
                "in_stock": p.get("in_stock", True),
                "stock_count": p.get("stock_count", 20),
            }

    return {"status": "ok", "product_id": product_id, "in_stock": True, "stock_count": 25}


@router.post("/inventory/check")
def check_bulk_inventory(payload: InventoryCheckRequest):
    """Bulk check inventory for cart items."""
    with _lock:
        if not _inventory_state["is_healthy"]:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={
                    "error": "Inventory service unavailable",
                    "reason": _inventory_state["failure_reason"] or "Warehouse inventory cluster unreachable",
                    "error_code": _inventory_state["error_code"] or "ERR_INVENTORY_UNAVAILABLE",
                    "service": "order_service",
                },
            )

    results = {}
    for pid in payload.product_ids:
        matched = next((p for p in DEMO_PRODUCTS if p["id"] == pid), None)
        results[pid] = {
            "in_stock": matched.get("in_stock", True) if matched else True,
            "stock_count": matched.get("stock_count", 20) if matched else 20,
        }

    return {"status": "ok", "service": "order_service", "inventory": results}


# -------------------------------------------------------------
# Simulated Checkout & Payment Processing
# -------------------------------------------------------------

@router.post("/checkout")
def submit_checkout(payload: CheckoutRequest):
    """Submit simulated checkout order."""
    with _lock:
        if not _checkout_state["is_healthy"]:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={
                    "error": "Checkout pipeline unavailable",
                    "reason": _checkout_state["failure_reason"] or "Checkout order creation worker down",
                    "error_code": _checkout_state["error_code"] or "ERR_CHECKOUT_UNAVAILABLE",
                    "service": "order_service",
                },
            )

    order_id = f"ORD-AGN-{int(time.time() * 1000) % 1000000:06d}"
    return {
        "status": "order_created",
        "service": "order_service",
        "order_id": order_id,
        "items_count": len(payload.items),
        "total_amount": payload.total,
        "payment_method": payload.payment_method,
        "shipping_address": payload.shipping_address,
        "estimated_delivery": "3-5 Business Days",
    }


@router.post("/payment/process")
def process_simulated_payment(payload: PaymentProcessRequest):
    """Process simulated payment transaction."""
    with _lock:
        if not _payment_state["is_healthy"]:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={
                    "error": "Payment gateway unavailable in demo environment",
                    "reason": _payment_state["failure_reason"] or "Payment provider settlement connector degraded",
                    "error_code": _payment_state["error_code"] or "ERR_PAYMENT_GATEWAY_UNAVAILABLE",
                    "service": "payment_service",
                },
            )

    return {
        "status": "payment_approved",
        "service": "payment_service",
        "transaction_id": f"TXN-UPI-{int(time.time() * 1000) % 1000000:06d}",
        "order_id": payload.order_id,
        "amount": payload.amount,
        "currency": "INR",
    }


# -------------------------------------------------------------
# Health & Telemetry
# -------------------------------------------------------------

@router.get("/health")
def get_demo_health():
    """Return genuine HTTP 200 when healthy, or HTTP 503/504 when demo service is down."""
    state = get_demo_state()
    if not state["is_healthy"]:
        status_code = state.get("status_code", status.HTTP_503_SERVICE_UNAVAILABLE)
        return JSONResponse(
            status_code=status_code,
            content={
                "status": "unhealthy",
                "service": "backend_api_products",
                "database_connected": False,
                "error": state["failure_reason"] or "Database connection pool exhausted",
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


# -------------------------------------------------------------
# Chaos Scenarios API
# -------------------------------------------------------------

@router.get("/scenarios")
def list_chaos_scenarios():
    """List all 8 available structured chaos scenarios with full metadata."""
    return {
        "status": "ok",
        "scenarios": chaos.get_all_scenarios(),
        "active_scenario": chaos.get_active_scenario(),
    }


@router.post("/chaos/inject")
def inject_chaos_scenario(payload: ChaosInjectRequest):
    """Inject a validated chaos scenario."""
    try:
        active = chaos.activate_scenario(payload.scenario_id)
        return {
            "status": "scenario_injected",
            "scenario": active,
            "message": f"Successfully activated {active['name']}",
        }
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err),
        )


@router.get("/chaos/status")
def get_chaos_status():
    """Get active chaos status and subsystem health."""
    active = chaos.get_active_scenario()
    d_state = get_demo_state()
    with _lock:
        return {
            "active_scenario": active,
            "subsystems": {
                "products_catalog": "healthy" if d_state["is_healthy"] else "unhealthy",
                "inventory": "healthy" if _inventory_state["is_healthy"] else "unhealthy",
                "checkout": "healthy" if _checkout_state["is_healthy"] else "unhealthy",
                "payment": "healthy" if _payment_state["is_healthy"] else "unhealthy",
            },
        }


@router.post("/chaos/reset")
def reset_all_chaos():
    """Reset all chaos scenarios and restore demo store to clean baseline."""
    chaos.reset_chaos_state()
    return {
        "status": "reset",
        "message": "All chaos faults cleared. All services restored to healthy baseline.",
    }


# Backward-compatible endpoints
@router.post("/chaos/fail")
def inject_chaos_failure(payload: ChaosFailRequest | None = None):
    """Backward compatible chaos injection endpoint."""
    reason = payload.reason if payload and payload.reason else "Simulated Outage: Products API database connection pool exhausted"
    set_demo_state(is_healthy=False, reason=reason, error_code="ERR_DB_POOL_EXHAUSTED", status_code=503)
    return {
        "status": "failure_injected",
        "service": "backend_api_products",
        "reason": reason,
        "target_endpoint": "/demo/products",
        "expected_http_status": 503,
    }


@router.post("/chaos/restore")
def restore_demo_service():
    """Backward compatible restore endpoint."""
    chaos.reset_chaos_state()
    return {
        "status": "restored",
        "service": "backend_api_products",
        "message": "Products API and database connection pool restored to healthy state",
    }
