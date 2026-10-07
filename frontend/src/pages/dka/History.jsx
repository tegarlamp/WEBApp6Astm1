import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Check, CheckSquare, FileDown, Loader2, Search, Square, X } from "lucide-react";
import { toast } from "sonner";
import { fileUrl, useDkaTests } from "@/lib/dka/api";
import { fmtDate } from "@/lib/kht/format";
import { DkaBadge, BlueBtn } from "@/components/dka/ui";
import { buildDkaCombinedHtml, printHtmlOnWeb } from "@/lib/dka/pdf";

const BatchCard = ({ rec, selectionMode, selected, onToggle }) => {
  const inner = (
    <>
      {selectionMode && (
        <span data-testid={`dka-check-${rec.id}`} className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border ${selected ? "border-blue-500 bg-blue-500" : "border-zinc-600 bg-zinc-950"}`}>
          {selected && <Check className="h-3.5 w-3.5 text-white" />}
        </span>
      )}
      <img src={fileUrl(rec.image_path, 320)} alt="" className="h-14 w-14 shrink-0 rounded-md bg-zinc-800 object-cover" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-mono text-[13px] font-bold text-zinc-50">{rec.meta.batch_id || rec.id.slice(0, 8)}</div>
        <div className="truncate font-mono text-[11px] text-zinc-300">{rec.meta.product || "—"} · {rec.samples.length} sampel</div>
        <div className="font-mono text-[10px] text-zinc-500">{fmtDate(rec.created_at)}</div>
      </div>
      <div className="flex max-w-[45%] flex-wrap justify-end gap-1">
        {rec.samples.map((s) => <DkaBadge key={s.index} rating={s.rating} color={s.color} size="sm" />)}
      </div>
    </>
  );
  const cls = `flex items-center gap-3 rounded-lg border px-3 py-3 transition-colors ${selected ? "border-blue-500/60 bg-blue-500/10" : "border-zinc-700 bg-zinc-900 hover:border-zinc-600"}`;
  return selectionMode ? (
    <button type="button" onClick={onToggle} data-testid={`dka-card-${rec.id}`} className={`${cls} w-full text-left`}>{inner}</button>
  ) : (
    <Link to={`/rating-dka/result/${rec.id}`} data-testid={`dka-card-${rec.id}`} className={cls}>{inner}</Link>
  );
};

export default function DkaHistory() {
  const [q, setQ] = useState("");
  const { data, isLoading } = useDkaTests(q);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [exporting, setExporting] = useState(false);
  const rows = data ?? [];

  const exitSelection = () => { setSelectionMode(false); setSelectedIds(new Set()); };
  const toggleOne = (id) => setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSelected = rows.length > 0 && rows.every((t) => selectedIds.has(t.id));
  const toggleSelectAll = () => setSelectedIds(allSelected ? new Set() : new Set(rows.map((t) => t.id)));

  async function exportCombined() {
    if (selectedIds.size === 0) { toast.info("Pilih minimal 1 batch."); return; }
    setExporting(true);
    try {
      const selected = rows.filter((t) => selectedIds.has(t.id));
      printHtmlOnWeb(await buildDkaCombinedHtml(selected));
      toast.success(`Menyiapkan PDF gabungan (${selected.length} batch).`);
      exitSelection();
    } catch (e) {
      toast.error(String(e?.message || "Gagal export PDF.").slice(0, 120));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 pb-28 animate-fade-up" data-testid="dka-history">
      <div className="flex items-center gap-2">
        <div className="flex h-11 flex-1 items-center gap-2 rounded-md border border-zinc-700 bg-zinc-800 px-3">
          <Search className="h-4 w-4 text-zinc-500" />
          <input data-testid="dka-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari batch, product, operator, sample" className="flex-1 bg-transparent font-mono text-[13px] text-zinc-50 outline-none placeholder:text-zinc-500" />
        </div>
        {selectionMode ? (
          <button type="button" onClick={exitSelection} data-testid="dka-selection-cancel" className="flex h-11 w-11 items-center justify-center rounded-md border border-zinc-700 text-zinc-50 hover:bg-zinc-800"><X className="h-5 w-5" /></button>
        ) : (
          <button type="button" onClick={() => setSelectionMode(true)} data-testid="dka-selection-enter" title="Pilih beberapa batch" className="flex h-11 w-11 items-center justify-center rounded-md border border-zinc-700 text-blue-400 hover:bg-zinc-800"><CheckSquare className="h-5 w-5" /></button>
        )}
      </div>

      {selectionMode && rows.length > 0 && (
        <div className="flex items-center gap-2">
          <button type="button" data-testid="dka-select-all" onClick={toggleSelectAll} className={`flex h-9 items-center gap-1.5 rounded-full border px-4 font-mono text-xs ${allSelected ? "border-blue-500 bg-blue-500 font-bold text-white" : "border-blue-500 bg-zinc-800 text-zinc-300"}`}>
            {allSelected ? <Check className="h-3 w-3" /> : <Square className="h-3 w-3 text-blue-400" />}
            {allSelected ? "Batalkan Pilih Semua" : "Pilih Semua"}
          </button>
          <span className="ml-auto font-mono text-[11px] text-blue-400" data-testid="dka-selected-count">{selectedIds.size} dipilih</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>
      ) : rows.length === 0 ? (
        <p className="py-16 text-center font-mono text-xs text-zinc-500" data-testid="dka-history-empty">Belum ada data.</p>
      ) : (
        <div className="flex flex-col gap-2" data-testid="dka-history-list">
          {rows.map((t) => <BatchCard key={t.id} rec={t} selectionMode={selectionMode} selected={selectedIds.has(t.id)} onToggle={() => toggleOne(t.id)} />)}
        </div>
      )}

      {selectionMode && (
        <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-zinc-700 bg-zinc-900 px-4 py-3 lg:left-72" data-testid="dka-action-bar">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <div className="flex-1">
              <div className="font-mono text-xs font-bold tracking-widest text-blue-400">{selectedIds.size} BATCH DIPILIH</div>
              <div className="font-mono text-[10px] text-zinc-300">Gabung jadi 1 PDF (1 halaman/batch, tabel ringkasan)</div>
            </div>
            <BlueBtn data-testid="dka-export-combined" onClick={exportCombined} disabled={selectedIds.size === 0 || exporting} className="h-11 px-4 text-xs">
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}{exporting ? "MENYIAPKAN…" : "EXPORT PDF"}
            </BlueBtn>
          </div>
        </div>
      )}
    </div>
  );
}
