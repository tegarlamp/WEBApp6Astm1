import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useDkaTrend } from "@/lib/dka/api";
import { fmtDate } from "@/lib/kht/format";
import { Card } from "@/components/kht/ui";
import { DkaTrendChart } from "@/components/dka/ui";

export default function DkaTrend() {
  const { data, isLoading } = useDkaTrend();
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [isLoading]);

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>;
  const points = data ?? [];
  if (points.length === 0) return <p className="py-16 text-center font-mono text-xs text-zinc-500" data-testid="dka-trend-empty">Data belum cukup untuk plot tren.</p>;
  const list = points.slice().reverse();

  return (
    <div className="flex flex-col gap-4 animate-fade-up" data-testid="dka-trend">
      <Card>
        <div className="font-mono text-[11px] tracking-[0.15em] text-blue-400">DKA BATCH TREND</div>
        <div ref={ref} className="mt-3 w-full">{w > 0 && <DkaTrendChart data={points} width={w} />}</div>
      </Card>
      <Card>
        <div className="font-mono text-[11px] tracking-[0.15em] text-blue-400">DATA POINTS</div>
        <div className="mt-2">
          {list.map((d, i) => (
            <Link key={d.id} to={`/rating-dka/result/${d.id}`} data-testid={`dka-trend-point-${d.id}`} className={`flex items-center py-3 transition-colors hover:bg-zinc-800/40 ${i === list.length - 1 ? "" : "border-b border-zinc-700"}`}>
              <div className="flex-1">
                <div className="font-mono text-[13px] font-bold text-zinc-50">{d.batch_id || "—"}</div>
                <div className="font-mono text-[10px] text-zinc-500">{fmtDate(d.created_at)} · {d.count} sampel</div>
              </div>
              <span className="font-heading text-[26px] font-bold text-blue-400">{d.avg_severity.toFixed(2)}</span>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
