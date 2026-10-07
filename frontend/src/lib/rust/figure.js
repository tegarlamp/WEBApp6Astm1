// Canvas renderers for ASTM D1748 report figures (photo overlay, calculation, comparison).
// All output is a JPEG/PNG data URI so it can be embedded in the print/PDF HTML.

export const GRADE_SPEC = [
  { g: "A", min: 0, max: 0, color: "#10B981", status: "EXCELLENT PASS", label: "Bersih tanpa karat" },
  { g: "B", min: 1, max: 10, color: "#34D399", status: "GOOD / MINOR", label: "Karat ringan" },
  { g: "C", min: 11, max: 25, color: "#FBBF24", status: "FAIR / MODERATE", label: "Karat sedang" },
  { g: "D", min: 26, max: 50, color: "#F97316", status: "POOR / EXTENSIVE", label: "Karat luas" },
  { g: "E", min: 51, max: 100, color: "#EF4444", status: "REJECT / SEVERE", label: "Karat berat" },
];

export const gradeSpecFor = (n) => GRADE_SPEC.find((s) => n >= s.min && n <= s.max) || GRADE_SPEC[4];

export const FALLBACK_CORNERS = [[0.06, 0.06], [0.94, 0.06], [0.94, 0.94], [0.06, 0.94]];
export const FULL_CORNERS = [[0, 0], [1, 0], [1, 1], [0, 1]];

export const METHOD_INFO = {
  zone: { short: "ZONA 50×50", label: "Active Zone 50×50 mm", desc: "Zona ukur tengah 50×50 mm dicari AI, dibagi 10×10 kotak @5×5 mm." },
  full: { short: "SELURUH FOTO", label: "Seluruh Gambar", desc: "Seluruh foto = active zone, dibagi rata 10×10 kotak @10% lebar × 10% tinggi." },
};

const norm100 = (boxes) => Array.from({ length: 100 }, (_, i) => Boolean(boxes?.[i]));

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Gagal memuat foto"));
    img.src = src;
  });
}

function bilerp(c, u, v) {
  const [tl, tr, br, bl] = c;
  return [
    (1 - u) * (1 - v) * tl[0] + u * (1 - v) * tr[0] + u * v * br[0] + (1 - u) * v * bl[0],
    (1 - u) * (1 - v) * tl[1] + u * (1 - v) * tr[1] + u * v * br[1] + (1 - u) * v * bl[1],
  ];
}

function poly(ctx, pts) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

/**
 * Photo with the AI-located 10x10 grid drawn on it. Rusted boxes are filled red and numbered.
 * zoom=true crops to the measuring zone (detail view).
 */
export async function renderOverlay(src, corners, boxes, { zoom: zoomIn = false, maxW = 1400, label = "AI VISION", method = "zone" } = {}) {
  const img = await loadImage(src);
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const full = method === "full";
  const zoom = full ? false : zoomIn;
  const estimated = !full && (!Array.isArray(corners) || corners.length !== 4);
  const cn = (full ? FULL_CORNERS : estimated ? FALLBACK_CORNERS : corners).map(([x, y]) => [x * W, y * H]);
  let sx = 0, sy = 0, sw = W, sh = H;
  if (zoom) {
    const xs = cn.map((p) => p[0]); const ys = cn.map((p) => p[1]);
    const bw = Math.max(...xs) - Math.min(...xs); const bh = Math.max(...ys) - Math.min(...ys);
    const pad = Math.max(bw, bh) * 0.1;
    sx = Math.max(0, Math.min(...xs) - pad); sy = Math.max(0, Math.min(...ys) - pad);
    sw = Math.min(W, Math.max(...xs) + pad) - sx; sh = Math.min(H, Math.max(...ys) + pad) - sy;
  }
  const target = zoom ? 900 : maxW;
  const k = Math.min(target / sw, (zoom ? 900 : 1000) / sh, zoom ? 8 : 1) || 1;
  const cw = Math.round(sw * k); const ch = Math.round(sh * k);
  const footer = 54;
  const canvas = document.createElement("canvas");
  canvas.width = cw; canvas.height = ch + footer;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#0A1420"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
  const c = cn.map(([x, y]) => [(x - sx) * k, (y - sy) * k]);

  // dim everything outside the measuring zone
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, cw, ch);
  [c[0], c[3], c[2], c[1]].forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = "rgba(10,20,32,0.45)"; ctx.fill("evenodd");
  ctx.restore();

  const cells = norm100(boxes);
  const cellPx = Math.hypot(c[1][0] - c[0][0], c[1][1] - c[0][1]) / 10;
  cells.forEach((rusted, i) => {
    if (!rusted) return;
    const r = Math.floor(i / 10); const col = i % 10;
    const q = [bilerp(c, col / 10, r / 10), bilerp(c, (col + 1) / 10, r / 10), bilerp(c, (col + 1) / 10, (r + 1) / 10), bilerp(c, col / 10, (r + 1) / 10)];
    poly(ctx, q); ctx.fillStyle = "rgba(239,68,68,0.38)"; ctx.fill();
  });
  // grid lines
  ctx.strokeStyle = "rgba(0,210,211,0.95)"; ctx.lineWidth = zoom ? 1.5 : 1;
  for (let i = 1; i < 10; i += 1) {
    const a = bilerp(c, i / 10, 0); const b = bilerp(c, i / 10, 1);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    const d = bilerp(c, 0, i / 10); const e = bilerp(c, 1, i / 10);
    ctx.beginPath(); ctx.moveTo(d[0], d[1]); ctx.lineTo(e[0], e[1]); ctx.stroke();
  }
  // rusted outlines + numbers
  cells.forEach((rusted, i) => {
    const r = Math.floor(i / 10); const col = i % 10;
    if (rusted) {
      const q = [bilerp(c, col / 10, r / 10), bilerp(c, (col + 1) / 10, r / 10), bilerp(c, (col + 1) / 10, (r + 1) / 10), bilerp(c, col / 10, (r + 1) / 10)];
      poly(ctx, q); ctx.strokeStyle = "#EF4444"; ctx.lineWidth = zoom ? 2 : 1.2; ctx.stroke();
    }
    if (cellPx >= 16) {
      const [mx, my] = bilerp(c, (col + 0.5) / 10, (r + 0.5) / 10);
      ctx.font = `bold ${Math.max(8, Math.min(16, cellPx * 0.32))}px Arial`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,0,0,0.75)"; ctx.strokeText(String(i + 1), mx, my);
      ctx.fillStyle = rusted ? "#FFFFFF" : "rgba(255,255,255,0.7)"; ctx.fillText(String(i + 1), mx, my);
    }
  });
  poly(ctx, c); ctx.strokeStyle = "#F59E0B"; ctx.lineWidth = zoom ? 3.5 : 2.5; ctx.stroke();

  // footer legend
  const n = cells.filter(Boolean).length; const spec = gradeSpecFor(n);
  ctx.fillStyle = "#0A1420"; ctx.fillRect(0, ch, cw, footer);
  const fs = cw < 520 ? 12 : 15;
  ctx.fillStyle = "rgba(239,68,68,0.8)"; ctx.fillRect(10, ch + 10, 14, 14);
  ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.font = `bold ${fs}px Arial`; ctx.fillStyle = "#FFFFFF";
  ctx.fillText(`${label}: ${n}/100 kotak → Grade ${spec.g}`, 30, ch + 17);
  ctx.font = `${fs - 3}px Arial`; ctx.fillStyle = "#00D2D3";
  ctx.fillText(full ? "Metode seluruh gambar: grid 10×10 menutup 100% foto" : estimated ? "Posisi grid estimasi (belum dideteksi AI)" : "Grid 10×10 (zona 50×50 mm) dipetakan AI", 10, ch + 40);
  return { dataUrl: canvas.toDataURL("image/jpeg", 0.9), estimated };
}

function drawMatrix(ctx, x0, y0, cell, boxes, { sums = true, colorFor } = {}) {
  const cells = norm100(boxes);
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (let i = 0; i < 100; i += 1) {
    const r = Math.floor(i / 10); const c = i % 10;
    const x = x0 + c * cell; const y = y0 + r * cell;
    ctx.fillStyle = colorFor ? colorFor(i) : cells[i] ? "#F97316" : "#F1F5F9";
    ctx.fillRect(x, y, cell, cell);
    ctx.strokeStyle = "#94A3B8"; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
    if (!colorFor) {
      ctx.font = `bold ${Math.round(cell * 0.38)}px Arial`; ctx.fillStyle = cells[i] ? "#FFFFFF" : "#94A3B8";
      ctx.fillText(cells[i] ? "1" : "0", x + cell / 2, y + cell / 2);
    }
  }
  ctx.strokeStyle = "#0A1420"; ctx.lineWidth = 2; ctx.strokeRect(x0, y0, cell * 10, cell * 10);
  if (!sums) return;
  const rowSums = Array.from({ length: 10 }, (_, r) => cells.slice(r * 10, r * 10 + 10).filter(Boolean).length);
  const colSums = Array.from({ length: 10 }, (_, c) => cells.filter((v, i) => v && i % 10 === c).length);
  ctx.font = `bold ${Math.round(cell * 0.36)}px Arial`;
  rowSums.forEach((s, r) => {
    ctx.fillStyle = "#E0F2FE"; ctx.fillRect(x0 + cell * 10 + 6, y0 + r * cell, cell, cell);
    ctx.fillStyle = "#0A1420"; ctx.fillText(String(s), x0 + cell * 10 + 6 + cell / 2, y0 + r * cell + cell / 2);
    ctx.fillStyle = "#64748B"; ctx.font = `${Math.round(cell * 0.3)}px Arial`; ctx.fillText(`R${r + 1}`, x0 - cell * 0.45, y0 + r * cell + cell / 2);
    ctx.font = `bold ${Math.round(cell * 0.36)}px Arial`;
  });
  colSums.forEach((s, c) => {
    ctx.fillStyle = "#E0F2FE"; ctx.fillRect(x0 + c * cell, y0 + cell * 10 + 6, cell, cell);
    ctx.fillStyle = "#0A1420"; ctx.fillText(String(s), x0 + c * cell + cell / 2, y0 + cell * 10 + 6 + cell / 2);
    ctx.fillStyle = "#64748B"; ctx.font = `${Math.round(cell * 0.3)}px Arial`; ctx.fillText(`K${c + 1}`, x0 + c * cell + cell / 2, y0 - cell * 0.4);
    ctx.font = `bold ${Math.round(cell * 0.36)}px Arial`;
  });
  const total = cells.filter(Boolean).length;
  ctx.fillStyle = "#0A1420"; ctx.fillRect(x0 + cell * 10 + 6, y0 + cell * 10 + 6, cell, cell);
  ctx.fillStyle = "#F59E0B"; ctx.fillText(String(total), x0 + cell * 10 + 6 + cell / 2, y0 + cell * 10 + 6 + cell / 2);
  return { rowSums, colSums, total };
}

function drawScale(ctx, x0, y0, w, n) {
  const h = 34;
  const weights = GRADE_SPEC.map((s) => (s.g === "A" ? 6 : s.max - s.min + 1));
  const sumW = weights.reduce((a, b) => a + b, 0);
  let x = x0; let markerX = x0;
  GRADE_SPEC.forEach((s, i) => {
    const sw = (weights[i] / sumW) * w;
    ctx.fillStyle = s.color; ctx.fillRect(x, y0, sw, h);
    ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 2; ctx.strokeRect(x, y0, sw, h);
    ctx.fillStyle = "#0A1420"; ctx.font = "bold 15px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(s.g, x + sw / 2, y0 + h / 2);
    ctx.font = "11px Arial"; ctx.fillStyle = "#475569";
    ctx.fillText(s.min === s.max ? `${s.min}` : `${s.min}–${s.max}`, x + sw / 2, y0 + h + 13);
    if (n >= s.min && n <= s.max) {
      const frac = s.max === s.min ? 0.5 : (n - s.min) / (s.max - s.min);
      markerX = x + Math.max(4, Math.min(sw - 4, frac * sw));
    }
    x += sw;
  });
  ctx.fillStyle = "#0A1420";
  ctx.beginPath(); ctx.moveTo(markerX, y0 - 2); ctx.lineTo(markerX - 9, y0 - 16); ctx.lineTo(markerX + 9, y0 - 16); ctx.closePath(); ctx.fill();
  ctx.font = "bold 13px Arial"; ctx.textAlign = "center"; ctx.fillText(`N = ${n}`, Math.max(x0 + 24, Math.min(x0 + w - 24, markerX)), y0 - 26);
}

/** Calculation sheet: binary 10x10 matrix with row/column sums, formula and grade scale. */
export function renderCalcFigure(boxes, { title, method = "zone" } = {}) {
  const full = method === "full";
  const ttl = title || `PERHITUNGAN AI VISION · ASTM D1748 · METODE ${full ? "SELURUH GAMBAR" : "ACTIVE ZONE 50×50 mm"}`;
  const canvas = document.createElement("canvas");
  canvas.width = 1120; canvas.height = 560;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#B45309"; ctx.font = "bold 16px Arial"; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.fillText(ttl, 24, 30);
  const res = drawMatrix(ctx, 58, 78, 38, boxes);
  ctx.fillStyle = "#64748B"; ctx.font = "11px Arial"; ctx.textAlign = "left";
  ctx.fillText("1 = kotak berkarat · 0 = bersih · Σ baris (kanan) · Σ kolom (bawah)", 30, 538);

  const n = res.total; const spec = gradeSpecFor(n);
  const X = 560; let y = 92;
  const line = (txt, { bold = false, color = "#0A1420", size = 14, gap = 26 } = {}) => {
    ctx.font = `${bold ? "bold " : ""}${size}px Arial`; ctx.fillStyle = color; ctx.textAlign = "left"; ctx.fillText(txt, X, y); y += gap;
  };
  line("Langkah perhitungan", { bold: true, color: "#B45309", size: 15 });
  line(full ? "1. Seluruh foto = active zone, dibagi 10×10 = 100 kotak" : "1. Zona ukur 50×50 mm dibagi 10×10 = 100 kotak (5×5 mm).", { size: 13, gap: full ? 18 : 26 });
  if (full) line("    (tiap kotak = 10% lebar × 10% tinggi foto).", { size: 13 });
  line("2. Kotak = 1 bila ada ≥1 titik karat kasat mata (termasuk", { size: 13, gap: 18 });
  line(full ? "    karat yang melewati batas kotak ke kotak tetangga)." : "    karat yang menyeberang garis potong ke kotak tetangga).", { size: 13 });
  line("3. Jumlah per baris:", { size: 13, gap: 20 });
  line(`    ${res.rowSums.join(" + ")} = ${n}`, { bold: true, size: 14 });
  line(`4. Luas terdampak = ${n}/100 × 100% = ${n}%`, { size: 13 });
  line(`5. N = ${n} berada pada rentang ${spec.min === spec.max ? spec.min : `${spec.min}–${spec.max}`} → GRADE ${spec.g}`, { bold: true, size: 14, color: spec.color === "#FBBF24" ? "#B45309" : spec.color });
  line(`    ${spec.status} · ${spec.label}`, { size: 13, color: "#475569", gap: 50 });
  drawScale(ctx, X, y + 20, 520, n);
  return canvas.toDataURL("image/png");
}

/** AI vs inspector grid comparison with difference map and agreement %. */
export function renderCompareFigure(aiBoxes, inspBoxes, { inspLabel = "KOREKSI INSPECTOR" } = {}) {
  const a = norm100(aiBoxes); const b = norm100(inspBoxes);
  const canvas = document.createElement("canvas");
  canvas.width = 1120; canvas.height = 470;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const cell = 30; const ys = 70;
  const xs = [30, 400, 770];
  const both = a.filter((v, i) => v && b[i]).length;
  const aiOnly = a.filter((v, i) => v && !b[i]).length;
  const inspOnly = a.filter((v, i) => !v && b[i]).length;
  const agree = 100 - aiOnly - inspOnly;
  const titles = [`AI VISION · ${a.filter(Boolean).length}/100 · Grade ${gradeSpecFor(a.filter(Boolean).length).g}`, `${inspLabel} · ${b.filter(Boolean).length}/100 · Grade ${gradeSpecFor(b.filter(Boolean).length).g}`, `SELISIH · kesesuaian ${agree}%`];
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  titles.forEach((t, i) => { ctx.font = "bold 14px Arial"; ctx.fillStyle = i === 2 ? "#B45309" : "#0A1420"; ctx.fillText(t, xs[i], ys - 14); });
  drawMatrix(ctx, xs[0], ys, cell, a, { sums: false, colorFor: (i) => (a[i] ? "#F97316" : "#F1F5F9") });
  drawMatrix(ctx, xs[1], ys, cell, b, { sums: false, colorFor: (i) => (b[i] ? "#F97316" : "#F1F5F9") });
  drawMatrix(ctx, xs[2], ys, cell, a, { sums: false, colorFor: (i) => (a[i] && b[i] ? "#F97316" : a[i] ? "#FACC15" : b[i] ? "#3B82F6" : "#F1F5F9") });
  const ly = ys + cell * 10 + 34;
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  const legend = [["#F97316", `Berkarat (keduanya): ${both}`], ["#FACC15", `Hanya AI (dikoreksi bersih): ${aiOnly}`], ["#3B82F6", `Hanya inspector (terlewat AI): ${inspOnly}`], ["#F1F5F9", `Bersih (keduanya): ${100 - both - aiOnly - inspOnly}`]];
  legend.forEach(([col, txt], i) => {
    const lx = 30 + i * 272;
    ctx.fillStyle = col; ctx.fillRect(lx, ly - 12, 16, 16); ctx.strokeStyle = "#94A3B8"; ctx.strokeRect(lx, ly - 12, 16, 16);
    ctx.fillStyle = "#0A1420"; ctx.font = "12px Arial"; ctx.fillText(txt, lx + 22, ly + 1);
  });
  return { dataUrl: canvas.toDataURL("image/png"), agree, aiOnly, inspOnly, both };
}
