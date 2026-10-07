import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API } from "@/lib/api";

export const KHT = `${API}/kht`;

export const STATUS_CLEAR = "CLEAR";
export const STATUS_TARNISH = "TARNISH";
export const isClear = (s) => ["CLEAR", "PASS"].includes(String(s ?? "").toUpperCase());
export const statusLabel = (s) => (isClear(s) ? STATUS_CLEAR : STATUS_TARNISH);

export function fileUrl(path, w) {
  if (!path) return "";
  if (path.startsWith("http") || path.startsWith("data:") || path.startsWith("blob:")) return path;
  const base = `${KHT}/files/${path}`;
  return w ? `${base}?w=${w}` : base;
}

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function postJsonWithRetry(url, body, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    } catch (e) {
      lastErr = e;
      await sleep(1000 * (i + 1));
    }
  }
  throw new Error(`Tidak bisa terhubung ke server (${lastErr?.message ?? "network"}). Periksa koneksi lalu coba lagi.`);
}

export const useDashboard = () => useQuery({ queryKey: ["kht", "dashboard"], queryFn: () => getJSON(`${KHT}/dashboard`) });
export const useTests = (q) =>
  useQuery({ queryKey: ["kht", "tests", q ?? ""], queryFn: () => getJSON(`${KHT}/tests${q ? `?q=${encodeURIComponent(q)}` : ""}`) });
export const useTest = (id) => useQuery({ queryKey: ["kht", "test", id], queryFn: () => getJSON(`${KHT}/tests/${id}`), enabled: !!id, retry: false });
export const useTrend = () => useQuery({ queryKey: ["kht", "trend"], queryFn: () => getJSON(`${KHT}/trend`) });
export const useColorScale = () => useQuery({ queryKey: ["kht", "color-scale"], queryFn: () => getJSON(`${KHT}/color-scale`) });

async function downscaleBlob(blob, maxSide = 2000) {
  try {
    const bmp = await createImageBitmap(blob);
    const scale = Math.max(bmp.width, bmp.height) / maxSide;
    if (scale <= 1) return blob;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width / scale);
    canvas.height = Math.round(bmp.height / scale);
    canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const out = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.92));
    return out ?? blob;
  } catch {
    return blob;
  }
}

const blobToBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(fr.error);
    fr.onload = () => resolve(String(fr.result).split(",")[1] ?? "");
    fr.readAsDataURL(blob);
  });

async function uploadInChunks(blob, ext) {
  const b64 = await blobToBase64(blob);
  const CHUNK = 300 * 1024;
  const total = Math.max(1, Math.ceil(b64.length / CHUNK));
  const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  for (let i = 0; i < total; i++) {
    const res = await postJsonWithRetry(`${KHT}/upload/chunk`, { upload_id: uploadId, index: i, total, data: b64.slice(i * CHUNK, (i + 1) * CHUNK) });
    if (!res.ok) throw new Error(`Upload chunk ${i + 1}/${total} failed: ${res.status}`);
  }
  const fin = await postJsonWithRetry(`${KHT}/upload/finish`, { upload_id: uploadId, ext });
  if (!fin.ok) {
    if (fin.status === 400) {
      let detail = "";
      try { detail = (await fin.json())?.detail || ""; } catch { /* non-JSON */ }
      throw new Error(detail || "Format foto tidak didukung. Coba ambil ulang foto.");
    }
    throw new Error(`Upload finish failed: ${fin.status} ${await fin.text()}`);
  }
  return (await fin.json()).image_path;
}

export async function uploadImage(uri) {
  const clean = uri.split("?")[0].toLowerCase();
  const ext = clean.endsWith(".png") ? "png" : "jpg";
  const name = `tube_${Date.now()}.${ext}`;
  let blob = await (await fetch(uri)).blob();
  blob = await downscaleBlob(blob);
  try {
    const form = new FormData();
    form.append("file", blob, name);
    const res = await fetch(`${KHT}/upload`, { method: "POST", body: form });
    if (res.ok) return (await res.json()).image_path;
    if (res.status === 400) {
      // Server menolak foto (format tidak didukung / file rusak) — tampilkan pesannya.
      let detail = "";
      try { detail = (await res.json())?.detail || ""; } catch { /* non-JSON */ }
      throw new Error(detail || "Format foto tidak didukung. Coba ambil ulang foto.");
    }
    if (res.status !== 413) throw new Error(`Upload failed: ${res.status}`);
  } catch (e) {
    if (!(e instanceof TypeError) && !String(e?.message).includes("413")) throw e;
  }
  return uploadInChunks(blob, ext);
}

/**
 * Siapkan URI preview yang PASTI bisa ditampilkan browser.
 *
 * Foto HP (HEIC/HEIF dari iPhone) tidak bisa didecode browser, sehingga preview
 * lokal `URL.createObjectURL(file)` tampil sebagai gambar rusak walaupun server
 * sudah mengonversinya. Kalau browser tidak mampu membaca file-nya, file diunggah
 * lebih dulu lalu dipakai URL JPEG hasil konversi server sebagai preview.
 *
 * @returns {Promise<{previewUri: string, imagePath: string|null}>}
 *   `imagePath` terisi bila file sudah terunggah (supaya tidak diunggah dua kali).
 */
export async function pickPreview(file) {
  const localUri = URL.createObjectURL(file);
  try {
    const bmp = await createImageBitmap(file);
    bmp.close?.();
    return { previewUri: localUri, imagePath: null };
  } catch {
    const path = await uploadImage(localUri);
    URL.revokeObjectURL(localUri);
    return { previewUri: fileUrl(path, 1600), imagePath: path };
  }
}

export async function imageToDataUri(url) {
  if (!url) return null;
  if (url.startsWith("data:")) return url;
  try {
    const blob = await (await fetch(url)).blob();
    return await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onerror = () => reject(fr.error);
      fr.onload = () => resolve(fr.result);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function analyzeWithPolling(payload, onTick) {
  const startRes = await postJsonWithRetry(`${KHT}/analyze/start`, payload);
  if (!startRes.ok) throw new Error((await startRes.text()) || `Analysis failed: ${startRes.status}`);
  const job = await startRes.json();
  const started = Date.now();
  const deadline = started + 6 * 60 * 1000;
  while (Date.now() < deadline) {
    await sleep(2500);
    onTick?.(Math.round((Date.now() - started) / 1000));
    let st = null;
    try {
      const r = await fetch(`${KHT}/analyze/jobs/${job.id}`);
      if (r.ok) st = await r.json();
    } catch {
      // transient network error — keep polling
    }
    if (!st) continue;
    if (st.status === "done" && st.record_id) return getJSON(`${KHT}/tests/${st.record_id}`);
    if (st.status === "error") throw new Error(st.error || "AI Vision analysis failed.");
  }
  throw new Error("Analisa AI memakan waktu terlalu lama. Coba lagi dengan foto yang lebih kecil.");
}

export async function ocrKhtLabelWithPolling(image_path, onTick) {
  const startRes = await postJsonWithRetry(`${KHT}/ocr/start`, { image_path });
  if (!startRes.ok) throw new Error((await startRes.text()) || `OCR start failed: ${startRes.status}`);
  const job = await startRes.json();
  const started = Date.now();
  const deadline = started + 4 * 60 * 1000;
  while (Date.now() < deadline) {
    await sleep(2000);
    onTick?.(Math.round((Date.now() - started) / 1000));
    let st = null;
    try {
      const r = await fetch(`${KHT}/ocr/jobs/${job.id}`);
      if (r.ok) st = await r.json();
    } catch {
      // transient network error — keep polling
    }
    if (!st) continue;
    if (st.status === "done") return st.result;
    if (st.status === "error") throw new Error(st.error || "OCR gagal membaca label.");
  }
  throw new Error("OCR memakan waktu terlalu lama. Coba foto yang lebih jelas.");
}

const invalidateAll = (qc) => qc.invalidateQueries({ queryKey: ["kht"] });

export function useAnalyze(onTick) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (payload) => analyzeWithPolling(payload, onTick), onSuccess: () => invalidateAll(qc) });
}

export function useDeleteTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`${KHT}/tests/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      return res.json();
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUpdateTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, changes }) => {
      const res = await fetch(`${KHT}/tests/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes) });
      if (!res.ok) throw new Error((await res.text()) || `Update failed: ${res.status}`);
      return res.json();
    },
    onSuccess: (data) => {
      qc.setQueryData(["kht", "test", data.id], data);
      invalidateAll(qc);
    },
  });
}
