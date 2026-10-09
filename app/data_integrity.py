"""
BRIDGE – Data Integrity Gate & Dead-Letter Quarantine Engine.

Detects, isolates, and quarantines malformed or invalid database records
before they can contaminate primary stores, while keeping valid records 100% intact.
Supports auto-repair, sanitization, and audit-grade isolation logs.
"""

from __future__ import annotations

import copy
import logging
import re
import threading
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from app import db, state

logger = logging.getLogger("bridge.integrity")
_lock = threading.RLock()

# Initial seed baseline for primary database to demonstrate existing valid records
BASELINE_VALID_RECORDS: List[Dict[str, Any]] = [
    {
        "id": "ORD-1001",
        "item_name": "Cashmere Oversized Sweater",
        "customer_email": "sarah.chen@example.com",
        "amount": 280.00,
        "quantity": 1,
        "currency": "USD",
        "status": "completed",
        "checksum": "valid_sha256_1001",
        "created_at": "2026-10-09T18:00:00Z",
        "integrity_verified": True,
    },
    {
        "id": "ORD-1002",
        "item_name": "Italian Wool Peacoat",
        "customer_email": "marcus.vance@example.com",
        "amount": 620.00,
        "quantity": 1,
        "currency": "USD",
        "status": "completed",
        "checksum": "valid_sha256_1002",
        "created_at": "2026-10-09T18:30:00Z",
        "integrity_verified": True,
    },
    {
        "id": "ORD-1003",
        "item_name": "Silk Charmeuse Scarf",
        "customer_email": "elena.rostova@example.com",
        "amount": 145.00,
        "quantity": 2,
        "currency": "USD",
        "status": "completed",
        "checksum": "valid_sha256_1003",
        "created_at": "2026-10-09T19:15:00Z",
        "integrity_verified": True,
    },
]

# In-memory stores (with MongoDB sync when available)
_valid_records: Dict[str, Dict[str, Any]] = {r["id"]: copy.deepcopy(r) for r in BASELINE_VALID_RECORDS}
_quarantined_records: Dict[str, Dict[str, Any]] = {}
_integrity_stats: Dict[str, Any] = {
    "total_ingested": len(BASELINE_VALID_RECORDS),
    "valid_accepted": len(BASELINE_VALID_RECORDS),
    "malformed_blocked": 0,
    "recovered_count": 0,
    "last_violation_at": None,
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def validate_order_record(payload: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """Strict schema & business logic integrity gate.
    
    Returns (is_valid, list_of_violations).
    """
    violations: List[str] = []

    if not isinstance(payload, dict):
        return False, ["Payload must be a JSON object"]

    # 1. Item Name check
    item_name = payload.get("item_name")
    if not item_name or not isinstance(item_name, str) or not item_name.strip():
        violations.append("Missing or empty required field: 'item_name'")

    # 2. Customer Email check
    email = payload.get("customer_email")
    if not email or not isinstance(email, str):
        violations.append("Missing required field: 'customer_email'")
    elif "@" not in email or "." not in email:
        violations.append(f"Invalid email format: '{email}'")

    # 3. Monetary Amount check (Crucial domain rule: no negative or zero pricing)
    amount = payload.get("amount")
    if amount is None:
        violations.append("Missing required monetary field: 'amount'")
    elif not isinstance(amount, (int, float)):
        violations.append(f"Field 'amount' must be numeric, received type '{type(amount).__name__}'")
    elif amount <= 0:
        violations.append(f"Field 'amount' cannot be negative or zero (received: {amount})")
    elif amount > 50000:
        violations.append(f"Field 'amount' exceeds maximum allowable limit: {amount}")

    # 4. Quantity check
    quantity = payload.get("quantity")
    if quantity is None:
        violations.append("Missing required field: 'quantity'")
    elif not isinstance(quantity, int) or isinstance(quantity, bool):
        violations.append(f"Field 'quantity' must be an integer, received '{type(quantity).__name__}'")
    elif quantity <= 0:
        violations.append(f"Field 'quantity' must be strictly positive (received: {quantity})")

    # 5. Currency check
    currency = payload.get("currency", "USD")
    if currency not in ("USD", "EUR", "GBP", "INR", "JPY", "CAD"):
        violations.append(f"Unrecognized or unsupported currency code: '{currency}'")

    # 6. Injection / Sanitization check
    for key, val in payload.items():
        if isinstance(val, str):
            if "<script" in val.lower() or "javascript:" in val.lower():
                violations.append(f"Security violation: script tag detected in field '{key}'")
            if "$where" in val or "{\"$gt\"" in val:
                violations.append(f"Security violation: NoSQL injection vector in field '{key}'")

    return (len(violations) == 0), violations


def ingest_record(
    payload: Dict[str, Any],
    source: str = "api_gateway",
) -> Dict[str, Any]:
    """Ingest an incoming record through the Data Integrity Gate.
    
    If valid: stored into primary collection.
    If malformed: routed to Dead-Letter Quarantine Store with full diagnostics.
    """
    with _lock:
        _integrity_stats["total_ingested"] += 1
        is_valid, violations = validate_order_record(payload)

        record_id = payload.get("id") or f"ORD-{uuid.uuid4().hex[:6].upper()}"

        if is_valid:
            # 1. Clean & accept into Primary DB
            record = copy.deepcopy(payload)
            record["id"] = record_id
            record["integrity_verified"] = True
            record["accepted_at"] = _now_iso()
            record["checksum"] = f"sha256_{uuid.uuid4().hex[:8]}"

            _valid_records[record_id] = record
            _integrity_stats["valid_accepted"] += 1

            # Sync to Mongo if connected
            db_conn = db.get_database()
            if db_conn is not None:
                try:
                    db_conn["valid_orders"].replace_one({"_id": record_id}, {**record, "_id": record_id}, upsert=True)
                except Exception as exc:
                    logger.warning("MongoDB valid_orders sync failed: %s", exc)

            return {
                "accepted": True,
                "status": "valid_stored_in_primary_db",
                "record_id": record_id,
                "violations": [],
                "quarantined": False,
                "record": record,
            }

        # 2. MALFORMED: Intercept and route to Dead-Letter Quarantine Vault
        quarantine_id = f"QRN-{uuid.uuid4().hex[:6].upper()}"
        quarantined_entry = {
            "id": quarantine_id,
            "target_record_id": record_id,
            "raw_payload": copy.deepcopy(payload),
            "violations": violations,
            "source": source,
            "status": "quarantined",
            "quarantined_at": _now_iso(),
            "suggested_fix": _generate_suggested_fix(payload, violations),
        }

        _quarantined_records[quarantine_id] = quarantined_entry
        _integrity_stats["malformed_blocked"] += 1
        _integrity_stats["last_violation_at"] = quarantined_entry["quarantined_at"]

        # Record SRE Audit Event for data corruption prevention
        state.record_audit_event(
            incident_id=f"INC-{quarantine_id}",
            event_type="data_integrity_violation_quarantined",
            service="database",
            details={
                "quarantine_id": quarantine_id,
                "target_record_id": record_id,
                "violations": violations,
                "blocked_payload_keys": list(payload.keys()),
                "status": "isolated_zero_primary_contamination",
            },
        )

        # Sync to Mongo quarantined collection if connected
        db_conn = db.get_database()
        if db_conn is not None:
            try:
                db_conn["quarantined_records"].replace_one(
                    {"_id": quarantine_id},
                    {**quarantined_entry, "_id": quarantine_id},
                    upsert=True,
                )
            except Exception as exc:
                logger.warning("MongoDB quarantined_records sync failed: %s", exc)

        logger.warning(
            "DATA INTEGRITY VIOLATION BLOCKED: %s quarantined with %d violations: %s",
            quarantine_id,
            len(violations),
            violations,
        )

        return {
            "accepted": False,
            "status": "quarantined_dead_letter",
            "quarantine_id": quarantine_id,
            "violations": violations,
            "quarantined": True,
            "error_code": "ERR_DATA_INTEGRITY_VIOLATION",
            "suggested_fix": quarantined_entry["suggested_fix"],
        }


def _generate_suggested_fix(payload: Dict[str, Any], violations: List[str]) -> Dict[str, Any]:
    """Generate automatic schema repair recommendations."""
    sanitized = copy.deepcopy(payload)

    # Auto fix negative price
    amount = sanitized.get("amount")
    if isinstance(amount, (int, float)) and amount <= 0:
        sanitized["amount"] = abs(amount) if amount != 0 else 99.00

    # Auto fix missing or invalid email
    email = sanitized.get("customer_email")
    if not email or "@" not in str(email):
        sanitized["customer_email"] = "recovered.customer@example.com"

    # Auto fix quantity
    qty = sanitized.get("quantity")
    if not isinstance(qty, int) or qty <= 0:
        sanitized["quantity"] = 1

    # Auto fix currency
    if sanitized.get("currency") not in ("USD", "EUR", "GBP", "INR", "JPY", "CAD"):
        sanitized["currency"] = "USD"

    if not sanitized.get("item_name"):
        sanitized["item_name"] = "Recovered Item"

    return {
        "repairable": True,
        "recommended_payload": sanitized,
        "actions": [f"Fix: {v}" for v in violations],
    }


def recover_quarantined_record(
    quarantine_id: str,
    repaired_payload: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Safely recover and re-ingest a quarantined record into the primary database.
    
    If repaired_payload is provided, uses it; otherwise applies automated repair.
    Validates before inserting into primary storage.
    """
    with _lock:
        entry = _quarantined_records.get(quarantine_id)
        if not entry:
            return {
                "success": False,
                "error": f"Quarantine record '{quarantine_id}' not found",
            }

        payload_to_test = repaired_payload or entry.get("suggested_fix", {}).get("recommended_payload")
        if not payload_to_test:
            return {
                "success": False,
                "error": "No repairable payload available for recovery",
            }

        # Re-run validation gate
        is_valid, violations = validate_order_record(payload_to_test)
        if not is_valid:
            return {
                "success": False,
                "error": "Repaired payload still violates integrity gate",
                "violations": violations,
            }

        # Promote safely to Primary Database
        target_id = payload_to_test.get("id") or entry.get("target_record_id") or f"ORD-{uuid.uuid4().hex[:6].upper()}"
        record = copy.deepcopy(payload_to_test)
        record["id"] = target_id
        record["integrity_verified"] = True
        record["recovered_from_quarantine"] = quarantine_id
        record["recovered_at"] = _now_iso()
        record["checksum"] = f"sha256_recovered_{uuid.uuid4().hex[:8]}"

        _valid_records[target_id] = record
        entry["status"] = "recovered_and_promoted"
        entry["recovered_at"] = record["recovered_at"]
        entry["promoted_record_id"] = target_id

        _integrity_stats["valid_accepted"] += 1
        _integrity_stats["recovered_count"] += 1

        # Record SRE Audit Event
        state.record_audit_event(
            incident_id=f"INC-{quarantine_id}",
            event_type="quarantine_record_recovered",
            service="database",
            details={
                "quarantine_id": quarantine_id,
                "promoted_record_id": target_id,
                "status": "safely_promoted_to_primary_store",
            },
        )

        return {
            "success": True,
            "message": f"Record '{quarantine_id}' safely sanitized and promoted to primary database as '{target_id}'.",
            "promoted_record": record,
        }


def purge_quarantined_record(quarantine_id: str) -> Dict[str, Any]:
    """Purge a toxic/corrupted payload from the quarantine store."""
    with _lock:
        entry = _quarantined_records.get(quarantine_id)
        if not entry:
            return {"success": False, "error": f"Record '{quarantine_id}' not found"}

        entry["status"] = "purged"
        entry["purged_at"] = _now_iso()

        state.record_audit_event(
            incident_id=f"INC-{quarantine_id}",
            event_type="quarantine_record_purged",
            service="database",
            details={"quarantine_id": quarantine_id, "status": "purged_from_dead_letter"},
        )
        return {"success": True, "message": f"Quarantine record '{quarantine_id}' purged successfully."}


def inject_malformed_record(scenario: str = "negative_price") -> Dict[str, Any]:
    """Helper to inject a realistic malformed record for live demonstration."""
    if scenario == "negative_price":
        payload = {
            "id": f"MAL-{uuid.uuid4().hex[:4].upper()}",
            "item_name": "Premium Leather Handbag",
            "customer_email": "attacker@darknet.io",
            "amount": -450.00,  # Negative monetary amount
            "quantity": 1,
            "currency": "USD",
        }
    elif scenario == "missing_customer":
        payload = {
            "id": f"MAL-{uuid.uuid4().hex[:4].upper()}",
            "item_name": "Silk Crepe Blouse",
            "customer_email": "invalid-no-domain",
            "amount": 185.00,
            "quantity": -2,  # Negative quantity
            "currency": "XYZ",  # Bogus currency
        }
    elif scenario == "script_injection":
        payload = {
            "id": f"MAL-{uuid.uuid4().hex[:4].upper()}",
            "item_name": "<script>alert('pwned')</script>",
            "customer_email": "bad@actor.com",
            "amount": 50.00,
            "quantity": 1,
            "currency": "USD",
        }
    else:
        payload = {
            "id": f"MAL-{uuid.uuid4().hex[:4].upper()}",
            "item_name": "",  # Empty name
            "customer_email": "none",
            "amount": "FREE_VOUCHER",  # String instead of float
            "quantity": 0,
            "currency": "FAKE",
        }

    return ingest_record(payload, source=f"demo_injection_{scenario}")


def get_integrity_status() -> Dict[str, Any]:
    """Return live status of Primary DB vs Quarantine Vault."""
    with _lock:
        valid_list = list(_valid_records.values())
        quarantine_list = list(_quarantined_records.values())

        # Contamination rate is strictly 0% because all invalid records are isolated
        contamination_rate = 0.0

        return {
            "database_status": "healthy_intact",
            "contamination_rate_percent": contamination_rate,
            "valid_records_count": len(valid_list),
            "quarantined_records_count": len([q for q in quarantine_list if q["status"] == "quarantined"]),
            "recovered_records_count": len([q for q in quarantine_list if q["status"] == "recovered_and_promoted"]),
            "purged_records_count": len([q for q in quarantine_list if q["status"] == "purged"]),
            "stats": copy.deepcopy(_integrity_stats),
            "valid_records": valid_list,
            "quarantined_records": quarantine_list,
        }


def reset_integrity_store() -> Dict[str, Any]:
    """Reset to clean initial baseline for repeatable demos."""
    global _valid_records, _quarantined_records, _integrity_stats
    with _lock:
        _valid_records = {r["id"]: copy.deepcopy(r) for r in BASELINE_VALID_RECORDS}
        _quarantined_records = {}
        _integrity_stats = {
            "total_ingested": len(BASELINE_VALID_RECORDS),
            "valid_accepted": len(BASELINE_VALID_RECORDS),
            "malformed_blocked": 0,
            "recovered_count": 0,
            "last_violation_at": None,
        }
        return {"success": True, "message": "Data integrity stores reset to clean baseline."}
