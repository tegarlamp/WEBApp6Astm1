import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, ImageIcon, Lightbulb, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { defaultBatchId, ocrCopperBatchWithPolling, uploadImage, useAnalyzeCopperBatch } from "@/lib/copper/api";
import { CameraCapture } from "@/components/kht/capture";
import { AmberBtn } from "@/components/copper/ui";
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
      className="h-11 rounded-md border border-zinc-700 bg-zinc-900 px-3 font-mono text-sm font-medium text-zinc-50 outline-none transition-colors placeholder:text-zinc-500 focus:border-amber-500"
    />
  </label>
);

export default function CopperNewTest() {
  const navigate = useNavigate();
  const galleryRef = useRef(null);
  const [stage, setStage] = useState("");
  const analyze = useAnalyzeCopperBatch((sec) => setStage(`Deteksi 4 strip, OCR & rating ASTM D130… ${sec}s`));
  const [imageUri, setImageUri] = useState(null);
  const [uploadedPath, setUploadedPath] = useState(null);
  const [preparing, setPreparing] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrStage, setOcrStage] = useState("");
  const [sampleIds, setSampleIds] = useState(["", "", "", ""]);
  const [f, setF] = useState({ batchId: defaultBatchId(), product: "", batch: "", operator: "", temperature: "135", duration: "168", remark: "" });
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));

  async function preparePhoto(previewUri, imagePath = null) {
    setImageUri(previewUri);
    setPreparing(true);
    setSampleIds(["", "", "", ""]);
    try {
      const path = imagePath || await uploadImage(previewUri);
      setUploadedPath(path);
      setOcrBusy(true);
      setOcrStage("Membaca 4 Sample ID…");
      const samples = await ocrCopperBatchWithPolling(path, (sec) => setOcrStage(`OCR Sample ID… ${sec}s`));
      setSampleIds(Array.from({ length: 4 }, (_, i) => samples[i]?.sample_id || ""));
      toast.success(`${samples.length} Sample ID terbaca otomatis. Periksa atau koreksi bila perlu.`);
    } catch (err) {
      toast.error(`OCR Sample ID gagal: ${String(err?.message || "coba foto lebih jelas").slice(0, 140)}`);
    } finally {
      setOcrBusy(false);
      setOcrStage("");
      setPreparing(false);
    }
  }

  async function onGalleryPick(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const { previewUri, imagePath } = await pickPreview(file);
      await preparePhoto(previewUri, imagePath);
    } catch (err) {
      toast.error(`Gagal membaca foto: ${String(err?.message || "format tidak didukung").slice(0, 120)}`);
    }
  }

  async function runAnalysis() {
    if (!imageUri) { toast.error("Ambil atau unggah satu foto berisi hingga 4 copper strip dulu."); return; }
    if (ocrBusy || preparing) { toast.info("Tunggu OCR Sample ID selesai."); return; }
    setBusy(true);
    let step = "Upload foto";
    try {
      setStage("Uploading foto batch…");
      const path = uploadedPath || (await uploadImage(imageUri));
      step = "Analisa AI Vision";
      setStage("Deteksi strip, OCR label & rating ASTM D130…");
      const result = await analyze.mutateAsync({
        image_path: path,
        batch_id: f.batchId,
        sample_ids: sampleIds,
        product: f.product,
        batch: f.batch,
        operator: f.operator,
        temperature_c: Number(f.temperature) || 135,
        duration_hours: Number(f.duration) || 168,
        remark: f.remark,
      });
      toast.success(`Analisa selesai — ${result.records.length} sample terdeteksi`);
      navigate(`/copper-strip/batch/${result.batch_id}`);
    } catch (e) {
      toast.error(`${step} gagal: ${String(e?.message || "AI batch analysis failed.").slice(0, 140)}`);
    } finally {
      setBusy(false);
      setStage("");
    }
  }

  const pickBtn = (icon, label, onClick, testId) => (
    <button type="button" onClick={onClick} data-testid={testId} className="flex min-w-[120px] flex-col items-center gap-2 rounded-md border border-zinc-700 bg-zinc-800 px-6 py-4 hover:border-amber-500/50">
      {icon}<span className="font-mono text-xs font-bold tracking-widest text-zinc-50">{label}</span>
    </button>
  );

  return (
    <div className="flex flex-col gap-3 pb-24 animate-fade-up" data-testid="copper-new-test">
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={onGalleryPick} data-testid="copper-gallery-input" />

      {imageUri ? (
        <div className="overflow-hidden rounded-xl border border-amber-500" data-testid="copper-image-preview-wrap">
          <img src={imageUri} alt="batch copper strip" className="h-64 w-full bg-zinc-800 object-contain" data-testid="copper-image-preview" />
          <div className="flex gap-2 bg-zinc-900 p-2">
            <button type="button" onClick={() => setShowCamera(true)} data-testid="copper-retake-camera" className="flex flex-1 items-center justify-center gap-2 rounded border border-zinc-700 bg-zinc-800 py-2 font-mono text-xs text-zinc-50 hover:bg-zinc-700"><Camera className="h-4 w-4" />Retake</button>
            <button type="button" onClick={() => galleryRef.current?.click()} data-testid="copper-change-gallery" className="flex flex-1 items-center justify-center gap-2 rounded border border-zinc-700 bg-zinc-800 py-2 font-mono text-xs text-zinc-50 hover:bg-zinc-700"><ImageIcon className="h-4 w-4" />Change</button>
          </div>
        </div>
      ) : preparing ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-amber-500/50 bg-zinc-900 p-8" data-testid="copper-preparing-photo">
          <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
          <p className="font-mono text-xs text-zinc-300">Menyiapkan foto…</p>
          <p className="font-mono text-[10px] text-zinc-500">Foto HP (HEIC) dikonversi dulu agar bisa ditampilkan</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-zinc-600 bg-zinc-900 p-6" data-testid="copper-pick-box">
          <p className="font-mono text-xs text-zinc-300">Satu foto berisi hingga 4 copper strip berjajar</p>
          <div className="flex gap-3">
            {pickBtn(<Camera className="h-6 w-6 text-amber-400" />, "CAMERA", () => setShowCamera(true), "copper-pick-camera")}
            {pickBtn(<ImageIcon className="h-6 w-6 text-amber-400" />, "GALLERY", () => galleryRef.current?.click(), "copper-pick-gallery")}
          </div>
        </div>
      )}

      <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3" data-testid="copper-ocr-tip">
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" />
        <p className="font-mono text-[11px] leading-4 text-zinc-200">Setelah foto diunggah, OCR otomatis membaca tulisan pada hingga 4 label Sample ID. Susun strip berjajar, beri jarak, gunakan cahaya merata, dan pastikan label terlihat. Kotak Sample ID dapat dikoreksi sebelum rating dijalankan.</p>
      </div>

      <div className="mt-2 font-mono text-[11px] tracking-[0.15em] text-amber-500">SAMPLE ID (OCR OTOMATIS)</div>
      <div className="grid gap-2 sm:grid-cols-2" data-testid="copper-sample-id-grid">
        {sampleIds.map((sampleId, index) => (
          <label key={`copper-sample-${index}`} className="flex flex-col gap-1">
            <span className="font-mono text-[10px] text-zinc-400">Sample {index + 1}</span>
            <input
              data-testid={`copper-input-sample-id-${index + 1}`}
              value={sampleId}
              onChange={(e) => setSampleIds((ids) => ids.map((id, i) => (i === index ? e.target.value : id)))}
              placeholder={`Sample ID ${index + 1}`}
              className="h-11 rounded-md border border-zinc-700 bg-zinc-900 px-3 font-mono text-sm font-bold text-zinc-50 outline-none placeholder:text-zinc-600 focus:border-amber-500"
            />
          </label>
        ))}
      </div>
      {ocrBusy && <div className="flex items-center gap-2 font-mono text-[11px] text-amber-300" data-testid="copper-ocr-stage"><Loader2 className="h-4 w-4 animate-spin" />{ocrStage}</div>}

      <div className="mt-2 font-mono text-[11px] tracking-[0.15em] text-amber-500">BATCH INFORMATION</div>
      <Field label="Batch ID" value={f.batchId} onChange={set("batchId")} testId="copper-input-batch-id" />
      <Field label="Product / Fuel" value={f.product} onChange={set("product")} testId="copper-input-product" />
      <Field label="Batch / Lot No." value={f.batch} onChange={set("batch")} placeholder="LOT-…" testId="copper-input-batch" />
      <Field label="Operator" value={f.operator} onChange={set("operator")} placeholder="Nama" testId="copper-input-operator" />
      <div className="mt-2 font-mono text-[11px] tracking-[0.15em] text-amber-500">TEST CONDITION</div>
      <div className="flex gap-3">
        <Field label="Temp (°C)" value={f.temperature} onChange={set("temperature")} numeric testId="copper-input-temp" />
        <Field label="Duration (h)" value={f.duration} onChange={set("duration")} numeric testId="copper-input-duration" />
      </div>
      <Field label="Remark" value={f.remark} onChange={set("remark")} placeholder="Opsional" testId="copper-input-remark" />

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-zinc-700 bg-zinc-900 px-4 py-3 lg:left-72">
        <div className="mx-auto max-w-3xl">
          <AmberBtn onClick={runAnalysis} disabled={busy || preparing || ocrBusy} data-testid="copper-run-analysis" className={`h-14 w-full text-sm ${!imageUri || busy || preparing || ocrBusy ? "opacity-50" : ""}`}>
            {busy ? <><Loader2 className="h-5 w-5 animate-spin" /><span data-testid="copper-analysis-stage">{stage || "PROCESSING…"}</span></> : <><Sparkles className="h-5 w-5" />RUN BATCH AI ANALYSIS</>}
          </AmberBtn>
        </div>
      </div>

      <CameraCapture open={showCamera} onClose={() => setShowCamera(false)} onCapture={(uri) => { setShowCamera(false); void preparePhoto(uri); }} />
    </div>
  );
}
