"""Backend tests for the HEIC/HEIF photo-upload fix in Rating DKA (kht/upload + kht/files).

Covers acceptance criteria:
 1. HEIC upload is transcoded and stored as real JPEG.
 3. Thumbnail (?w=400) and PDF-embed (?w=1600) variants are decodable JPEGs.
 4. Pre-fix broken storage objects (raw HEIC under a .jpg path) are auto-healed when served.
 5. A full DKA analyze run started from a HEIC photo yields a record whose image_path and
    every sample crop_path serve as decodable JPEGs.
 7. Corrupt / non-image uploads are rejected with HTTP 400 and a clear Indonesian message.
 8. Regression: plain JPEG/PNG uploads still work and serve back as decodable JPEGs.
"""
import io
import os
import time
import uuid

import pytest
import requests
from PIL import Image

BASE_URL = "http://localhost:8001"
API = f"{BASE_URL}/api"

HEIC_PATH = "/app/tests/fixtures/iphone_photo.heic"
DKA_HEIC_PATH = "/app/tests/fixtures/dka_iphone.heic"

created_dka_ids = []


@pytest.fixture(scope="session", autouse=True)
def _cleanup():
    yield
    try:
        r = requests.post(f"{API}/auth/login", json={"username": "admin", "password": "admin123"}, timeout=15)
        headers = {"X-Session-Token": r.json()["token"]} if r.status_code == 200 else {}
    except Exception:
        headers = {}
    for rid in created_dka_ids:
        try:
            requests.delete(f"{API}/dka/tests/{rid}", headers=headers, timeout=15)
        except Exception:
            pass


@pytest.fixture(scope="session")
def auth_headers():
    r = requests.post(f"{API}/auth/login", json={"username": "admin", "password": "admin123"}, timeout=15)
    assert r.status_code == 200, r.text
    token = r.json()["token"]
    return {"X-Session-Token": token}


def _is_jpeg(content: bytes) -> bool:
    return len(content) >= 2 and content[0] == 0xFF and content[1] == 0xD8


def _make_png(color=(20, 120, 200)) -> bytes:
    im = Image.new("RGBA", (300, 300), color + (255,))
    out = io.BytesIO()
    im.save(out, "PNG")
    return out.getvalue()


def _make_jpeg(color=(200, 90, 40)) -> bytes:
    im = Image.new("RGB", (300, 300), color)
    out = io.BytesIO()
    im.save(out, "JPEG", quality=85)
    return out.getvalue()


# ---- Criterion 1: HEIC upload stores a real JPEG --------------------------
def test_heic_upload_stores_real_jpeg(auth_headers):
    assert os.path.exists(HEIC_PATH), "fixture HEIC file missing"
    with open(HEIC_PATH, "rb") as f:
        heic_bytes = f.read()

    r = requests.post(
        f"{API}/kht/upload",
        files={"file": ("iphone_photo.heic", heic_bytes, "image/heic")},
        headers=auth_headers,
        timeout=60,
    )
    assert r.status_code == 200, r.text
    path = r.json()["image_path"]
    assert path.endswith(".jpg"), path

    r2 = requests.get(f"{API}/kht/files/{path}", timeout=30)
    assert r2.status_code == 200
    assert r2.headers.get("content-type", "").startswith("image/jpeg")
    assert _is_jpeg(r2.content), "served bytes are not a decodable JPEG (first bytes: %r)" % r2.content[:8]


# ---- Criterion 3: thumbnail + PDF-embed variants decodable ----------------
def test_heic_upload_thumbnail_and_pdf_variants(auth_headers):
    with open(DKA_HEIC_PATH, "rb") as f:
        heic_bytes = f.read()
    r = requests.post(
        f"{API}/kht/upload",
        files={"file": ("dka_iphone.heic", heic_bytes, "image/heic")},
        headers=auth_headers,
        timeout=60,
    )
    assert r.status_code == 200, r.text
    path = r.json()["image_path"]

    for w in (400, 1600):
        rw = requests.get(f"{API}/kht/files/{path}", params={"w": w}, timeout=30)
        assert rw.status_code == 200
        assert rw.headers.get("content-type", "").startswith("image/jpeg")
        assert _is_jpeg(rw.content), f"w={w} variant not decodable JPEG: {rw.content[:8]!r}"


# ---- Criterion 4: auto-heal of pre-fix broken photos -----------------------
def test_prefix_broken_photo_autoheals_on_serve():
    """Seed a storage object with raw HEIC bytes under a .jpg path (simulating the
    pre-fix bug), then verify GET .../files/{path} and ?w=1600 both auto-transcode
    it to a decodable JPEG instead of returning the raw HEIC bytes."""
    import sys
    sys.path.insert(0, "/app/backend")
    import server  # noqa: E402

    with open(HEIC_PATH, "rb") as f:
        raw_heic = f.read()
    legacy_path = f"{server.APP_NAME}/uploads/legacy-{uuid.uuid4()}.jpg"
    result = server.put_object(legacy_path, raw_heic, "image/jpeg")
    stored_path = result.get("path", legacy_path)

    # sanity: the raw bytes we wrote are NOT jpeg-magic (proves this really seeds the bug)
    assert not _is_jpeg(raw_heic)

    r = requests.get(f"{API}/kht/files/{stored_path}", timeout=30)
    assert r.status_code == 200
    assert _is_jpeg(r.content), f"auto-heal failed, got {r.content[:8]!r}"
    assert r.headers.get("content-type", "").startswith("image/jpeg")

    r2 = requests.get(f"{API}/kht/files/{stored_path}", params={"w": 1600}, timeout=30)
    assert r2.status_code == 200
    assert _is_jpeg(r2.content), f"auto-heal (w=1600) failed, got {r2.content[:8]!r}"


# ---- Criterion 7: corrupt / non-image upload rejected ----------------------
def test_corrupt_upload_rejected_with_clear_message(auth_headers):
    junk = os.urandom(5 * 1024)
    r = requests.post(
        f"{API}/kht/upload",
        files={"file": ("broken.jpg", junk, "image/jpeg")},
        headers=auth_headers,
        timeout=30,
    )
    assert r.status_code == 400, r.text
    detail = r.json().get("detail", "")
    assert "Format foto tidak didukung" in detail, detail


# ---- Criterion 8: regression - plain JPEG/PNG uploads still work ----------
def test_plain_jpeg_and_png_upload_regression(auth_headers):
    for name, blob, ctype in (
        ("plain.jpg", _make_jpeg(), "image/jpeg"),
        ("plain.png", _make_png(), "image/png"),
    ):
        r = requests.post(
            f"{API}/kht/upload",
            files={"file": (name, blob, ctype)},
            headers=auth_headers,
            timeout=30,
        )
        assert r.status_code == 200, r.text
        path = r.json()["image_path"]
        assert path.endswith(".jpg")

        for w in (None, 400):
            params = {"w": w} if w else {}
            rf = requests.get(f"{API}/kht/files/{path}", params=params, timeout=30)
            assert rf.status_code == 200
            assert _is_jpeg(rf.content)
            assert rf.headers.get("content-type", "").startswith("image/jpeg")


# ---- Criterion 5: full DKA analyze flow from a HEIC photo -----------------
def test_dka_analyze_full_flow_from_heic(auth_headers):
    with open(DKA_HEIC_PATH, "rb") as f:
        heic_bytes = f.read()
    r = requests.post(
        f"{API}/kht/upload",
        files={"file": ("dka_iphone.heic", heic_bytes, "image/heic")},
        headers=auth_headers,
        timeout=60,
    )
    assert r.status_code == 200, r.text
    image_path = r.json()["image_path"]

    batch_id = f"tscheck-dka-heic-{int(time.time())}"
    r = requests.post(
        f"{API}/dka/analyze/start",
        json={
            "image_path": image_path,
            "batch_id": batch_id,
            "product": "Engine Oil SAE 15W-40",
            "operator": "TS-Check",
            "temperature_c": 320,
            "duration_hours": 16,
            "remark": "",
        },
        headers=auth_headers,
        timeout=30,
    )
    assert r.status_code == 200, r.text
    job_id = r.json()["id"]

    record_id = None
    last = None
    deadline = time.time() + 180
    while time.time() < deadline:
        rj = requests.get(f"{API}/dka/analyze/jobs/{job_id}", headers=auth_headers, timeout=30)
        assert rj.status_code == 200
        last = rj.json()
        if last["status"] == "done":
            record_id = last["record_id"]
            break
        if last["status"] == "error":
            pytest.fail(f"DKA analyze job errored: {last.get('error')}")
        time.sleep(3)
    assert record_id, f"DKA analyze job did not finish in time: {last}"
    created_dka_ids.append(record_id)

    rec = requests.get(f"{API}/dka/tests/{record_id}", headers=auth_headers, timeout=30)
    assert rec.status_code == 200, rec.text
    doc = rec.json()
    assert doc["meta"]["batch_id"] == batch_id

    # image_path itself decodable at PDF width
    ri = requests.get(f"{API}/kht/files/{doc['image_path']}", params={"w": 1600}, timeout=30)
    assert ri.status_code == 200
    assert _is_jpeg(ri.content)

    samples = doc.get("samples", [])
    assert len(samples) >= 1
    for s in samples:
        cp = s.get("crop_path")
        assert cp, f"sample {s.get('index')} missing crop_path"
        rc = requests.get(f"{API}/kht/files/{cp}", params={"w": 1600}, timeout=30)
        assert rc.status_code == 200, rc.text
        assert _is_jpeg(rc.content), f"sample {s.get('index')} crop not decodable JPEG"
