"""
Verification test suite for:
Requirement #2: Database corruption detection and recovery

Explicitly tests all 7 rubric criteria:
1. Validate incoming records before production insertion.
2. Quarantine invalid records in MongoDB / Dead-Letter store.
3. Display the reason the record failed validation.
4. Controlled Inject Malformed action.
5. Sanitize & Recover with revalidation.
6. Prove existing valid records remain unchanged.
7. Audit the full recovery process.
"""

from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app import data_integrity, db, state

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_integrity():
    """Ensure clean baseline before every test."""
    data_integrity.reset_integrity_store()
    yield
    data_integrity.reset_integrity_store()


# ---------------------------------------------------------------------------
# Rubric Item 1: Validate incoming records before production insertion
# ---------------------------------------------------------------------------
def test_1_validate_incoming_records_before_production_insertion():
    """Valid records are accepted through the gate; invalid records are stopped BEFORE writing to primary DB."""
    # A. Valid record
    valid_payload = {
        "item_name": "Silk Cashmere Cardigan",
        "customer_email": "alice@example.com",
        "amount": 320.00,
        "quantity": 1,
        "currency": "USD",
    }
    resp = client.post("/integrity/ingest", json=valid_payload)
    assert resp.status_code == 200
    res_data = resp.json()
    assert res_data["accepted"] is True
    assert res_data["quarantined"] is False
    assert res_data["status"] == "valid_stored_in_primary_db"
    assert res_data["record"]["integrity_verified"] is True

    # B. Invalid record (amount = -99.00)
    invalid_payload = {
        "item_name": "Corrupted Product",
        "customer_email": "bad@example.com",
        "amount": -99.00,
        "quantity": 1,
        "currency": "USD",
    }
    resp_bad = client.post("/integrity/ingest", json=invalid_payload)
    assert resp_bad.status_code == 200
    bad_data = resp_bad.json()
    assert bad_data["accepted"] is False
    assert bad_data["quarantined"] is True
    assert bad_data["error_code"] == "ERR_DATA_INTEGRITY_VIOLATION"


# ---------------------------------------------------------------------------
# Rubric Item 2: Quarantine invalid records in MongoDB
# ---------------------------------------------------------------------------
def test_2_quarantine_invalid_records_in_mongodb():
    """Invalid records are isolated into the quarantined_records collection."""
    mock_db = MagicMock()
    mock_quarantine_col = MagicMock()
    mock_db.__getitem__.side_effect = lambda name: mock_quarantine_col if name == "quarantined_records" else MagicMock()

    with patch.object(db, "get_database", return_value=mock_db):
        resp = client.post("/integrity/inject-malformed?scenario=negative_price")
        assert resp.status_code == 200
        data = resp.json()
        assert data["quarantined"] is True
        quarantine_id = data["quarantine_id"]

        # Verify MongoDB upsert was executed for quarantined_records
        assert mock_quarantine_col.replace_one.called
        call_args = mock_quarantine_col.replace_one.call_args[0]
        assert call_args[0] == {"_id": quarantine_id}
        assert call_args[1]["status"] == "quarantined"


# ---------------------------------------------------------------------------
# Rubric Item 3: Display the reason the record failed validation
# ---------------------------------------------------------------------------
def test_3_display_reasons_record_failed_validation():
    """Detailed human-readable and machine-readable rejection reasons are returned."""
    # Test negative amount
    resp = client.post("/integrity/inject-malformed?scenario=negative_price")
    data = resp.json()
    violations = data["violations"]
    assert len(violations) >= 1
    assert any("negative or zero" in v.lower() for v in violations)

    # Test invalid email & quantity & bogus currency
    resp_schema = client.post("/integrity/inject-malformed?scenario=missing_customer")
    schema_data = resp_schema.json()
    schema_violations = schema_data["violations"]
    assert any("email" in v.lower() for v in schema_violations)
    assert any("quantity" in v.lower() for v in schema_violations)
    assert any("currency" in v.lower() for v in schema_violations)


# ---------------------------------------------------------------------------
# Rubric Item 4: Add a controlled Inject Malformed action
# ---------------------------------------------------------------------------
def test_4_controlled_inject_malformed_action():
    """Controlled endpoints exist to inject distinct real-world corruption patterns on demand."""
    scenarios = ["negative_price", "missing_customer", "script_injection", "corrupt_types"]
    for sc in scenarios:
        resp = client.post(f"/integrity/inject-malformed?scenario={sc}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["quarantined"] is True
        assert data["status"] == "quarantined_dead_letter"
        assert len(data["violations"]) > 0


# ---------------------------------------------------------------------------
# Rubric Item 5: Implement Sanitize & Recover with revalidation
# ---------------------------------------------------------------------------
def test_5_sanitize_and_recover_with_revalidation():
    """Sanitize & Recover repairs defects, re-validates against the gate, and promotes to primary DB."""
    # 1. Inject malformed negative price record
    inj_resp = client.post("/integrity/inject-malformed?scenario=negative_price")
    quarantine_id = inj_resp.json()["quarantine_id"]

    # 2. Attempt recovery with an invalid payload (still negative) -> MUST BE REJECTED BY REVALIDATION
    fail_recovery = client.post(
        f"/integrity/quarantine/{quarantine_id}/recover",
        json={"repaired_payload": {"item_name": "Test", "customer_email": "a@b.com", "amount": -10.0, "quantity": 1}},
    )
    assert fail_recovery.status_code == 400
    assert "violates integrity gate" in fail_recovery.json()["detail"].lower()

    # 3. Successful recovery with automated sanitization
    recover_resp = client.post(f"/integrity/quarantine/{quarantine_id}/recover", json={})
    assert recover_resp.status_code == 200
    rec_data = recover_resp.json()
    assert rec_data["success"] is True
    promoted = rec_data["promoted_record"]
    assert promoted["amount"] == 450.00  # -450 fixed to +450
    assert promoted["integrity_verified"] is True
    assert promoted["recovered_from_quarantine"] == quarantine_id


# ---------------------------------------------------------------------------
# Rubric Item 6: Prove existing valid records remain unchanged
# ---------------------------------------------------------------------------
def test_6_prove_existing_valid_records_remain_unchanged():
    """Injecting multiple malformed records leaves existing valid records completely intact."""
    # Snapshot baseline
    status_0 = data_integrity.get_integrity_status()
    baseline_records = {r["id"]: r for r in status_0["valid_records"]}
    assert len(baseline_records) == 3

    # Inject 3 separate malicious payloads
    client.post("/integrity/inject-malformed?scenario=negative_price")
    client.post("/integrity/inject-malformed?scenario=missing_customer")
    client.post("/integrity/inject-malformed?scenario=script_injection")

    # Snapshot post-attack
    status_1 = data_integrity.get_integrity_status()
    current_records = {r["id"]: r for r in status_1["valid_records"]}

    # Prove primary database is 100% identical and uncontaminated
    assert current_records == baseline_records
    assert status_1["contamination_rate_percent"] == 0.0
    assert status_1["quarantined_records_count"] == 3
    assert status_1["valid_records_count"] == 3


# ---------------------------------------------------------------------------
# Rubric Item 7: Audit the full recovery process
# ---------------------------------------------------------------------------
def test_7_audit_the_full_recovery_process():
    """Audit trail logs every step: detection, quarantine isolation, and safe recovery."""
    # Step 1: Malformed injected -> triggers 'data_integrity_violation_quarantined' audit
    inj_resp = client.post("/integrity/inject-malformed?scenario=negative_price")
    quarantine_id = inj_resp.json()["quarantine_id"]

    quarantine_audits = [
        e for e in state.audit_log
        if e.get("event_type") == "data_integrity_violation_quarantined"
        and e.get("details", {}).get("quarantine_id") == quarantine_id
    ]
    assert len(quarantine_audits) == 1
    assert quarantine_audits[0]["service"] == "database"
    assert quarantine_audits[0]["details"]["status"] == "isolated_zero_primary_contamination"

    # Step 2: Sanitize & Recover -> triggers 'quarantine_record_recovered' audit
    rec_resp = client.post(f"/integrity/quarantine/{quarantine_id}/recover", json={})
    assert rec_resp.status_code == 200

    recovery_audits = [
        e for e in state.audit_log
        if e.get("event_type") == "quarantine_record_recovered"
        and e.get("details", {}).get("quarantine_id") == quarantine_id
    ]
    assert len(recovery_audits) == 1
    assert recovery_audits[0]["details"]["status"] == "safely_promoted_to_primary_store"
    assert "promoted_record_id" in recovery_audits[0]["details"]

