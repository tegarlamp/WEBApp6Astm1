import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check, FileDown, Loader2, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { fileUrl, statusLabel, useCopperScale, useCopperTest, useDeleteCopper, useUpdateCopper } from "@/lib/copper/api";
import { fmtDateTime } from "@/lib/kht/format";
import { buildCopperSingleHtml, printHtmlOnWeb } from "@/lib/copper/pdf";
import { Card, InfoRow, KhtHeader, StatusBadge } from "@/components/kht/ui";
import { AmberBtn, CopperClassGauge, CopperClassPicker } from "@/components/copper/ui";

const Label = ({ children }) => <div className="font-mono text-[11px] tracking-[0.15em] text-amber-500">{children}</div>;

export default function CopperResult() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: test, isLoading, isError } = useCopperTest(id);
  useCopperScale();
  const del = useDeleteCopper();
  const update = useUpdateCopper();
  const [exporting, setExporting] = useState(false);
  const [editing, setEditing] = useState(null); // "summary" | "recommendation" | null
  const [summaryDraft, setSummaryDraft] = useState("");
  const [recDraft, setRecDraft] = useState("");

  function startEdit(section) {
    if (!test) return;
    if (section === "summary") setSummaryDraft(test.ai_summary || "");
    if (section === "recommendation") setRecDraft(test.recommendation || "");
    setEditing(section);
  }

  async function changeClass(code) {
    if (!test || code === test.classification) return;
    try {
      await update.mutateAsync({ id: test.id, changes: { classification: code } });
      toast.success(`Klasifikasi diperbarui ke ${code.toUpperCase()}.`);
    } catch (e) {
      toast.error(String(e?.message || "Gagal menyimpan.").slice(0, 120));
    }
  }

  async function saveEdit() {
    if (!test || !editing) return;
    const changes = editing === "summary" ? { ai_summary: summaryDraft.trim() } : { recommendation: recDraft.trim() };
    try {
      await update.mutateAsync({ id: test.id, changes });
      toast.success("Perubahan tersimpan.");
      setEditing(null);
    } catch (e) {
      toast.error(String(e?.message || "Gagal menyimpan.").slice(0, 120));
    }
  }

  const renderEditControls = (section) =>
    editing === section ? (
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setEditing(null)} disabled={update.isPending} data-testid={`copper-cancel-${section}`} className="flex h-8 w-8 items-center justify-center rounded-sm border border-zinc-700 bg-zinc-800 text-zinc-400"><X className="h-4 w-4" /></button>
        <button type="button" onClick={saveEdit} disabled={update.isPending} data-testid={`copper-save-${section}`} className="flex items-center gap-1.5 rounded-sm bg-amber-500 px-3 py-1.5 font-mono text-[11px] font-bold text-zinc-950">
          {update.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}Save
        </button>
      </div>
    ) : (
      <button type="button" onClick={() => startEdit(section)} data-testid={`copper-edit-${section}`} className="flex items-center gap-1 rounded-sm border border-zinc-700 bg-zinc-800 px-2 py-1 font-mono text-[11px] font-bold text-amber-400"><Pencil className="h-3 w-3" />Edit</button>
    );

  async function exportPdf() {
    if (!test) return;
    setExporting(true);
    try {
      printHtmlOnWeb(await buildCopperSingleHtml(test));
      toast.success("Menyiapkan PDF report…");
    } catch (e) {
      toast.error(`Export PDF gagal: ${String(e?.message || "unknown error").slice(0, 140)}`);
    } finally {
      setExporting(false);
    }
  }

  async function onDelete() {
    try {
      await del.mutateAsync(test.id);
      toast.success("Uji dihapus");
      navigate("/copper-strip/history");
    } catch {
      toast.error("Gagal menghapus");
    }
  }

  const exportBtn = (
    <button type="button" onClick={exportPdf} disabled={exporting || !test} data-testid="copper-export-pdf" className="flex h-10 w-10 items-center justify-center rounded-md text-amber-400 hover:bg-zinc-800 disabled:opacity-50">
      {exporting ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileDown className="h-5 w-5" />}
    </button>
  );

  return (
    <div className="min-h-screen bg-zinc-950" data-testid="copper-result-page">
      <KhtHeader title="AI Analysis Result" subtitle={test?.meta.sample_id || (test ? test.id.slice(0, 8) : undefined)} backTo="/copper-strip" right={exportBtn} logo="CU" accent="amber" />
      <div className="mx-auto max-w-3xl px-4 py-6 lg:px-6">
        {isError ? (
          <div className="flex flex-col items-center gap-4 py-24" data-testid="copper-not-found">
            <p className="font-mono text-[13px] text-zinc-500">Data uji tidak ditemukan.</p>
            <AmberBtn onClick={() => navigate("/copper-strip")} data-testid="copper-go-home" className="px-6 py-3 text-[13px]">KEMBALI KE DASHBOARD</AmberBtn>
          </div>
        ) : isLoading || !test ? (
          <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-amber-400" /></div>
        ) : (
          <div className="flex flex-col gap-4 animate-fade-up">
            <Card>
              <Label>SAMPLE PHOTO</Label>
              <div className="mt-3 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-800">
                <img src={fileUrl(test.crop_path || test.image_path, 1600)} alt="sample" className="max-h-72 w-full object-contain" data-testid="copper-result-image" />
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between">
                <Label>ASTM D130 CLASSIFICATION</Label>
                <StatusBadge status={test.status} size="sm" />
              </div>
              <div className="my-4 flex justify-center">
                <CopperClassGauge classification={test.classification} group={test.group} color={test.color} status={test.status} confidence={test.confidence} />
              </div>
              <p className="text-center font-mono text-[12px] leading-5 text-zinc-300" data-testid="copper-class-desc">{test.description}</p>
            </Card>

            <Card>
              <Label>KOREKSI MANUAL KELAS</Label>
              <p className="mt-2 font-mono text-[11px] leading-4 text-zinc-400">Tap kelas yang sesuai jika hasil AI perlu dikoreksi. Status CLEAR/TARNISH dihitung otomatis.</p>
              <div className={`mt-3 ${update.isPending ? "opacity-60" : ""}`}>
                <CopperClassPicker value={test.classification} onChange={changeClass} disabled={update.isPending} />
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between">
                <Label>DESKRIPSI KONDISI</Label>
                {renderEditControls("summary")}
              </div>
              {editing === "summary" ? (
                <textarea data-testid="copper-summary-input" value={summaryDraft} onChange={(e) => setSummaryDraft(e.target.value)} autoFocus rows={3} className="mt-2 w-full rounded-md border border-zinc-700 bg-zinc-950 p-3 font-mono text-[13px] leading-5 text-zinc-50 outline-none focus:border-amber-500" placeholder="Tulis deskripsi kondisi…" />
              ) : (
                <p className="mt-2 font-mono text-[13px] leading-5 text-zinc-200" data-testid="copper-summary">{test.ai_summary || "Belum ada deskripsi."}</p>
              )}
            </Card>

            <Card>
              <div className="flex items-center justify-between">
                <Label>REKOMENDASI</Label>
                {renderEditControls("recommendation")}
              </div>
              {editing === "recommendation" ? (
                <textarea data-testid="copper-recommendation-input" value={recDraft} onChange={(e) => setRecDraft(e.target.value)} autoFocus rows={3} className="mt-2 w-full rounded-md border border-zinc-700 bg-zinc-950 p-3 font-mono text-[13px] leading-5 text-zinc-50 outline-none focus:border-amber-500" placeholder="Tulis rekomendasi tindakan…" />
              ) : (
                <p className={`mt-2 font-mono text-[13px] leading-5 ${test.recommendation ? "text-zinc-200" : "text-zinc-500"}`} data-testid="copper-recommendation">{test.recommendation || "Belum ada rekomendasi. Tap Edit untuk menambahkan."}</p>
              )}
            </Card>

            <Card>
              <Label>TEST INFORMATION</Label>
              <div className="mt-1">
                <InfoRow k="Product / Fuel" v={test.meta.product || "—"} />
                <InfoRow k="Batch / Lot" v={test.meta.batch || "—"} />
                <InfoRow k="Operator" v={test.meta.operator || "—"} />
                <InfoRow k="Condition" v={`${test.meta.temperature_c}°C · ${test.meta.duration_hours}h`} />
                <InfoRow k="Classification" v={`${String(test.classification).toUpperCase()} (${test.group})`} />
                <InfoRow k="Status" v={statusLabel(test.status)} />
                <InfoRow k="Analyzed" v={fmtDateTime(test.created_at)} />
                <InfoRow k="AI Model" v={test.ai_model} last />
              </div>
            </Card>

            <AmberBtn onClick={exportPdf} disabled={exporting} data-testid="copper-export-report-btn" className="py-4 text-sm">
              <FileDown className="h-4 w-4" />EXPORT PDF REPORT
            </AmberBtn>
            <button type="button" onClick={onDelete} disabled={del.isPending} data-testid="copper-delete-test" className="flex items-center justify-center gap-2 py-3 font-mono text-xs text-red-500 hover:text-red-400">
              <Trash2 className="h-4 w-4" />Hapus uji ini
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
