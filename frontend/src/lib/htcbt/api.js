import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API } from "@/lib/api";

export { uploadImage } from "@/lib/kht/api";

export const HTCBT = `${API}/htcbt`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

async function postJSON(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) {
    let d;
    try { d = await res.json(); } catch { /* ignore */ }
    throw new Error(d?.detail || `Request failed: ${res.status}`);
  }
  return res.json();
}

async function del(url) {
  const res = await fetch(url, { method: "DELETE" });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

export const useHtcbtMethods = () =>
  useQuery({ queryKey: ["htcbt", "methods"], queryFn: () => getJSON(`${HTCBT}/methods`) });

export const useHtcbtActive = () =>
  useQuery({ queryKey: ["htcbt", "active"], queryFn: () => getJSON(`${HTCBT}/active`), refetchInterval: 30000 });

export const useHtcbtRuns = () =>
  useQuery({ queryKey: ["htcbt", "runs"], queryFn: () => getJSON(`${HTCBT}/runs`) });

export async function ocrLabelWithPolling(image_path, onTick) {
  const job = await postJSON(`${HTCBT}/ocr/start`, { image_path });
  const started = Date.now();
  const deadline = started + 4 * 60 * 1000;
  while (Date.now() < deadline) {
    await sleep(2000);
    onTick?.(Math.round((Date.now() - started) / 1000));
    let st = null;
    try { st = await getJSON(`${HTCBT}/ocr/jobs/${job.id}`); } catch { /* transient */ }
    if (!st) continue;
    if (st.status === "done") return st.result;
    if (st.status === "error") throw new Error(st.error || "OCR gagal membaca label.");
  }
  throw new Error("OCR memakan waktu terlalu lama. Coba foto yang lebih jelas.");
}

const invalidate = (qc) => qc.invalidateQueries({ queryKey: ["htcbt"] });

export function useHtcbtSubmit() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (payload) => postJSON(`${HTCBT}/submit`, payload), onSuccess: () => invalidate(qc) });
}

export function useHtcbtSubmitBatch() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (payload) => postJSON(`${HTCBT}/submit-batch`, payload), onSuccess: () => invalidate(qc) });
}

export function useHtcbtComplete() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id) => postJSON(`${HTCBT}/runs/${id}/complete`), onSuccess: () => invalidate(qc) });
}

export function useHtcbtStop() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id) => postJSON(`${HTCBT}/runs/${id}/stop`), onSuccess: () => invalidate(qc) });
}

export function useHtcbtDeleteRun() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id) => del(`${HTCBT}/runs/${id}`), onSuccess: () => invalidate(qc) });
}

export function useHtcbtRemoveSample() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, code }) => del(`${HTCBT}/runs/${id}/samples/${encodeURIComponent(code)}`),
    onSuccess: () => invalidate(qc),
  });
}

export function defaultSampleId() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `HTCBT-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${Math.floor(Math.random() * 900) + 100}`;
}

const DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export function fmtFull(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "\u2014";
  const p = (n) => String(n).padStart(2, "0");
  return `${DAYS[d.getDay()]}, ${p(d.getDate())}-${MONTHS[d.getMonth()]}-${d.getFullYear()}, ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function fmtCountdown(totalSec) {
  const sec = Math.max(0, Math.floor(totalSec));
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const p = (n) => String(n).padStart(2, "0");
  return `${d > 0 ? `${d}h ` : ""}${p(h)}:${p(m)}:${p(s)}`;
}

export function remainingSeconds(finishIso) {
  const finish = new Date(finishIso).getTime();
  if (isNaN(finish)) return 0;
  return Math.max(0, Math.round((finish - Date.now()) / 1000));
}
