"""
BRIDGE – Comprehensive Automated Tests for Codex-Style Multi-File Code Change Review.

Tests preview without modifying files, individual review, accept all, reject all,
stale patch rejection, post-application validation, security controls, and audit logs.
"""

import os
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from app import code_changes, state
from app.main import app

client = TestClient(app)
ROOT_DIR = Path(__file__).resolve().parent.parent


@pytest.fixture(autouse=True)
def clean_test_state():
    """Ensure clean state before and after each test."""
    state.reset_state()
    code_changes.reset_changesets()
    yield
    state.reset_state()
    code_changes.reset_changesets()


def test_propose_changeset_without_modifying_working_tree():
    """Proposing a change set must compute real diffs, additions, deletions, without writing to disk."""
    test_rel_path = "scratch/test_preview_sample.py"
    test_abs_path = ROOT_DIR / test_rel_path
    test_abs_path.parent.mkdir(parents=True, exist_ok=True)

    original_content = "def sample_func():\n    return 42\n"
    with open(test_abs_path, "w", encoding="utf-8") as f:
        f.write(original_content)

    proposed_content = "def sample_func():\n    # Optimized\n    return 100\n"

    try:
        # Propose change set via API
        resp = client.post(
            "/code-changes/propose",
            json={
                "title": "Fix return value in sample_func",
                "description": "Increases return value to 100",
                "service": "backend_api",
                "file_patches": {
                    test_rel_path: proposed_content,
                },
            },
        )
        assert resp.status_code == 200
        data = resp.json()["changeset"]

        # Verify change set metadata
        assert data["id"].startswith("CS-")
        assert data["title"] == "Fix return value in sample_func"
        assert data["status"] == "pending"
        assert data["total_files"] == 1
        assert data["total_additions"] == 2
        assert data["total_deletions"] == 1
        assert len(data["files"]) == 1

        file_obj = data["files"][0]
        assert file_obj["file_path"] == test_rel_path
        assert file_obj["filename"] == "test_preview_sample.py"
        assert file_obj["status"] == "pending"
        assert "+    # Optimized" in file_obj["diff_content"]
        assert "-    return 42" in file_obj["diff_content"]
        assert "+    return 100" in file_obj["diff_content"]

        # CRITICAL: Verify file on disk was NOT modified during preview
        with open(test_abs_path, "r", encoding="utf-8") as f:
            disk_content = f.read()
        assert disk_content == original_content

    finally:
        if test_abs_path.exists():
            test_abs_path.unlink()


def test_individual_file_review_and_apply():
    """Support reviewing, accepting one file, rejecting another, and applying only accepted files."""
    file1_rel = "scratch/test_file1.py"
    file2_rel = "scratch/test_file2.py"
    file1_abs = ROOT_DIR / file1_rel
    file2_abs = ROOT_DIR / file2_rel

    file1_abs.parent.mkdir(parents=True, exist_ok=True)
    with open(file1_abs, "w", encoding="utf-8") as f:
        f.write("# File 1 Original\nval1 = 1\n")
    with open(file2_abs, "w", encoding="utf-8") as f:
        f.write("# File 2 Original\nval2 = 2\n")

    prop1 = "# File 1 Updated\nval1 = 10\n"
    prop2 = "# File 2 Updated\nval2 = 20\n"

    try:
        # 1. Propose change set with 2 files
        resp = client.post(
            "/code-changes/propose",
            json={
                "title": "Update multiple files",
                "description": "Patch values in file1 and file2",
                "file_patches": {
                    file1_rel: prop1,
                    file2_rel: prop2,
                },
            },
        )
        cs_id = resp.json()["changeset"]["id"]

        # 2. Accept file1, Reject file2
        rev1 = client.post(
            f"/code-changes/{cs_id}/file-review",
            json={"file_path": file1_rel, "decision": "accepted"},
        )
        assert rev1.status_code == 200
        assert rev1.json()["changeset"]["status"] == "partially_reviewed"

        rev2 = client.post(
            f"/code-changes/{cs_id}/file-review",
            json={"file_path": file2_rel, "decision": "rejected"},
        )
        assert rev2.status_code == 200

        # 3. Apply change set
        apply_resp = client.post(f"/code-changes/{cs_id}/apply")
        assert apply_resp.status_code == 200
        apply_data = apply_resp.json()
        assert apply_data["status"] == "applied"
        assert apply_data["validation_results"]["passed"] is True

        # 4. Verify file1 was modified on disk, file2 remained unchanged
        with open(file1_abs, "r", encoding="utf-8") as f:
            assert f.read() == prop1

        with open(file2_abs, "r", encoding="utf-8") as f:
            assert f.read() == "# File 2 Original\nval2 = 2\n"

    finally:
        for p in (file1_abs, file2_abs):
            if p.exists():
                p.unlink()


def test_accept_all_applies_entire_change_set():
    """Accept All must mark all files accepted and apply all of them cleanly."""
    file_rel = "scratch/test_accept_all.py"
    file_abs = ROOT_DIR / file_rel
    file_abs.parent.mkdir(parents=True, exist_ok=True)
    with open(file_abs, "w", encoding="utf-8") as f:
        f.write("a = 1\n")

    prop = "a = 999\n"

    try:
        resp = client.post(
            "/code-changes/propose",
            json={
                "title": "Accept All Test",
                "description": "Testing accept all",
                "file_patches": {file_rel: prop},
            },
        )
        cs_id = resp.json()["changeset"]["id"]

        acc_resp = client.post(f"/code-changes/{cs_id}/accept-all")
        assert acc_resp.status_code == 200
        assert acc_resp.json()["changeset"]["status"] == "accepted"

        app_resp = client.post(f"/code-changes/{cs_id}/apply")
        assert app_resp.status_code == 200

        with open(file_abs, "r", encoding="utf-8") as f:
            assert f.read() == prop

    finally:
        if file_abs.exists():
            file_abs.unlink()


def test_reject_all_discards_changes_without_modifying_disk():
    """Reject All must mark all files rejected, and apply must refuse to touch any file."""
    file_rel = "scratch/test_reject_all.py"
    file_abs = ROOT_DIR / file_rel
    file_abs.parent.mkdir(parents=True, exist_ok=True)
    orig = "keep_me = True\n"
    with open(file_abs, "w", encoding="utf-8") as f:
        f.write(orig)

    try:
        resp = client.post(
            "/code-changes/propose",
            json={
                "title": "Reject All Test",
                "description": "Testing reject all",
                "file_patches": {file_rel: "keep_me = False\n"},
            },
        )
        cs_id = resp.json()["changeset"]["id"]

        rej_resp = client.post(f"/code-changes/{cs_id}/reject-all")
        assert rej_resp.status_code == 200
        assert rej_resp.json()["changeset"]["status"] == "rejected"

        # Attempt to apply must fail because 0 files are accepted
        apply_resp = client.post(f"/code-changes/{cs_id}/apply")
        assert apply_resp.status_code == 400
        assert "No files have been accepted" in apply_resp.json()["detail"]

        # Verify disk content is untouched
        with open(file_abs, "r", encoding="utf-8") as f:
            assert f.read() == orig

    finally:
        if file_abs.exists():
            file_abs.unlink()


def test_stale_patch_conflict_rejection():
    """Before applying, verify disk hash matches preview hash. Reject stale patches with 409 Conflict."""
    file_rel = "scratch/test_stale.py"
    file_abs = ROOT_DIR / file_rel
    file_abs.parent.mkdir(parents=True, exist_ok=True)

    with open(file_abs, "w", encoding="utf-8") as f:
        f.write("version = 1.0\n")

    try:
        # 1. Propose patch
        resp = client.post(
            "/code-changes/propose",
            json={
                "title": "Stale Conflict Test",
                "description": "Testing stale conflict",
                "file_patches": {file_rel: "version = 2.0\n"},
            },
        )
        cs_id = resp.json()["changeset"]["id"]
        client.post(f"/code-changes/{cs_id}/accept-all")

        # 2. Simulate concurrent out-of-band edit to the file on disk
        with open(file_abs, "w", encoding="utf-8") as f:
            f.write("version = 1.5 (concurrent edit)\n")

        # 3. Apply must detect hash mismatch and return 409 Conflict
        apply_resp = client.post(f"/code-changes/{cs_id}/apply")
        assert apply_resp.status_code == 409
        assert "Conflict detected" in apply_resp.json()["detail"]

        # 4. Verify disk content retained the concurrent edit and was not overwritten
        with open(file_abs, "r", encoding="utf-8") as f:
            assert f.read() == "version = 1.5 (concurrent edit)\n"

    finally:
        if file_abs.exists():
            file_abs.unlink()


def test_post_application_validation_failure():
    """If proposed code has syntax errors, validation runs and captures the error cleanly."""
    file_rel = "scratch/test_bad_syntax.py"
    file_abs = ROOT_DIR / file_rel
    file_abs.parent.mkdir(parents=True, exist_ok=True)

    with open(file_abs, "w", encoding="utf-8") as f:
        f.write("def valid_func():\n    pass\n")

    bad_syntax_code = "def broken_func(:\n    syntax error here\n"

    try:
        resp = client.post(
            "/code-changes/propose",
            json={
                "title": "Bad Syntax Test",
                "description": "Testing validation failure",
                "file_patches": {file_rel: bad_syntax_code},
            },
        )
        cs_id = resp.json()["changeset"]["id"]
        client.post(f"/code-changes/{cs_id}/accept-all")

        apply_resp = client.post(f"/code-changes/{cs_id}/apply")
        assert apply_resp.status_code == 200
        data = apply_resp.json()
        assert data["validation_results"]["passed"] is False
        assert len(data["validation_results"]["checks"]) > 0
        assert data["validation_results"]["checks"][0]["passed"] is False

    finally:
        if file_abs.exists():
            file_abs.unlink()


def test_security_prevents_path_traversal_and_sensitive_files():
    """Must reject path traversal (e.g. '../') and sensitive files (e.g. '.env')."""
    # 1. Path traversal
    resp1 = client.post(
        "/code-changes/propose",
        json={
            "title": "Traversal Attack",
            "description": "Attempting path traversal",
            "file_patches": {"../../etc/passwd": "bad content"},
        },
    )
    assert resp1.status_code == 400
    assert "Security error" in resp1.json()["detail"]

    # 2. Sensitive .env file
    resp2 = client.post(
        "/code-changes/propose",
        json={
            "title": "Env Attack",
            "description": "Attempting .env overwrite",
            "file_patches": {".env": "SECRET=hacked"},
        },
    )
    assert resp2.status_code == 400
    assert "Security error" in resp2.json()["detail"]


def test_audit_logging_of_code_change_review():
    """All code change lifecycle events must be recorded in the audit log."""
    file_rel = "scratch/test_audit.py"
    file_abs = ROOT_DIR / file_rel
    file_abs.parent.mkdir(parents=True, exist_ok=True)
    with open(file_abs, "w", encoding="utf-8") as f:
        f.write("x = 1\n")

    try:
        resp = client.post(
            "/code-changes/propose",
            json={
                "title": "Audit Test",
                "description": "Testing audit log recording",
                "incident_id": "INC-TEST-001",
                "file_patches": {file_rel: "x = 2\n"},
            },
        )
        cs_id = resp.json()["changeset"]["id"]
        client.post(f"/code-changes/{cs_id}/accept-all")
        client.post(f"/code-changes/{cs_id}/apply")

        audit_resp = client.get("/audit?incident_id=INC-TEST-001")
        assert audit_resp.status_code == 200
        events = [e["event_type"] for e in audit_resp.json()["audit_log"]]
        assert "code_patch_proposed" in events
        assert "code_patch_all_accepted" in events
        assert "code_patch_applied" in events

    finally:
        if file_abs.exists():
            file_abs.unlink()


def test_propose_incident_repair_10s_review_phases():
    """POST /recovery/propose-repair/{incident_id} must generate authentic changeset with 10s review metadata."""
    # 1. Create an incident first via simulate failure
    inc_resp = client.post("/simulate/fail/database")
    assert inc_resp.status_code == 200
    incident_id = inc_resp.json()["incident"]["id"]

    # 2. Propose repair changeset
    prop_resp = client.post(f"/recovery/propose-repair/{incident_id}")
    assert prop_resp.status_code == 200
    cs = prop_resp.json()["changeset"]

    # 3. Validate metadata
    assert cs["id"].startswith("CS-")
    assert cs["incident_id"] == incident_id
    assert cs["minimum_review_duration_seconds"] == 10.0
    assert cs["review_started_at"] is not None
    assert len(cs["review_phases"]) == 4

    # Check phase timings span 10.0 seconds
    assert cs["review_phases"][0]["duration_seconds"] == 2.5
    assert cs["review_phases"][1]["duration_seconds"] == 2.5
    assert cs["review_phases"][2]["duration_seconds"] == 2.5
    assert cs["review_phases"][3]["duration_seconds"] == 2.5
    assert sum(p["duration_seconds"] for p in cs["review_phases"]) == 10.0

    # Validate that files contain real diff content
    assert cs["total_files"] >= 1
    assert cs["total_additions"] > 0
    for f in cs["files"]:
        assert f["diff_content"] is not None
        assert f["original_content_hash"] is not None
        assert f["proposed_content"] is not None

    # Verify audit trail
    audit_resp = client.get(f"/audit?incident_id={incident_id}")
    assert audit_resp.status_code == 200
    events = [e["event_type"] for e in audit_resp.json()["audit_log"]]
    assert "code_patch_proposed" in events


def test_propose_incident_repair_unknown_incident():
    """POST /recovery/propose-repair/{incident_id} for unknown incident returns 404."""
    resp = client.post("/recovery/propose-repair/INC-DOES-NOT-EXIST")
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


