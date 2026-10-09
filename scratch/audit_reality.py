"""
Controlled Reality Audit for RecoverOps.
"""

from fastapi.testclient import TestClient
from app.main import app
from app import demo_store, state

client = TestClient(app)

def run_audit():
    # Reset state
    state.reset_state()
    demo_store.reset_demo_store()

    print("=== 1. Controlled Failure & Recovery Test ===")
    # Fail demo store
    client.post("/demo/chaos/fail", json={"reason": "DB pool exhausted"})
    r_health_before = client.get("/demo/health")
    r_prod_before = client.get("/demo/products")
    print(f"Before recovery: /demo/health status={r_health_before.status_code}, /demo/products status={r_prod_before.status_code}")
    print(f"Health response payload: {r_health_before.json()}")

    # Trigger live probe -> incident
    r_probe = client.post("/live/probe?auto_create_incident=true")
    probe_data = r_probe.json()
    inc_id = probe_data["incident"]["id"]
    failed_svc = probe_data["incident"]["failed_service"]
    print(f"Created Incident ID={inc_id}, failed_service={failed_svc}")

    # Trigger recovery
    r_rec = client.post(f"/recovery/start/{inc_id}")
    rec_data = r_rec.json()
    print(f"Recovery response: incident status={rec_data['incident']['status']}, job stage={rec_data.get('job', {}).get('stage')}")

    r_health_after = client.get("/demo/health")
    r_prod_after = client.get("/demo/products")
    print(f"After recovery: /demo/health status={r_health_after.status_code}, /demo/products status={r_prod_after.status_code}")
    print(f"Products returned: {len(r_prod_after.json().get('products', []))}")

    print("\n=== 2. Negative Test (Unrepaired failure) ===")
    state.reset_state()
    demo_store.reset_demo_store()
    client.post("/demo/chaos/fail")
    probe = client.post("/live/probe?auto_create_incident=true").json()
    neg_inc_id = probe["incident"]["id"]
    client.post("/simulate/configure", json={"service": "backend_api", "health_check_success": False, "health_check_error": "Probe failed: Connection refused"})
    r_neg_rec = client.post(f"/recovery/start/{neg_inc_id}")
    neg_data = r_neg_rec.json()
    print(f"Negative recovery incident status={neg_data['incident']['status']}, job stage={neg_data.get('job', {}).get('stage')}")
    last_step = neg_data['incident']['recovery_steps'][-1]
    print(f"Failure reason recorded in recovery step: {last_step.get('reason')}")
    print(f"Recovery Job error: {neg_data.get('job', {}).get('error')}")

    print("\n=== 3. High-Risk Approval Gate Test ===")
    state.reset_state()
    demo_store.reset_demo_store()
    inc_db = state.fail_service("database")
    r_db_rec = client.post(f"/recovery/start/{inc_db['id']}")
    db_data = r_db_rec.json()
    print(f"DB recovery paused status={db_data['incident']['status']}, pending_approval_id={db_data['incident']['pending_approval_id']}")
    print(f"Job stage: {db_data.get('job', {}).get('stage')}")

    # Confirm cannot execute before approval
    inc_after_poll = client.get(f"/incidents/{inc_db['id']}").json()["incident"]
    print(f"Incident before approval remains in status: {inc_after_poll['status']}")

    # Approve and verify completion
    appr_id = db_data["incident"]["pending_approval_id"]
    r_appr = client.post(f"/approvals/{appr_id}/approve", json={"reason": "Audit verification approval"})
    appr_res = r_appr.json()
    print(f"After approve: incident status={appr_res['incident']['status']}, approval status={appr_res['approval']['status']}")

if __name__ == "__main__":
    run_audit()
