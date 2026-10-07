import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API } from "@/lib/api";

export { fileUrl, imageToDataUri, uploadImage } from "@/lib/kht/api";

export const DKA = `${API}/dka`;
export const DKA_CATEGORIES = ["CLEAR", "Aspect 1", "Aspect 2", "Aspect 3"];
export const DKA_FALLBACK_COLORS = { CLEAR: "#E3EAEC", "Aspect 1": "#C68A3E", "Aspect 2": "#6E3B18", "Aspect 3": "#161616" };

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

export const useDkaDashboard = () => useQuery({ queryKey: ["dka", "dashboard"], queryFn: () => getJSON(`${DKA}/dashboard`) });
export const useDkaTests = (q) =>
  useQuery({ queryKey: ["dka", "tests", q ?? ""], queryFn: () => getJSON(`${DKA}/tests${q ? `?q=${encodeURIComponent(q)}` : ""}`) });
export const useDkaTest = (id) => useQuery({ queryKey: ["dka", "test", id], queryFn: () => getJSON(`${DKA}/tests/${id}`), enabled: !!id, retry: false });
export const useDkaTrend = () => useQuery({ queryKey: ["dka", "trend"], queryFn: () => getJSON(`${DKA}/trend`) });
export const useDkaScale = () => useQuery({ queryKey: ["dka", "scale"], queryFn: () => getJSON(`${DKA}/reference-scale`) });

export async function analyzeDkaWithPolling(payload, onTick) {
  const startRes = await postJsonWithRetry(`${DKA}/analyze/start`, payload);
  if (!startRes.ok) throw new Error((await startRes.text()) || `Analysis failed: ${startRes.status}`);
  const job = await startRes.json();
  const started = Date.now();
  const deadline = started + 6 * 60 * 1000;
  while (Date.now() < deadline) {
    await sleep(2500);
    onTick?.(Math.round((Date.now() - started) / 1000));
    let st = null;
    try {
      const r = await fetch(`${DKA}/analyze/jobs/${job.id}`);
      if (r.ok) st = await r.json();
    } catch {
      // transient — keep polling
    }
    if (!st) continue;
    if (st.status === "done" && st.record_id) return getJSON(`${DKA}/tests/${st.record_id}`);
    if (st.status === "error") throw new Error(st.error || "AI Vision analysis failed.");
  }
  throw new Error("Analisa AI memakan waktu terlalu lama. Coba lagi dengan foto yang lebih kecil.");
}



export async function ocrDkaTemperatureWithPolling(image_path, onTick) {
  const startRes = await postJsonWithRetry(`${DKA}/ocr/start`, { image_path });
  if (!startRes.ok) throw new Error((await startRes.text()) || `OCR start failed: ${startRes.status}`);
  const job = await startRes.json();
  const started = Date.now();
  const deadline = started + 4 * 60 * 1000;
  while (Date.now() < deadline) {
    await sleep(2000);
    onTick?.(Math.round((Date.now() - started) / 1000));
    let st = null;
    try {
      const r = await fetch(`${DKA}/ocr/jobs/${job.id}`);
      if (r.ok) st = await r.json();
    } catch {
      // transient — keep polling
    }
    if (!st) continue;
    if (st.status === "done") return st.result || {};
    if (st.status === "error") throw new Error(st.error || "OCR suhu gagal membaca label.");
  }
  throw new Error("OCR suhu memakan waktu terlalu lama. Coba foto yang lebih jelas.");
}
const invalidate = (qc) => qc.invalidateQueries({ queryKey: ["dka"] });

export function useAnalyzeDka(onTick) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (payload) => analyzeDkaWithPolling(payload, onTick), onSuccess: () => invalidate(qc) });
}

export function useDeleteDka() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`${DKA}/tests/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      return res.json();
    },
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdateDka() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, changes }) => {
      const res = await fetch(`${DKA}/tests/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes) });
      if (!res.ok) throw new Error((await res.text()) || `Update failed: ${res.status}`);
      return res.json();
    },
    onSuccess: (data) => {
      qc.setQueryData(["dka", "test", data.id], data);
      invalidate(qc);
    },
  });
}

export function defaultBatchId() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `DKA-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${Math.floor(Math.random() * 900) + 100}`;
}
