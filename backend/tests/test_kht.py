"""Backend tests for K-HTT Analyst module."""
import os
import io
import time
import base64
import pytest
import requests
from PIL import Image, ImageDraw

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else None
if not BASE_URL:
    # Read frontend .env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
API = f"{BASE_URL}/api"

created_ids = []


@pytest.fixture(scope="session", autouse=True)
def cleanup():
    yield
    for tid in created_ids:
        try:
            requests.delete(f"{API}/kht/tests/{tid}", timeout=10)
        except Exception:
            pass


# ----- Dashboard / Trend / Color Scale -----
def test_dashboard():
    r = requests.get(f"{API}/kht/dashboard", timeout=30)
    assert r.status_code == 200
    d = r.json()
    for k in ("latest", "total", "passed", "failed", "avg_rating"):
        assert k in d
    assert d["total"] >= 4
    assert d["passed"] + d["failed"] == d["total"]
    assert d["latest"] is not None


def test_list_tests_and_search():
    r = requests.get(f"{API}/kht/tests", timeout=30)
    assert r.status_code == 200
    tests = r.json()
    assert len(tests) >= 4
    seed_ids = [t["meta"]["sample_id"] for t in tests]
    assert any(sid.startswith("KHT-2026-05-") for sid in seed_ids)

    # search
    r = requests.get(f"{API}/kht/tests", params={"q": "Karis"}, timeout=30)
    assert r.status_code == 200
    hits = r.json()
    assert all("Karis" in t["meta"]["operator"] for t in hits)
    assert len(hits) >= 1

    r = requests.get(f"{API}/kht/tests", params={"q": "Hydraulic"}, timeout=30)
    assert r.status_code == 200
    assert any("Hydraulic" in t["meta"]["oil_type"] for t in r.json())


def test_get_test_by_id_and_404():
    tests = requests.get(f"{API}/kht/tests", timeout=30).json()
    tid = tests[0]["id"]
    r = requests.get(f"{API}/kht/tests/{tid}", timeout=30)
    assert r.status_code == 200
    assert r.json()["id"] == tid

    r = requests.get(f"{API}/kht/tests/does-not-exist", timeout=30)
    assert r.status_code == 404


def test_update_rating_toggles_status():
    tests = requests.get(f"{API}/kht/tests", timeout=30).json()
    # pick a CLEAR seeded test
    clear = next(t for t in tests if t["status"] == "CLEAR")
    tid = clear["id"]
    original_rating = clear["rating"]

    # rating 5.5 -> TARNISH
    r = requests.put(f"{API}/kht/tests/{tid}", json={"rating": 5.5}, timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert d["rating"] == 5.5
    assert d["status"] == "TARNISH"
    assert d["edited"] is True

    # rating 8 -> CLEAR
    r = requests.put(f"{API}/kht/tests/{tid}", json={"rating": 8}, timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert d["rating"] == 8
    assert d["status"] == "CLEAR"

    # clamp
    r = requests.put(f"{API}/kht/tests/{tid}", json={"rating": 25}, timeout=30)
    assert r.status_code == 200
    assert r.json()["rating"] == 10

    r = requests.put(f"{API}/kht/tests/{tid}", json={"rating": -5}, timeout=30)
    assert r.status_code == 200
    assert r.json()["rating"] == 0

    # update summary + recommendation
    r = requests.put(f"{API}/kht/tests/{tid}", json={
        "ai_summary": "TEST summary edit",
        "recommendation": "TEST recommendation edit",
    }, timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert d["ai_summary"] == "TEST summary edit"
    assert d["recommendation"] == "TEST recommendation edit"

    # restore
    requests.put(f"{API}/kht/tests/{tid}", json={"rating": original_rating}, timeout=30)


def test_trend():
    r = requests.get(f"{API}/kht/trend", timeout=30)
    assert r.status_code == 200
    trend = r.json()
    assert len(trend) >= 4
    dates = [t["created_at"] for t in trend]
    assert dates == sorted(dates)
    for t in trend:
        assert "rating" in t and "sample_id" in t and "status" in t


def test_color_scale():
    r = requests.get(f"{API}/kht/color-scale", timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert d["image"].startswith("data:image/")
    assert len(d["levels"]) == 11
    levels = [lv["level"] for lv in d["levels"]]
    assert set(levels) == set(range(11))


# ----- Upload + analyze -----
def _make_test_jpeg() -> bytes:
    """A simple amber gradient JPEG resembling a tube."""
    im = Image.new("RGB", (400, 800), (240, 235, 220))
    d = ImageDraw.Draw(im)
    for y in range(200, 700):
        t = (y - 200) / 500
        r = int(200 - 60 * t)
        g = int(140 - 60 * t)
        b = int(60 - 30 * t)
        d.rectangle([150, y, 250, y + 1], fill=(r, g, b))
    out = io.BytesIO()
    im.save(out, "JPEG", quality=85)
    return out.getvalue()


def test_upload_and_serve():
    img = _make_test_jpeg()
    r = requests.post(f"{API}/kht/upload", files={"file": ("sample.jpg", img, "image/jpeg")}, timeout=60)
    assert r.status_code == 200, r.text
    path = r.json()["image_path"]
    assert path

    r = requests.get(f"{API}/kht/files/{path}", timeout=30)
    assert r.status_code == 200
    assert r.headers.get("content-type", "").startswith("image/")
    assert len(r.content) > 100


def test_chunked_upload():
    img = _make_test_jpeg()
    upload_id = "test-chunk-" + str(int(time.time()))
    # split into 2 chunks
    mid = len(img) // 2
    chunks = [img[:mid], img[mid:]]
    for i, c in enumerate(chunks):
        r = requests.post(f"{API}/kht/upload/chunk", json={
            "upload_id": upload_id, "index": i, "total": len(chunks),
            "data": base64.b64encode(c).decode(),
        }, timeout=30)
        assert r.status_code == 200
    r = requests.post(f"{API}/kht/upload/finish", json={"upload_id": upload_id, "ext": "jpg"}, timeout=60)
    assert r.status_code == 200
    assert r.json()["image_path"]


def test_analyze_missing_image_returns_404():
    r = requests.post(f"{API}/kht/analyze/start", json={
        "image_path": "elastech-kht/uploads/does-not-exist.jpg",
        "sample_id": "TEST_missing", "oil_type": "x", "batch": "", "operator": "",
        "temperature_c": 320, "duration_hours": 16, "air_flow": 10, "oil_flow": 0.31, "remark": "",
    }, timeout=30)
    assert r.status_code == 404


def test_analyze_full_flow():
    img = _make_test_jpeg()
    r = requests.post(f"{API}/kht/upload", files={"file": ("t.jpg", img, "image/jpeg")}, timeout=60)
    assert r.status_code == 200
    image_path = r.json()["image_path"]

    r = requests.post(f"{API}/kht/analyze/start", json={
        "image_path": image_path,
        "sample_id": "TEST_KHT_ANALYZE", "oil_type": "Engine Oil SAE 15W-40",
        "batch": "TEST_BATCH", "operator": "TEST_OP",
        "temperature_c": 320, "duration_hours": 16, "air_flow": 10, "oil_flow": 0.31, "remark": "",
    }, timeout=30)
    assert r.status_code == 200, r.text
    job_id = r.json()["id"]

    # poll
    record_id = None
    deadline = time.time() + 180
    last = None
    while time.time() < deadline:
        r = requests.get(f"{API}/kht/analyze/jobs/{job_id}", timeout=30)
        assert r.status_code == 200
        j = r.json()
        last = j
        if j["status"] == "done":
            record_id = j["record_id"]
            break
        if j["status"] == "error":
            pytest.fail(f"AI job errored: {j.get('error')}")
        time.sleep(3)
    assert record_id, f"AI job did not finish in time: {last}"

    r = requests.get(f"{API}/kht/tests/{record_id}", timeout=30)
    assert r.status_code == 200
    rec = r.json()
    created_ids.append(record_id)
    assert 0 <= rec["rating"] <= 10
    assert rec["status"] in ("CLEAR", "TARNISH")
    assert rec["performance"]
    assert rec["deposit_level_label"]
    assert rec["ai_summary"]
    assert rec["recommendation"]
    assert "parameters" in rec


def test_soft_delete():
    # Create a synthetic record via analyze - reuse one from above via a new upload+analyze would be expensive.
    # Instead insert via update path is not available; simulate by making a quick record through analyze if needed.
    # Simpler: use the record from test_analyze_full_flow. If not created, skip.
    if not created_ids:
        pytest.skip("no created record to delete")
    tid = created_ids[-1]
    r = requests.delete(f"{API}/kht/tests/{tid}", timeout=30)
    assert r.status_code == 200
    # not in list
    tests = requests.get(f"{API}/kht/tests", timeout=30).json()
    assert not any(t["id"] == tid for t in tests)
    # 404 on get
    r = requests.get(f"{API}/kht/tests/{tid}", timeout=30)
    assert r.status_code == 404
    created_ids.remove(tid)
