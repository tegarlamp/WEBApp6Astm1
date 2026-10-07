import React from "react";
import { toast } from "sonner";
import { Loader2, Trash2, CheckCircle2, Square, Timer as TimerIcon } from "lucide-react";
import { useDkacecRuns, useDkacecDeleteRun, fmtFull } from "@/lib/dkacec/api";

const STATUS = {
  running: { label: "RUNNING", cls: "bg-blue-500/15 text-blue-400" },
  done: { label: "SELESAI", cls: "bg-emerald-500/15 text-emerald-400" },
  stopped: { label: "DIHENTIKAN", cls: "bg-zinc-600/30 text-zinc-300" },
};

export default function DkacecHistory() {
  const { data: runs = [], isLoading } = useDkacecRuns();
  const del = useDkacecDeleteRun();

  if (isLoading) {
    return <div className="flex justify-center py-24" data-testid="dkacec-history-loading"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>;
  }
  if (!runs.length) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center" data-testid="dkacec-history-empty">
        <TimerIcon className="h-12 w-12 text-zinc-500" />
        <div className="font-heading text-xl font-semibold text-zinc-50">Belum ada riwayat run</div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 animate-fade-up" data-testid="dkacec-history">
      {runs.map((r) => {
        const st = STATUS[r.status] || STATUS.stopped;
        return (
          <div key={r.id} data-testid={`dkacec-run-${r.id}`} className="rounded-xl border border-zinc-700 bg-zinc-900 p-4">
            <div className="flex items-center justify-between">
              <div className="font-mono text-[12px] font-bold text-zinc-50">{r.method_label}</div>
              <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[9px] font-bold tracking-widest ${st.cls}`}>
                {r.status === "done" ? <CheckCircle2 className="h-3 w-3" /> : r.status === "stopped" ? <Square className="h-3 w-3" /> : <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />}
                {st.label}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {r.samples.map((s) => (
                <span key={s.sample_code} className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-[11px] text-zinc-200">{s.sample_code}</span>
              ))}
            </div>
            <div className="mt-3 grid gap-1 font-mono text-[11px] text-zinc-400">
              <div>Start&nbsp;&nbsp;: <span className="text-zinc-200">{fmtFull(r.start_at)}</span></div>
              <div>Finish : <span className="text-blue-400">{fmtFull(r.finish_at)}</span></div>
              {r.operator && <div>Operator: <span className="text-zinc-200">{r.operator}</span></div>}
            </div>
            <div className="mt-3 flex justify-end">
              <button
                data-testid={`dkacec-delete-run-${r.id}`}
                onClick={() => { if (window.confirm("Hapus run ini dari riwayat?")) del.mutate(r.id, { onSuccess: () => toast.success("Run dihapus.") }); }}
                className="flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 font-mono text-[11px] text-red-400 hover:border-red-500/50 hover:bg-red-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" /> Hapus
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
