import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Coins, TestTube2, Loader2 } from "lucide-react";
import { useCopperDashboard } from "@/lib/copper/api";
import { fmtDateTime } from "@/lib/kht/format";
import { Card, InfoRow, StatusBadge } from "@/components/kht/ui";
import { CopperClassGauge } from "@/components/copper/ui";

const Label = ({ children }) => <div className="font-mono text-[11px] tracking-[0.15em] text-amber-500">{children}</div>;

const ScaleLink = () => (
  <Link to="/copper-strip/scale" data-testid="copper-scale-link" className="flex items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-900 p-4 transition-colors hover:border-amber-500/50">
    <div className="flex h-11 w-11 items-center justify-center rounded-md bg-amber-500/15"><Coins className="h-5 w-5 text-amber-400" /></div>
    <div className="flex-1">
      <div className="font-heading text-[17px] font-semibold text-zinc-50">ASTM D130 Standard Chart</div>
      <div className="font-mono text-[11px] text-zinc-300">Referensi warna korosi 1a – 4c</div>
    </div>
    <ArrowRight className="h-4 w-4 text-zinc-300" />
  </Link>
);

export default function CopperDashboard() {
  const { data, isLoading } = useCopperDashboard();
  const latest = data?.latest;

  if (isLoading) return <div className="flex justify-center py-24" data-testid="copper-dashboard-loading"><Loader2 className="h-6 w-6 animate-spin text-amber-400" /></div>;

  if (!latest)
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center" data-testid="copper-dashboard-empty">
        <TestTube2 className="h-12 w-12 text-zinc-500" />
        <div className="font-heading text-2xl font-semibold text-zinc-50">Belum ada uji</div>
        <p className="font-mono text-xs text-zinc-500">Jalankan analisa AI Vision pertama Anda untuk melihat hasil.</p>
        <Link to="/copper-strip/new" data-testid="copper-new-test-cta" className="mt-2 rounded-md bg-amber-500 px-6 py-3 font-mono text-sm font-bold tracking-widest text-zinc-950 hover:bg-amber-400">RUN NEW TEST</Link>
        <div className="mt-4 w-full"><ScaleLink /></div>
      </div>
    );

  return (
    <div className="flex flex-col gap-4 animate-fade-up" data-testid="copper-dashboard">
      <Card data-testid="copper-latest-card">
        <div className="flex items-center justify-between">
          <Label>LATEST RESULT</Label>
          <StatusBadge status={latest.status} />
        </div>
        <div className="mt-2 font-mono text-[15px] font-bold text-zinc-50" data-testid="copper-latest-sample-id">{latest.meta.sample_id}</div>
        <div className="my-4 flex justify-center">
          <CopperClassGauge classification={latest.classification} group={latest.group} color={latest.color} status={latest.status} confidence={latest.confidence} />
        </div>
        <div className="flex border-t border-zinc-700">
          <div className="flex-1 px-2 py-3">
            <div className="font-mono text-[9px] tracking-widest text-zinc-500">CLASSIFICATION</div>
            <div className="mt-1 font-mono text-sm font-bold text-zinc-50">{String(latest.classification).toUpperCase()}</div>
          </div>
          <div className="flex-1 border-l border-zinc-700 px-2 py-3">
            <div className="font-mono text-[9px] tracking-widest text-zinc-500">STANDARD</div>
            <div className="mt-1 font-mono text-sm font-bold text-zinc-50">ASTM D130 / IP 154</div>
          </div>
        </div>
        <Link to={`/copper-strip/result/${latest.id}`} data-testid="copper-view-report" className="mt-3 flex items-center justify-center gap-2 rounded-md bg-amber-500 py-3 font-mono text-[13px] font-bold tracking-widest text-zinc-950 hover:bg-amber-400">
          VIEW FULL REPORT <ArrowRight className="h-4 w-4" />
        </Link>
      </Card>

      <div className="flex gap-2">
        <div className="flex flex-1 flex-col items-center rounded-lg border border-zinc-700 bg-zinc-900 py-3" data-testid="copper-stat-total">
          <span className="font-heading text-[26px] font-bold leading-7 text-zinc-50">{data.total ?? 0}</span>
          <span className="font-mono text-[9px] tracking-widest text-zinc-500">TOTAL</span>
        </div>
        <div className="flex flex-1 flex-col items-center rounded-lg border border-zinc-700 bg-zinc-900 py-3" data-testid="copper-stat-clear">
          <span className="font-heading text-[26px] font-bold leading-7 text-emerald-400">{data.passed ?? 0}</span>
          <span className="font-mono text-[9px] tracking-widest text-zinc-500">CLEAR</span>
        </div>
        <div className="flex flex-1 flex-col items-center rounded-lg border border-zinc-700 bg-zinc-900 py-3" data-testid="copper-stat-tarnish">
          <span className="font-heading text-[26px] font-bold leading-7 text-red-400">{data.failed ?? 0}</span>
          <span className="font-mono text-[9px] tracking-widest text-zinc-500">TARNISH</span>
        </div>
      </div>

      <ScaleLink />

      <Card>
        <Label>DESKRIPSI KONDISI</Label>
        <p className="mt-2 font-mono text-[13px] leading-5 text-zinc-200" data-testid="copper-latest-summary">{latest.ai_summary || "—"}</p>
      </Card>

      <Card>
        <Label>TEST INFORMATION</Label>
        <div className="mt-1">
          <InfoRow k="Product / Fuel" v={latest.meta.product || "—"} />
          <InfoRow k="Batch / Lot" v={latest.meta.batch || "—"} />
          <InfoRow k="Operator" v={latest.meta.operator || "—"} />
          <InfoRow k="Test Condition" v={`${latest.meta.temperature_c}°C · ${latest.meta.duration_hours}h`} />
          <InfoRow k="Analyzed" v={fmtDateTime(latest.created_at)} last />
        </div>
      </Card>
    </div>
  );
}
