import sys
import os
sys.path.insert(0, os.path.abspath("."))
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
import httpx
import json
from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)

print("=" * 60)
print("RECOVEROPS COMPREHENSIVE E2E VERIFICATION SUITE")
print("=" * 60)

# Step 1: Health and Initial Products
print("\n[1] Testing initial health and fashion catalog...")
res_health = client.get("/demo/health")
assert res_health.status_code == 200, f"Expected 200, got {res_health.status_code}"
health_data = res_health.json()
print(f"  ✓ /demo/health status: {health_data['status']} ({health_data['service']})")

res_products = client.get("/demo/products")
assert res_products.status_code == 200, f"Expected 200, got {res_products.status_code}"
products_data = res_products.json()
print(f"  ✓ /demo/products returned {products_data['item_count']} items in catalog")
sample_p = products_data['products'][0]
print(f"  ✓ Sample Product: '{sample_p['name']}' - ₹{sample_p['price']} ({sample_p['category']})")

# Step 2: Inject Outage
print("\n[2] Injecting controlled chaos outage on Products API...")
res_chaos = client.post("/demo/chaos/fail", json={"reason": "DB Connection Pool Exhaustion"})
assert res_chaos.status_code == 200
print("  ✓ Outage injected successfully")

# Step 3: Verify Genuine HTTP 503
print("\n[3] Verifying genuine HTTP 503 responses...")
res_503_health = client.get("/demo/health")
assert res_503_health.status_code == 503, f"Expected 503, got {res_503_health.status_code}"
print(f"  ✓ /demo/health returned HTTP 503: {res_503_health.json()['error_code']}")

res_503_prod = client.get("/demo/products")
assert res_503_prod.status_code == 503, f"Expected 503, got {res_503_prod.status_code}"
print(f"  ✓ /demo/products returned HTTP 503: {res_503_prod.json()['detail']}")

# Step 4: Run Live Probe & Create Incident
print("\n[4] Running live probe with automated incident creation...")
res_probe = client.post("/live/probe?auto_create_incident=true")
assert res_probe.status_code == 200
probe_data = res_probe.json()
assert not probe_data["is_healthy"]
assert probe_data["incident"] is not None
inc_id = probe_data["incident"]["id"]
print(f"  ✓ Probe detected outage (HTTP {probe_data['health_probe']['status_code']})")
print(f"  ✓ Incident created in SRE Control Plane: INC-{inc_id[:8].upper()}")

# Step 5: Risk Gate Assessment
print("\n[5] Evaluating Recovery Confidence & Risk Gate...")
res_assess = client.post("/recovery/assess", json={"incident_id": inc_id})
assert res_assess.status_code == 200
assessment = res_assess.json()
print(f"  ✓ Readiness Status: {assessment['readiness_status']}")
print(f"  ✓ Risk Level: {assessment['risk_level']}")
print(f"  ✓ Recovery Sequence: {' -> '.join(assessment['recovery_order'])}")
print(f"  ✓ State Fingerprint: {assessment['state_fingerprint'][:10]}...")

# Step 6: Execute Recovery via Allowlisted Adapter
print("\n[6] Executing allowlisted recovery sequence...")
res_rec = client.post(f"/recovery/start/{inc_id}")
assert res_rec.status_code == 200
rec_data = res_rec.json()
print(f"  ✓ Recovery sequence completed: Status={rec_data['incident']['status']}")
assert rec_data['incident']['status'] == 'resolved'
assert rec_data['incident']['total_recovery_duration_seconds'] is not None
print(f"  ✓ Total Recovery Duration: {rec_data['incident']['total_recovery_duration_seconds']:.2f}s")

# Step 7: Verify Post-Recovery HTTP 200
print("\n[7] Verifying live endpoints post-recovery...")
res_post_health = client.get("/demo/health")
assert res_post_health.status_code == 200
print(f"  ✓ /demo/health verified: status={res_post_health.json()['status']}")

res_post_prod = client.get("/demo/products")
assert res_post_prod.status_code == 200
print(f"  ✓ /demo/products verified: {res_post_prod.json()['item_count']} items back online")

# Step 8: Audit Log Verification
print("\n[8] Inspecting audit trail for complete traceability...")
res_audit = client.get(f"/audit?incident_id={inc_id}")
assert res_audit.status_code == 200
audit_events = res_audit.json()["audit_log"]
print(f"  ✓ Audit log recorded {len(audit_events)} events for incident {inc_id[:8]}:")
for ev in audit_events:
    print(f"     - [{ev['event_type']}] {ev['service'] or 'system'}: {json.dumps(ev['details'])[:60]}...")

# Step 9: Database High-Risk Approval Verification
print("\n[9] Testing High-Risk Database Approval Safety Gate...")
# Simulate failure on database
res_db_fail = client.post("/simulate/fail/database")
assert res_db_fail.status_code == 200
inc_db = res_db_fail.json()["incident"]
print(f"  ✓ Triggered database failure: Incident ID={inc_db['id'][:8]}")

# Start recovery -> should transition to awaiting_approval
res_db_rec = client.post(f"/recovery/start/{inc_db['id']}")
assert res_db_rec.status_code == 200
assert res_db_rec.json()["incident"]["status"] == "awaiting_approval"
print("  ✓ Database recovery safely halted for human approval")

# Fetch pending approval
pending_appr = client.get("/approvals/pending").json()["pending_approvals"]
assert len(pending_appr) > 0
appr_id = pending_appr[0]["id"]
print(f"  ✓ Found pending approval requirement: ID={appr_id[:8]} (Risk: {pending_appr[0]['risk_level']})")

# Approve action
res_approve = client.post(f"/approvals/{appr_id}/approve", json={"reason": "Approved by Senior SRE"})
assert res_approve.status_code == 200
assert res_approve.json()["incident"]["status"] == "resolved"
print("  ✓ Approval granted -> Database recovery resumed and completed successfully!")

print("\n" + "=" * 60)
print("ALL 9 END-TO-END VERIFICATION CHECKS PASSED (100% SUCCESS)")
print("=" * 60)
