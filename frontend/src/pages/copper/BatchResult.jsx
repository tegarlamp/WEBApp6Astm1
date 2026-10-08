import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FileDown, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { fileUrl, useCopperBatch, useDeleteCopperBatch, useUpdateCopper } from "@/lib/copper/api";
import { fmtDateTime } from "@/lib/kht/format";
import { buildCopperCombinedHtml, printHtmlOnWeb } from "@/lib/copper/pdf";
import { Card, InfoRow, KhtHeader } from "@/components/kht/ui";
import { AmberBtn, CopperClassGauge, CopperClassPicker } from "@/components/copper/ui";

const SampleEditor = ({ sample, busy, onClassification, onSaveId, onDraft }) => {
  const [sid, setSid] = useState(sample.meta?.sample_id || "");
  useEffect(() => { setSid(sample.meta?.sample_id || ""); }, [sample.meta?.sample_id]);
  return (
    <Card data-testid={`copper-batch-sample-${sample.sample_index}`}>
      <div className="flex gap-4">
        <img src={fileUrl(sample.crop_path || sample.image_path, 400)} alt={`sample ${sample.sample_index}`} className="h-36 w-28 shrink-0 rounded-lg border border-zinc-700 bg-zinc-800 object-contain" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="font-mono text-[10px] tracking-widest text-amber-400">SAMPLE #{sample.sample_index}</span>
          <span className="mt-1 font-mono text-[11px] text-zinc-300">Sample ID (OCR)</span>
          <input
            data-testid={`copper-batch-sid-${sample.sample_index}`}
            value={sid}
            onChange={(e) => { setSid(e.target.value); onDraft(e.target.value); }}
            onBlur={() => onSaveId(sid)}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            placeholder={`Unknown ${sample.sample_index}`}
            className="h-11 rounded-md border border-zinc-700 bg-zinc-950 px-3 font-mono text-sm font-bold text-zinc-50 outline-none focus:border-amber-500"
          />
          <span className="font-mono text-[10px] text-zinc-500">OCR confidence {Number(sample.confidence || 0).toFixed(0)}%</span>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <div className="font-mono text-[11px] text-zinc-300">Rating ASTM D130</div>
        <div className="font-mono text-[10px] text-zinc-500">Posisi {sample.sample_index}</div>
      </div>
      <div className="mt-2 flex flex-col items-center gap-3 sm:flex-row sm:items-start">
        <CopperClassGauge classification={sample.classification} group={sample.group} color={sample.color} status={sample.status} confidence={sample.confidence} size={112} />
        <div className="flex-1">
          <CopperClassPicker value={sample.classification} onChange={onClassification} disabled={busy} />
          <p className="mt-3 font-mono text-[12px] leading-5 text-zinc-200" data-testid={`copper-batch-summary-${sample.sample_index}`}>{sample.ai_summary || "Belum ada ringkasan AI."}</p>
          <p className="mt-2 font-mono text-[11px] leading-4 text-zinc-400">{sample.recommendation || "Belum ada rekomendasi."}</p>
        </div>
      </div>
    </Card>
  );
};

export default function CopperBatchResult() {
  const { batchId } = useParams();
  const navigate = useNavigate();
  const { data: records, isLoading, isError } = useCopperBatch(batchId);
  const update = useUpdateCopper();
  const del = useDeleteCopperBatch();
  const [exporting, setExporting] = useState(false);
  const drafts = useRef({});

  async function saveSampleId(sample, sampleId) {
    const value = sampleId.trim();
    if (!value || value === sample.meta?.sample_id) return;
    try {
      await update.mutateAsync({ id: sample.id, changes: { sample_id: value } });
      delete drafts.current[sample.id];
      toast.success(`Sample #${sample.sample_index} tersimpan.`);
    } catch (e) {
      toast.error(String(e?.message || "Gagal menyimpan Sample ID.").slice(0, 120));
    }
  }

  async function changeClassification(sample, code) {
    try {
      await update.mutateAsync({ id: sample.id, changes: { classification: code } });
    } catch (e) {
      toast.error(String(e?.message || "Gagal menyimpan rating.").slice(0, 120));
    }
  }

  async function exportPdf() {
    if (!records?.length) return;
    setExporting(true);
    try {
      const latest = await Promise.all(records.map(async (r) => {
        const v = (drafts.current[r.id] ?? "").trim();
        if (!v || v === r.meta?.sample_id) return r;
        const saved = await update.mutateAsync({ id: r.id, changes: { sample_id: v } });
        delete drafts.current[r.id];
        return saved;
      }));
      printHtmlOnWeb(await buildCopperCombinedHtml(latest));
      toast.success(`Menyiapkan PDF batch (${records.length} sample)…`);
    } catch (e) {
      toast.error(`Export PDF gagal: ${String(e?.message || "unknown error").slice(0, 140)}`);
    } finally {
      setExporting(false);
    }
  }

  async function deleteBatch() {
    try {
      await del.mutateAsync(batchId);
      toast.success("Batch copper dihapus.");
      navigate("/copper-strip/history");
    } catch (e) {
      toast.error(String(e?.message || "Gagal menghapus batch.").slice(0, 120));
    }
  }

  const exportBtn = (
    <button type="button" onClick={exportPdf} disabled={exporting || !records?.length} data-testid="copper-batch-export-pdf" className="flex h-10 w-10 items-center justify-center text-amber-400 hover:bg-zinc-800 disabled:opacity-50">
      {exporting ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileDown className="h-5 w-5" />}
    </button>
  );

  return (
    <div className="min-h-screen bg-zinc-950" data-testid="copper-batch-result-page">
      <KhtHeader title="Copper Batch Result" subtitle={batchId} backTo="/copper-strip" right={exportBtn} logo="CU" accent="amber" />
      <div className="mx-auto max-w-3xl px-4 py-6 lg:px-6">
        {isError ? (
          <div className="flex flex-col items-center gap-4 py-24" data-testid="copper-batch-not-found">
            <p className="font-mono text-[13px] text-zinc-500">Batch copper tidak ditemukan.</p>
            <AmberBtn onClick={() => navigate("/copper-strip")} data-testid="copper-batch-go-home" className="px-6 py-3 text-[13px]">KEMBALI KE DASHBOARD</AmberBtn>
          </div>
        ) : isLoading || !records ? (
          <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-amber-400" /></div>
        ) : (
          <div className="flex flex-col gap-4 animate-fade-up">
            <p className="font-mono text-[11px] text-zinc-300" data-testid="copper-batch-result-hint">{records.length} sample terdeteksi berdasarkan urutan baca foto. Koreksi Sample ID atau rating jika diperlukan.</p>
            {records.map((sample) => (
              <SampleEditor
                key={sample.id}
                sample={sample}
                busy={update.isPending}
                onClassification={(code) => changeClassification(sample, code)}
                onSaveId={(sid) => saveSampleId(sample, sid)}
                onDraft={(v) => { drafts.current[sample.id] = v; }}
              />
            ))}
            <Card>
              <div className="font-mono text-[11px] tracking-[0.15em] text-amber-400">BATCH INFORMATION</div>
              <div className="mt-1">
                <InfoRow k="Batch ID" v={batchId || "—"} />
                <InfoRow k="Product" v={records[0]?.meta?.product || "—"} />
                <InfoRow k="Batch / Lot" v={records[0]?.meta?.batch || "—"} />
                <InfoRow k="Operator" v={records[0]?.meta?.operator || "—"} />
                <InfoRow k="Condition" v={`${records[0]?.meta?.temperature_c}°C · ${records[0]?.meta?.duration_hours}h`} />
                <InfoRow k="Analyzed" v={fmtDateTime(records[0]?.created_at)} />
                <InfoRow k="AI Model" v={records[0]?.ai_model} last />
              </div>
            </Card>
            <AmberBtn onClick={exportPdf} disabled={exporting} data-testid="copper-batch-export-report-btn" className="h-13 py-4 text-sm">
              <FileDown className="h-4 w-4" />EXPORT PDF BATCH REPORT
            </AmberBtn>
            <button type="button" onClick={deleteBatch} disabled={del.isPending} data-testid="copper-batch-delete" className="flex items-center justify-center gap-2 py-3 font-mono text-xs text-red-500 hover:text-red-400">
              <Trash2 className="h-4 w-4" />Hapus batch ini
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
