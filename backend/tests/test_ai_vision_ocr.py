"""
AI Vision + OCR end-to-end test for all modules.
Verifies that the EMERGENT_LLM_KEY works (no 429 Budget exceeded / 502) across:
  - K-HTT   (/api/kht/analyze/start + jobs)
  - DKA     (/api/dka/analyze/start + jobs)
  - Copper  (/api/copper/analyze/start + jobs)
  - Rust    (/api/rust/analyze/start + jobs)
  - HTCBT OCR     (/api/htcbt/ocr/start + jobs)
  - DKA-CEC OCR   (/api/dkacec/ocr/start + jobs)
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
FIXTURE_JPG = "/app/tests/fixtures/plain_test.jpg"


# ---- Session fixture ------------------------------------------------------
@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    r = s.post(
        f"{BASE_URL}/api/auth/login",
        json={"username": "admin", "password": "admin123"},
        timeout=20,
    )
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def uploaded_image_path(client):
    """Upload a single image once and reuse the storage path for all modules."""
    with open(FIXTURE_JPG, "rb") as fh:
        r = client.post(
            f"{BASE_URL}/api/kht/upload",
            files={"file": ("plain_test.jpg", fh, "image/jpeg")},
            timeout=60,
        )
    assert r.status_code == 200, f"upload failed: {r.status_code} {r.text}"
    body = r.json()
    assert "image_path" in body, body
    return body["image_path"]


# ---- Helper to poll an async analyze/ocr job -----------------------------
def _poll_job(client, status_url, timeout=120):
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
        r = client.get(status_url, timeout=20)
        assert r.status_code == 200, f"job status {r.status_code} {r.text}"
        last = r.json()
        if last.get("status") in ("done", "error"):
            return last
        time.sleep(2)
    pytest.fail(f"job timed out: last={last}")


# ---- AI Vision tests ------------------------------------------------------
class TestAiVision:
    def test_kht_analyze(self, client, uploaded_image_path):
        start = client.post(
            f"{BASE_URL}/api/kht/analyze/start",
            json={"image_path": uploaded_image_path, "sample_id": "TEST_KHT_AI"},
            timeout=30,
        )
        assert start.status_code == 200, start.text
        job_id = start.json()["id"]
        result = _poll_job(client, f"{BASE_URL}/api/kht/analyze/jobs/{job_id}")
        assert result["status"] == "done", f"KHT job error: {result.get('error')}"
        assert result.get("record_id"), result

    def test_dka_analyze(self, client, uploaded_image_path):
        start = client.post(
            f"{BASE_URL}/api/dka/analyze/start",
            json={"image_path": uploaded_image_path, "batch_id": "TEST_DKA_AI"},
            timeout=30,
        )
        assert start.status_code == 200, start.text
        job_id = start.json()["id"]
        result = _poll_job(client, f"{BASE_URL}/api/dka/analyze/jobs/{job_id}")
        assert result["status"] == "done", f"DKA job error: {result.get('error')}"

    def test_copper_analyze(self, client, uploaded_image_path):
        start = client.post(
            f"{BASE_URL}/api/copper/analyze/start",
            json={"image_path": uploaded_image_path, "sample_id": "TEST_COP_AI"},
            timeout=30,
        )
        assert start.status_code == 200, start.text
        job_id = start.json()["id"]
        result = _poll_job(client, f"{BASE_URL}/api/copper/analyze/jobs/{job_id}")
        assert result["status"] == "done", f"Copper job error: {result.get('error')}"

    def test_rust_analyze(self, client, uploaded_image_path):
        start = client.post(
            f"{BASE_URL}/api/rust/analyze/start",
            json={"image_path": uploaded_image_path, "sample_id": "TEST_RUST_AI", "method": "zone"},
            timeout=30,
        )
        assert start.status_code == 200, start.text
        job_id = start.json()["id"]
        result = _poll_job(client, f"{BASE_URL}/api/rust/analyze/jobs/{job_id}", timeout=180)
        assert result["status"] == "done", f"Rust job error: {result.get('error')}"


# ---- OCR tests ------------------------------------------------------------
class TestOcr:
    def test_htcbt_ocr(self, client, uploaded_image_path):
        start = client.post(
            f"{BASE_URL}/api/htcbt/ocr/start",
            json={"image_path": uploaded_image_path},
            timeout=30,
        )
        assert start.status_code == 200, start.text
        job_id = start.json()["id"]
        result = _poll_job(client, f"{BASE_URL}/api/htcbt/ocr/jobs/{job_id}")
        # Allow "done" OR "error" with a *parsing* message (no budget / 502).
        err = (result.get("error") or "").lower()
        assert "budget" not in err and "429" not in err and "502" not in err, (
            f"HTCBT OCR hit LLM budget/quota: {result}"
        )
        assert result["status"] == "done", f"HTCBT OCR unexpected: {result}"

    def test_dkacec_ocr(self, client, uploaded_image_path):
        start = client.post(
            f"{BASE_URL}/api/dkacec/ocr/start",
            json={"image_path": uploaded_image_path},
            timeout=30,
        )
        assert start.status_code == 200, start.text
        job_id = start.json()["id"]
        result = _poll_job(client, f"{BASE_URL}/api/dkacec/ocr/jobs/{job_id}")
        err = (result.get("error") or "").lower()
        assert "budget" not in err and "429" not in err and "502" not in err, (
            f"DKA-CEC OCR hit LLM budget/quota: {result}"
        )
        assert result["status"] == "done", f"DKA-CEC OCR unexpected: {result}"
