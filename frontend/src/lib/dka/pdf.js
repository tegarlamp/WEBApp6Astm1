import { fileUrl, imageToDataUri, textOnColor } from "@/lib/dka/api";
import { fmtDate, fmtDateTime } from "@/lib/kht/format";

export { printHtmlOnWeb } from "@/lib/kht/pdf";

const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const commonStyles = () => `
    @page { margin: 0; size: A4; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #0A1420; margin: 0; padding: 0; }
    .page { padding: 40px 32px; page-break-after: always; }
    .page:last-child { page-break-after: auto; }
    h1 { margin: 0; font-size: 22px; }
    .sub { color: #1d4ed8; font-size: 11px; letter-spacing: 1.2px; font-weight: 700; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 4px; font-weight: bold; font-size: 11px; border: 1px solid rgba(0,0,0,.15); }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    td, th { padding: 8px 6px; border-bottom: 1px solid #e5e7eb; font-size: 12px; text-align: left; }
    th { font-size: 10px; color: #64748b; letter-spacing: 0.5px; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; }
    .thumbs { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 14px; }
    .thumb { border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; background: #f8fafc; }
    .thumb img { width: 100%; height: 300px; object-fit: contain; background: #f8fafc; display: block; }
    .thumb .cap { padding: 6px; font-size: 10px; color: #374151; text-align: center; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; margin-top: 10px; }
    .meta-grid div { font-size: 11px; color: #374151; padding: 4px 0; border-bottom: 1px solid #eef2f7; }
    .meta-grid span { color: #64748b; margin-right: 6px; }
`;

async function embed(path) {
  const url = fileUrl(path || "", 1600);
  if (!url) return "";
  return (await imageToDataUri(url)) || url;
}

async function renderBatch(rec) {
  const imgs = await Promise.all(rec.samples.map((s) => embed(s.crop_path)));
  const rows = rec.samples
    .map((s) => `<tr><td>#${s.index}</td><td>${esc(s.sample_id || "—")}</td><td><span class="badge" style="background:${esc(s.color)};color:${textOnColor(s.color)}">${esc(s.rating)}</span></td><td>${s.confidence.toFixed(0)}%</td><td>${esc(s.summary || "—")}</td></tr>`)
    .join("");
  const thumbs = rec.samples
    .map((s, i) => `<div class="thumb"><img src="${esc(imgs[i])}"/><div class="cap">#${s.index} · ${esc(s.sample_id || "—")} · ${esc(s.rating)}</div></div>`)
    .join("");
  return `
    <div class="page">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1px solid #e5e7eb;padding-bottom:8px">
        <div>
          <div class="sub">RATING DKA · BATCH REPORT</div>
          <h1>${esc(rec.meta.batch_id || rec.id.slice(0, 8))}</h1>
        </div>
        <div style="text-align:right;font-size:10px;color:#64748b">${esc(fmtDateTime(rec.created_at))}<br/>${rec.samples.length} sampel</div>
      </div>
      <table>
        <thead><tr><th>#</th><th>Sample ID</th><th>Rating</th><th>Conf</th><th>Deskripsi</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="thumbs">${thumbs}</div>
      <div class="meta-grid">
        <div><span>Batch ID</span>${esc(rec.meta.batch_id || "—")}</div>
        <div><span>Product</span>${esc(rec.meta.product || "—")}</div>
        <div><span>Operator</span>${esc(rec.meta.operator || "—")}</div>
        <div><span>Condition</span>${rec.meta.temperature_c}&deg;C · ${rec.meta.duration_hours}h</div>
        <div><span>AI Model</span>${esc(rec.ai_model)}</div>
        <div><span>Tanggal</span>${esc(fmtDate(rec.created_at))}</div>
      </div>
    </div>`;
}

const wrap = (title, body) => `<!DOCTYPE html><html><head><meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <title>${esc(title)}</title>
    <style>${commonStyles()}</style>
  </head><body>${body}</body></html>`;

export async function buildDkaSingleHtml(rec) {
  return wrap(`DKA Batch Report ${rec.meta.batch_id || rec.id}`, await renderBatch(rec));
}

export async function buildDkaCombinedHtml(records) {
  return wrap("DKA Combined Batch Report", (await Promise.all(records.map(renderBatch))).join("\n"));
}
