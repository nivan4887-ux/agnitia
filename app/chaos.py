"""
BRIDGE – Multi-Scenario Chaos Engine and Fault Injection Framework.

Defines 8 deterministic, structured chaos scenarios (A through H) with target-specific
state mutations, distinct HTTP response behaviors, diagnostic error codes,
and allowlisted recovery pathways.
"""

from __future__ import annotations

import threading
from typing import Any

# --- BRIDGE Automated Connection Drain & Lock Reclamation ---
_pool_drain_lock = threading.Lock()
_active_connection_leases: int = 0
_auto_recovery_enabled: bool = True
# -------------------------------------------------------------

_chaos_lock = threading.RLock()

CHAOS_SCENARIOS: dict[str, dict[str, Any]] = {
    "scenario_a_catalog_db": {
        "id": "scenario_a_catalog_db",
        "scenario_letter": "A",
        "name": "Scenario A — Product Catalog DB Connection Pool Exhaustion",
        "description": "Simulates high-concurrency pool depletion on the fashion catalog database. Product endpoints return HTTP 503.",
        "target_service": "backend_api",
        "failure_type": "database_pool_exhaustion",
        "expected_status": 503,
        "error_code": "ERR_DB_POOL_EXHAUSTED",
        "user_effect": "Catalog unavailable; browsing products displays structured database outage alert.",
        "required_action": "restart_service",
        "verification_endpoints": ["/demo/health", "/demo/products"],
        "dependency_impact": ["backend_api", "website"],
    },
    "scenario_b_api_timeout": {
        "id": "scenario_b_api_timeout",
        "scenario_letter": "B",
        "name": "Scenario B — Product API Latency & Gateway Timeout",
        "description": "Simulates downstream upstream timeout / latency breach. Product endpoints return HTTP 504 Gateway Timeout.",
        "target_service": "backend_api",
        "failure_type": "gateway_timeout",
        "expected_status": 504,
        "error_code": "ERR_PRODUCT_API_TIMEOUT",
        "user_effect": "Storefront displays request timed out with customer retry button.",
        "required_action": "restart_service",
        "verification_endpoints": ["/demo/health", "/demo/products"],
        "dependency_impact": ["website"],
    },
    "scenario_c_inventory_failure": {
        "id": "scenario_c_inventory_failure",
        "scenario_letter": "C",
        "name": "Scenario C — Real-Time Inventory Service Outage",
        "description": "Simulates warehouse inventory cluster failure. Inventory checks return HTTP 503.",
        "target_service": "order_service",
        "failure_type": "inventory_service_unavailable",
        "expected_status": 503,
        "error_code": "ERR_INVENTORY_UNAVAILABLE",
        "user_effect": "Product details remain viewable, but stock checks and inventory indicators display unavailable.",
        "required_action": "restart_service",
        "verification_endpoints": ["/demo/inventory/check"],
        "dependency_impact": ["website"],
    },
    "scenario_d_checkout_failure": {
        "id": "scenario_d_checkout_failure",
        "scenario_letter": "D",
        "name": "Scenario D — Checkout Pipeline & Order Creation Outage",
        "description": "Simulates checkout submission processing failure. Checkout submissions return HTTP 503.",
        "target_service": "order_service",
        "failure_type": "checkout_service_unavailable",
        "expected_status": 503,
        "error_code": "ERR_CHECKOUT_UNAVAILABLE",
        "user_effect": "Browsing and cart updates work, but checkout submission fails with clear explanation and retry.",
        "required_action": "restart_service",
        "verification_endpoints": ["/demo/checkout"],
        "dependency_impact": ["website"],
    },
    "scenario_e_payment_degraded": {
        "id": "scenario_e_payment_degraded",
        "scenario_letter": "E",
        "name": "Scenario E — Payment Gateway Connector Degradation",
        "description": "Simulates payment provider webhook and settlement connector failure. Payment processing returns HTTP 503.",
        "target_service": "payment_service",
        "failure_type": "payment_gateway_unavailable",
        "expected_status": 503,
        "error_code": "ERR_PAYMENT_GATEWAY_UNAVAILABLE",
        "user_effect": "Prevents simulated order payment confirmation with descriptive payment degradation notice.",
        "required_action": "restart_service",
        "verification_endpoints": ["/demo/payment/process"],
        "dependency_impact": ["website"],
    },
    "scenario_f_backend_api_down": {
        "id": "scenario_f_backend_api_down",
        "scenario_letter": "F",
        "name": "Scenario F — Core Application Gateway & Backend API Outage",
        "description": "Simulates core application gateway failure. Health and core API requests return HTTP 503.",
        "target_service": "backend_api",
        "failure_type": "service_unavailable",
        "expected_status": 503,
        "error_code": "ERR_BACKEND_API_DOWN",
        "user_effect": "Storefront displays core service unavailable state.",
        "required_action": "restart_service",
        "verification_endpoints": ["/demo/health", "/demo/products"],
        "dependency_impact": ["order_service", "payment_service", "website"],
    },
    "scenario_g_verification_failure": {
        "id": "scenario_g_verification_failure",
        "scenario_letter": "G",
        "name": "Scenario G — Recovery Action Executed but Post-Health Verification Fails",
        "description": "Demonstrates that executing a recovery action does not guarantee health. Post-recovery verification fails and keeps incident marked failed.",
        "target_service": "backend_api",
        "failure_type": "verification_probe_failure",
        "expected_status": 503,
        "error_code": "ERR_VERIFICATION_PROBE_FAILED",
        "user_effect": "Recovery attempt executes action but terminates as failed in audit trail due to probe rejection.",
        "required_action": "restart_service",
        "verification_endpoints": ["/demo/health"],
        "dependency_impact": ["website"],
    },
    "scenario_h_upstream_dependency_failure": {
        "id": "scenario_h_upstream_dependency_failure",
        "scenario_letter": "H",
        "name": "Scenario H — Upstream Database Failure (Blocked Prerequisite)",
        "description": "Simulates Tier 0 persistent database failure. Dependent downstream services are marked degraded. Recovery is blocked by dependency gate.",
        "target_service": "database",
        "failure_type": "database_outage",
        "expected_status": 503,
        "error_code": "ERR_DATABASE_UNAVAILABLE",
        "user_effect": "Recovery Engine flags BLOCKED prerequisite and requires database recovery before downstream recovery.",
        "required_action": "restore_backup_and_restart",
        "verification_endpoints": ["/services"],
        "dependency_impact": ["backend_api", "order_service", "payment_service", "website"],
    },
}

# Current Chaos State
_active_scenario: str | None = None
_scenario_metadata: dict[str, Any] | None = None


def get_all_scenarios() -> list[dict[str, Any]]:
    """Return all available registered chaos scenarios."""
    return list(CHAOS_SCENARIOS.values())


def get_active_scenario() -> dict[str, Any] | None:
    """Return the currently active chaos scenario metadata, or None if healthy."""
    with _chaos_lock:
        if _active_scenario and _active_scenario in CHAOS_SCENARIOS:
            return CHAOS_SCENARIOS[_active_scenario].copy()
        return None


def activate_scenario(scenario_id: str) -> dict[str, Any]:
    """Validate and activate a registered chaos scenario."""
    from app import state, demo_store

    with _chaos_lock:
        if scenario_id not in CHAOS_SCENARIOS:
            raise ValueError(f"Unknown chaos scenario ID: '{scenario_id}'. Must be one of {list(CHAOS_SCENARIOS.keys())}")

        scenario = CHAOS_SCENARIOS[scenario_id]
        global _active_scenario, _scenario_metadata
        _active_scenario = scenario_id
        _scenario_metadata = scenario

        # 1. Mutate demo store state according to scenario
        target_svc = scenario["target_service"]
        err_code = scenario["error_code"]
        desc = scenario["description"]

        if scenario_id in ("scenario_a_catalog_db", "scenario_b_api_timeout", "scenario_f_backend_api_down", "scenario_g_verification_failure"):
            demo_store.set_demo_state(
                is_healthy=False,
                reason=desc,
                error_code=err_code,
                status_code=scenario["expected_status"],
            )
        elif scenario_id == "scenario_c_inventory_failure":
            demo_store.set_inventory_healthy(False, reason=desc, error_code=err_code)
        elif scenario_id == "scenario_d_checkout_failure":
            demo_store.set_checkout_healthy(False, reason=desc, error_code=err_code)
        elif scenario_id == "scenario_e_payment_degraded":
            demo_store.set_payment_healthy(False, reason=desc, error_code=err_code)
        elif scenario_id == "scenario_h_upstream_dependency_failure":
            demo_store.set_demo_state(is_healthy=True)  # catalog itself is fine, but db is down
            with state.state_lock:
                state.fail_service("database")

        # 2. For scenario G (verification failure), configure simulation override
        if scenario_id == "scenario_g_verification_failure":
            state.simulation_overrides["backend_api"] = {
                "action_success": True,
                "health_check_success": False,
                "health_check_error": "Live HTTP verification probe rejected: HTTP 503 returned post-action",
            }
        else:
            state.simulation_overrides.pop("backend_api", None)

        return scenario.copy()


def reset_chaos_state() -> None:
    """Reset all chaos scenarios and restore demo services to healthy baseline."""
    from app import state, demo_store

    with _chaos_lock:
        global _active_scenario, _scenario_metadata
        _active_scenario = None
        _scenario_metadata = None

        demo_store.reset_demo_store()
        demo_store.set_inventory_healthy(True)
        demo_store.set_checkout_healthy(True)
        demo_store.set_payment_healthy(True)
        state.simulation_overrides.clear()

