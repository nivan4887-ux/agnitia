"""
Unit and integration tests for BRIDGE Data Integrity Gate & Dead-Letter Quarantine.

Verifies:
1. Detecting deliberately malformed records.
2. Quarantine isolation preventing primary database contamination.
3. Valid existing records remaining completely intact.
4. Safe recovery & promotion back to the primary database.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app import data_integrity

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_integrity():
    """Ensure clean baseline before every test."""
    data_integrity.reset_integrity_store()
    yield
    data_integrity.reset_integrity_store()


def test_baseline_valid_records_intact():
    """Verify primary database contains baseline valid records."""
    status = data_integrity.get_integrity_status()
    assert status["database_status"] == "healthy_intact"
    assert status["contamination_rate_percent"] == 0.0
    assert status["valid_records_count"] == 3
    assert status["quarantined_records_count"] == 0

    valid_ids = [r["id"] for r in status["valid_records"]]
    assert "ORD-1001" in valid_ids
    assert "ORD-1002" in valid_ids
    assert "ORD-1003" in valid_ids


def test_ingest_valid_record_succeeds():
    """Ingesting a valid record stores it in the primary database."""
    payload = {
        "item_name": "Silk Cashmere Cardigan",
        "customer_email": "alice@example.com",
        "amount": 320.00,
        "quantity": 1,
        "currency": "USD",
    }
    resp = client.post("/integrity/ingest", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["accepted"] is True
    assert data["quarantined"] is False
    assert data["status"] == "valid_stored_in_primary_db"

    status = data_integrity.get_integrity_status()
    assert status["valid_records_count"] == 4
    assert status["quarantined_records_count"] == 0
    assert status["contamination_rate_percent"] == 0.0


def test_deliberate_malformed_negative_price_quarantined_and_valid_intact():
    """Demonstrate a deliberately malformed record with negative price is quarantined,
    and valid records remain intact without any corruption."""
    # Snapshot valid records before injection
    status_before = data_integrity.get_integrity_status()
    initial_valid_ids = {r["id"] for r in status_before["valid_records"]}
    assert len(initial_valid_ids) == 3

    # Inject negative price malformed record
    resp = client.post("/integrity/inject-malformed?scenario=negative_price")
    assert resp.status_code == 200
    data = resp.json()

    # Assert detection and quarantine
    assert data["accepted"] is False
    assert data["quarantined"] is True
    assert data["status"] == "quarantined_dead_letter"
    assert data["error_code"] == "ERR_DATA_INTEGRITY_VIOLATION"
    assert any("negative" in v.lower() for v in data["violations"])
    quarantine_id = data["quarantine_id"]

    # Verify primary database status: VALID RECORDS REMAIN 100% INTACT
    status_after = data_integrity.get_integrity_status()
    current_valid_ids = {r["id"] for r in status_after["valid_records"]}
    
    # Valid records were NOT corrupted or modified
    assert current_valid_ids == initial_valid_ids
    assert status_after["valid_records_count"] == 3
    assert status_after["quarantined_records_count"] == 1
    assert status_after["contamination_rate_percent"] == 0.0

    # Verify quarantine vault contains the malformed payload
    quarantined = [q for q in status_after["quarantined_records"] if q["id"] == quarantine_id]
    assert len(quarantined) == 1
    assert quarantined[0]["raw_payload"]["amount"] == -450.00
    assert quarantined[0]["status"] == "quarantined"


def test_multiple_malformed_scenarios_isolation():
    """Verify script injection and missing customer are quarantined while DB stays healthy."""
    client.post("/integrity/inject-malformed?scenario=script_injection")
    client.post("/integrity/inject-malformed?scenario=missing_customer")

    status = data_integrity.get_integrity_status()
    assert status["valid_records_count"] == 3
    assert status["quarantined_records_count"] == 2
    assert status["contamination_rate_percent"] == 0.0


def test_safe_recovery_and_promotion_of_quarantined_record():
    """Verify a quarantined record can be safely sanitized and promoted to primary database."""
    # 1. Inject malformed
    inject_resp = client.post("/integrity/inject-malformed?scenario=negative_price")
    quarantine_id = inject_resp.json()["quarantine_id"]

    # 2. Recover the record via automated sanitization
    recover_resp = client.post(f"/integrity/quarantine/{quarantine_id}/recover", json={})
    assert recover_resp.status_code == 200
    rec_data = recover_resp.json()
    assert rec_data["success"] is True
    assert rec_data["promoted_record"]["amount"] == 450.00  # Auto-fixed negative to positive
    assert rec_data["promoted_record"]["integrity_verified"] is True

    # 3. Verify primary database now includes the sanitized record
    status = data_integrity.get_integrity_status()
    assert status["valid_records_count"] == 4
    assert status["quarantined_records_count"] == 0
    assert status["recovered_records_count"] == 1
    assert status["contamination_rate_percent"] == 0.0


def test_purge_quarantined_record():
    """Verify unrecoverable records can be cleanly purged."""
    inject_resp = client.post("/integrity/inject-malformed?scenario=corrupt_types")
    quarantine_id = inject_resp.json()["quarantine_id"]

    del_resp = client.delete(f"/integrity/quarantine/{quarantine_id}")
    assert del_resp.status_code == 200
    assert del_resp.json()["success"] is True

    status = data_integrity.get_integrity_status()
    assert status["quarantined_records_count"] == 0
    assert status["purged_records_count"] == 1
    assert status["valid_records_count"] == 3

