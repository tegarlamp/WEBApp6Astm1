import React from "react";
import { Loader2 } from "lucide-react";
import { textOnColor, useDkaScale } from "@/lib/dka/api";
import { Card, KhtHeader } from "@/components/kht/ui";

export default function DkaScale() {
  const { data, isLoading, isError, refetch } = useDkaScale();
  const categories = (data?.categories ?? []).slice().sort((a, b) => a.severity - b.severity);
  return (
    <div className="min-h-screen bg-zinc-950" data-testid="dka-scale-page">
      <KhtHeader title="DKA Standard" subtitle="Referensi kategori rating" backTo="/rating-dka" logo="DKA" accent="blue" />
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6 lg:px-6">
        {isLoading ? (
          <div className="flex flex-col items-center gap-3 py-24"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /><span className="font-mono text-xs text-zinc-500">Memuat referensi…</span></div>
        ) : isError || !data ? (
          <button type="button" onClick={() => refetch()} className="py-24 text-center font-mono text-xs text-zinc-500" data-testid="dka-scale-retry">Gagal memuat referensi. Tap untuk coba lagi.</button>
        ) : (
          <>
            <Card className="animate-fade-up">
              <div className="font-mono text-[11px] tracking-[0.15em] text-blue-400">DKA STANDARD REFERENCE</div>
              <div className="mt-3 overflow-hidden rounded-lg border border-zinc-700 bg-[#0B1119]">
                <img src={data.image} alt="DKA standard reference" className="w-full object-contain" style={{ aspectRatio: "1.5" }} data-testid="dka-scale-image" />
              </div>
              <p className="mt-3 font-mono text-[11px] leading-[17px] text-zinc-200">{data.note}</p>
            </Card>
            <Card className="animate-fade-up">
              <div className="font-mono text-[11px] tracking-[0.15em] text-blue-400">KATEGORI RATING</div>
              <p className="mt-2 font-mono text-[11px] leading-[17px] text-zinc-300">AI Vision membandingkan setiap tabung sampel dengan standar ini untuk menentukan rating.</p>
              <div className="mt-2" data-testid="dka-scale-categories">
                {categories.map((cat, i) => (
                  <div key={cat.code} className={`flex items-center gap-3 py-3 ${i === categories.length - 1 ? "" : "border-b border-zinc-700"}`} data-testid={`dka-category-${cat.code.replace(" ", "-")}`}>
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-white/15" style={{ backgroundColor: cat.color }}>
                      <span className="font-heading text-xl font-bold" style={{ color: textOnColor(cat.color) }}>{cat.severity}</span>
                    </div>
                    <div className="flex-1">
                      <div className="font-mono text-[13px] font-bold text-zinc-50">{cat.code}</div>
                      <div className="font-mono text-[11px] leading-4 text-zinc-200">{cat.description}</div>
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
