import React from "react";
import { fileUrl, textOnColor } from "@/lib/dka/api";

export const DkaBadge = ({ rating, color, size = "md" }) => (
  <span
    data-testid={`dka-badge-${rating}`}
    className={`inline-flex rounded border border-black/15 font-mono font-bold tracking-wide ${size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1.5 text-[13px]"}`}
    style={{ backgroundColor: color, color: textOnColor(color) }}
  >
    {String(rating).toUpperCase()}
  </span>
);

export const DkaSampleCard = ({ sample }) => (
  <div className="min-w-[140px] flex-1 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900" data-testid={`dka-sample-${sample.index}`}>
    <img src={fileUrl(sample.crop_path || "", 400)} alt={`sample ${sample.index}`} className="h-[150px] w-full bg-zinc-800 object-cover" />
    <div className="flex flex-col gap-0.5 p-3">
      <span className="font-mono text-[9px] tracking-widest text-blue-400">#{sample.index}</span>
      <span className="truncate font-mono text-[13px] font-bold text-zinc-50">{sample.sample_id || "—"}</span>
      <div className="mt-1"><DkaBadge rating={sample.rating} color={sample.color} size="sm" /></div>
      <span className="mt-1 font-mono text-[10px] text-zinc-500">Conf {sample.confidence.toFixed(0)}%</span>
    </div>
  </div>
);

const MAX_SEV = 3;
export const DkaTrendChart = ({ data, width, height = 220 }) => {
  const padL = 34, padR = 12, padT = 16, padB = 24;
  const chartW = Math.max(1, width - padL - padR);
  const chartH = height - padT - padB;
  const n = data.length;
  const x = (i) => padL + (n <= 1 ? chartW / 2 : (i / (n - 1)) * chartW);
  const y = (s) => padT + (s / MAX_SEV) * chartH;
  const points = data.map((d, i) => `${x(i)},${y(d.avg_severity)}`).join(" ");
  const labels = ["CLEAR", "Asp1", "Asp2", "Asp3"];
  return (
    <div data-testid="dka-trend-chart">
      <svg width={width} height={height}>
        {[0, 1, 2, 3].map((g) => <line key={g} x1={padL} y1={y(g)} x2={width - padR} y2={y(g)} stroke="#1E3A5F" strokeWidth={1} />)}
        {[0, 1, 2, 3].map((g, i) => <text key={`t${g}`} x={2} y={y(g) + 4} fill="#64748B" fontSize={8} fontFamily="JetBrains Mono">{labels[i]}</text>)}
        {n > 1 && <polyline points={points} fill="none" stroke="#3B82F6" strokeWidth={2.5} />}
        {data.map((d, i) => (
          <circle key={i} cx={x(i)} cy={y(d.avg_severity)} r={4} fill="#3B82F6" stroke="#0A1420" strokeWidth={1.5}>
            <title>{d.batch_id} · {d.avg_severity.toFixed(2)}</title>
          </circle>
        ))}
      </svg>
      <div className="mt-1 font-mono text-[10px] text-zinc-500">Rata-rata severity per batch (0 = CLEAR terbaik → 3 = Aspect 3 terburuk)</div>
    </div>
  );
};

export const BlueBtn = ({ children, className = "", ...rest }) => (
  <button type="button" className={`flex items-center justify-center gap-2 rounded-md bg-blue-500 font-mono font-bold tracking-widest text-white transition-colors hover:bg-blue-400 disabled:opacity-50 ${className}`} {...rest}>
    {children}
  </button>
);
