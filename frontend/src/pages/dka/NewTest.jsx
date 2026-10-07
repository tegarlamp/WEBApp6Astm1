import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, ImageIcon, Lightbulb, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { defaultBatchId, ocrDkaTemperatureWithPolling, uploadImage, useAnalyzeDka } from "@/lib/dka/api";
import { pickPreview } from "@/lib/kht/api";
import { CameraCapture } from "@/components/kht/capture";
import { BlueBtn } from "@/components/dka/ui";

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

export default function DkaNewTest() {
  const navigate = useNavigate();
  const galleryRef = useRef(null);
  const [stage, setStage] = useState("");
  const analyze = useAnalyzeDka((sec) => setStage(`Deteksi 4 tabung & OCR… ${sec}s`));
  const [imageUri, setImageUri] = useState(null);
  const [uploadedPath, setUploadedPath] = useState(null);
  const [preparing, setPreparing] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrStage, setOcrStage] = useState("");
  const [f, setF] = useState({ batchId: defaultBatchId(), product: "", operator: "", temperature: "", duration: "192", remark: "" });
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));

  async function preparePhoto(previewUri, imagePath = null) {
    setImageUri(previewUri);
    setPreparing(true);
    try {
      const path = imagePath || await uploadImage(previewUri);
      setUploadedPath(path);
      setOcrBusy(true);
      setOcrStage("Membaca Temp (°C) dari label…");
      const result = await ocrDkaTemperatureWithPolling(path, (sec) => setOcrStage(`OCR Temp (°C)… ${sec}s`));
      if (result.temperature_c != null) {
        setF((s) => ({ ...s, temperature: String(result.temperature_c) }));
        toast.success(`Temp terbaca otomatis: ${result.temperature_c}°C. Duration tetap 192 jam.`);
      } else {
        toast.info("Temp tidak terbaca dari label. Silakan isi manual.");
      }
    } catch (err) {
      toast.error(`OCR Temp gagal: ${String(err?.message || "coba foto lebih jelas").slice(0, 140)}`);
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
    if (!imageUri) { toast.error("Ambil atau unggah foto batch (maks 4 tabung) dulu."); return; }
    if (ocrBusy || preparing) { toast.info("Tunggu OCR Temp selesai."); return; }
    if (!f.temperature) { toast.error("Temp belum terbaca. Isi Temp (°C) manual lalu coba lagi."); return; }
    setBusy(true);
    let step = "Upload foto";
    try {
      setStage("Uploading image…");
      // Foto HEIC sudah diunggah saat preview disiapkan — jangan unggah dua kali.
      const path = uploadedPath || (await uploadImage(imageUri));
      step = "Analisa AI";
      setStage("Deteksi tabung & OCR label…");
      const result = await analyze.mutateAsync({
        image_path: path, batch_id: f.batchId, product: f.product, operator: f.operator,
        temperature_c: Number(f.temperature), duration_hours: 192, remark: f.remark,
      });
      toast.success(`Analisa selesai — ${result.samples.length} sampel terdeteksi`);
      setImageUri(null);
      setUploadedPath(null);
      set("batchId")(defaultBatchId());
      navigate(`/rating-dka/result/${result.id}`);
    } catch (e) {
      toast.error(`${step} gagal: ${String(e?.message || "AI analysis failed.").slice(0, 110)}`);
    } finally {
      setBusy(false);
      setStage("");
    }
  }

  const pickBtn = (icon, label, onClick, testId) => (
    <button type="button" onClick={onClick} data-testid={testId} className="flex min-w-[120px] flex-col items-center gap-2 rounded-md border border-zinc-700 bg-zinc-800 px-6 py-4 hover:border-blue-500/50">
      {icon}<span className="font-mono text-xs font-bold tracking-widest text-zinc-50">{label}</span>
    </button>
  );

  return (
    <div className="flex flex-col gap-3 pb-24 animate-fade-up" data-testid="dka-new-test">
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={onGalleryPick} data-testid="dka-gallery-input" />

      {imageUri ? (
        <div className="overflow-hidden rounded-xl border border-blue-500" data-testid="dka-image-preview-wrap">
          <img src={imageUri} alt="batch" className="h-64 w-full bg-zinc-800 object-cover" data-testid="dka-image-preview" />
          <div className="flex gap-2 bg-zinc-900 p-2">
            <button type="button" onClick={() => setShowCamera(true)} data-testid="dka-retake-camera" className="flex flex-1 items-center justify-center gap-2 rounded border border-zinc-700 bg-zinc-800 py-2 font-mono text-xs text-zinc-50 hover:bg-zinc-700"><Camera className="h-4 w-4" />Retake</button>
            <button type="button" onClick={() => galleryRef.current?.click()} data-testid="dka-change-gallery" className="flex flex-1 items-center justify-center gap-2 rounded border border-zinc-700 bg-zinc-800 py-2 font-mono text-xs text-zinc-50 hover:bg-zinc-700"><ImageIcon className="h-4 w-4" />Change</button>
          </div>
        </div>
      ) : preparing ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-blue-500/50 bg-zinc-900 p-8" data-testid="dka-preparing-photo">
          <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
          <p className="font-mono text-xs text-zinc-300">Menyiapkan foto…</p>
          <p className="font-mono text-[10px] text-zinc-500">Foto HP (HEIC) dikonversi dulu agar bisa ditampilkan</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-zinc-600 bg-zinc-900 p-6" data-testid="dka-pick-box">
          <p className="font-mono text-xs text-zinc-300">Foto hingga 4 tabung berjajar (resolusi tinggi)</p>
          <div className="flex gap-3">
            {pickBtn(<Camera className="h-6 w-6 text-blue-400" />, "CAMERA", () => setShowCamera(true), "dka-pick-camera")}
            {pickBtn(<ImageIcon className="h-6 w-6 text-blue-400" />, "GALLERY", () => galleryRef.current?.click(), "dka-pick-gallery")}
          </div>
        </div>
      )}

      <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3" data-testid="dka-ocr-tip">
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" />
        <p className="font-mono text-[11px] leading-4 text-zinc-200">Setelah foto diunggah, OCR otomatis membaca Temp (°C) dari label atau catatan uji. Product / Oil boleh dikosongkan. Duration selalu dimulai dari 192 jam.</p>
      </div>
      {ocrBusy && <div className="flex items-center gap-2 font-mono text-[11px] text-blue-300" data-testid="dka-ocr-stage"><Loader2 className="h-4 w-4 animate-spin" />{ocrStage}</div>}

      <div className="mt-2 font-mono text-[11px] tracking-[0.15em] text-blue-400">BATCH INFORMATION</div>
      <Field label="Batch ID" value={f.batchId} onChange={set("batchId")} testId="dka-input-batch-id" />
      <Field label="Product / Oil" value={f.product} onChange={set("product")} placeholder="Opsional" testId="dka-input-product" />
      <Field label="Operator" value={f.operator} onChange={set("operator")} placeholder="Nama" testId="dka-input-operator" />
      <div className="mt-2 font-mono text-[11px] tracking-[0.15em] text-blue-400">TEST CONDITION</div>
      <div className="flex gap-3">
        <Field label="Temp (°C)" value={f.temperature} onChange={set("temperature")} placeholder="Otomatis dari OCR" numeric testId="dka-input-temp" />
        <Field label="Duration (h)" value={f.duration} onChange={set("duration")} numeric testId="dka-input-duration" />
      </div>
      <Field label="Remark" value={f.remark} onChange={set("remark")} placeholder="Opsional" testId="dka-input-remark" />

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-zinc-700 bg-zinc-900 px-4 py-3 lg:left-72">
        <div className="mx-auto max-w-3xl">
          <BlueBtn onClick={runAnalysis} disabled={busy || preparing || ocrBusy} data-testid="dka-run-analysis" className={`h-14 w-full text-sm ${!imageUri || busy || preparing || ocrBusy ? "opacity-50" : ""}`}>
            {busy ? <><Loader2 className="h-5 w-5 animate-spin" /><span data-testid="dka-analysis-stage">{stage || "PROCESSING…"}</span></> : <><Sparkles className="h-5 w-5" />RUN BATCH AI ANALYSIS</>}
          </BlueBtn>
        </div>
      </div>

      <CameraCapture open={showCamera} onClose={() => setShowCamera(false)} onCapture={(uri) => { setShowCamera(false); void preparePhoto(uri); }} />
    </div>
  );
}
