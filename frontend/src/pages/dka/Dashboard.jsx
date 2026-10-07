import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Droplets, Layers, Loader2 } from "lucide-react";
import { useDkaDashboard, DKA_CATEGORIES } from "@/lib/dka/api";
import { fmtDateTime } from "@/lib/kht/format";
import { Card, InfoRow } from "@/components/kht/ui";
import { DkaSampleCard } from "@/components/dka/ui";

const Label = ({ children }) => <div className="font-mono text-[11px] tracking-[0.15em] text-blue-400">{children}</div>;

const ScaleLink = () => (
  <Link to="/rating-dka/scale" data-testid="dka-scale-link" className="flex items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-900 p-4 transition-colors hover:border-blue-500/50">
    <div className="flex h-11 w-11 items-center justify-center rounded-md bg-blue-500/15"><Droplets className="h-5 w-5 text-blue-400" /></div>
    <div className="flex-1">
      <div className="font-heading text-[17px] font-semibold text-zinc-50">DKA Standard Reference</div>
      <div className="font-mono text-[11px] text-zinc-300">CLEAR · Aspect 1 · Aspect 2 · Aspect 3</div>
    </div>
    <ArrowRight className="h-4 w-4 text-zinc-300" />
  </Link>
);

export default function DkaDashboard() {
  const { data, isLoading } = useDkaDashboard();
  const latest = data?.latest;

  if (isLoading) return <div className="flex justify-center py-24" data-testid="dka-dashboard-loading"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>;

  if (!latest)
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center" data-testid="dka-dashboard-empty">
        <Layers className="h-12 w-12 text-zinc-500" />
        <div className="font-heading text-2xl font-semibold text-zinc-50">Belum ada batch</div>
        <p className="font-mono text-xs text-zinc-500">Foto hingga 4 tabung sekaligus untuk analisa batch pertama.</p>
        <Link to="/rating-dka/new" data-testid="dka-new-test-cta" className="mt-2 rounded-md bg-blue-500 px-6 py-3 font-mono text-sm font-bold tracking-widest text-white hover:bg-blue-400">RUN NEW BATCH</Link>
        <div className="mt-4 w-full"><ScaleLink /></div>
      </div>
    );

  return (
    <div className="flex flex-col gap-4 animate-fade-up" data-testid="dka-dashboard">
      <Card data-testid="dka-latest-card">
        <div className="flex items-center justify-between">
          <Label>LATEST BATCH</Label>
          <span className="font-mono text-[11px] text-zinc-300" data-testid="dka-latest-count">{latest.samples.length} sampel</span>
        </div>
        <div className="mt-2 font-mono text-[15px] font-bold text-zinc-50" data-testid="dka-latest-batch-id">{latest.meta.batch_id || latest.id.slice(0, 8)}</div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {latest.samples.map((s) => <DkaSampleCard key={s.index} sample={s} />)}
        </div>
        <Link to={`/rating-dka/result/${latest.id}`} data-testid="dka-view-report" className="mt-3 flex items-center justify-center gap-2 rounded-md bg-blue-500 py-3 font-mono text-[13px] font-bold tracking-widest text-white hover:bg-blue-400">
          VIEW FULL REPORT <ArrowRight className="h-4 w-4" />
        </Link>
      </Card>

      <div className="flex gap-2">
        <div className="flex flex-1 flex-col items-center rounded-lg border border-zinc-700 bg-zinc-900 py-3" data-testid="dka-stat-batches">
          <span className="font-heading text-[26px] font-bold leading-7 text-zinc-50">{data.total_batches ?? 0}</span>
          <span className="font-mono text-[9px] tracking-widest text-zinc-500">BATCHES</span>
        </div>
        <div className="flex flex-1 flex-col items-center rounded-lg border border-zinc-700 bg-zinc-900 py-3" data-testid="dka-stat-samples">
          <span className="font-heading text-[26px] font-bold leading-7 text-blue-400">{data.total_samples ?? 0}</span>
          <span className="font-mono text-[9px] tracking-widest text-zinc-500">SAMPLES</span>
        </div>
      </div>

      <Card>
        <Label>DISTRIBUSI RATING</Label>
        <div className="mt-2" data-testid="dka-distribution">
          {DKA_CATEGORIES.map((k, i) => (
            <div key={k} className={`flex items-center justify-between py-2.5 ${i === DKA_CATEGORIES.length - 1 ? "" : "border-b border-zinc-700"}`}>
              <span className="font-mono text-xs text-zinc-300">{k}</span>
              <span className="font-mono text-sm font-bold text-zinc-50" data-testid={`dka-dist-${k.replace(" ", "-")}`}>{data.distribution?.[k] ?? 0}</span>
            </div>
          ))}
        </div>
      </Card>

      <ScaleLink />

      <Card>
        <Label>TEST INFORMATION</Label>
        <div className="mt-1">
          <InfoRow k="Batch ID" v={latest.meta.batch_id || "—"} />
          <InfoRow k="Product" v={latest.meta.product || "—"} />
          <InfoRow k="Operator" v={latest.meta.operator || "—"} />
          <InfoRow k="Condition" v={`${latest.meta.temperature_c}°C · ${latest.meta.duration_hours}h`} />
          <InfoRow k="Analyzed" v={fmtDateTime(latest.created_at)} last />
        </div>
      </Card>
    </div>
  );
}
