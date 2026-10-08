import React, { useRef, useState } from "react";
import { Crop, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { fileUrl, useRecropCopper } from "@/lib/copper/api";

const MIN = 0.03;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const HANDLES = ["nw", "ne", "sw", "se"];

function applyDrag(start, mode, dx, dy) {
  let [x, y, w, h] = start;
  if (mode === "move") return [clamp(x + dx, 0, 1 - w), clamp(y + dy, 0, 1 - h), w, h];
  if (mode.includes("w")) { const nx = clamp(x + dx, 0, x + w - MIN); w += x - nx; x = nx; }
  if (mode.includes("e")) w = clamp(w + dx, MIN, 1 - x);
  if (mode.includes("n")) { const ny = clamp(y + dy, 0, y + h - MIN); h += y - ny; y = ny; }
  if (mode.includes("s")) h = clamp(h + dy, MIN, 1 - y);
  return [x, y, w, h];
}

export default function CropEditor({ sample, onClose }) {
  const recrop = useRecropCopper();
  const wrap = useRef(null);
  const drag = useRef(null);
  const [box, setBox] = useState(sample.bbox?.length === 4 ? sample.bbox : [0.35, 0.1, 0.3, 0.8]);

  const down = (mode) => (e) => {
    e.stopPropagation(); e.preventDefault();
    wrap.current.setPointerCapture(e.pointerId);
    drag.current = { mode, sx: e.clientX, sy: e.clientY, start: box };
  };
  const move = (e) => {
    const d = drag.current; if (!d) return;
    const r = wrap.current.getBoundingClientRect();
    setBox(applyDrag(d.start, d.mode, (e.clientX - d.sx) / r.width, (e.clientY - d.sy) / r.height));
  };
  const up = () => { drag.current = null; };

  async function save() {
    try { await recrop.mutateAsync({ id: sample.id, bbox: box }); toast.success(`Crop sample #${sample.sample_index} tersimpan.`); onClose(); }
    catch (e) { toast.error(String(e?.message || "Gagal menyimpan crop").slice(0, 140)); }
  }

  const [x, y, w, h] = box;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" data-testid="copper-crop-editor">
      <div className="flex max-h-full w-full max-w-4xl flex-col gap-3 rounded-xl border border-zinc-700 bg-zinc-900 p-4">
        <div className="flex items-center justify-between">
          <div className="font-mono text-[11px] tracking-[0.15em] text-amber-400">ATUR CROP · SAMPLE #{sample.sample_index}</div>
          <button type="button" onClick={onClose} data-testid="copper-crop-close" className="text-zinc-400 hover:text-zinc-100"><X className="h-5 w-5" /></button>
        </div>
        <p className="font-mono text-[11px] text-zinc-400">Geser kotak untuk memindahkan, tarik sudut untuk memperbesar/memperkecil. Pastikan hanya 1 strip copper di dalam kotak.</p>
        <div className="flex justify-center overflow-auto">
          <div ref={wrap} onPointerMove={move} onPointerUp={up} onPointerCancel={up} className="relative inline-block touch-none select-none" data-testid="copper-crop-canvas">
            <img src={fileUrl(sample.image_path, 1600)} alt="foto asli" draggable={false} className="block max-h-[65vh] max-w-full" />
            <div onPointerDown={down("move")} data-testid="copper-crop-box" className="absolute cursor-move border-2 border-amber-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]"
              style={{ left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${h * 100}%` }}>
              {HANDLES.map((k) => (
                <span key={k} onPointerDown={down(k)} data-testid={`copper-crop-handle-${k}`}
                  className={`absolute h-4 w-4 rounded-sm border-2 border-zinc-950 bg-amber-400 ${k.includes("n") ? "-top-2" : "-bottom-2"} ${k.includes("w") ? "-left-2" : "-right-2"} ${k === "nw" || k === "se" ? "cursor-nwse-resize" : "cursor-nesw-resize"}`} />
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-zinc-700 px-4 py-2 font-mono text-xs text-zinc-300 hover:bg-zinc-800" data-testid="copper-crop-cancel">BATAL</button>
          <button type="button" onClick={save} disabled={recrop.isPending} data-testid="copper-crop-save" className="flex items-center gap-2 rounded-md bg-amber-500 px-4 py-2 font-mono text-xs font-bold tracking-widest text-zinc-950 hover:bg-amber-400 disabled:opacity-50">
            {recrop.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crop className="h-4 w-4" />}SIMPAN CROP
          </button>
        </div>
      </div>
    </div>
  );
}
