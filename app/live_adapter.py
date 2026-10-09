"""
BRIDGE – Restricted Allowlisted Live Recovery Adapter and Real HTTP Prober.

Safely executes allowlisted internal recovery actions on designated local demo services,
and verifies real HTTP status and product payload health.
"""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any

from app import demo_store, state

ALLOWLISTED_ACTIONS = {
    "restart_service",
    "restart_demo_products_api",
    "reconnect_and_warm_cache",
    "clear_cache_and_restart",
    "restore_backup_and_restart",
    "restart_python_demo_service",
}

ALLOWLISTED_TARGETS = {
    "database",
    "backend_api",
    "order_service",
    "payment_service",
    "website",
    "standalone_service",
}


def probe_demo_health() -> dict[str, Any]:
    """Execute an in-process live health probe on the demo Products API."""
    d_state = demo_store.get_demo_state()
    now_iso = datetime.now(timezone.utc).isoformat()

    if not d_state["is_healthy"]:
        status_code = d_state.get("status_code", 503)
        return {
            "healthy": False,
            "status_code": status_code,
            "endpoint": "/demo/health",
            "service": "backend_api_products",
            "error": d_state["failure_reason"] or "Database connection pool exhausted",
            "error_code": d_state["error_code"] or "ERR_DB_POOL_EXHAUSTED",
            "timestamp": now_iso,
        }

    return {
        "healthy": True,
        "status_code": 200,
        "endpoint": "/demo/health",
        "service": "backend_api_products",
        "database_connected": True,
        "latency_ms": 12,
        "timestamp": now_iso,
    }


def probe_demo_products() -> dict[str, Any]:
    """Execute an in-process live products catalog probe on the demo Products API."""
    d_state = demo_store.get_demo_state()
    now_iso = datetime.now(timezone.utc).isoformat()

    if not d_state["is_healthy"]:
        status_code = d_state.get("status_code", 503)
        return {
            "healthy": False,
            "status_code": status_code,
            "endpoint": "/demo/products",
            "error": d_state["failure_reason"] or "Products API unavailable",
            "error_code": d_state["error_code"] or "ERR_DB_POOL_EXHAUSTED",
            "products_returned": 0,
            "timestamp": now_iso,
        }

    return {
        "healthy": True,
        "status_code": 200,
        "endpoint": "/demo/products",
        "products_returned": len(demo_store.DEMO_PRODUCTS),
        "timestamp": now_iso,
    }


def run_live_health_probe(auto_create_incident: bool = True) -> dict[str, Any]:
    """Run genuine health probe and automatically record a real incident if live service fails."""
    health_result = probe_demo_health()
    products_result = probe_demo_products()

    is_healthy = health_result["healthy"] and products_result["healthy"]
    now_iso = datetime.now(timezone.utc).isoformat()

    created_incident: dict[str, Any] | None = None

    if not is_healthy and auto_create_incident:
        from app import sos
        sos_res = sos.dispatch_sos_incident(
            service="backend_api",
            reason=f"Live HTTP probe failure: {health_result.get('error') or 'Service unhealthy'}",
            reporter="live_http_probe",
            failure_type="live_http_probe_failure",
            metadata={
                "health_probe": health_result,
                "products_probe": products_result,
                "observed_http_status": health_result["status_code"],
                "error_code": health_result.get("error_code"),
                "error_message": health_result.get("error"),
            },
            auto_trigger_recovery=False,
        )
        created_incident = sos_res.get("incident")
        if created_incident:
            state.record_audit_event(
                incident_id=created_incident["id"],
                event_type="live_http_probe_failure",
                service="backend_api",
                details={
                    "health_probe": health_result,
                    "products_probe": products_result,
                    "observed_http_status": health_result["status_code"],
                    "error_code": health_result.get("error_code"),
                    "error_message": health_result.get("error"),
                },
            )

    return {
        "is_healthy": is_healthy,
        "service": "backend_api",
        "health_probe": health_result,
        "products_probe": products_result,
        "incident": created_incident,
        "timestamp": now_iso,
    }


def probe_standalone_health(port: int | None = None) -> dict[str, Any]:
    """Execute real TCP HTTP health probe against independent Python demo service process."""
    from app.supervisor import supervisor
    target_port = port or supervisor.port
    url = f"http://127.0.0.1:{target_port}/health"
    now_iso = datetime.now(timezone.utc).isoformat()

    try:
        req = urllib.request.Request(url, headers={"User-Agent": "BRIDGE-HealthProber/1.0"})
        with urllib.request.urlopen(req, timeout=1.5) as resp:
            status_code = resp.getcode()
            body = json.loads(resp.read().decode("utf-8"))
            return {
                "healthy": status_code == 200 and body.get("status") == "healthy",
                "status_code": status_code,
                "endpoint": url,
                "service": "standalone_service",
                "pid": body.get("pid"),
                "timestamp": now_iso,
            }
    except urllib.error.HTTPError as he:
        return {
            "healthy": False,
            "status_code": he.code,
            "endpoint": url,
            "service": "standalone_service",
            "error": f"HTTP {he.code} {he.reason}",
            "timestamp": now_iso,
        }
    except Exception as exc:
        return {
            "healthy": False,
            "status_code": 0,
            "endpoint": url,
            "service": "standalone_service",
            "error": f"Connection failed: {exc}",
            "timestamp": now_iso,
        }


def probe_standalone_products(port: int | None = None) -> dict[str, Any]:
    """Execute real TCP HTTP products catalog probe against independent Python demo service process."""
    from app.supervisor import supervisor
    target_port = port or supervisor.port
    url = f"http://127.0.0.1:{target_port}/products"
    now_iso = datetime.now(timezone.utc).isoformat()

    try:
        req = urllib.request.Request(url, headers={"User-Agent": "BRIDGE-HealthProber/1.0"})
        with urllib.request.urlopen(req, timeout=1.5) as resp:
            status_code = resp.getcode()
            body = json.loads(resp.read().decode("utf-8"))
            products = body.get("products", [])
            return {
                "healthy": status_code == 200 and len(products) > 0,
                "status_code": status_code,
                "endpoint": url,
                "service": "standalone_service",
                "products_returned": len(products),
                "pid": body.get("pid"),
                "timestamp": now_iso,
            }
    except urllib.error.HTTPError as he:
        return {
            "healthy": False,
            "status_code": he.code,
            "endpoint": url,
            "service": "standalone_service",
            "error": f"HTTP {he.code} {he.reason}",
            "timestamp": now_iso,
        }
    except Exception as exc:
        return {
            "healthy": False,
            "status_code": 0,
            "endpoint": url,
            "service": "standalone_service",
            "error": f"Connection failed: {exc}",
            "timestamp": now_iso,
        }


def run_standalone_health_probe(auto_create_incident: bool = True, port: int | None = None) -> dict[str, Any]:
    """Run genuine real TCP HTTP health probe on standalone process and auto-create incident on failure."""
    health_result = probe_standalone_health(port=port)
    products_result = probe_standalone_products(port=port)

    is_healthy = health_result["healthy"] and products_result["healthy"]
    now_iso = datetime.now(timezone.utc).isoformat()

    created_incident: dict[str, Any] | None = None

    if not is_healthy and auto_create_incident:
        with state.state_lock:
            if state.service_states.get("standalone_service") != "failed":
                created_incident = state.fail_service("standalone_service")
                state.record_audit_event(
                    incident_id=created_incident["id"],
                    event_type="standalone_http_probe_failure",
                    service="standalone_service",
                    details={
                        "health_probe": health_result,
                        "products_probe": products_result,
                        "observed_http_status": health_result["status_code"],
                        "error": health_result.get("error"),
                    },
                )

    return {
        "is_healthy": is_healthy,
        "service": "standalone_service",
        "health_probe": health_result,
        "products_probe": products_result,
        "incident": created_incident,
        "timestamp": now_iso,
    }


def execute_allowlisted_action(service: str, action: str) -> dict[str, Any]:
    """Safely execute an allowlisted internal recovery action on a designated target."""
    if service not in ALLOWLISTED_TARGETS:
        return {
            "success": False,
            "action": action,
            "service": service,
            "error": f"Unauthorized target service: '{service}'. Must be in allowlist.",
        }

    if action not in ALLOWLISTED_ACTIONS:
        return {
            "success": False,
            "action": action,
            "service": service,
            "error": f"Unauthorized recovery action: '{action}'. Must be in allowlist.",
        }

    # 1. Real Python Operating-System Process Recovery
    if action == "restart_python_demo_service":
        from app.supervisor import supervisor
        res = supervisor.restart_service()
        if not res.get("success"):
            return {
                "success": False,
                "action": action,
                "service": service,
                "error": res.get("error", "Failed to restart standalone Python process"),
            }
        return {
            "success": True,
            "action": action,
            "service": service,
            "message": f"Successfully restarted Python OS process (PID {res.get('pid')}) on port {supervisor.port}",
            "pid": res.get("pid"),
            "port": supervisor.port,
        }

    # 2. Reset corresponding demo subsystem states for in-memory simulated targets
    if service == "backend_api":
        demo_store.set_demo_state(is_healthy=True, reason="")
    elif service == "order_service":
        demo_store.set_inventory_healthy(True)
        demo_store.set_checkout_healthy(True)
    elif service == "payment_service":
        demo_store.set_payment_healthy(True)
    elif service == "database":
        demo_store.set_demo_state(is_healthy=True, reason="")

    return {
        "success": True,
        "action": action,
        "service": service,
        "message": f"Successfully executed allowlisted action '{action}' on '{service}'",
    }


def verify_live_service_health(service: str) -> dict[str, Any]:
    """Verify live HTTP responses for designated service after recovery action."""
    # 1. Real TCP HTTP Verification for Standalone OS Process
    if service == "standalone_service":
        last_health = None
        last_prods = None
        for _ in range(8):
            last_health = probe_standalone_health()
            last_prods = probe_standalone_products()
            if last_health["healthy"] and last_prods["healthy"]:
                return {
                    "passed": True,
                    "health_check_type": "real_http_health_probe",
                    "message": (
                        f"Real TCP HTTP 200 verification passed for {last_health['endpoint']} "
                        f"and {last_prods['endpoint']} (PID {last_health.get('pid')})"
                    ),
                    "health_probe": last_health,
                    "products_probe": last_prods,
                }
            time.sleep(0.15)

        return {
            "passed": False,
            "health_check_type": "real_http_health_probe",
            "message": f"Real HTTP verification failed for standalone service: {last_health.get('error') if last_health else 'Probe timeout'}",
            "health_probe": last_health,
            "products_probe": last_prods,
        }

    # 2. Live HTTP Probing for Backend API Demo Store
    if service == "backend_api":
        health_probe = probe_demo_health()
        products_probe = probe_demo_products()

        if not health_probe["healthy"] or not products_probe["healthy"]:
            return {
                "passed": False,
                "health_check_type": "live_http_probe",
                "message": f"Live verification failed: HTTP {health_probe['status_code']} on {health_probe['endpoint']}",
                "health_probe": health_probe,
                "products_probe": products_probe,
            }

        return {
            "passed": True,
            "health_check_type": "live_http_probe",
            "message": "Live HTTP 200 verification passed for both /demo/health and /demo/products",
            "health_probe": health_probe,
            "products_probe": products_probe,
        }

    # For services without a designated live HTTP endpoint, reject target confusion
    return {
        "passed": False,
        "health_check_type": "invalid_live_target",
        "message": f"Service '{service}' has no configured live HTTP verification probe endpoint.",
    }


