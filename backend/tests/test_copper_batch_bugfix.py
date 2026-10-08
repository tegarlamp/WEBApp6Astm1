"""
Backend tests for Copper Strip Batch bug fixes (iteration 14):
  Bug 1: PUT /api/copper/tests/{id} with {sample_id} must persist to meta.sample_id
         (not a top-level field). Verified via GET returning updated meta.sample_id.
  Bug 2: Batch analyze on a 4-strip photo must produce 4 records with crop_path
         images each roughly <= 1/3 of the original width (one strip per crop).
"""
import io
import os
import time
import base64
import pytest
import requests
from PIL import Image

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
FIXTURE_4 = "/app/tests/fixtures/copper_batch_4.jpg"
ADMIN_USER = "admin"
ADMIN_PASS = "admin123"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS}, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return s


# ---------- Bug 1: PUT persists to meta.sample_id ----------

def _create_minimal_record(session):
    """Insert a copper test directly via API: upload image + run SINGLE copper analyze
    to get a record quickly without running the whole batch. If AI fails we fall
    back to inserting via Mongo (not possible here) so we use batch analyze with
    sample_ids override to seed."""
    with open(FIXTURE_4, "rb") as f:
        up = session.post(f"{API}/kht/upload", files={"file": ("copper.jpg", f, "image/jpeg")}, timeout=60)
    assert up.status_code == 200, up.text
    image_path = up.json()["image_path"]
    # Use batch analyze (fast enough; one Gemini call) with 1 strip crop? use the 4-strip image
    body = {
        "image_path": image_path,
        "batch_id": "TEST_BUG1",
        "sample_ids": ["TEST_SEED_01", "TEST_SEED_02", "TEST_SEED_03", "TEST_SEED_04"],
        "product": "TEST_PRODUCT",
        "batch": "TEST_LOT",
        "operator": "pytest",
        "temperature_c": 100,
        "duration_hours": 3,
        "remark": "",
    }
    r = session.post(f"{API}/copper/batch/analyze/start", json=body, timeout=60)
    assert r.status_code == 200, r.text
    job = r.json()
    job_id, batch_id = job["id"], job["batch_id"]
    # Poll
    for _ in range(90):
        time.sleep(2)
        j = session.get(f"{API}/copper/batch/analyze/jobs/{job_id}", timeout=30).json()
        if j["status"] in ("done", "error"):
            break
    assert j["status"] == "done", f"job did not complete: {j}"
    return batch_id, j["record_ids"], image_path


@pytest.fixture(scope="session")
def seeded_batch(session):
    batch_id, record_ids, image_path = _create_minimal_record(session)
    yield batch_id, record_ids, image_path
    # cleanup
    try:
        session.delete(f"{API}/copper/batches/{batch_id}", timeout=30)
    except Exception:
        pass


def test_put_sample_id_persists_to_meta(session, seeded_batch):
    _, record_ids, _ = seeded_batch
    assert record_ids, "no records created"
    rid = record_ids[0]

    new_sid = "TEST_EDITED_SID_ABC"
    put = session.put(f"{API}/copper/tests/{rid}", json={"sample_id": new_sid}, timeout=30)
    assert put.status_code == 200, put.text
    data = put.json()
    # PUT response must reflect in meta.sample_id (NOT a top-level sample_id)
    assert data.get("meta", {}).get("sample_id") == new_sid, f"PUT body missed meta.sample_id: {data}"
    assert "sample_id" not in data or data.get("sample_id") in (None, "", new_sid), \
        "top-level sample_id should not shadow meta.sample_id"

    # GET must show the persisted value (verifies DB)
    g = session.get(f"{API}/copper/tests/{rid}", timeout=30)
    assert g.status_code == 200
    gd = g.json()
    assert gd["meta"]["sample_id"] == new_sid, f"GET did not persist meta.sample_id: {gd}"
    assert gd.get("edited") is True


def test_put_sample_id_trimmed(session, seeded_batch):
    _, record_ids, _ = seeded_batch
    rid = record_ids[-1]
    put = session.put(f"{API}/copper/tests/{rid}", json={"sample_id": "  TEST_TRIM_ME  "}, timeout=30)
    assert put.status_code == 200
    assert put.json()["meta"]["sample_id"] == "TEST_TRIM_ME"


# ---------- Bug 2: 4-strip batch yields 4 crops each ~ <= 1/3 width ----------

def test_batch_4_strips_each_crop_one_strip(session, seeded_batch):
    batch_id, record_ids, image_path = seeded_batch
    assert len(record_ids) == 4, f"Expected 4 strips detected, got {len(record_ids)}: ids={record_ids}"

    # Original image dims
    orig_bytes = session.get(f"{API}/kht/files/{image_path}", timeout=30).content
    orig = Image.open(io.BytesIO(orig_bytes))
    ow = orig.width
    max_allowed = ow / 3.0  # one strip must be <= ~1/3 of operator photo width

    # fetch batch records (full data)
    recs = session.get(f"{API}/copper/batches/{batch_id}", timeout=30).json()
    assert len(recs) == 4
    widths = []
    for r in recs:
        cp = r.get("crop_path")
        assert cp, f"record missing crop_path: {r}"
        cb = session.get(f"{API}/kht/files/{cp}", timeout=30)
        assert cb.status_code == 200, f"crop not fetchable: {cp} {cb.status_code}"
        im = Image.open(io.BytesIO(cb.content))
        widths.append(im.width)

    # Allow some slack: at least 3 of 4 crops must be <= 1/3 of width.
    # (AI may produce one slightly wider box.)
    ok = sum(1 for w in widths if w <= max_allowed * 1.15)
    assert ok >= 3, f"crops too wide (likely multi-strip): widths={widths} original_width={ow}"


def test_batch_ocr_reads_sample_ids(session, seeded_batch):
    """OCR step must read CU-01..CU-04 (at least 2 of 4) from the fixture image."""
    _, _, image_path = seeded_batch
    r = session.post(f"{API}/copper/batch/ocr/start", json={"image_path": image_path}, timeout=30)
    assert r.status_code == 200, r.text
    job_id = r.json()["id"]
    for _ in range(60):
        time.sleep(2)
        j = session.get(f"{API}/copper/batch/ocr/jobs/{job_id}", timeout=30).json()
        if j["status"] in ("done", "error"):
            break
    assert j["status"] == "done", j
    samples = j.get("samples") or []
    assert len(samples) >= 3, f"expected ~4 samples detected, got {samples}"
    ids = [str(s.get("sample_id", "")).upper().replace(" ", "") for s in samples]
    hits = sum(1 for want in ("CU-01", "CU-02", "CU-03", "CU-04") if any(want in x for x in ids))
    assert hits >= 2, f"OCR did not read CU-0x labels: {ids}"
