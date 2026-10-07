import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Timer, Thermometer, Hourglass, CheckCircle2, Square, Plus, X, Loader2,
  PlayCircle, FlaskConical,
} from "lucide-react";
import {
  useDkacecActive, useDkacecComplete, useDkacecStop, useDkacecRemoveSample,
  fmtFull, fmtHms, remainingSeconds,
} from "@/lib/dkacec/api";
import { requestNotifyPermission, unlockAudio, notifyTimerDoneOnce } from "@/lib/notify";

const Card = ({ children, className = "", ...p }) => (
  <div className={`rounded-xl border border-zinc-700 bg-zinc-900 p-4 ${className}`} {...p}>{children}</div>
);
const Label = ({ children }) => (
  <div className="font-mono text-[11px] tracking-[0.15em] text-blue-400">{children}</div>
);

function useTick(finishIso) {
  const [sec, setSec] = useState(() => remainingSeconds(finishIso));
  useEffect(() => {
    setSec(remainingSeconds(finishIso));
    const id = setInterval(() => setSec(remainingSeconds(finishIso)), 1000);
    return () => clearInterval(id);
  }, [finishIso]);
  return sec;
}

function ActiveTimer({ run }) {
  const sec = useTick(run.finish_at);
  const finished = sec <= 0;
  const complete = useDkacecComplete();
  const stop = useDkacecStop();
  const removeSample = useDkacecRemoveSample();
  const firedRef = useRef(false);

  // Ask for notification permission and unlock audio (once the timer is on screen).
  useEffect(() => {
    requestNotifyPermission();
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    if (finished && !firedRef.current) {
      firedRef.current = true;
      toast.success("Timer DKA-CEC SELESAI \u2014 pengujian 100% tuntas.", { duration: 8000 });
      notifyTimerDoneOnce(
        `dkacec:${run.id}`,
        "DKA-CEC SELESAI \u2014 Timer 0 jam",
        `Pengujian ${Math.round(run.duration_hours)} jam @ ${Math.round(run.temperature_c)}\u00b0C telah selesai. Segera konfirmasi batch.`,
      );
    }
    if (!finished) firedRef.current = false;
  }, [finished, run.id, run.duration_hours, run.temperature_c]);

  const total = run.total_seconds || 1;
  const progress = Math.min(100, Math.max(0, ((total - sec) / total) * 100));

  return (
    <div className="flex flex-col gap-4 animate-fade-up" data-testid="dkacec-active-timer">
      {finished && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4" data-testid="dkacec-finished-banner">
          <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-400" />
          <div className="flex-1">
            <div className="font-heading text-sm font-bold text-emerald-300">PENGUJIAN SELESAI</div>
            <div className="font-mono text-[11px] text-emerald-200/80">Waktu {Math.round(run.duration_hours)} jam telah berakhir. Konfirmasi untuk mengarsipkan batch.</div>
          </div>
          <button
            data-testid="dkacec-complete-btn"
            onClick={() => complete.mutate(run.id, { onSuccess: () => toast.success("Batch diarsipkan.") })}
            disabled={complete.isPending}
            className="rounded-md bg-emerald-500 px-4 py-2 font-mono text-[12px] font-bold tracking-widest text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
          >
            {complete.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "SELESAIKAN"}
          </button>
        </div>
      )}

      <Card data-testid="dkacec-timer-card" className={finished ? "border-emerald-500/40" : "border-blue-500/40"}>
        <div className="flex items-center justify-between">
          <Label>ACTIVE TIMER</Label>
          <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] font-bold tracking-widest ${finished ? "bg-emerald-500/15 text-emerald-400" : "bg-blue-500/15 text-blue-400"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${finished ? "bg-emerald-400" : "animate-pulse bg-blue-400"}`} />
            {finished ? "FINISHED" : "RUNNING"}
          </span>
        </div>

        <div className="mt-1 font-mono text-[12px] text-zinc-300">{run.method_label}</div>

        <div className="my-5 text-center">
          <div className="font-mono text-[10px] tracking-[0.3em] text-zinc-500">SISA WAKTU (JAM:MENIT:DETIK)</div>
          <div data-testid="dkacec-countdown" className={`font-heading text-5xl font-bold tabular-nums ${finished ? "text-emerald-400" : "text-zinc-50"}`}>
            {fmtHms(sec)}
          </div>
          {run.running_label && (
            <div className="mt-1 font-mono text-[11px] text-zinc-500" data-testid="dkacec-running-hours-info">
              Mulai dari {Math.round(run.duration_hours)}:00 &minus; jam running{" "}
              <span className="font-bold text-blue-400">{run.running_label}</span>
            </div>
          )}
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
          <div className={`h-full rounded-full transition-all duration-1000 ${finished ? "bg-emerald-500" : "bg-blue-500"}`} style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-1 text-right font-mono text-[10px] text-zinc-500">{progress.toFixed(1)}%</div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-zinc-700 bg-zinc-950 p-3">
            <div className="flex items-center gap-1.5 font-mono text-[9px] tracking-widest text-zinc-500"><PlayCircle className="h-3 w-3" /> START</div>
            <div data-testid="dkacec-start" className="mt-1 font-mono text-[12px] font-bold leading-4 text-zinc-100">{fmtFull(run.start_at)}</div>
          </div>
          <div className="rounded-lg border border-zinc-700 bg-zinc-950 p-3">
            <div className="flex items-center gap-1.5 font-mono text-[9px] tracking-widest text-zinc-500"><Hourglass className="h-3 w-3" /> FINISH</div>
            <div data-testid="dkacec-finish" className="mt-1 font-mono text-[12px] font-bold leading-4 text-blue-400">{fmtFull(run.finish_at)}</div>
          </div>
        </div>

        <div className="mt-3 flex gap-3">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2">
            <Thermometer className="h-4 w-4 text-red-400" />
            <span className="font-mono text-[13px] font-bold text-zinc-100">{Math.round(run.temperature_c)}°C</span>
          </div>
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2">
            <Timer className="h-4 w-4 text-blue-400" />
            <span className="font-mono text-[13px] font-bold text-zinc-100">{Math.round(run.duration_hours)} jam</span>
          </div>
        </div>
      </Card>

      <Card data-testid="dkacec-samples-card">
        <div className="flex items-center justify-between">
          <Label>SAMPEL DALAM BATCH ({run.samples.length}/4)</Label>
          <Link to="/dka-cec/new" data-testid="dkacec-add-sample-link" className="flex items-center gap-1 font-mono text-[11px] font-bold text-blue-400 hover:text-blue-300">
            <Plus className="h-3.5 w-3.5" /> TAMBAH
          </Link>
        </div>
        <div className="mt-3 flex flex-col gap-2">
          {run.samples.map((s) => (
            <div key={s.sample_code} data-testid={`dkacec-sample-${s.sample_code}`} className="flex items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5">
              <FlaskConical className="h-4 w-4 text-blue-400" />
              <span className="flex-1 font-mono text-[13px] font-bold text-zinc-100">{s.sample_code}</span>
              {run.samples.length > 1 && (
                <button
                  data-testid={`dkacec-remove-sample-${s.sample_code}`}
                  title="Hapus sampel"
                  onClick={() => removeSample.mutate({ id: run.id, code: s.sample_code })}
                  className="rounded p-1 text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        {run.operator && (
          <div className="mt-3 font-mono text-[11px] text-zinc-500">Operator: <span className="text-zinc-300">{run.operator}</span></div>
        )}
      </Card>

      <button
        data-testid="dkacec-stop-btn"
        onClick={() => {
          if (window.confirm("Hentikan run ini? Batch akan diarsipkan dan Anda bisa memulai batch baru.")) {
            stop.mutate(run.id, { onSuccess: () => toast.success("Run dihentikan.") });
          }
        }}
        disabled={stop.isPending}
        className="flex items-center justify-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 py-3 font-mono text-[12px] font-bold tracking-widest text-red-400 hover:border-red-500/50 hover:bg-red-500/10 disabled:opacity-50"
      >
        {stop.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />} HENTIKAN RUN
      </button>
    </div>
  );
}

export default function DkacecMonitor() {
  const { data, isLoading } = useDkacecActive();
  const active = data?.active;

  if (isLoading) {
    return (
      <div className="flex justify-center py-24" data-testid="dkacec-monitor-loading">
        <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
      </div>
    );
  }

  if (!active) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center" data-testid="dkacec-monitor-empty">
        <Timer className="h-12 w-12 text-zinc-500" />
        <div className="font-heading text-2xl font-semibold text-zinc-50">Belum ada timer aktif</div>
        <p className="max-w-sm font-mono text-xs text-zinc-500">Scan label sampel (tulisan tangan) untuk memulai Smart Timer otomatis 192 jam @ 150/160/180°C.</p>
        <Link to="/dka-cec/new" data-testid="dkacec-start-cta" className="mt-2 flex items-center gap-2 rounded-md bg-blue-500 px-6 py-3 font-mono text-sm font-bold tracking-widest text-zinc-950 hover:bg-blue-400">
          SCAN LABEL & MULAI
        </Link>
      </div>
    );
  }

  return <ActiveTimer run={active} />;
}
