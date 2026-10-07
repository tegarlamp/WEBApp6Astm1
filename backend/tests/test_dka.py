"""Backend tests for Rating DKA module."""
import os
import io
import time
import pytest
import requests
from PIL import Image, ImageDraw

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip()
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"

ALLOWED_RATINGS = {"CLEAR", "Aspect 1", "Aspect 2", "Aspect 3"}
created_ids = []


@pytest.fixture(scope="session", autouse=True)
def cleanup():
    yield
    for tid in created_ids:
        try:
            requests.delete(f"{API}/dka/tests/{tid}", timeout=10)
        except Exception:
            pass


# --- Dashboard ---
def test_dashboard():
    r = requests.get(f"{API}/dka/dashboard", timeout=30)
    assert r.status_code == 200
    d = r.json()
    for k in ("latest", "total_batches", "total_samples", "distribution"):
        assert k in d
    assert d["latest"] is not None
    assert d["latest"]["meta"]["batch_id"] == "DKA-DEMO-BATCH"
    assert len(d["latest"]["samples"]) == 4
    assert set(d["distribution"].keys()) == ALLOWED_RATINGS
    # Seeded 4 samples: one per category
    assert d["total_samples"] >= 4
    for cat in ALLOWED_RATINGS:
        assert d["distribution"][cat] >= 1


# --- List / search / get ---
def test_list_search_get():
    r = requests.get(f"{API}/dka/tests", timeout=30)
    assert r.status_code == 200
    tests = r.json()
    assert len(tests) >= 1
    batch = next(t for t in tests if t["meta"]["batch_id"] == "DKA-DEMO-BATCH")
    tid = batch["id"]

    # search by batch id
    r = requests.get(f"{API}/dka/tests", params={"q": "DKA-DEMO"}, timeout=30)
    assert r.status_code == 200
    assert any(t["meta"]["batch_id"] == "DKA-DEMO-BATCH" for t in r.json())

    # search by sample_id
    r = requests.get(f"{API}/dka/tests", params={"q": "DKA-2026-001"}, timeout=30)
    assert r.status_code == 200
    assert any(t["id"] == tid for t in r.json())

    # search by product
    r = requests.get(f"{API}/dka/tests", params={"q": "Engine Oil"}, timeout=30)
    assert r.status_code == 200 and len(r.json()) >= 1

    # get by id
    r = requests.get(f"{API}/dka/tests/{tid}", timeout=30)
    assert r.status_code == 200
    assert r.json()["id"] == tid

    # 404
    r = requests.get(f"{API}/dka/tests/does-not-exist", timeout=30)
    assert r.status_code == 404


# --- Update rating + sample_id and restore ---
def test_update_and_restore():
    tests = requests.get(f"{API}/dka/tests", timeout=30).json()
    batch = next(t for t in tests if t["meta"]["batch_id"] == "DKA-DEMO-BATCH")
    tid = batch["id"]
    orig_idx2 = next(s for s in batch["samples"] if s["index"] == 2)
    orig_idx1 = next(s for s in batch["samples"] if s["index"] == 1)
    orig_rating_2 = orig_idx2["rating"]
    orig_sid_1 = orig_idx1["sample_id"]

    # Update rating on index 2
    r = requests.put(f"{API}/dka/tests/{tid}", json={
        "samples": [{"index": 2, "rating": "Aspect 3"}]
    }, timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert d["edited"] is True
    s2 = next(s for s in d["samples"] if s["index"] == 2)
    assert s2["rating"] == "Aspect 3"
    assert s2["severity"] == 3
    assert s2["color"] == "#161616"

    # Update sample_id on index 1
    r = requests.put(f"{API}/dka/tests/{tid}", json={
        "samples": [{"index": 1, "sample_id": "X-1"}]
    }, timeout=30)
    assert r.status_code == 200
    d = r.json()
    s1 = next(s for s in d["samples"] if s["index"] == 1)
    assert s1["sample_id"] == "X-1"

    # RESTORE seed values
    r = requests.put(f"{API}/dka/tests/{tid}", json={
        "samples": [
            {"index": 2, "rating": orig_rating_2},
            {"index": 1, "sample_id": orig_sid_1},
        ]
    }, timeout=30)
    assert r.status_code == 200
    d = r.json()
    s2 = next(s for s in d["samples"] if s["index"] == 2)
    s1 = next(s for s in d["samples"] if s["index"] == 1)
    assert s2["rating"] == orig_rating_2
    assert s1["sample_id"] == orig_sid_1


# --- Trend + reference-scale ---
def test_trend():
    r = requests.get(f"{API}/dka/trend", timeout=30)
    assert r.status_code == 200
    trend = r.json()
    assert len(trend) >= 1
    for t in trend:
        for k in ("id", "batch_id", "avg_severity", "count", "created_at"):
            assert k in t


def test_reference_scale():
    r = requests.get(f"{API}/dka/reference-scale", timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert d["image"].startswith("data:image/")
    assert len(d["categories"]) == 4
    codes = [c["code"] for c in d["categories"]]
    assert codes == ["CLEAR", "Aspect 1", "Aspect 2", "Aspect 3"]


# --- AI full flow ---
def _make_batch_jpeg() -> bytes:
    im = Image.new("RGB", (1200, 800), (245, 243, 238))
    d = ImageDraw.Draw(im)
    # 4 tube-like rectangles with different colors
    colors = [(240, 238, 230), (200, 138, 62), (110, 59, 24), (22, 22, 22)]
    labels = ["T-1", "T-2", "T-3", "T-4"]
    slot = 1200 // 4
    for i, (c, lbl) in enumerate(zip(colors, labels)):
        cx = i * slot + slot // 2
        # tube body
        d.rectangle([cx - 60, 150, cx + 60, 620], fill=c, outline=(30, 30, 30), width=3)
        # label sticker under
        d.rectangle([cx - 55, 640, cx + 55, 720], fill=(255, 255, 255), outline=(0, 0, 0), width=2)
        d.text((cx - 20, 665), lbl, fill=(0, 0, 0))
    out = io.BytesIO()
    im.save(out, "JPEG", quality=88)
    return out.getvalue()


def test_analyze_missing_image_404():
    r = requests.post(f"{API}/dka/analyze/start", json={
        "image_path": "elastech-kht/uploads/nope.jpg",
        "batch_id": "TEST-BATCH", "product": "x", "operator": "",
    }, timeout=30)
    assert r.status_code == 404


def test_analyze_full_flow_and_delete():
    img = _make_batch_jpeg()
    r = requests.post(f"{API}/kht/upload", files={"file": ("batch.jpg", img, "image/jpeg")}, timeout=60)
    assert r.status_code == 200, r.text
    image_path = r.json()["image_path"]

    r = requests.post(f"{API}/dka/analyze/start", json={
        "image_path": image_path,
        "batch_id": "TEST-BATCH", "product": "Engine Oil SAE 15W-40",
        "operator": "TEST_OP",
    }, timeout=30)
    assert r.status_code == 200, r.text
    job_id = r.json()["id"]

    record_id = None
    deadline = time.time() + 180
    last = None
    while time.time() < deadline:
        r = requests.get(f"{API}/dka/analyze/jobs/{job_id}", timeout=30)
        assert r.status_code == 200
        j = r.json()
        last = j
        if j["status"] == "done":
            record_id = j["record_id"]
            break
        if j["status"] == "error":
            pytest.fail(f"AI job errored: {j.get('error')}")
        time.sleep(3)
    assert record_id, f"AI job did not finish: {last}"

    r = requests.get(f"{API}/dka/tests/{record_id}", timeout=30)
    assert r.status_code == 200
    rec = r.json()
    created_ids.append(record_id)
    assert 1 <= len(rec["samples"]) <= 4
    for s in rec["samples"]:
        assert s["rating"] in ALLOWED_RATINGS
        assert 0 <= s["severity"] <= 3
        assert s["color"].startswith("#")
        assert 0 <= s["confidence"] <= 100
        assert "index" in s and "sample_id" in s
        # summary optional but should exist as string
        assert isinstance(s.get("summary", ""), str)
        # crop_path served
        if s.get("crop_path"):
            fr = requests.get(f"{API}/kht/files/{s['crop_path']}", timeout=30)
            assert fr.status_code == 200
            assert fr.headers.get("content-type", "").startswith("image/")

    # Soft delete (this created batch only, not seeded)
    assert rec["meta"]["batch_id"] == "TEST-BATCH"  # safety
    r = requests.delete(f"{API}/dka/tests/{record_id}", timeout=30)
    assert r.status_code == 200
    r = requests.get(f"{API}/dka/tests/{record_id}", timeout=30)
    assert r.status_code == 404
    if record_id in created_ids:
        created_ids.remove(record_id)
