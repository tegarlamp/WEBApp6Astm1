import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, FlaskConical, Loader2, Palette } from "lucide-react";
import { useDashboard } from "@/lib/kht/api";
import { fmtDateTime } from "@/lib/kht/format";
import { Card, CardLabel, InfoRow, KHTScale, KHTScaleDetail, RatingGauge, StatusBadge } from "@/components/kht/ui";
import { ParameterTable } from "@/components/kht/viz";

const Stat = ({ label, value, color, testId }) => (
  <div className="flex flex-1 flex-col items-center rounded-lg border border-zinc-700 bg-zinc-900 py-3" data-testid={testId}>
    <span className="font-heading text-[26px] font-bold leading-7" style={{ color }}>{value}</span>
    <span className="font-mono text-[9px] tracking-widest text-zinc-500">{label}</span>
  </div>
);

const ColorScaleLink = ({ testId }) => (
  <Link to="/khtt/color-scale" data-testid={testId} className="flex items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-900 p-4 transition-colors hover:border-amber-500/50">
    <div className="flex h-11 w-11 items-center justify-center rounded-md bg-[#0E3342]"><Palette className="h-5 w-5 text-amber-500" /></div>
    <div className="flex-1">
      <div className="font-heading text-[17px] font-semibold text-zinc-50">Nikko Color Scale</div>
      <div className="font-mono text-[11px] text-zinc-300">Standar referensi warna 0 – 10</div>
    </div>
    <ArrowRight className="h-4 w-4 text-zinc-300" />
  </Link>
);

export default function KhtDashboard() {
  const { data, isLoading } = useDashboard();
  const latest = data?.latest;

  if (isLoading)
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-zinc-500" data-testid="kht-dashboard-loading">
        <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
        <span className="font-mono text-xs">Scanning latest results…</span>
      </div>
    );

  if (!latest)
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center" data-testid="kht-dashboard-empty">
        <FlaskConical className="h-12 w-12 text-zinc-500" />
        <div className="font-heading text-2xl font-semibold text-zinc-50">No tests yet</div>
        <p className="font-mono text-xs text-zinc-500">Run your first AI Vision analysis to see results here.</p>
        <Link to="/khtt/new" data-testid="dashboard-new-test" className="mt-2 rounded-md bg-amber-500 px-6 py-3 font-mono text-sm font-bold tracking-widest text-zinc-950 hover:bg-amber-400">RUN NEW TEST</Link>
        <div className="mt-4 w-full"><ColorScaleLink testId="dashboard-color-scale-empty" /></div>
      </div>
    );

  return (
    <div className="flex flex-col gap-4 animate-fade-up" data-testid="kht-dashboard">
      <Card data-testid="dashboard-latest-card">
        <div className="flex items-center justify-between">
          <CardLabel>LATEST RESULT</CardLabel>
          <StatusBadge status={latest.status} />
        </div>
        <div className="mt-2 font-mono text-[15px] font-bold text-zinc-50" data-testid="dashboard-latest-sample-id">{latest.meta.sample_id}</div>
        <div className="my-4 flex justify-center"><RatingGauge rating={latest.rating} performance={latest.performance} confidence={latest.confidence} /></div>
        <div className="mt-2 flex border-t border-zinc-700">
          <div className="flex-1 px-2 py-3">
            <div className="font-mono text-[9px] tracking-widest text-zinc-500">DEPOSIT LEVEL</div>
            <div className="mt-0.5 font-mono text-sm font-bold text-zinc-50">{latest.deposit_level_label || "—"}</div>
          </div>
          <div className="flex-1 border-l border-zinc-700 px-2 py-3">
            <div className="font-mono text-[9px] tracking-widest text-zinc-500">AI MODEL</div>
            <div className="mt-0.5 font-mono text-sm font-bold text-zinc-50">KHT-AI-V2</div>
          </div>
        </div>
        <Link to={`/khtt/result/${latest.id}`} data-testid="dashboard-view-report" className="mt-2 flex items-center justify-center gap-2 rounded-md bg-amber-500 py-3 font-mono text-[13px] font-bold tracking-widest text-zinc-950 hover:bg-amber-400">
          VIEW FULL REPORT <ArrowRight className="h-4 w-4" />
        </Link>
      </Card>

      <div className="flex gap-2">
        <Stat label="TOTAL" value={String(data.total ?? 0)} color="#FFFFFF" testId="stat-total" />
        <Stat label="CLEAR" value={String(data.passed ?? 0)} color="#10B981" testId="stat-clear" />
        <Stat label="TARNISH" value={String(data.failed ?? 0)} color="#EF4444" testId="stat-tarnish" />
        <Stat label="AVG" value={(data.avg_rating ?? 0).toFixed(1)} color="#F59E0B" testId="stat-avg" />
      </div>

      <Card>
        <CardLabel>KHT STANDARD RATING REFERENCE</CardLabel>
        <div className="mt-3"><KHTScale current={latest.rating} /></div>
      </Card>

      <ColorScaleLink testId="dashboard-color-scale" />

      <Card>
        <CardLabel>PARAMETER ANALYSIS</CardLabel>
        <div className="mt-2"><ParameterTable parameters={latest.parameters} /></div>
      </Card>

      <Card>
        <CardLabel className="mb-1">TEST INFORMATION</CardLabel>
        <InfoRow k="Oil / Product" v={latest.meta.oil_type || "—"} />
        <InfoRow k="Batch / Lot" v={latest.meta.batch || "—"} />
        <InfoRow k="Operator" v={latest.meta.operator || "—"} />
        <InfoRow k="Test Condition" v={`${latest.meta.temperature_c}°C · ${latest.meta.duration_hours}h`} />
        <InfoRow k="Air / Oil Flow" v={`${latest.meta.air_flow} / ${latest.meta.oil_flow} mL/min`} />
        <InfoRow k="Analyzed" v={fmtDateTime(latest.created_at)} last />
      </Card>

      <Card>
        <CardLabel>STANDARD SCALE (KES)</CardLabel>
        <div className="mt-2"><KHTScaleDetail /></div>
      </Card>
    </div>
  );
}
