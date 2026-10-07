import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Grid3X3, Loader2, Plus, ShieldCheck } from "lucide-react";
import { useRustDashboard, RUST_GRADES } from "@/lib/rust/api";
import { Card, InfoRow } from "@/components/kht/ui";
import RustGrid from "@/components/rust/Grid";

const Label = ({ children }) => <div className="font-mono text-[11px] tracking-[0.15em] text-amber-400">{children}</div>;

export default function RustDashboard() {
  const { data, isLoading } = useRustDashboard();
  if (isLoading) return <div className="flex justify-center py-24" data-testid="rust-dashboard-loading"><Loader2 className="h-6 w-6 animate-spin text-amber-400" /></div>;
  const latest = data?.latest;
  if (!latest) return (
    <div className="flex flex-col items-center gap-4 py-16 text-center" data-testid="rust-dashboard-empty">
      <Grid3X3 className="h-12 w-12 text-amber-500" /><div className="font-heading text-2xl font-semibold text-zinc-50">Belum ada inspeksi karat</div>
      <p className="max-w-md font-mono text-xs leading-5 text-zinc-500">Foto metal panel bersama plat ukur transparan 100 kotak untuk memulai penilaian ASTM D1748.</p>
      <Link to="/rust-preventing/new" data-testid="rust-new-test-cta" className="flex items-center gap-2 rounded-md bg-amber-500 px-6 py-3 font-mono text-sm font-bold tracking-widest text-zinc-950 hover:bg-amber-400"><Plus className="h-4 w-4" /> NEW INSPECTION</Link>
    </div>
  );
  const grade = RUST_GRADES[latest.grade] || RUST_GRADES.E;
  return (
    <div className="flex flex-col gap-4 animate-fade-up" data-testid="rust-dashboard">
      <Card data-testid="rust-latest-card">
        <div className="flex items-center justify-between"><Label>LATEST ASTM D1748 RESULT</Label><span data-testid="rust-latest-grade" className="rounded border px-3 py-1 font-mono text-sm font-bold" style={{ color: grade.color, borderColor: `${grade.color}66`, backgroundColor: `${grade.color}18` }}>GRADE {latest.grade}</span></div>
        <div className="mt-2 font-mono text-[15px] font-bold text-zinc-50" data-testid="rust-latest-sample-id">{latest.meta.sample_id || "—"}</div>
        <div className="my-4 grid gap-4 sm:grid-cols-[160px_1fr] sm:items-center"><div className="flex flex-col items-center"><div className="font-heading text-6xl font-bold" style={{ color: grade.color }} data-testid="rust-latest-count">{latest.rusted_box_count}</div><div className="font-mono text-[10px] tracking-widest text-zinc-500">RUSTED BOXES / 100</div></div><RustGrid boxes={latest.grid_boxes} /></div>
        <div className="border-t border-zinc-700 pt-3"><InfoRow k="Grade status" v={latest.grade_status} /><InfoRow k="Confidence" v={`${Number(latest.confidence).toFixed(0)}%`} /><InfoRow k="Spread" v={latest.rust_spread || "—"} last /></div>
        <Link to={`/rust-preventing/result/${latest.id}`} data-testid="rust-view-report" className="mt-3 flex items-center justify-center gap-2 rounded-md bg-amber-500 py-3 font-mono text-[13px] font-bold tracking-widest text-zinc-950 hover:bg-amber-400">VIEW FULL REPORT <ArrowRight className="h-4 w-4" /></Link>
      </Card>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">{Object.keys(RUST_GRADES).map((g) => <div key={g} className="flex flex-col items-center rounded-lg border border-zinc-700 bg-zinc-900 py-3"><span className="font-heading text-2xl font-bold" style={{ color: RUST_GRADES[g].color }}>{data?.grade_counts?.[g] || 0}</span><span className="font-mono text-[9px] tracking-widest text-zinc-500">GRADE {g}</span></div>)}</div>
      <Card><Label>ANALYSIS NOTE</Label><p className="mt-2 font-mono text-[13px] leading-5 text-zinc-200" data-testid="rust-latest-summary">{latest.ai_summary || "—"}</p></Card>
      <Card><Label>TEST INFORMATION</Label><InfoRow k="Product / Oil" v={latest.meta.product || "—"} /><InfoRow k="Exposure" v={`${latest.meta.exposure_hours}h @ ${latest.meta.temperature_c}°C`} /><InfoRow k="Humidity" v={`${latest.meta.humidity_pct}% RH`} /><InfoRow k="Substrate" v={latest.meta.substrate || "—"} last /></Card>
      <Link to="/rust-preventing/grid-scale" data-testid="rust-scale-link" className="flex items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-900 p-4 hover:border-amber-500/50"><ShieldCheck className="h-5 w-5 text-amber-400" /><span className="flex-1 font-mono text-xs text-zinc-200">Lihat aturan Grade A–E & metode hitung 100 kotak</span><ArrowRight className="h-4 w-4 text-zinc-500" /></Link>
    </div>
  );
}
