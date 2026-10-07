import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API } from "@/lib/api";

export { uploadImage } from "@/lib/kht/api";
export { fmtFull, fmtCountdown, remainingSeconds, defaultSampleId } from "@/lib/htcbt/api";

export const DKACEC = `${API}/dkacec`;

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

export const useDkacecMethods = () =>
  useQuery({ queryKey: ["dkacec", "methods"], queryFn: () => getJSON(`${DKACEC}/methods`) });

export const useDkacecActive = () =>
  useQuery({ queryKey: ["dkacec", "active"], queryFn: () => getJSON(`${DKACEC}/active`), refetchInterval: 30000 });

export const useDkacecRuns = () =>
  useQuery({ queryKey: ["dkacec", "runs"], queryFn: () => getJSON(`${DKACEC}/runs`) });

export async function ocrLabelWithPolling(image_path, onTick) {
  const job = await postJSON(`${DKACEC}/ocr/start`, { image_path });
  const started = Date.now();
  const deadline = started + 4 * 60 * 1000;
  while (Date.now() < deadline) {
    await sleep(2000);
    onTick?.(Math.round((Date.now() - started) / 1000));
    let st = null;
    try { st = await getJSON(`${DKACEC}/ocr/jobs/${job.id}`); } catch { /* transient */ }
    if (!st) continue;
    if (st.status === "done") return st.result;
    if (st.status === "error") throw new Error(st.error || "OCR gagal membaca label.");
  }
  throw new Error("OCR memakan waktu terlalu lama. Coba foto yang lebih jelas.");
}

export async function ocrRunHoursWithPolling(image_path, onTick) {
  const job = await postJSON(`${DKACEC}/runhours/start`, { image_path });
  const started = Date.now();
  const deadline = started + 4 * 60 * 1000;
  while (Date.now() < deadline) {
    await sleep(2000);
    onTick?.(Math.round((Date.now() - started) / 1000));
    let st = null;
    try { st = await getJSON(`${DKACEC}/runhours/jobs/${job.id}`); } catch { /* transient */ }
    if (!st) continue;
    if (st.status === "done") return st.result;
    if (st.status === "error") throw new Error(st.error || "OCR jam running gagal.");
  }
  throw new Error("OCR memakan waktu terlalu lama. Coba foto layar yang lebih jelas.");
}

/** Durasi uji tetap 192 jam untuk semua mesin. */
export const DKACEC_TOTAL_HOURS = 192;

/** Sisa waktu = 192:00 - jam running terbaca. Dihitung lokal agar preview instan. */
export function remainingFromRunHours(hours, minutes) {
  const h = Number.parseInt(hours, 10);
  const m = Number.parseInt(minutes, 10);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || m < 0 || m > 59) return null;
  const total = h * 60 + m;
  const limit = DKACEC_TOTAL_HOURS * 60;
  if (total > limit) return null;
  const rem = limit - total;
  const p = (n) => String(n).padStart(2, "0");
  return {
    hours: h,
    minutes: m,
    totalMinutes: total,
    label: `${p(h)}:${p(m)}`,
    remainingMinutes: rem,
    remainingHours: Math.floor(rem / 60),
    remainingMins: rem % 60,
    remainingLabel: `${p(Math.floor(rem / 60))}:${p(rem % 60)}`,
    expired: rem <= 0,
  };
}

/** Countdown jam:menit:detik (total jam, tanpa pemisah hari) — mis. 121:33:07. */
export function fmtHms(totalSec) {
  const sec = Math.max(0, Math.floor(totalSec));
  const p = (n) => String(n).padStart(2, "0");
  return `${p(Math.floor(sec / 3600))}:${p(Math.floor((sec % 3600) / 60))}:${p(sec % 60)}`;
}

const invalidate = (qc) => qc.invalidateQueries({ queryKey: ["dkacec"] });

export function useDkacecSubmitBatch() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (payload) => postJSON(`${DKACEC}/submit-batch`, payload), onSuccess: () => invalidate(qc) });
}

export function useDkacecComplete() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id) => postJSON(`${DKACEC}/runs/${id}/complete`), onSuccess: () => invalidate(qc) });
}

export function useDkacecStop() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id) => postJSON(`${DKACEC}/runs/${id}/stop`), onSuccess: () => invalidate(qc) });
}

export function useDkacecDeleteRun() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id) => del(`${DKACEC}/runs/${id}`), onSuccess: () => invalidate(qc) });
}

export function useDkacecRemoveSample() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, code }) => del(`${DKACEC}/runs/${id}/samples/${encodeURIComponent(code)}`),
    onSuccess: () => invalidate(qc),
  });
}
