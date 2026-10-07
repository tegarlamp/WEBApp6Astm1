import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Crop, ImageIcon, Loader2, ScanLine, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { uploadImage, useAnalyze, ocrKhtLabelWithPolling } from "@/lib/kht/api";
import { defaultSampleId, defaultSecretOilCode } from "@/lib/kht/format";
import { CardLabel } from "@/components/kht/ui";
import { CameraCapture, CropEditor } from "@/components/kht/capture";
import { pickPreview } from "@/lib/kht/api";

const Field = ({ label, value, onChange, placeholder, numeric, testId, readOnly = false }) => (
  <label className="flex flex-1 flex-col gap-1">
    <span className="font-mono text-[11px] text-zinc-300">{label}</span>
    <input
      data-testid={testId}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      inputMode={numeric ? "decimal" : "text"}
      readOnly={readOnly}
      className={`h-11 rounded-md border border-zinc-700 bg-zinc-900 px-3 font-mono text-sm font-medium text-zinc-50 outline-none transition-colors placeholder:text-zinc-500 focus:border-amber-500 ${readOnly ? "cursor-not-allowed text-amber-300" : ""}`}
    />
  </label>
);

const SmallBtn = ({ icon: Icon, label, onClick, testId }) => (
  <button type="button" onClick={onClick} data-testid={testId} className="flex flex-1 items-center justify-center gap-2 rounded border border-zinc-700 bg-zinc-800 py-2 font-mono text-xs text-zinc-50 hover:bg-zinc-700">
    <Icon className="h-4 w-4" />{label}
  </button>
);

export default function KhtNewTest() {
  const navigate = useNavigate();
  const galleryRef = useRef(null);
  const [stage, setStage] = useState("");
  const analyze = useAnalyze((sec) => setStage(`Running AI Vision analysis… ${sec}s`));

  const [imageUri, setImageUri] = useState(null);
  const [rawImage, setRawImage] = useState(null);
  const [showCrop, setShowCrop] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [busy, setBusy] = useState(false);

  const [initialSample] = useState(() => defaultSampleId());
  const [f, setF] = useState({
    sampleId: initialSample, oilType: defaultSecretOilCode(), batch: "", operator: "",
    temperature: "290", duration: "16", airFlow: "10", oilFlow: "0.31", remark: "",
  });
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));

  // --- Auto label scan: read the handwritten code on the tube's white label ---
  const autoSampleRef = useRef(initialSample); // last auto-set sample id (never override manual typing)
  const ocrForRef = useRef(null); // raw image uri already scanned
  const [labelBusy, setLabelBusy] = useState(false);
  const [labelStage, setLabelStage] = useState("");
  const [labelFound, setLabelFound] = useState("");

  async function autoScanLabel(srcUri) {
    if (!srcUri || ocrForRef.current === srcUri || labelBusy) return;
    ocrForRef.current = srcUri;
    setLabelBusy(true);
    setLabelStage("Memindai kode sampel pada label\u2026");
    try {
      const path = await uploadImage(srcUri);
      const r = await ocrKhtLabelWithPolling(path, (sec) => setLabelStage(`Membaca label pada tube\u2026 ${sec}s`));
      const code = (r.sample_id || "").trim();
      setLabelFound(code);
      setF((s) => ({
        ...s,
        sampleId: code && s.sampleId === autoSampleRef.current ? code : s.sampleId,
        batch: r.batch && !s.batch ? r.batch : s.batch,
        operator: r.operator && !s.operator ? r.operator : s.operator,
        temperature: r.temperature_c != null && s.temperature === "290" ? String(r.temperature_c) : s.temperature,
        duration: r.duration_hours != null && s.duration === "16" ? String(r.duration_hours) : s.duration,
      }));
      if (code) autoSampleRef.current = code;
      if (code) {
        toast.success(`Kode sampel terbaca otomatis dari label: ${code}`);
      } else {
        toast.info("Kode sampel tidak terbaca pada label \u2014 isi manual bila perlu.");
      }
    } catch (e) {
      toast.error(`Baca label otomatis gagal: ${String(e?.message || "OCR gagal").slice(0, 110)}`);
    } finally {
      setLabelBusy(false);
      setLabelStage("");
    }
  }

  // The single camera/gallery flow below captures the image once. After crop, the same
  // capture automatically runs label OCR on the full frame and AI Vision on the focused tube.
  function openCropper(uri) {
    setRawImage(uri);
    setShowCrop(true);
  }

  async function onGalleryPick(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      // Cropper juga butuh gambar yang bisa didecode browser.
      const { previewUri } = await pickPreview(file);
      openCropper(previewUri);
    } catch (err) {
      toast.error(`Gagal membaca foto: ${String(err?.message || "format tidak didukung").slice(0, 120)}`);
    }
  }

  async function runAnalysis() {
    if (!imageUri) {
      toast.error("Capture or upload a tube photo first.");
      return;
    }
    setBusy(true);
    let step = "Upload foto";
    try {
      setStage("Uploading image…");
      const path = await uploadImage(imageUri);
      step = "Analisa AI";
      setStage("Running AI Vision segmentation…");
      const result = await analyze.mutateAsync({
        image_path: path,
        sample_id: f.sampleId,
        oil_type: f.oilType,
        batch: f.batch,
        operator: f.operator,
        temperature_c: Number(f.temperature) || 290,
        duration_hours: Number(f.duration) || 16,
        air_flow: Number(f.airFlow) || 10,
        oil_flow: Number(f.oilFlow) || 0.31,
        remark: f.remark,
      });
      toast.success("Analysis complete");
      setImageUri(null);
      const nextId = defaultSampleId();
      autoSampleRef.current = nextId;
      ocrForRef.current = null;
      setLabelFound("");
      set("sampleId")(nextId);
      navigate(`/khtt/result/${result.id}`);
    } catch (e) {
      toast.error(`${step} gagal: ${String(e?.message || "AI analysis failed.").slice(0, 110)}`);
    } finally {
      setBusy(false);
      setStage("");
    }
  }

  return (
    <div className="flex flex-col gap-3 pb-24 animate-fade-up" data-testid="kht-new-test">
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={onGalleryPick} data-testid="gallery-input" />

      {imageUri ? (
        <div className="overflow-hidden rounded-xl border border-amber-500" data-testid="image-preview-wrap">
          <div className="relative">
            <img src={imageUri} alt="cropped tube" className="h-56 w-full bg-zinc-800 object-cover" data-testid="image-preview" />
            <div className="absolute left-2 top-2 flex items-center gap-1 rounded bg-amber-500 px-2 py-0.5 font-mono text-[9px] font-bold tracking-widest text-zinc-950"><Crop className="h-3 w-3" />CROPPED FOR AI</div>
          </div>
          <div className="flex gap-2 bg-zinc-900 p-2">
            <SmallBtn icon={Crop} label="Crop" onClick={() => rawImage && setShowCrop(true)} testId="recrop" />
            <SmallBtn icon={Camera} label="Retake" onClick={() => setShowCamera(true)} testId="retake-camera" />
            <SmallBtn icon={ImageIcon} label="Change" onClick={() => galleryRef.current?.click()} testId="change-gallery" />
          </div>
          {(labelBusy || labelFound) && (
            <div className="flex items-center gap-2 border-t border-zinc-800 bg-zinc-950 px-3 py-2" data-testid="kht-label-scan-status">
              {labelBusy ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" /><span className="font-mono text-[10px] text-amber-300" data-testid="kht-label-scan-stage">{labelStage || "Memindai label…"}</span></>
              ) : (
                <><ScanLine className="h-3.5 w-3.5 text-emerald-400" /><span className="font-mono text-[10px] text-emerald-300">Kode sampel terbaca dari label: <b data-testid="kht-label-found">{labelFound}</b></span></>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-zinc-600 bg-zinc-900 p-6" data-testid="pick-box">
          <p className="font-mono text-xs text-zinc-300">Satu capture untuk OCR label + AI Vision tube</p>
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowCamera(true)} data-testid="pick-camera" className="flex min-w-[120px] flex-col items-center gap-2 rounded-md border border-zinc-700 bg-zinc-800 px-6 py-4 hover:border-amber-500/50">
              <Camera className="h-6 w-6 text-amber-500" /><span className="font-mono text-xs font-bold tracking-widest text-zinc-50">CAMERA</span>
            </button>
            <button type="button" onClick={() => galleryRef.current?.click()} data-testid="pick-gallery" className="flex min-w-[120px] flex-col items-center gap-2 rounded-md border border-zinc-700 bg-zinc-800 px-6 py-4 hover:border-amber-500/50">
              <ImageIcon className="h-6 w-6 text-amber-500" /><span className="font-mono text-xs font-bold tracking-widest text-zinc-50">GALLERY</span>
            </button>
          </div>
        </div>
      )}

      <CardLabel className="mt-3">SAMPLE INFORMATION</CardLabel>
      <Field label="Sample ID" value={f.sampleId} onChange={set("sampleId")} testId="input-sample-id" />
      <Field label="Product / Oil Type" value={f.oilType} onChange={set("oilType")} readOnly testId="input-oil-type" />
      <Field label="Batch / Lot No." value={f.batch} onChange={set("batch")} placeholder="LOT-…" testId="input-batch" />
      <Field label="Operator" value={f.operator} onChange={set("operator")} placeholder="Name" testId="input-operator" />

      <CardLabel className="mt-3">TEST CONDITION</CardLabel>
      <div className="flex gap-3">
        <Field label="Temp (°C)" value={f.temperature} onChange={set("temperature")} numeric testId="input-temp" />
        <Field label="Duration (h)" value={f.duration} onChange={set("duration")} numeric testId="input-duration" />
      </div>
      <div className="flex gap-3">
        <Field label="Air Flow (mL/min)" value={f.airFlow} onChange={set("airFlow")} numeric testId="input-air" />
        <Field label="Oil Flow (mL/min)" value={f.oilFlow} onChange={set("oilFlow")} numeric testId="input-oil" />
      </div>
      <Field label="Remark" value={f.remark} onChange={set("remark")} placeholder="Optional" testId="input-remark" />

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-zinc-700 bg-zinc-900 px-4 py-3 lg:left-72">
        <div className="mx-auto max-w-3xl">
          <button
            type="button"
            onClick={runAnalysis}
            disabled={busy || labelBusy}
            data-testid="run-analysis"
            className={`flex h-14 w-full items-center justify-center gap-2 rounded-md bg-amber-500 font-mono text-sm font-bold tracking-widest text-zinc-950 transition-colors hover:bg-amber-400 ${(!imageUri || busy || labelBusy) ? "opacity-50" : ""}`}
          >
            {busy ? <><Loader2 className="h-5 w-5 animate-spin" /><span data-testid="analysis-stage">{stage || "PROCESSING…"}</span></> : <><Sparkles className="h-5 w-5" />RUN AI VISION ANALYSIS</>}
          </button>
        </div>
      </div>

      <CameraCapture open={showCamera} onClose={() => setShowCamera(false)} onCapture={(uri) => { setShowCamera(false); openCropper(uri); }} />
      <CropEditor open={showCrop} src={rawImage} onCancel={() => setShowCrop(false)} onDone={(uri) => { setImageUri(uri); setShowCrop(false); autoScanLabel(rawImage || uri); }} />
    </div>
  );
}
