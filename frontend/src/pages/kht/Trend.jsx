import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useTrend } from "@/lib/kht/api";
import { fmtDate, ratingColor } from "@/lib/kht/format";
import { Card, CardLabel, StatusBadge } from "@/components/kht/ui";
import { TrendChart } from "@/components/kht/viz";

export default function KhtTrend() {
  const { data, isLoading } = useTrend();
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [isLoading]);

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-amber-500" /></div>;
  const points = (data ?? []).map((d) => ({ rating: d.rating, sample_id: d.sample_id }));
  if (points.length === 0) return <p className="py-16 text-center font-mono text-xs text-zinc-500" data-testid="trend-empty">Insufficient data to plot trend.</p>;

  const list = (data ?? []).slice().reverse();
  return (
    <div className="flex flex-col gap-4 animate-fade-up" data-testid="kht-trend">
      <Card>
        <CardLabel>KHT RATING TREND</CardLabel>
        <div ref={ref} className="mt-3 w-full">{w > 0 && <TrendChart data={points} width={w} />}</div>
      </Card>
      <Card>
        <CardLabel>DATA POINTS</CardLabel>
        <div className="mt-2">
          {list.map((d, i) => (
            <Link key={d.id} to={`/khtt/result/${d.id}`} data-testid={`trend-point-${d.id}`} className={`flex items-center py-3 transition-colors hover:bg-zinc-800/40 ${i === list.length - 1 ? "" : "border-b border-zinc-700"}`}>
              <div className="flex-1">
                <div className="font-mono text-[13px] font-bold text-zinc-50">{d.sample_id || "—"}</div>
                <div className="font-mono text-[10px] text-zinc-500">{fmtDate(d.created_at)}</div>
              </div>
              <span className="font-heading text-[26px] font-bold" style={{ color: ratingColor(d.rating) }}>{d.rating.toFixed(1)}</span>
              <div className="ml-3"><StatusBadge status={d.status} size="sm" /></div>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
