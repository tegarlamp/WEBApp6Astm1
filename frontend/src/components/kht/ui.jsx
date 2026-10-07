import React from "react";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { isClear, statusLabel } from "@/lib/kht/api";
import { RATING_BANDS, ratingColor } from "@/lib/kht/format";

export const Card = ({ children, className = "", ...rest }) => (
  <section className={`rounded-xl border border-zinc-700 bg-zinc-900 p-5 ${className}`} {...rest}>
    {children}
  </section>
);

export const CardLabel = ({ children, className = "" }) => (
  <div className={`font-mono text-[11px] tracking-[0.15em] text-amber-500 ${className}`}>{children}</div>
);

export const InfoRow = ({ k, v, last, testId }) => (
  <div className={`flex items-center justify-between gap-4 py-2.5 ${last ? "" : "border-b border-zinc-700"}`} data-testid={testId}>
    <span className="font-mono text-xs text-zinc-300">{k}</span>
    <span className="truncate font-mono text-xs font-medium text-zinc-50">{v}</span>
  </div>
);

export const StatusBadge = ({ status, size = "md" }) => {
  const clear = isClear(status);
  const cls = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1.5 text-[13px]";
  return (
    <span
      data-testid={`status-badge-${clear ? "clear" : "tarnish"}`}
      className={`inline-flex rounded font-mono font-bold tracking-widest text-white ${cls} ${clear ? "bg-emerald-500" : "bg-red-500"}`}
    >
      {statusLabel(status)}
    </span>
  );
};

export const RatingGauge = ({ rating, performance, confidence, size = 168 }) => {
  const stroke = 12;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const circ = 2 * Math.PI * r;
  const arc = circ * Math.min(1, Math.max(0, rating / 10));
  const color = ratingColor(rating);
  return (
    <div className="flex flex-col items-center" data-testid="rating-gauge">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size}>
          <circle cx={cx} cy={cx} r={r} stroke="#1A2B40" strokeWidth={stroke} fill="none" />
          <circle
            cx={cx} cy={cx} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
            strokeDasharray={`${arc} ${circ}`} transform={`rotate(-90 ${cx} ${cx})`}
            style={{ transition: "stroke-dasharray 0.8s ease-out" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="flex items-end">
            <span className="font-heading text-[56px] font-bold leading-[60px] text-zinc-50" data-testid="gauge-rating-value">{rating.toFixed(1)}</span>
            <span className="font-heading mb-2 text-xl font-semibold text-zinc-500">/10</span>
          </div>
          <span className="font-mono text-[10px] tracking-widest text-zinc-500">KHT RATING (AI)</span>
        </div>
      </div>
      <div className="font-heading mt-2 text-xl font-semibold tracking-wider" style={{ color }} data-testid="gauge-performance">{performance || "—"}</div>
      <div className="mt-0.5 font-mono text-[11px] text-zinc-500">CONFIDENCE {confidence.toFixed(1)}%</div>
    </div>
  );
};

export const KHTScale = ({ current }) => {
  const markerIndex = current === undefined ? -1 : Math.min(RATING_BANDS.length - 1, Math.max(0, Math.round(10 - current)));
  return (
    <div data-testid="kht-scale">
      <div className="flex overflow-hidden rounded">
        {RATING_BANDS.map((b, i) => (
          <div
            key={b.score}
            className={`flex flex-1 items-center justify-center py-2 ${i === markerIndex ? "border-2 border-white" : ""}`}
            style={{ backgroundColor: b.color }}
          >
            <span className="font-heading text-[15px] font-bold text-white">{b.score}</span>
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px]">
        <span className="text-emerald-500">10 · EXCELLENT</span>
        <span className="text-red-500">FAILED · 0</span>
      </div>
    </div>
  );
};

export const KHTScaleDetail = () => (
  <div data-testid="kht-scale-detail">
    {RATING_BANDS.map((b, i) => (
      <div key={b.score} className={`flex items-center gap-3 py-3 ${i === RATING_BANDS.length - 1 ? "" : "border-b border-zinc-700"}`}>
        <div className="flex h-10 w-10 items-center justify-center rounded-md" style={{ backgroundColor: b.color }}>
          <span className="font-heading text-lg font-bold text-white">{b.score}</span>
        </div>
        <div className="flex-1">
          <div className="font-mono text-[13px] font-bold text-zinc-50">{b.pct} · {b.sub}</div>
          <div className="mt-0.5 font-mono text-[11px] text-zinc-500">{b.grade}</div>
        </div>
      </div>
    ))}
  </div>
);

export const KhtHeader = ({ title, subtitle, backTo, right, logo = "KHT", accent = "amber" }) => {
  const bg = accent === "blue" ? "bg-blue-500" : "bg-amber-500";
  const tx = accent === "blue" ? "text-blue-400" : "text-amber-500";
  return (
  <div className="flex items-center gap-3 border-b border-zinc-700 bg-zinc-900 px-6 py-4">
    {backTo && (
      <Link to={backTo} data-testid="kht-back-btn" className="flex h-10 w-10 items-center justify-center rounded-md text-zinc-50 transition-colors hover:bg-zinc-800">
        <ChevronLeft className="h-5 w-5" />
      </Link>
    )}
    <div className={`flex h-10 w-10 items-center justify-center rounded-md ${bg} font-heading text-sm font-bold text-zinc-950`}>{logo}</div>
    <div className="flex-1 leading-tight">
      <div className="font-heading text-xl font-bold tracking-wide text-zinc-50" data-testid="kht-page-title">{title}</div>
      {subtitle && <div className={`font-mono text-[11px] ${tx}`}>{subtitle}</div>}
    </div>
    {right}
  </div>
  );
};
