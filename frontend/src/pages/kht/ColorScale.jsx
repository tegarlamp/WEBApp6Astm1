import React from "react";
import { Loader2 } from "lucide-react";
import { useColorScale } from "@/lib/kht/api";
import { Card, CardLabel, KhtHeader, StatusBadge } from "@/components/kht/ui";

export default function KhtColorScale() {
  const { data, isLoading, isError, refetch } = useColorScale();
  const levels = (data?.levels ?? []).slice().sort((a, b) => a.level - b.level);

  return (
    <div className="min-h-screen bg-zinc-950" data-testid="kht-color-scale-page">
      <KhtHeader title="Nikko Color Scale" subtitle="Standard reference 0 – 10" backTo="/khtt" />
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6 lg:px-6">
        {isLoading ? (
          <div className="flex flex-col items-center gap-3 py-24"><Loader2 className="h-6 w-6 animate-spin text-amber-500" /><span className="font-mono text-xs text-zinc-500">Loading reference…</span></div>
        ) : isError || !data ? (
          <button type="button" onClick={() => refetch()} className="py-24 text-center font-mono text-xs text-zinc-500" data-testid="color-scale-retry">Failed to load reference. Tap to retry.</button>
        ) : (
          <>
            <Card className="animate-fade-up">
              <CardLabel>NIKKO COLOR SCALE BOARD</CardLabel>
              <div className="mt-3 overflow-hidden rounded-lg border border-zinc-700 bg-[#0B1119]">
                <img src={data.image} alt="Nikko color scale board" className="w-full object-contain" style={{ aspectRatio: "1.5" }} data-testid="color-scale-image" />
              </div>
              <p className="mt-3 font-mono text-[11px] leading-[17px] text-zinc-200">{data.note}</p>
            </Card>
            <Card className="animate-fade-up">
              <CardLabel>REFERENCE LEVELS (0 – 10)</CardLabel>
              <p className="mt-2 font-mono text-[11px] leading-[17px] text-zinc-300">Bandingkan warna endapan pada tabung sample dengan level di bawah ini saat melakukan analisa visual.</p>
              <div className="mt-2" data-testid="color-scale-levels">
                {levels.map((lvl, i) => (
                  <div key={lvl.level} className={`flex items-center gap-3 py-3 ${i === levels.length - 1 ? "" : "border-b border-zinc-700"}`} data-testid={`color-level-${lvl.level}`}>
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-white/15" style={{ backgroundColor: lvl.color }}>
                      <span className="font-heading text-xl font-bold" style={{ color: lvl.level >= 7 ? "#0A1420" : "#FFFFFF" }}>{lvl.level}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-mono text-[13px] font-bold text-zinc-50">{lvl.name}</span>
                        <StatusBadge status={lvl.status} size="sm" />
                      </div>
                      <div className="font-mono text-[11px] leading-4 text-zinc-200">{lvl.condition}</div>
                      <div className="mt-0.5 font-mono text-[10px] tracking-wide text-zinc-500">Endapan {lvl.deposit_pct} · {lvl.grade}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
