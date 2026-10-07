import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, CheckSquare, FileDown, Loader2, Search, Square, X } from "lucide-react";
import { toast } from "sonner";
import { fileUrl, isClear, useTests } from "@/lib/kht/api";
import { fmtDate, ratingColor } from "@/lib/kht/format";
import { StatusBadge } from "@/components/kht/ui";
import { buildCombinedReportHtml, printHtmlOnWeb } from "@/lib/kht/pdf";

const FILTERS = [
  { label: "All", value: "all" },
  { label: "Clear", value: "clear" },
  { label: "Tarnish", value: "tarnish" },
];

const HistoryCard = ({ test, selectionMode, selected, onToggle }) => {
  const inner = (
    <>
      {selectionMode && (
        <span
          data-testid={`history-check-${test.id}`}
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border ${selected ? "border-amber-500 bg-amber-500" : "border-zinc-600 bg-zinc-950"}`}
        >
          {selected && <Check className="h-3.5 w-3.5 text-zinc-950" />}
        </span>
      )}
      <img src={fileUrl(test.image_path, 320)} alt="" className="h-14 w-14 shrink-0 rounded-md bg-zinc-800 object-cover" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-mono text-[13px] font-bold text-zinc-50">{test.meta.sample_id || "—"}</div>
        <div className="truncate font-mono text-[11px] text-zinc-300">{test.meta.oil_type || "Unknown oil"}</div>
        <div className="font-mono text-[10px] text-zinc-500">{fmtDate(test.created_at)}</div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="font-heading text-2xl font-bold" style={{ color: ratingColor(test.rating) }}>{test.rating.toFixed(1)}</span>
        <StatusBadge status={test.status} size="sm" />
      </div>
    </>
  );
  const cls = `flex items-center gap-3 rounded-lg border px-3 py-3 transition-colors ${selected ? "border-amber-500/60 bg-amber-500/10" : "border-zinc-700 bg-zinc-900 hover:border-zinc-600"}`;
  return selectionMode ? (
    <button type="button" onClick={onToggle} data-testid={`history-card-${test.id}`} className={`${cls} w-full text-left`}>{inner}</button>
  ) : (
    <Link to={`/khtt/result/${test.id}`} data-testid={`history-card-${test.id}`} className={cls}>{inner}</Link>
  );
};

export default function KhtHistory() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const { data, isLoading } = useTests(q);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [exporting, setExporting] = useState(false);

  const rows = useMemo(() => {
    const list = data ?? [];
    return filter === "all" ? list : list.filter((t) => isClear(t.status) === (filter === "clear"));
  }, [data, filter]);

  const exitSelection = () => { setSelectionMode(false); setSelectedIds(new Set()); };
  const toggleOne = (id) => setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSelected = rows.length > 0 && rows.every((t) => selectedIds.has(t.id));
  const toggleSelectAll = () => setSelectedIds(allSelected ? new Set() : new Set(rows.map((t) => t.id)));

  async function exportCombined() {
    if (selectedIds.size === 0) { toast.info("Pilih minimal 1 sample."); return; }
    setExporting(true);
    try {
      const selected = rows.filter((t) => selectedIds.has(t.id));
      if (selected.length === 0) { toast.error("Sample terpilih tidak ada di daftar aktif."); return; }
      printHtmlOnWeb(await buildCombinedReportHtml(selected));
      toast.success(`Menyiapkan PDF gabungan (${selected.length} sample).`);
      exitSelection();
    } catch (e) {
      toast.error(String(e?.message || "Gagal export PDF.").slice(0, 120));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 pb-28 animate-fade-up" data-testid="kht-history">
      <div className="flex items-center gap-2">
        <div className="flex h-11 flex-1 items-center gap-2 rounded-md border border-zinc-700 bg-zinc-800 px-3">
          <Search className="h-4 w-4 text-zinc-500" />
          <input data-testid="history-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search sample, oil, batch, operator" className="flex-1 bg-transparent font-mono text-[13px] text-zinc-50 outline-none placeholder:text-zinc-500" />
        </div>
        {selectionMode ? (
          <button type="button" onClick={exitSelection} data-testid="history-selection-cancel" className="flex h-11 w-11 items-center justify-center rounded-md border border-zinc-700 text-zinc-50 hover:bg-zinc-800"><X className="h-5 w-5" /></button>
        ) : (
          <button type="button" onClick={() => setSelectionMode(true)} data-testid="history-selection-enter" title="Pilih beberapa sample" className="flex h-11 w-11 items-center justify-center rounded-md border border-zinc-700 text-amber-500 hover:bg-zinc-800"><CheckSquare className="h-5 w-5" /></button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f.value} type="button" data-testid={`filter-chip-${f.value}`} onClick={() => setFilter(f.value)} className={`h-9 rounded-full border px-4 font-mono text-xs transition-colors ${filter === f.value ? "border-amber-500 bg-amber-500 font-bold text-zinc-950" : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:text-zinc-50"}`}>{f.label}</button>
        ))}
        {selectionMode && rows.length > 0 && (
          <button type="button" data-testid="history-select-all" onClick={toggleSelectAll} className={`flex h-9 items-center gap-1.5 rounded-full border px-4 font-mono text-xs ${allSelected ? "border-amber-500 bg-amber-500 font-bold text-zinc-950" : "border-amber-500 bg-zinc-800 text-zinc-300"}`}>
            {allSelected ? <Check className="h-3 w-3" /> : <Square className="h-3 w-3 text-amber-500" />}
            {allSelected ? "Batalkan Pilih Semua" : "Pilih Semua"}
          </button>
        )}
        {selectionMode && <span className="ml-auto self-center font-mono text-[11px] text-amber-500" data-testid="history-selected-count">{selectedIds.size} dipilih</span>}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-amber-500" /></div>
      ) : rows.length === 0 ? (
        <p className="py-16 text-center font-mono text-xs text-zinc-500" data-testid="history-empty">No records found.</p>
      ) : (
        <div className="flex flex-col gap-2" data-testid="history-list">
          {rows.map((t) => <HistoryCard key={t.id} test={t} selectionMode={selectionMode} selected={selectedIds.has(t.id)} onToggle={() => toggleOne(t.id)} />)}
        </div>
      )}

      {selectionMode && (
        <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-zinc-700 bg-zinc-900 px-4 py-3 lg:left-72" data-testid="history-action-bar">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <div className="flex-1">
              <div className="font-mono text-xs font-bold tracking-widest text-amber-500">{selectedIds.size} SAMPLE DIPILIH</div>
              <div className="font-mono text-[10px] text-zinc-300">Gabung menjadi 1 file PDF (cover + per halaman)</div>
            </div>
            <button type="button" data-testid="history-export-combined" onClick={exportCombined} disabled={selectedIds.size === 0 || exporting} className="flex h-11 items-center gap-2 rounded-md bg-amber-500 px-4 font-mono text-xs font-bold tracking-widest text-zinc-950 hover:bg-amber-400 disabled:opacity-50">
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}{exporting ? "MENYIAPKAN…" : "EXPORT PDF"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
