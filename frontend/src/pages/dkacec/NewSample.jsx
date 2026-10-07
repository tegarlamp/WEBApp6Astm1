import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, ImageIcon, Loader2, ScanLine, Play, Trash2, Plus, MonitorSmartphone, Hourglass, PencilLine } from "lucide-react";
import { toast } from "sonner";
import {
  uploadImage, ocrLabelWithPolling, ocrRunHoursWithPolling, useDkacecSubmitBatch,
  useDkacecMethods, defaultSampleId, remainingFromRunHours, DKACEC_TOTAL_HOURS,
} from "@/lib/dkacec/api";
import { CameraCapture } from "@/components/kht/capture";
import { pickPreview } from "@/lib/kht/api";

const Field = ({ label, value, onChange, placeholder, numeric, testId }) => (
  <label className="flex flex-1 flex-col gap-1">
    <span className="font-mono text-[11px] text-zinc-300">{label}</span>
    <input
      data-testid={testId}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      inputMode={numeric ? "decimal" : "text"}
      className="h-11 rounded-md border border-zinc-700 bg-zinc-900 px-3 font-mono text-sm font-medium text-zinc-50 outline-none transition-colors placeholder:text-zinc-500 focus:border-blue-500"
    />
  </label>
);

export default function DkacecNewSample() {
  const navigate = useNavigate();
  const galleryRef = useRef(null);
  const { data: methodsData } = useDkacecMethods();
  const methods = methodsData?.methods || [];
  const maxSamples = methodsData?.max_samples || 4;
  const submit = useDkacecSubmitBatch();

  const [imageUri, setImageUri] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [rawText, setRawText] = useState("");
  const [scanned, setScanned] = useState(false);
  const [imagePath, setImagePath] = useState(null);
  const [samples, setSamples] = useState([{ id: crypto.randomUUID(), code: "" }]);
  const [f, setF] = useState({ operator: "", methodCode: "", temperature: "" });
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));

  // --- Jam running mesin (OCR foto layar monitor) ---
  const monitorGalleryRef = useRef(null);
  const [monitorUri, setMonitorUri] = useState(null);
  const [showMonitorCamera, setShowMonitorCamera] = useState(false);
  const [runBusy, setRunBusy] = useState(false);
  const [runStage, setRunStage] = useState("");
  const [runScanned, setRunScanned] = useState(false);
  const [runEdited, setRunEdited] = useState(false);
  const [runImagePath, setRunImagePath] = useState(null);
  const [runAxisLabels, setRunAxisLabels] = useState([]);
  const [runH, setRunH] = useState("");
  const [runM, setRunM] = useState("");

  const runPreview = remainingFromRunHours(runH, runM);
  const runFilled = runH !== "" || runM !== "";

  async function onMonitorPick(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const { previewUri, imagePath: up } = await pickPreview(file);
      setMonitorUri(previewUri);
      setRunImagePath(up);
      setRunScanned(false);
    } catch (err) {
      toast.error(`Gagal membaca foto: ${String(err?.message || "format tidak didukung").slice(0, 120)}`);
    }
  }

  async function runHoursOcr() {
    if (!monitorUri) { toast.error("Ambil atau unggah foto layar monitor dulu."); return; }
    setRunBusy(true);
    let step = "Upload foto";
    try {
      setRunStage("Uploading foto monitor\u2026");
      const path = runImagePath || (await uploadImage(monitorUri));
      step = "OCR jam running";
      setRunStage("Membaca jam running (AI Vision)\u2026");
      const r = await ocrRunHoursWithPolling(path, (sec) => setRunStage(`Membaca jam running\u2026 ${sec}s`));
      setRunImagePath(path);
      setRunAxisLabels(Array.isArray(r.axis_labels) ? r.axis_labels : []);
      setRunH(String(r.hours ?? ""));
      setRunM(String(r.minutes ?? "").padStart(2, "0"));
      setRunScanned(true);
      setRunEdited(false);
      toast.success(`Jam running terbaca: ${r.label} \u2014 periksa dulu, sisa waktu ${r.remaining_label}.`);
    } catch (e) {
      toast.error(`${step} gagal: ${String(e?.message || "OCR gagal").slice(0, 140)}`);
    } finally {
      setRunBusy(false);
      setRunStage("");
    }
  }

  function editRun(setter) {
    return (v) => { setter(v); if (runScanned) setRunEdited(true); };
  }

  const setSample = (idx, val) => setSamples((arr) => arr.map((s, i) => (i === idx ? { ...s, code: val } : s)));
  const removeSample = (idx) => setSamples((arr) => (arr.length <= 1 ? [{ id: crypto.randomUUID(), code: "" }] : arr.filter((_, i) => i !== idx)));
  const addSample = () => setSamples((arr) => (arr.length >= maxSamples ? arr : [...arr, { id: crypto.randomUUID(), code: "" }]));

  async function onGalleryPick(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      // Foto HEIC dari HP tidak bisa dirender browser -> diunggah & dikonversi server dulu.
      const { previewUri, imagePath: up } = await pickPreview(file);
      setImageUri(previewUri);
      setImagePath(up);
      setScanned(false);
    } catch (err) {
      toast.error(`Gagal membaca foto: ${String(err?.message || "format tidak didukung").slice(0, 120)}`);
    }
  }

  function applyMethod(code) {
    const m = methods.find((x) => x.code === code);
    setF((s) => ({
      ...s,
      methodCode: code,
      temperature: m ? String(m.temperature_c) : s.temperature,
    }));
  }

  async function runOcr() {
    if (!imageUri) { toast.error("Ambil atau unggah foto label dulu."); return; }
    setBusy(true);
    let step = "Upload foto";
    try {
      setStage("Uploading label\u2026");
      const path = imagePath || (await uploadImage(imageUri));
      step = "OCR AI Vision";
      setStage("Membaca tulisan tangan (AI Vision)\u2026");
      const r = await ocrLabelWithPolling(path, (sec) => setStage(`Membaca tulisan tangan\u2026 ${sec}s`));
      setImagePath(path);
      setRawText(r.raw_text || "");
      const codes = Array.isArray(r.sample_codes) && r.sample_codes.length
        ? r.sample_codes
        : (r.sample_code ? [r.sample_code] : []);
      setSamples(codes.length ? codes.map((c) => ({ id: crypto.randomUUID(), code: c })) : [{ id: crypto.randomUUID(), code: defaultSampleId() }]);
      setF((s) => ({
        ...s,
        methodCode: r.method_code || s.methodCode,
        temperature: r.temperature_c != null ? String(r.temperature_c) : s.temperature,
        operator: r.operator || s.operator,
      }));
      setScanned(true);
      if (r.over_limit) {
        toast.warning(`Terdeteksi lebih dari ${r.max_samples || maxSamples} sampel. Hanya ${r.max_samples || maxSamples} pertama yang diambil.`);
      }
      toast.success(`Label terbaca \u2014 ${codes.length} sampel terdeteksi. Periksa data lalu mulai timer.`);
    } catch (e) {
      toast.error(`${step} gagal: ${String(e?.message || "OCR gagal").slice(0, 120)}`);
    } finally {
      setBusy(false);
      setStage("");
    }
  }

  async function startTimer() {
    const codes = samples.map((s) => s.code.trim()).filter(Boolean);
    if (!codes.length) { toast.error("Minimal satu kode sampel wajib diisi."); return; }
    if (!f.methodCode && !f.temperature) { toast.error("Pilih metode atau isi suhu (\u00b0C)."); return; }
    if (runFilled && !runPreview) {
      toast.error(`Jam running tidak valid. Menit 0-59 dan maksimal ${DKACEC_TOTAL_HOURS} jam.`);
      return;
    }
    if (runPreview?.expired) {
      toast.error(`Jam running ${runPreview.label} sudah mencapai ${DKACEC_TOTAL_HOURS} jam \u2014 tidak ada sisa waktu.`);
      return;
    }
    setBusy(true);
    try {
      const res = await submit.mutateAsync({
        sample_codes: codes,
        temperature_c: f.temperature ? Number(f.temperature) : null,
        method_code: f.methodCode || null,
        operator: f.operator,
        image_path: imagePath,
        ocr_raw: rawText,
        running_hours: runPreview ? runPreview.hours : null,
        running_minutes: runPreview ? runPreview.minutes : null,
        runhours_image_path: runImagePath,
      });
      const addedN = (res.added || []).length;
      const skippedN = (res.skipped || []).length;
      let msg = res.created ? `Smart Timer dimulai \u2014 ${addedN} sampel.` : `${addedN} sampel ditambahkan ke batch aktif.`;
      if (res.created && runPreview) msg += ` Countdown mulai dari ${runPreview.remainingLabel}.`;
      if (skippedN) msg += ` ${skippedN} dilewati (duplikat/penuh).`;
      toast.success(msg);
      if (res.truncated) toast.warning(`Beberapa sampel melebihi batas ${res.max_samples} dan tidak dimasukkan.`);
      navigate("/dka-cec");
    } catch (e) {
      toast.error(String(e?.message || "Gagal memulai timer").slice(0, 140));
    } finally {
      setBusy(false);
    }
  }

  const pickBtn = (icon, label, onClick, testId) => (
    <button type="button" onClick={onClick} data-testid={testId} className="flex min-w-[120px] flex-col items-center gap-2 rounded-md border border-zinc-700 bg-zinc-800 px-6 py-4 hover:border-blue-500/50">
      {icon}<span className="font-mono text-xs font-bold tracking-widest text-zinc-50">{label}</span>
    </button>
  );

  return (
    <div className="flex flex-col gap-3 pb-28 animate-fade-up" data-testid="dkacec-new-sample">
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={onGalleryPick} data-testid="dkacec-gallery-input" />

      {imageUri ? (
        <div className="overflow-hidden rounded-xl border border-blue-500" data-testid="dkacec-image-preview-wrap">
          <img src={imageUri} alt="label sampel" className="h-56 w-full bg-zinc-800 object-cover" data-testid="dkacec-image-preview" />
          <div className="flex gap-2 bg-zinc-900 p-2">
            <button type="button" onClick={() => setShowCamera(true)} data-testid="dkacec-retake-camera" className="flex flex-1 items-center justify-center gap-2 rounded border border-zinc-700 bg-zinc-800 py-2 font-mono text-xs text-zinc-50 hover:bg-zinc-700"><Camera className="h-4 w-4" />Retake</button>
            <button type="button" onClick={() => galleryRef.current?.click()} data-testid="dkacec-change-gallery" className="flex flex-1 items-center justify-center gap-2 rounded border border-zinc-700 bg-zinc-800 py-2 font-mono text-xs text-zinc-50 hover:bg-zinc-700"><ImageIcon className="h-4 w-4" />Change</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-zinc-600 bg-zinc-900 p-6" data-testid="dkacec-pick-box">
          <p className="text-center font-mono text-xs text-zinc-300">Ambil atau unggah foto label tulisan tangan sampel</p>
          <div className="flex gap-3">
            {pickBtn(<Camera className="h-6 w-6 text-blue-400" />, "CAMERA", () => setShowCamera(true), "dkacec-pick-camera")}
            {pickBtn(<ImageIcon className="h-6 w-6 text-blue-400" />, "GALLERY", () => galleryRef.current?.click(), "dkacec-pick-gallery")}
          </div>
        </div>
      )}

      {imageUri && !scanned && (
        <button
          type="button"
          onClick={runOcr}
          disabled={busy}
          data-testid="dkacec-run-ocr"
          className="flex h-12 items-center justify-center gap-2 rounded-md bg-blue-500 font-mono text-sm font-bold tracking-widest text-zinc-950 hover:bg-blue-400 disabled:opacity-50"
        >
          {busy ? <><Loader2 className="h-5 w-5 animate-spin" /><span data-testid="dkacec-ocr-stage">{stage || "MEMPROSES\u2026"}</span></> : <><ScanLine className="h-5 w-5" /> BACA LABEL (OCR)</>}
        </button>
      )}

      <div className="mt-1 flex items-center justify-between">
        <div className="font-mono text-[11px] tracking-[0.15em] text-blue-400">
          DAFTAR SAMPEL {scanned ? "(hasil OCR \u2014 dapat diedit)" : ""}
        </div>
        <span className="font-mono text-[10px] text-zinc-500" data-testid="dkacec-sample-count">
          {samples.filter((s) => s.code.trim()).length}/{maxSamples}
        </span>
      </div>
      <div className="flex flex-col gap-2" data-testid="dkacec-sample-list">
        {samples.map((s, idx) => (
          <div key={s.id} className="flex items-center gap-2" data-testid={`dkacec-sample-row-${idx}`}>
            <span className="w-6 shrink-0 text-center font-mono text-[11px] text-zinc-500">{idx + 1}.</span>
            <input
              data-testid={`dkacec-input-sample-${idx}`}
              value={s.code}
              onChange={(e) => setSample(idx, e.target.value)}
              placeholder={`cth: WZ 275215`}
              className="h-11 flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 font-mono text-sm font-medium text-zinc-50 outline-none transition-colors placeholder:text-zinc-500 focus:border-blue-500"
            />
            <button
              type="button"
              onClick={() => removeSample(idx)}
              data-testid={`dkacec-remove-sample-${idx}`}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-red-500/60 hover:text-red-400"
              title="Hapus sampel"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {samples.length < maxSamples && (
          <button
            type="button"
            onClick={addSample}
            data-testid="dkacec-add-sample"
            className="flex h-10 items-center justify-center gap-2 rounded-md border border-dashed border-zinc-600 bg-zinc-900/50 font-mono text-xs text-zinc-300 hover:border-blue-500/50 hover:text-blue-400"
          >
            <Plus className="h-4 w-4" /> Tambah Sampel
          </button>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2 font-mono text-[11px] tracking-[0.15em] text-blue-400">
        <MonitorSmartphone className="h-3.5 w-3.5" /> JAM RUNNING MESIN (OCR LAYAR MONITOR)
      </div>
      <div className="flex flex-col gap-3 rounded-xl border border-zinc-700 bg-zinc-900 p-3" data-testid="dkacec-runhours-card">
        <p className="font-mono text-[11px] leading-4 text-zinc-400">
          Foto layar monitor mesin. OCR membaca angka jam paling kanan pada sumbu X grafik
          (mis. <span className="text-zinc-200">70:27</span>) sebagai jam running.
        </p>

        <input ref={monitorGalleryRef} type="file" accept="image/*" className="hidden" onChange={onMonitorPick} data-testid="dkacec-runhours-gallery-input" />

        {monitorUri ? (
          <div className="overflow-hidden rounded-lg border border-blue-500/60" data-testid="dkacec-runhours-preview-wrap">
            <img src={monitorUri} alt="layar monitor mesin" className="h-52 w-full bg-zinc-800 object-contain" data-testid="dkacec-runhours-preview" />
            <div className="flex gap-2 bg-zinc-950 p-2">
              <button type="button" onClick={() => setShowMonitorCamera(true)} data-testid="dkacec-runhours-retake-camera" className="flex flex-1 items-center justify-center gap-2 rounded border border-zinc-700 bg-zinc-800 py-2 font-mono text-xs text-zinc-50 hover:bg-zinc-700"><Camera className="h-4 w-4" />Retake</button>
              <button type="button" onClick={() => monitorGalleryRef.current?.click()} data-testid="dkacec-runhours-change-gallery" className="flex flex-1 items-center justify-center gap-2 rounded border border-zinc-700 bg-zinc-800 py-2 font-mono text-xs text-zinc-50 hover:bg-zinc-700"><ImageIcon className="h-4 w-4" />Change</button>
            </div>
          </div>
        ) : (
          <div className="flex gap-3" data-testid="dkacec-runhours-pick-box">
            {pickBtn(<Camera className="h-6 w-6 text-blue-400" />, "CAMERA", () => setShowMonitorCamera(true), "dkacec-runhours-pick-camera")}
            {pickBtn(<ImageIcon className="h-6 w-6 text-blue-400" />, "GALLERY", () => monitorGalleryRef.current?.click(), "dkacec-runhours-pick-gallery")}
          </div>
        )}

        {monitorUri && (
          <button
            type="button"
            onClick={runHoursOcr}
            disabled={runBusy}
            data-testid="dkacec-run-runhours-ocr"
            className="flex h-11 items-center justify-center gap-2 rounded-md border border-blue-500 bg-blue-500/10 font-mono text-[12px] font-bold tracking-widest text-blue-300 hover:bg-blue-500/20 disabled:opacity-50"
          >
            {runBusy
              ? <><Loader2 className="h-4 w-4 animate-spin" /><span data-testid="dkacec-runhours-stage">{runStage || "MEMPROSES\u2026"}</span></>
              : <><ScanLine className="h-4 w-4" /> {runScanned ? "BACA ULANG JAM RUNNING" : "BACA JAM RUNNING (OCR)"}</>}
          </button>
        )}

        {/* Hasil OCR ditampilkan lebih dulu agar bisa diverifikasi / dikoreksi manual */}
        <div className="rounded-lg border border-zinc-700 bg-zinc-950 p-3" data-testid="dkacec-runhours-result">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] tracking-widest text-zinc-500">JAM RUNNING TERBACA</span>
            {runScanned && (
              <span className={`rounded-full px-2 py-0.5 font-mono text-[9px] font-bold tracking-widest ${runEdited ? "bg-amber-500/15 text-amber-400" : "bg-emerald-500/15 text-emerald-400"}`} data-testid="dkacec-runhours-badge">
                {runEdited ? "DIKOREKSI MANUAL" : "HASIL OCR"}
              </span>
            )}
          </div>

          <div className="mt-2 flex items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] text-zinc-400">JAM</span>
              <input
                data-testid="dkacec-input-run-hours"
                value={runH}
                onChange={(e) => editRun(setRunH)(e.target.value.replace(/[^\d]/g, "").slice(0, 3))}
                placeholder="70"
                inputMode="numeric"
                className="h-12 w-20 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-center font-mono text-xl font-bold tabular-nums text-zinc-50 outline-none focus:border-blue-500"
              />
            </label>
            <span className="pb-3 font-mono text-xl font-bold text-zinc-500">:</span>
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] text-zinc-400">MENIT</span>
              <input
                data-testid="dkacec-input-run-minutes"
                value={runM}
                onChange={(e) => editRun(setRunM)(e.target.value.replace(/[^\d]/g, "").slice(0, 2))}
                placeholder="27"
                inputMode="numeric"
                className="h-12 w-20 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-center font-mono text-xl font-bold tabular-nums text-zinc-50 outline-none focus:border-blue-500"
              />
            </label>
            <div className="flex items-center gap-1 pb-3 font-mono text-[10px] text-zinc-500">
              <PencilLine className="h-3 w-3" /> bisa dikoreksi
            </div>
          </div>

          {runAxisLabels.length > 0 && (
            <div className="mt-3" data-testid="dkacec-runhours-axis-labels">
              <div className="font-mono text-[10px] tracking-widest text-zinc-500">LABEL SUMBU X TERBACA</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {runAxisLabels.map((l, i) => (
                  <span
                    key={`${l}-${i}`}
                    className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${i === runAxisLabels.length - 1 ? "bg-blue-500/20 font-bold text-blue-300" : "bg-zinc-800 text-zinc-400"}`}
                  >
                    {l}
                  </span>
                ))}
              </div>
            </div>
          )}

          {runFilled && !runPreview && (
            <p className="mt-3 font-mono text-[11px] text-red-400" data-testid="dkacec-runhours-invalid">
              Jam running tidak valid. Menit 0-59, maksimal {DKACEC_TOTAL_HOURS} jam.
            </p>
          )}

          {runPreview && (
            <div className="mt-3 rounded-lg border border-blue-500/40 bg-blue-500/5 p-3" data-testid="dkacec-runhours-remaining">
              <div className="flex items-center gap-1.5 font-mono text-[10px] tracking-widest text-blue-400">
                <Hourglass className="h-3 w-3" /> SISA WAKTU (START COUNTDOWN)
              </div>
              <div className="mt-1 font-mono text-[11px] text-zinc-400" data-testid="dkacec-runhours-formula">
                {DKACEC_TOTAL_HOURS}:00 &minus; {runPreview.label} =
              </div>
              <div className="font-heading text-3xl font-bold tabular-nums text-blue-300" data-testid="dkacec-runhours-remaining-value">
                {runPreview.remainingHours} jam {String(runPreview.remainingMins).padStart(2, "0")} menit
              </div>
              {runPreview.expired && (
                <p className="mt-1 font-mono text-[11px] text-red-400">Sudah mencapai {DKACEC_TOTAL_HOURS} jam — tidak ada sisa waktu.</p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-2 font-mono text-[11px] tracking-[0.15em] text-blue-400">DATA BATCH</div>
      <Field label="Operator" value={f.operator} onChange={set("operator")} placeholder="Nama analis (hasil OCR / manual)" testId="dkacec-input-operator" />

      <div className="mt-1 font-mono text-[11px] tracking-[0.15em] text-blue-400">METODE UJI (192 JAM)</div>
      <div className="grid grid-cols-3 gap-2" data-testid="dkacec-method-picker">
        {methods.map((m) => (
          <button
            key={m.code}
            type="button"
            data-testid={`dkacec-method-${m.code}`}
            onClick={() => applyMethod(m.code)}
            className={`rounded-lg border p-3 text-left transition-colors ${f.methodCode === m.code ? "border-blue-500 bg-blue-500/10" : "border-zinc-700 bg-zinc-900 hover:border-blue-500/40"}`}
          >
            <div className="font-mono text-[12px] font-bold text-zinc-50">{m.temperature_c}°C</div>
            <div className="font-mono text-[11px] text-zinc-400">{m.duration_hours} jam</div>
          </button>
        ))}
      </div>
      <div className="flex gap-3">
        <Field label="Suhu (°C)" value={f.temperature} onChange={set("temperature")} numeric testId="dkacec-input-temp" placeholder="150 / 160 / 180" />
      </div>

      {rawText && (
        <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3" data-testid="dkacec-raw-text">
          <div className="font-mono text-[10px] tracking-widest text-zinc-500">TEKS TERBACA</div>
          <p className="mt-1 whitespace-pre-wrap font-mono text-[11px] leading-4 text-zinc-400">{rawText}</p>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-zinc-700 bg-zinc-900 px-4 py-3 lg:left-72">
        <div className="mx-auto max-w-3xl">
          <button
            onClick={startTimer}
            disabled={busy || submit.isPending}
            data-testid="dkacec-start-timer"
            className={`flex h-14 w-full items-center justify-center gap-2 rounded-md bg-blue-500 font-mono text-sm font-bold tracking-widest text-zinc-950 hover:bg-blue-400 ${busy || submit.isPending ? "opacity-50" : ""}`}
          >
            {submit.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />} MULAI / TAMBAH TIMER
          </button>
        </div>
      </div>

      <CameraCapture open={showCamera} onClose={() => setShowCamera(false)} onCapture={(uri) => { setShowCamera(false); setImageUri(uri); setImagePath(null); setScanned(false); }} />
      <CameraCapture open={showMonitorCamera} onClose={() => setShowMonitorCamera(false)} onCapture={(uri) => { setShowMonitorCamera(false); setMonitorUri(uri); setRunImagePath(null); setRunScanned(false); }} />
    </div>
  );
}
