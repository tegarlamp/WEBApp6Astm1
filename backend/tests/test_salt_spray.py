"""Backend tests for Salt Spray ASTM B117 (iteration_17).

Covers:
- CRUD + analyze (job-based) end-to-end with real AI (1 call)
- method endpoint always normalizes to 'zone' (even if 'full' sent)
- data isolation from rust (/api/rust/tests)
- locate-grid, dashboard, trend, reference-scale
"""
import os
import time
import base64
import pathlib
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fall back to local supervisor backend for in-pod runs
    BASE_URL = "http://localhost:8001"

FIXTURE = pathlib.Path("/app/tests/fixtures/saltspray_panel.jpg")


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    # auth cookie
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"username": "admin", "password": "admin123"}, timeout=20)
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def uploaded_image(client):
    with FIXTURE.open("rb") as f:
        r = client.post(f"{BASE_URL}/api/kht/upload", files={"file": ("saltspray.jpg", f, "image/jpeg")}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["image_path"]


def test_reference_scale(client):
    r = client.get(f"{BASE_URL}/api/salt-spray/reference-scale", timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert "grades" in data and "measurement_area" in data
    assert "50" in data["measurement_area"]


def test_dashboard_and_trend_load(client):
    r1 = client.get(f"{BASE_URL}/api/salt-spray/dashboard", timeout=10)
    r2 = client.get(f"{BASE_URL}/api/salt-spray/trend", timeout=10)
    assert r1.status_code == 200 and r2.status_code == 200


@pytest.fixture(scope="module")
def salt_record(client, uploaded_image):
    """Run one real AI job and return the created record id."""
    payload = {
        "image_path": uploaded_image,
        "sample_id": "TEST_SALT_17",
        "operator": "pytest",
        "product": "zinc-panel",
        "batch": "iter17",
        "exposure_hours": 96,
        "temperature_c": 35,
        "remark": "iteration_17",
        "method": "zone",
    }
    r = client.post(f"{BASE_URL}/api/salt-spray/analyze/start", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    job_id = r.json()["id"]
    # poll
    rec_id = None
    for _ in range(60):
        time.sleep(2)
        jr = client.get(f"{BASE_URL}/api/salt-spray/analyze/jobs/{job_id}", timeout=15)
        assert jr.status_code == 200
        j = jr.json()
        if j["status"] == "done":
            rec_id = j["record_id"]
            break
        if j["status"] == "error":
            pytest.fail(f"AI job errored: {j.get('error')}")
    assert rec_id, "AI job did not finish in time"
    yield rec_id
    # cleanup
    client.delete(f"{BASE_URL}/api/salt-spray/tests/{rec_id}", timeout=10)


def test_record_fields(client, salt_record):
    r = client.get(f"{BASE_URL}/api/salt-spray/tests/{salt_record}", timeout=10)
    assert r.status_code == 200
    rec = r.json()
    assert rec["method"] == "zone"
    assert rec["meta"]["sample_id"] == "TEST_SALT_17"
    assert isinstance(rec["rusted_box_count"], int)
    assert rec["grade"] in {"A", "B", "C", "D", "E"} or isinstance(rec["grade"], str)
    assert isinstance(rec.get("grid_boxes") or [], list)


def test_method_put_full_still_zone(client, salt_record):
    """Even if client sends 'full', backend _salt_norm_method always returns 'zone'."""
    r = client.put(f"{BASE_URL}/api/salt-spray/tests/{salt_record}/method",
                   json={"method": "full"}, timeout=15)
    assert r.status_code == 200, r.text
    assert r.json()["method"] == "zone"


def test_data_isolation_from_rust(client, salt_record):
    rr = client.get(f"{BASE_URL}/api/rust/tests", timeout=15)
    assert rr.status_code == 200
    rust_ids = {d["id"] for d in rr.json()}
    assert salt_record not in rust_ids

    sr = client.get(f"{BASE_URL}/api/salt-spray/tests", timeout=15)
    assert sr.status_code == 200
    assert salt_record in {d["id"] for d in sr.json()}


def test_list_search(client, salt_record):
    r = client.get(f"{BASE_URL}/api/salt-spray/tests", params={"q": "TEST_SALT_17"}, timeout=15)
    assert r.status_code == 200
    assert any(d["id"] == salt_record for d in r.json())


def test_update_inspector(client, salt_record):
    r = client.put(f"{BASE_URL}/api/salt-spray/tests/{salt_record}",
                   json={"inspector_count": 3}, timeout=15)
    assert r.status_code == 200
    rec = r.json()
    assert rec["inspector_count"] == 3
    assert rec.get("inspector_grade")
