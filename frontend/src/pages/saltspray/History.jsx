import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Check, CheckSquare, FileDown, Loader2, Search, ShieldAlert, Square, X } from "lucide-react";
import { toast } from "sonner";
import { useRustTests, SALT_GRADES } from "@/lib/saltspray/api";
import { fileUrl } from "@/lib/kht/api";
import { fmtDate } from "@/lib/kht/format";
import { buildRustCombinedHtml, printHtmlOnWeb } from "@/lib/saltspray/pdf";

function SaltCard({ record, selectionMode, selected, onToggle }) {
  const grade = SALT_GRADES[record.grade] || SALT_GRADES.E;
  const inner = (
    <>
      {selectionMode && (
        <span data-testid={`salt-check-${record.id}`} className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border ${selected ? "border-amber-500 bg-amber-500" : "border-zinc-600 bg-zinc-950"}`}>
          {selected && <Check className="h-3.5 w-3.5 text-zinc-950" />}
        </span>
      )}
      <img src={fileUrl(record.image_path, 320)} alt="metal panel" className="h-14 w-14 shrink-0 rounded-md bg-zinc-800 object-cover" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-mono text-[13px] font-bold text-zinc-50">{record.meta.sample_id || record.id.slice(0, 8)}</div>
        <div className="truncate font-mono text-[11px] text-zinc-300">{record.meta.product || "—"}</div>
        <div className="font-mono text-[10px] text-zinc-500">{fmtDate(record.created_at)} · <span data-testid={`salt-history-method-${record.id}`} className="text-amber-400">ZONA 50×50</span> · {record.rusted_box_count}/100 kotak{record.inspector_count != null ? ` · Manual ${record.inspector_count} (${record.inspector_grade})` : ""}</div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="font-heading text-2xl font-bold" style={{ color: grade.color }}>Grade {record.grade}</span>
        <span className="font-mono text-[10px] text-zinc-500">{Number(record.confidence).toFixed(0)}% AI</span>
      </div>
    </>
  );
  const cls = `flex items-center gap-3 rounded-lg border px-3 py-3 transition-colors ${selected ? "border-amber-500/60 bg-amber-500/10" : "border-zinc-700 bg-zinc-900 hover:border-amber-500/50"}`;
  return selectionMode
    ? <button type="button" onClick={onToggle} data-testid={`salt-history-card-${record.id}`} className={`${cls} w-full text-left`}>{inner}</button>
    : <Link to={`/salt-spray/result/${record.id}`} data-testid={`salt-history-card-${record.id}`} className={cls}>{inner}</Link>;
}

export default function SaltHistory() {
  const [q, setQ] = useState("");
  const { data, isLoading } = useRustTests(q);
  const rows = data || [];
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [exporting, setExporting] = useState(false);

  const exitSelection = () => { setSelectionMode(false); setSelectedIds(new Set()); };
  const toggleOne = (id) => setSelectedIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));
  const toggleSelectAll = () => setSelectedIds(allSelected ? new Set() : new Set(rows.map((r) => r.id)));

  async function exportCombined() {
    if (selectedIds.size === 0) { toast.info("Pilih minimal 1 sampel."); return; }
    setExporting(true);
    try {
      const selected = rows.filter((r) => selectedIds.has(r.id));
      printHtmlOnWeb(await buildRustCombinedHtml(selected));
      toast.success(`Menyiapkan PDF gabungan (${selected.length} sampel).`);
      exitSelection();
    } catch (e) {
      toast.error(String(e?.message || "Gagal export PDF.").slice(0, 120));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 pb-28 animate-fade-up" data-testid="salt-history">
      <div className="flex items-center gap-2">
        <div className="flex h-11 flex-1 items-center gap-2 rounded-md border border-zinc-700 bg-zinc-800 px-3">
          <Search className="h-4 w-4 text-zinc-500" />
          <input data-testid="salt-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari sample, product, batch, operator" className="flex-1 bg-transparent font-mono text-[13px] text-zinc-50 outline-none placeholder:text-zinc-500" />
        </div>
        {selectionMode ? (
          <button type="button" onClick={exitSelection} data-testid="salt-selection-cancel" className="flex h-11 w-11 items-center justify-center rounded-md border border-zinc-700 text-zinc-50 hover:bg-zinc-800"><X className="h-5 w-5" /></button>
        ) : (
          <button type="button" onClick={() => setSelectionMode(true)} data-testid="salt-selection-enter" title="Pilih beberapa sampel untuk PDF gabungan" className="flex h-11 w-11 items-center justify-center rounded-md border border-zinc-700 text-amber-400 hover:bg-zinc-800"><CheckSquare className="h-5 w-5" /></button>
        )}
      </div>

      {selectionMode && rows.length > 0 && (
        <div className="flex items-center gap-2">
          <button type="button" data-testid="salt-select-all" onClick={toggleSelectAll} className={`flex h-9 items-center gap-1.5 rounded-full border px-4 font-mono text-xs ${allSelected ? "border-amber-500 bg-amber-500 font-bold text-zinc-950" : "border-amber-500 bg-zinc-800 text-zinc-300"}`}>
            {allSelected ? <Check className="h-3 w-3" /> : <Square className="h-3 w-3 text-amber-400" />}
            {allSelected ? "Batalkan Pilih Semua" : "Pilih Semua"}
          </button>
          <span className="ml-auto font-mono text-[11px] text-amber-400" data-testid="salt-selected-count">{selectedIds.size} dipilih</span>
        </div>
      )}

      {isLoading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-amber-400" /></div>
        : rows.length === 0 ? <div className="py-16 text-center font-mono text-xs text-zinc-500" data-testid="salt-history-empty">Belum ada data inspeksi.</div>
          : <div className="flex flex-col gap-2" data-testid="salt-history-list">{rows.map((record) => <SaltCard key={record.id} record={record} selectionMode={selectionMode} selected={selectedIds.has(record.id)} onToggle={() => toggleOne(record.id)} />)}</div>}

      <div className="mt-4 flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 p-3"><ShieldAlert className="h-4 w-4 text-amber-400" /><span className="font-mono text-[10px] leading-4 text-zinc-500">Grade dihitung ulang secara deterministik dari total kotak berkarat.</span></div>

      {selectionMode && (
        <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-zinc-700 bg-zinc-900 px-4 py-3 lg:left-72" data-testid="salt-action-bar">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <div className="flex-1">
              <div className="font-mono text-xs font-bold tracking-widest text-amber-400">{selectedIds.size} SAMPEL DIPILIH</div>
              <div className="font-mono text-[10px] text-zinc-300">1 PDF: cover + foto, overlay AI, perhitungan &amp; penilaian per sampel</div>
            </div>
            <button type="button" data-testid="salt-export-combined" onClick={exportCombined} disabled={selectedIds.size === 0 || exporting} className="flex h-11 items-center gap-2 rounded-md bg-amber-500 px-4 font-mono text-xs font-bold tracking-widest text-zinc-950 hover:bg-amber-400 disabled:opacity-50">
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}{exporting ? "MENYIAPKAN…" : "EXPORT PDF"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
