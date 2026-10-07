import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check, FileDown, Loader2, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { isClear, statusLabel, useDeleteTest, useTest, useUpdateTest } from "@/lib/kht/api";
import { fmtDateTime } from "@/lib/kht/format";
import { buildSingleReportHtml, printHtmlOnWeb } from "@/lib/kht/pdf";
import { Card, CardLabel, InfoRow, KhtHeader, KHTScale, RatingGauge, StatusBadge } from "@/components/kht/ui";
import { ParameterTable, Segmented, TubeViewer } from "@/components/kht/viz";

const textAreaCls = "mt-2 min-h-24 w-full rounded-md border border-zinc-600 bg-zinc-950 p-3 font-mono text-[13px] leading-5 text-zinc-50 outline-none focus:border-amber-500";

export default function KhtResult() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: test, isLoading, isError } = useTest(id);
  const del = useDeleteTest();
  const update = useUpdateTest();
  const [mode, setMode] = useState("heatmap");
  const [exporting, setExporting] = useState(false);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState("");

  function startEdit(section) {
    if (!test) return;
    setDraft(section === "rating" ? String(test.rating) : section === "summary" ? test.ai_summary || "" : test.recommendation || "");
    setEditing(section);
  }

  async function saveEdit() {
    if (!test || !editing) return;
    const changes = {};
    if (editing === "rating") {
      const n = parseFloat(draft.replace(",", "."));
      if (isNaN(n) || n < 0 || n > 10) { toast.error("Angka color scale harus 0 – 10."); return; }
      changes.rating = Math.round(n * 10) / 10;
    } else if (editing === "summary") changes.ai_summary = draft.trim();
    else changes.recommendation = draft.trim();
    try {
      await update.mutateAsync({ id: test.id, changes });
      toast.success("Perubahan tersimpan.");
      setEditing(null);
    } catch (e) {
      toast.error(String(e?.message || "Gagal menyimpan.").slice(0, 120));
    }
  }

  const EditControls = ({ section }) =>
    editing === section ? (
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setEditing(null)} disabled={update.isPending} data-testid={`cancel-${section}`} className="flex h-8 w-8 items-center justify-center rounded border border-zinc-700 bg-zinc-800 text-zinc-300 hover:text-zinc-50"><X className="h-4 w-4" /></button>
        <button type="button" onClick={saveEdit} disabled={update.isPending} data-testid={`save-${section}`} className="flex h-8 items-center gap-1 rounded bg-amber-500 px-3 font-mono text-[11px] font-bold text-zinc-950 hover:bg-amber-400">
          {update.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}Save
        </button>
      </div>
    ) : (
      <button type="button" onClick={() => startEdit(section)} data-testid={`edit-${section}`} className="flex h-8 items-center gap-1 rounded border border-zinc-600 bg-zinc-800 px-2.5 font-mono text-[11px] font-bold text-amber-500 hover:bg-zinc-700"><Pencil className="h-3 w-3" />Edit</button>
    );

  async function exportPdf() {
    if (!test) return;
    setExporting(true);
    try {
      printHtmlOnWeb(await buildSingleReportHtml(test));
      toast.success("Menyiapkan PDF report…");
    } catch (e) {
      toast.error(`Export PDF gagal: ${String(e?.message || "unknown error").slice(0, 140)}`);
    } finally {
      setExporting(false);
    }
  }

  async function onDelete() {
    if (!test) return;
    try {
      await del.mutateAsync(test.id);
      toast.success("Test deleted");
      navigate("/khtt/history");
    } catch {
      toast.error("Delete failed");
    }
  }

  const exportBtn = (
    <button type="button" onClick={exportPdf} disabled={exporting || !test} data-testid="export-pdf" className="flex h-10 w-10 items-center justify-center rounded-md text-amber-500 hover:bg-zinc-800 disabled:opacity-50">
      {exporting ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileDown className="h-5 w-5" />}
    </button>
  );

  return (
    <div className="min-h-screen bg-zinc-950" data-testid="kht-result-page">
      <KhtHeader title="AI Analysis Result" subtitle={test?.meta.sample_id} backTo="/khtt" right={exportBtn} />
      <div className="mx-auto max-w-3xl px-4 py-6 lg:px-6">
        {isError ? (
          <div className="flex flex-col items-center gap-4 py-24" data-testid="result-not-found">
            <p className="font-mono text-[13px] text-zinc-500">Test record not found.</p>
            <button type="button" onClick={() => navigate("/khtt")} data-testid="result-go-home" className="rounded-md bg-amber-500 px-6 py-3 font-mono text-[13px] font-bold tracking-widest text-zinc-950">BACK TO DASHBOARD</button>
          </div>
        ) : isLoading || !test ? (
          <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-amber-500" /></div>
        ) : (
          <div className="flex flex-col gap-4 animate-fade-up">
            <Card>
              <CardLabel>SAMPLE ANALYSIS</CardLabel>
              <div className="my-3"><Segmented testId="view-mode" value={mode} onChange={setMode} options={[{ label: "Heatmap", value: "heatmap" }, { label: "Original", value: "original" }]} /></div>
              <TubeViewer imagePath={test.image_path} parameters={test.parameters} mode={mode} />
            </Card>

            <Card>
              <div className="flex items-center justify-between">
                <CardLabel>RESULT &amp; RATING</CardLabel>
                <div className="flex items-center gap-2"><StatusBadge status={test.status} size="sm" /><EditControls section="rating" /></div>
              </div>
              {editing === "rating" ? (
                <div className="mt-3 flex flex-col gap-2">
                  <span className="font-mono text-[10px] text-zinc-500">Angka Color Scale (0 – 10)</span>
                  <input autoFocus data-testid="rating-input" value={draft} onChange={(e) => setDraft(e.target.value)} inputMode="decimal" placeholder="0 - 10" className="h-14 rounded-md border border-zinc-600 bg-zinc-950 text-center font-heading text-3xl font-bold text-zinc-50 outline-none focus:border-amber-500" />
                  <span className="font-mono text-[10px] text-zinc-500">Status dihitung otomatis: CLEAR bila ≥ 7, selain itu TARNISH.</span>
                </div>
              ) : (
                <div className="my-4 flex justify-center"><RatingGauge rating={test.rating} performance={test.performance} confidence={test.confidence} /></div>
              )}
              <div className="mt-2 flex border-t border-zinc-700">
                <div className="flex-1 px-2 py-3">
                  <div className="font-mono text-[9px] tracking-widest text-zinc-500">DEPOSIT LEVEL</div>
                  <div className="mt-0.5 font-mono text-sm font-bold text-zinc-50" data-testid="result-deposit-level">{test.deposit_level_label || "—"}</div>
                </div>
                <div className="flex-1 border-l border-zinc-700 px-2 py-3">
                  <div className="font-mono text-[9px] tracking-widest text-zinc-500">STATUS</div>
                  <div className={`mt-0.5 font-mono text-sm font-bold ${isClear(test.status) ? "text-emerald-500" : "text-red-500"}`} data-testid="result-status">{statusLabel(test.status)}</div>
                </div>
              </div>
              <div className="mt-3"><KHTScale current={test.rating} /></div>
            </Card>

            <Card>
              <div className="flex items-center justify-between"><CardLabel>DESKRIPSI KONDISI</CardLabel><EditControls section="summary" /></div>
              {editing === "summary" ? (
                <textarea autoFocus data-testid="summary-input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Tulis deskripsi kondisi endapan…" className={textAreaCls} />
              ) : (
                <p className="mt-2 font-mono text-[13px] leading-5 text-zinc-200" data-testid="result-summary">{test.ai_summary || "Belum ada deskripsi."}</p>
              )}
            </Card>

            <Card>
              <div className="flex items-center justify-between"><CardLabel>REKOMENDASI</CardLabel><EditControls section="recommendation" /></div>
              {editing === "recommendation" ? (
                <textarea autoFocus data-testid="recommendation-input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Tulis rekomendasi tindakan…" className={textAreaCls} />
              ) : (
                <p className={`mt-2 font-mono text-[13px] leading-5 ${test.recommendation ? "text-zinc-200" : "text-zinc-500"}`} data-testid="result-recommendation">{test.recommendation || "Belum ada rekomendasi. Klik Edit untuk menambahkan."}</p>
              )}
            </Card>

            <Card>
              <CardLabel>PARAMETER ANALYSIS</CardLabel>
              <div className="mt-2"><ParameterTable parameters={test.parameters} /></div>
            </Card>

            <Card>
              <CardLabel className="mb-1">TEST INFORMATION</CardLabel>
              <InfoRow k="Product / Oil" v={test.meta.oil_type || "—"} />
              <InfoRow k="Batch / Lot" v={test.meta.batch || "—"} />
              <InfoRow k="Operator" v={test.meta.operator || "—"} />
              <InfoRow k="Condition" v={`${test.meta.temperature_c}°C · ${test.meta.duration_hours}h`} />
              <InfoRow k="Air / Oil Flow" v={`${test.meta.air_flow} / ${test.meta.oil_flow} mL/min`} />
              <InfoRow k="Analyzed" v={fmtDateTime(test.created_at)} />
              <InfoRow k="AI Model" v={test.ai_model} last />
            </Card>

            <button type="button" onClick={exportPdf} disabled={exporting} data-testid="export-report-btn" className="flex h-13 items-center justify-center gap-2 rounded-md bg-amber-500 py-4 font-mono text-sm font-bold tracking-widest text-zinc-950 hover:bg-amber-400 disabled:opacity-50">
              <FileDown className="h-4 w-4" />EXPORT PDF REPORT
            </button>
            <button type="button" onClick={onDelete} disabled={del.isPending} data-testid="delete-test" className="flex items-center justify-center gap-2 py-3 font-mono text-xs text-red-500 hover:text-red-400">
              <Trash2 className="h-4 w-4" />Delete this test
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
