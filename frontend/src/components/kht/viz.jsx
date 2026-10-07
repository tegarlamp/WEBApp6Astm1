import React, { useEffect, useRef, useState } from "react";
import { fileUrl } from "@/lib/kht/api";
import { paramRows, ratingColor } from "@/lib/kht/format";

const TUBE_LEN_MM = 300;
const TICKS = [0, 50, 100, 150, 200, 250, 300];

export const ParameterTable = ({ parameters }) => {
  const rows = paramRows(parameters);
  return (
    <div data-testid="parameter-table">
      {rows.map((r, i) => (
        <div key={r.label} className={`flex items-center justify-between py-3 ${i === rows.length - 1 ? "" : "border-b border-zinc-700"}`}>
          <span className="font-mono text-[13px] text-zinc-300">{r.label}</span>
          <span className="font-mono text-sm font-bold text-zinc-50">{r.value}</span>
        </div>
      ))}
    </div>
  );
};

export const TubeViewer = ({ imagePath, parameters, mode, height = 220 }) => {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  const start = Math.max(0, Math.min(TUBE_LEN_MM, parameters.deposit_start_mm));
  const end = Math.max(start, Math.min(TUBE_LEN_MM, parameters.deposit_end_mm));
  const leftPct = (start / TUBE_LEN_MM) * 100;
  const widthPct = Math.max(2, ((end - start) / TUBE_LEN_MM) * 100);
  const heat = mode === "heatmap";
  return (
    <div data-testid="tube-viewer">
      <div ref={ref} className="relative mb-1 h-4">
        {w > 0 && TICKS.map((t) => (
          <span key={t} className="absolute w-6 text-center font-mono text-[9px] text-zinc-500" style={{ left: Math.min(Math.max((t / TUBE_LEN_MM) * w - 12, 0), w - 24) }}>{t}</span>
        ))}
      </div>
      <div className={`relative overflow-hidden rounded-lg border bg-[#050B12] ${heat ? "border-amber-500" : "border-zinc-700"}`} style={{ height }}>
        <img src={fileUrl(imagePath, 1600)} alt="sample tube" className="h-full w-full object-cover" />
        {heat && (
          <>
            <div className="absolute inset-0 bg-black/35" />
            <div
              className="absolute rounded-md opacity-80"
              style={{ top: height * 0.22, bottom: height * 0.22, left: `${leftPct}%`, width: `${widthPct}%`, background: "linear-gradient(90deg,#10B981,#EAB308,#EF4444,#EAB308,#10B981)" }}
            />
            <div className="absolute top-1.5 text-center font-mono text-[11px] font-bold text-amber-500" style={{ left: `${leftPct}%`, width: `${widthPct}%` }}>
              {(end - start).toFixed(0)} mm
            </div>
          </>
        )}
        {!heat && <div className="absolute left-1.5 top-1.5 rounded bg-[#0A1420]/75 px-1.5 py-0.5 font-mono text-[10px] text-amber-500">ORIGINAL</div>}
      </div>
      {heat && (
        <div className="mt-2">
          <div className="h-2 rounded" style={{ background: "linear-gradient(90deg,#10B981,#EAB308,#EF4444)" }} />
          <div className="mt-1 flex justify-between font-mono text-[9px] text-zinc-500"><span>Low deposit</span><span>High deposit</span></div>
        </div>
      )}
    </div>
  );
};

export const Segmented = ({ value, onChange, options, testId }) => (
  <div className="flex rounded-md border border-zinc-700 bg-zinc-950 p-1" data-testid={testId}>
    {options.map((o) => (
      <button
        key={o.value}
        type="button"
        data-testid={`${testId}-${o.value}`}
        onClick={() => onChange(o.value)}
        className={`flex-1 rounded px-3 py-1.5 font-mono text-xs font-medium transition-colors ${value === o.value ? "bg-amber-500 text-zinc-950" : "text-zinc-400 hover:text-zinc-100"}`}
      >
        {o.label}
      </button>
    ))}
  </div>
);

export const TrendChart = ({ data, width, height = 240 }) => {
  const padL = 28, padR = 12, padT = 16, padB = 24;
  const chartW = Math.max(1, width - padL - padR);
  const chartH = height - padT - padB;
  const n = data.length;
  const x = (i) => padL + (n <= 1 ? chartW / 2 : (i / (n - 1)) * chartW);
  const y = (r) => padT + (1 - r / 10) * chartH;
  const points = data.map((d, i) => `${x(i)},${y(d.rating)}`).join(" ");
  const grid = [0, 2.5, 5, 7.5, 10];
  return (
    <div data-testid="trend-chart">
      <svg width={width} height={height}>
        {grid.map((g) => <line key={g} x1={padL} y1={y(g)} x2={width - padR} y2={y(g)} stroke="#1E3A5F" strokeWidth={1} />)}
        {grid.map((g) => <text key={`t${g}`} x={4} y={y(g) + 4} fill="#64748B" fontSize={9} fontFamily="JetBrains Mono">{g}</text>)}
        <line x1={padL} y1={y(7)} x2={width - padR} y2={y(7)} stroke="#10B981" strokeWidth={1} strokeDasharray="4 4" />
        {n > 1 && <polyline points={points} fill="none" stroke="#00D2D3" strokeWidth={2.5} />}
        {data.map((d, i) => (
          <circle key={i} cx={x(i)} cy={y(d.rating)} r={4} fill={ratingColor(d.rating)} stroke="#0A1420" strokeWidth={1.5}>
            <title>{d.sample_id} · {d.rating.toFixed(1)}</title>
          </circle>
        ))}
      </svg>
      <div className="mt-1 font-mono text-[10px] text-emerald-500">- - - CLEAR threshold (7.0)</div>
    </div>
  );
};
