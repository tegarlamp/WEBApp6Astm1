import React from "react";
import { COPPER_CLASSES, isClear, statusLabel, textOnColor, useCopperScale } from "@/lib/copper/api";

export const AmberBtn = ({ children, className = "", ...rest }) => (
  <button type="button" className={`flex items-center justify-center gap-2 rounded-md bg-amber-500 font-mono font-bold tracking-widest text-zinc-950 transition-colors hover:bg-amber-400 disabled:opacity-50 ${className}`} {...rest}>
    {children}
  </button>
);

// Big circular colour swatch showing the ASTM class code + group + confidence.
export const CopperClassGauge = ({ classification, group, color, status, confidence, size = 168 }) => {
  const clear = isClear(status);
  const swatchText = textOnColor(color);
  return (
    <div className="flex flex-col items-center" data-testid="copper-class-gauge">
      <div
        className="flex flex-col items-center justify-center rounded-full"
        style={{ width: size, height: size, backgroundColor: color, borderWidth: 6, borderStyle: "solid", borderColor: clear ? "#10B981" : "#EF4444" }}
      >
        <span className="font-heading font-bold leading-none" style={{ fontSize: size * 0.36, color: swatchText }} data-testid="copper-gauge-class">
          {String(classification).toUpperCase()}
        </span>
        <span className="mt-1 font-mono text-[9px] tracking-widest" style={{ color: swatchText, opacity: 0.85 }}>ASTM D130 CLASS</span>
      </div>
      <div className="font-heading mt-2 text-xl font-semibold tracking-wider" style={{ color: clear ? "#10B981" : "#EF4444" }} data-testid="copper-gauge-group">
        {String(group || "—").toUpperCase()}
      </div>
      <div className="mt-0.5 font-mono text-[11px] text-zinc-500">CONFIDENCE {Number(confidence || 0).toFixed(1)}%</div>
    </div>
  );
};

// Horizontal scroll of every ASTM class as a colour chip; active gets a ring.
export const CopperClassPicker = ({ value, onChange, disabled }) => {
  const { data } = useCopperScale();
  const classes = data?.classes?.length ? data.classes : COPPER_CLASSES;
  return (
    <div className="flex gap-2 overflow-x-auto pb-1" data-testid="copper-class-picker">
      {classes.map((c) => {
        const active = c.code === value;
        return (
          <button
            key={c.code}
            type="button"
            data-testid={`copper-class-${c.code}`}
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onChange(c.code)}
            className={`flex h-12 min-w-[48px] shrink-0 items-center justify-center rounded-md px-2 font-heading text-lg font-bold transition-transform ${active ? "scale-105 ring-2 ring-white ring-offset-2 ring-offset-zinc-900" : "opacity-70 hover:opacity-100"} ${disabled ? "opacity-50" : ""}`}
            style={{ backgroundColor: c.color, color: textOnColor(c.color) }}
          >
            {c.code.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
};

export const CopperBadge = ({ code, color, size = "md" }) => (
  <span
    data-testid={`copper-badge-${code}`}
    className={`inline-flex rounded border border-black/15 font-mono font-bold tracking-wide ${size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1.5 text-[13px]"}`}
    style={{ backgroundColor: color, color: textOnColor(color) }}
  >
    {String(code).toUpperCase()}
  </span>
);

const MAX_SEV = 12;
export const CopperTrendChart = ({ data, width, height = 220 }) => {
  const padL = 34, padR = 12, padT = 16, padB = 24;
  const chartW = Math.max(1, width - padL - padR);
  const chartH = height - padT - padB;
  const n = data.length;
  const x = (i) => padL + (n <= 1 ? chartW / 2 : (i / (n - 1)) * chartW);
  const y = (s) => padT + (s / MAX_SEV) * chartH;
  const points = data.map((d, i) => `${x(i)},${y(d.severity)}`).join(" ");
  const grid = [0, 3, 6, 9, 12];
  const labels = { 0: "0", 3: "2a", 6: "2d", 9: "3c", 12: "4c" };
  return (
    <div data-testid="copper-trend-chart">
      <svg width={width} height={height}>
        {grid.map((g) => <line key={g} x1={padL} y1={y(g)} x2={width - padR} y2={y(g)} stroke="#3A2A10" strokeWidth={1} />)}
        {grid.map((g) => <text key={`t${g}`} x={2} y={y(g) + 4} fill="#a16207" fontSize={8} fontFamily="JetBrains Mono">{labels[g]}</text>)}
        {n > 1 && <polyline points={points} fill="none" stroke="#F59E0B" strokeWidth={2.5} />}
        {data.map((d, i) => (
          <circle key={i} cx={x(i)} cy={y(d.severity)} r={4} fill={isClear(d.status) ? "#10B981" : "#EF4444"} stroke="#0A1420" strokeWidth={1.5}>
            <title>{d.sample_id} · {String(d.classification).toUpperCase()} · {statusLabel(d.status)}</title>
          </circle>
        ))}
      </svg>
      <div className="mt-1 font-mono text-[10px] text-zinc-500">Severity per sampel (0 = Freshly Polished terbaik → 12 = 4c terburuk)</div>
    </div>
  );
};
