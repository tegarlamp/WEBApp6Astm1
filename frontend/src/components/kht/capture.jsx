import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Crop, Loader2, X } from "lucide-react";

const MIN = 48;
const HANDLE = 28;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const CropEditor = ({ open, src, onCancel, onDone }) => {
  const boxRef = useRef(null);
  const imgRef = useRef(null);
  const [orig, setOrig] = useState(null);
  const [box, setBox] = useState(null);
  const [rect, setRect] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [busy, setBusy] = useState(false);
  const drag = useRef(null);

  useEffect(() => {
    if (!open || !src) return;
    setOrig(null);
    const im = new Image();
    im.onload = () => setOrig({ w: im.naturalWidth, h: im.naturalHeight });
    im.onerror = () => setOrig({ w: 1000, h: 1000 });
    im.src = src;
  }, [open, src]);

  useEffect(() => {
    if (!open || !boxRef.current) return;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(boxRef.current);
    return () => ro.disconnect();
  }, [open]);

  const disp = useMemo(() => {
    if (!orig || !box) return null;
    const ar = orig.w / orig.h;
    let dw = box.w, dh = box.w / ar;
    if (dh > box.h) { dh = box.h; dw = box.h * ar; }
    return { w: dw, h: dh };
  }, [orig, box]);

  useEffect(() => {
    if (!disp) return;
    const w = disp.w * 0.78, h = disp.h * 0.5;
    setRect({ x: (disp.w - w) / 2, y: (disp.h - h) / 2, w, h });
  }, [disp]);

  const startDrag = (mode) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    drag.current = { mode, sx: e.clientX, sy: e.clientY, s: rect };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onMove = useCallback((e) => {
    if (!drag.current || !disp) return;
    const { mode, sx, sy, s } = drag.current;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    const dw = disp.w, dh = disp.h;
    let { x, y, w, h } = s;
    if (mode === "move") { x = clamp(s.x + dx, 0, dw - s.w); y = clamp(s.y + dy, 0, dh - s.h); }
    else if (mode === "tl") { x = clamp(s.x + dx, 0, s.x + s.w - MIN); y = clamp(s.y + dy, 0, s.y + s.h - MIN); w = s.w - (x - s.x); h = s.h - (y - s.y); }
    else if (mode === "tr") { y = clamp(s.y + dy, 0, s.y + s.h - MIN); w = clamp(s.w + dx, MIN, dw - s.x); h = s.h - (y - s.y); }
    else if (mode === "bl") { x = clamp(s.x + dx, 0, s.x + s.w - MIN); w = s.w - (x - s.x); h = clamp(s.h + dy, MIN, dh - s.y); }
    else { w = clamp(s.w + dx, MIN, dw - s.x); h = clamp(s.h + dy, MIN, dh - s.y); }
    setRect({ x, y, w, h });
  }, [disp]);

  const endDrag = () => { drag.current = null; };

  async function applyCrop() {
    if (!disp || !orig || !src) return;
    setBusy(true);
    try {
      const scale = orig.w / disp.w;
      const sx = clamp(Math.round(rect.x * scale), 0, orig.w - 1);
      const sy = clamp(Math.round(rect.y * scale), 0, orig.h - 1);
      const sw = clamp(Math.round(rect.w * scale), 1, orig.w - sx);
      const sh = clamp(Math.round(rect.h * scale), 1, orig.h - sy);
      const canvas = document.createElement("canvas");
      canvas.width = sw;
      canvas.height = sh;
      canvas.getContext("2d").drawImage(imgRef.current, sx, sy, sw, sh, 0, 0, sw, sh);
      const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.95));
      onDone(blob ? URL.createObjectURL(blob) : src);
    } catch {
      onDone(src);
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;
  const handle = (mode, style) => (
    <div
      data-testid={`crop-handle-${mode}`}
      onPointerDown={startDrag(mode)}
      className="absolute rounded-full border-[3px] border-amber-500 bg-amber-500/25"
      style={{ width: HANDLE, height: HANDLE, cursor: `${mode === "tl" || mode === "br" ? "nwse" : "nesw"}-resize`, ...style }}
    />
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950" data-testid="crop-editor" onPointerMove={onMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
      <div className="flex items-center border-b border-zinc-700 px-3 py-2">
        <button type="button" onClick={onCancel} data-testid="crop-cancel" className="flex h-10 w-10 items-center justify-center rounded-md text-zinc-50 hover:bg-zinc-800"><X className="h-5 w-5" /></button>
        <div className="flex-1 text-center">
          <div className="font-heading text-lg font-semibold tracking-wide text-zinc-50">Crop Sample Tube</div>
          <div className="font-mono text-[10px] text-amber-500">Frame only the tube · ignore glare &amp; background</div>
        </div>
        <div className="w-10" />
      </div>

      <div ref={boxRef} className="flex flex-1 items-center justify-center overflow-hidden bg-[#050B12] p-4">
        {!disp ? (
          <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
        ) : (
          <div className="relative select-none touch-none" style={{ width: disp.w, height: disp.h }}>
            <img ref={imgRef} src={src} alt="to crop" draggable={false} className="block" style={{ width: disp.w, height: disp.h }} />
            <div className="pointer-events-none absolute bg-[#050B12]/65" style={{ left: 0, top: 0, width: disp.w, height: rect.y }} />
            <div className="pointer-events-none absolute bg-[#050B12]/65" style={{ left: 0, top: rect.y + rect.h, width: disp.w, height: Math.max(0, disp.h - rect.y - rect.h) }} />
            <div className="pointer-events-none absolute bg-[#050B12]/65" style={{ left: 0, top: rect.y, width: rect.x, height: rect.h }} />
            <div className="pointer-events-none absolute bg-[#050B12]/65" style={{ left: rect.x + rect.w, top: rect.y, width: Math.max(0, disp.w - rect.x - rect.w), height: rect.h }} />
            <div
              data-testid="crop-frame"
              onPointerDown={startDrag("move")}
              className="absolute cursor-move border-2 border-amber-500"
              style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
            >
              <div className="absolute bottom-0 top-0 w-px bg-white/35" style={{ left: rect.w / 3 }} />
              <div className="absolute bottom-0 top-0 w-px bg-white/35" style={{ left: (rect.w / 3) * 2 }} />
              <div className="absolute left-0 right-0 h-px bg-white/35" style={{ top: rect.h / 3 }} />
              <div className="absolute left-0 right-0 h-px bg-white/35" style={{ top: (rect.h / 3) * 2 }} />
            </div>
            {handle("tl", { left: rect.x - HANDLE / 2, top: rect.y - HANDLE / 2 })}
            {handle("tr", { left: rect.x + rect.w - HANDLE / 2, top: rect.y - HANDLE / 2 })}
            {handle("bl", { left: rect.x - HANDLE / 2, top: rect.y + rect.h - HANDLE / 2 })}
            {handle("br", { left: rect.x + rect.w - HANDLE / 2, top: rect.y + rect.h - HANDLE / 2 })}
          </div>
        )}
      </div>

      <div className="flex gap-3 border-t border-zinc-700 bg-zinc-900 px-4 py-3">
        <button type="button" onClick={() => onDone(src)} data-testid="crop-use-full" className="h-12 flex-1 rounded-md border border-zinc-700 bg-zinc-800 font-mono text-[13px] font-bold tracking-widest text-zinc-50 hover:bg-zinc-700">
          USE FULL IMAGE
        </button>
        <button type="button" onClick={applyCrop} disabled={busy || !disp} data-testid="crop-done" className="flex h-12 flex-[1.4] items-center justify-center gap-2 rounded-md bg-amber-500 font-mono text-sm font-bold tracking-widest text-zinc-950 hover:bg-amber-400 disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crop className="h-4 w-4" />}USE CROP
        </button>
      </div>
    </div>
  );
};

export const CameraCapture = ({ open, onClose, onCapture }) => {
  const videoRef = useRef(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!open) return;
    let stream;
    setErr("");
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((s) => { stream = s; if (videoRef.current) videoRef.current.srcObject = s; })
      .catch(() => setErr("Kamera tidak tersedia. Izinkan akses kamera atau gunakan Gallery."));
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, [open]);

  function snap() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    c.toBlob((b) => b && onCapture(URL.createObjectURL(b)), "image/jpeg", 0.95);
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950" data-testid="camera-capture">
      <div className="flex items-center border-b border-zinc-700 px-3 py-2">
        <button type="button" onClick={onClose} data-testid="camera-close" className="flex h-10 w-10 items-center justify-center rounded-md text-zinc-50 hover:bg-zinc-800"><X className="h-5 w-5" /></button>
        <div className="flex-1 text-center font-heading text-lg font-semibold tracking-wide text-zinc-50">Capture Hot Tube</div>
        <div className="w-10" />
      </div>
      <div className="flex flex-1 items-center justify-center bg-[#050B12]">
        {err ? <p className="px-6 text-center font-mono text-xs text-red-400" data-testid="camera-error">{err}</p> : <video ref={videoRef} autoPlay playsInline muted className="max-h-full max-w-full" />}
      </div>
      <div className="flex justify-center border-t border-zinc-700 bg-zinc-900 py-4">
        <button type="button" onClick={snap} disabled={!!err} data-testid="camera-shutter" className="h-16 w-16 rounded-full border-4 border-amber-500 bg-amber-500/30 transition-transform active:scale-95 disabled:opacity-40" />
      </div>
    </div>
  );
};
