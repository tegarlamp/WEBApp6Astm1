import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API } from "@/lib/api";

export { fileUrl, imageToDataUri, uploadImage, isClear, statusLabel } from "@/lib/kht/api";

export const COPPER = `${API}/copper`;

// Full ASTM D130 / IP 154 class list (fallback while the scale query loads).
export const COPPER_CLASSES = [
  { code: "0", label: "Freshly Polished", group: "Freshly Polished", color: "#E8955A", severity: 0, status: "CLEAR" },
  { code: "1a", label: "Slight Tarnish", group: "Slight Tarnish", color: "#EFB07A", severity: 1, status: "CLEAR" },
  { code: "1b", label: "Slight Tarnish", group: "Slight Tarnish", color: "#D6822F", severity: 2, status: "CLEAR" },
  { code: "2a", label: "Moderate Tarnish", group: "Moderate Tarnish", color: "#A83B4B", severity: 3, status: "TARNISH" },
  { code: "2b", label: "Moderate Tarnish", group: "Moderate Tarnish", color: "#B98FBE", severity: 4, status: "TARNISH" },
  { code: "2c", label: "Moderate Tarnish", group: "Moderate Tarnish", color: "#9C6FA6", severity: 5, status: "TARNISH" },
  { code: "2d", label: "Moderate Tarnish", group: "Moderate Tarnish", color: "#BFBFBF", severity: 6, status: "TARNISH" },
  { code: "3a", label: "Moderate Tarnish", group: "Moderate Tarnish", color: "#9C3A6B", severity: 7, status: "TARNISH" },
  { code: "3b", label: "Dark Tarnish", group: "Dark Tarnish", color: "#3E7D6B", severity: 8, status: "TARNISH" },
  { code: "3c", label: "Dark Tarnish", group: "Dark Tarnish", color: "#2E5A4E", severity: 9, status: "TARNISH" },
  { code: "4a", label: "Corrosion", group: "Corrosion", color: "#4A4A4A", severity: 10, status: "TARNISH" },
  { code: "4b", label: "Corrosion", group: "Corrosion", color: "#2B2B2B", severity: 11, status: "TARNISH" },
  { code: "4c", label: "Corrosion", group: "Corrosion", color: "#141414", severity: 12, status: "TARNISH" },
];

export const COPPER_COLOR_MAP = Object.fromEntries(COPPER_CLASSES.map((c) => [c.code, c.color]));

export function textOnColor(color) {
  const h = (color || "#888888").replace("#", "");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "#0A1420" : "#FFFFFF";
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

export const useCopperDashboard = () => useQuery({ queryKey: ["copper", "dashboard"], queryFn: () => getJSON(`${COPPER}/dashboard`) });
export const useCopperTests = (q) =>
  useQuery({ queryKey: ["copper", "tests", q ?? ""], queryFn: () => getJSON(`${COPPER}/tests${q ? `?q=${encodeURIComponent(q)}` : ""}`) });
export const useCopperTest = (id) => useQuery({ queryKey: ["copper", "test", id], queryFn: () => getJSON(`${COPPER}/tests/${id}`), enabled: !!id, retry: false });
export const useCopperBatch = (batchId) => useQuery({ queryKey: ["copper", "batch", batchId], queryFn: () => getJSON(`${COPPER}/batches/${encodeURIComponent(batchId)}`), enabled: !!batchId, retry: false });
export const useCopperTrend = () => useQuery({ queryKey: ["copper", "trend"], queryFn: () => getJSON(`${COPPER}/trend`) });
export const useCopperScale = () => useQuery({ queryKey: ["copper", "scale"], queryFn: () => getJSON(`${COPPER}/reference-scale`) });

export async function analyzeCopperWithPolling(payload, onTick) {
  const startRes = await postJsonWithRetry(`${COPPER}/analyze/start`, payload);
  if (!startRes.ok) throw new Error((await startRes.text()) || `Analysis failed: ${startRes.status}`);
  const job = await startRes.json();
  const started = Date.now();
  const deadline = started + 6 * 60 * 1000;
  while (Date.now() < deadline) {
    await sleep(2500);
    onTick?.(Math.round((Date.now() - started) / 1000));
    let st = null;
    try {
      const r = await fetch(`${COPPER}/analyze/jobs/${job.id}`);
      if (r.ok) st = await r.json();
    } catch {
      // transient — keep polling
    }
    if (!st) continue;
    if (st.status === "done" && st.record_id) return getJSON(`${COPPER}/tests/${st.record_id}`);
    if (st.status === "error") throw new Error(st.error || "AI Vision analysis failed.");
  }
  throw new Error("Analisa AI memakan waktu terlalu lama. Coba lagi dengan foto yang lebih kecil.");
}

export async function ocrCopperLabelWithPolling(image_path, onTick) {
  const startRes = await postJsonWithRetry(`${COPPER}/ocr/start`, { image_path });
  if (!startRes.ok) throw new Error((await startRes.text()) || `OCR start failed: ${startRes.status}`);
  const job = await startRes.json();
  const started = Date.now();
  const deadline = started + 4 * 60 * 1000;
  while (Date.now() < deadline) {
    await sleep(2000);
    onTick?.(Math.round((Date.now() - started) / 1000));
    let st = null;
    try {
      const r = await fetch(`${COPPER}/ocr/jobs/${job.id}`);
      if (r.ok) st = await r.json();
    } catch {
      // transient — keep polling
    }
    if (!st) continue;
    if (st.status === "done") return st.result;
    if (st.status === "error") throw new Error(st.error || "OCR gagal membaca label.");
  }
  throw new Error("OCR memakan waktu terlalu lama. Coba foto yang lebih jelas.");
}

export async function analyzeCopperBatchWithPolling(payload, onTick) {
  const startRes = await postJsonWithRetry(`${COPPER}/batch/analyze/start`, payload);
  if (!startRes.ok) throw new Error((await startRes.text()) || `Batch analysis failed: ${startRes.status}`);
  const job = await startRes.json();
  const started = Date.now();
  const deadline = started + 6 * 60 * 1000;
  while (Date.now() < deadline) {
    await sleep(2500);
    onTick?.(Math.round((Date.now() - started) / 1000));
    let st = null;
    try {
      const r = await fetch(`${COPPER}/batch/analyze/jobs/${job.id}`);
      if (r.ok) st = await r.json();
    } catch {
      // transient — keep polling
    }
    if (!st) continue;
    if (st.status === "done" && st.batch_id) {
      const records = await getJSON(`${COPPER}/batches/${encodeURIComponent(st.batch_id)}`);
      return { batch_id: st.batch_id, records };
    }
    if (st.status === "error") throw new Error(st.error || "AI Vision batch analysis failed.");
  }
  throw new Error("Analisa batch AI memakan waktu terlalu lama. Coba lagi dengan foto yang lebih kecil.");
}



export async function ocrCopperBatchWithPolling(image_path, onTick) {
  const startRes = await postJsonWithRetry(`${COPPER}/batch/ocr/start`, { image_path });
  if (!startRes.ok) throw new Error((await startRes.text()) || `Batch OCR failed: ${startRes.status}`);
  const job = await startRes.json();
  const started = Date.now();
  const deadline = started + 4 * 60 * 1000;
  while (Date.now() < deadline) {
    await sleep(2000);
    onTick?.(Math.round((Date.now() - started) / 1000));
    let st = null;
    try {
      const r = await fetch(`${COPPER}/batch/ocr/jobs/${job.id}`);
      if (r.ok) st = await r.json();
    } catch {
      // transient — keep polling
    }
    if (!st) continue;
    if (st.status === "done") return st.samples || [];
    if (st.status === "error") throw new Error(st.error || "OCR batch gagal membaca Sample ID.");
  }
  throw new Error("OCR batch memakan waktu terlalu lama. Coba foto yang lebih jelas.");
}
const invalidate = (qc) => qc.invalidateQueries({ queryKey: ["copper"] });

export function useAnalyzeCopper(onTick) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (payload) => analyzeCopperWithPolling(payload, onTick), onSuccess: () => invalidate(qc) });
}


export function useAnalyzeCopperBatch(onTick) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (payload) => analyzeCopperBatchWithPolling(payload, onTick), onSuccess: () => invalidate(qc) });
}

export function useDeleteCopper() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`${COPPER}/tests/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      return res.json();
    },
    onSuccess: () => invalidate(qc),
  });
}

export function useDeleteCopperBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (batchId) => {
      const res = await fetch(`${COPPER}/batches/${encodeURIComponent(batchId)}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.text()) || "Batch delete failed");
      return res.json();
    },
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdateCopper() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, changes }) => {
      const res = await fetch(`${COPPER}/tests/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes) });
      if (!res.ok) throw new Error((await res.text()) || `Update failed: ${res.status}`);
      return res.json();
    },
    onSuccess: (data) => {
      qc.setQueryData(["copper", "test", data.id], data);
      invalidate(qc);
    },
  });
}

export function defaultSampleId() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `CU-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${Math.floor(Math.random() * 900) + 100}`;
}


export function defaultBatchId() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `CU-BATCH-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${Math.floor(Math.random() * 900) + 100}`;
}
