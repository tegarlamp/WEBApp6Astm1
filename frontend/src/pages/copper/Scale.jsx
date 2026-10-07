import React from "react";
import { Loader2 } from "lucide-react";
import { textOnColor, useCopperScale } from "@/lib/copper/api";
import { Card, KhtHeader } from "@/components/kht/ui";

export default function CopperScale() {
  const { data, isLoading, isError, refetch } = useCopperScale();
  const classes = (data?.classes ?? []).slice().sort((a, b) => a.severity - b.severity);
  return (
    <div className="min-h-screen bg-zinc-950" data-testid="copper-scale-page">
      <KhtHeader title="ASTM D130 Standard" subtitle="Referensi klasifikasi korosi" backTo="/copper-strip" logo="CU" accent="amber" />
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6 lg:px-6">
        {isLoading ? (
          <div className="flex flex-col items-center gap-3 py-24"><Loader2 className="h-6 w-6 animate-spin text-amber-400" /><span className="font-mono text-xs text-zinc-500">Memuat referensi…</span></div>
        ) : isError || !data ? (
          <button type="button" onClick={() => refetch()} className="py-24 text-center font-mono text-xs text-zinc-500" data-testid="copper-scale-retry">Gagal memuat referensi. Tap untuk coba lagi.</button>
        ) : (
          <>
            <Card className="animate-fade-up">
              <div className="font-mono text-[11px] tracking-[0.15em] text-amber-500">ASTM D130 / IP 154 STANDARD CHART</div>
              <div className="mt-3 overflow-hidden rounded-lg border border-zinc-700 bg-[#0B1119]">
                <img src={data.image} alt="ASTM D130 standard reference" className="w-full object-contain" style={{ aspectRatio: "2.2" }} data-testid="copper-scale-image" />
              </div>
              <p className="mt-3 font-mono text-[11px] leading-[17px] text-zinc-200">{data.note}</p>
            </Card>
            <Card className="animate-fade-up">
              <div className="font-mono text-[11px] tracking-[0.15em] text-amber-500">KLASIFIKASI KOROSI</div>
              <p className="mt-2 font-mono text-[11px] leading-[17px] text-zinc-300">AI Vision membandingkan strip sampel dengan standar ini untuk menentukan klasifikasi. CLEAR (lulus) bila kelas 0 / 1a / 1b.</p>
              <div className="mt-2" data-testid="copper-scale-classes">
                {classes.map((c, i) => {
                  const clear = ["0", "1a", "1b"].includes(c.code);
                  return (
                    <div key={c.code} className={`flex items-center gap-3 py-3 ${i === classes.length - 1 ? "" : "border-b border-zinc-700"}`} data-testid={`copper-class-row-${c.code}`}>
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-white/15" style={{ backgroundColor: c.color }}>
                        <span className="font-heading text-base font-bold" style={{ color: textOnColor(c.color) }}>{c.code.toUpperCase()}</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[13px] font-bold text-zinc-50">{c.group}</span>
                          <span className={`font-mono text-[9px] font-bold ${clear ? "text-emerald-400" : "text-red-400"}`}>{clear ? "CLEAR" : "TARNISH"}</span>
                        </div>
                        <div className="font-mono text-[11px] leading-4 text-zinc-200">{c.description}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
