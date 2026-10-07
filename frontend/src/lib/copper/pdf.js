import { fileUrl, imageToDataUri, statusLabel, textOnColor } from "@/lib/copper/api";
import { fmtDate, fmtDateTime } from "@/lib/kht/format";

export { printHtmlOnWeb } from "@/lib/kht/pdf";

const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const statusColor = (status) => (statusLabel(status) === "CLEAR" ? "#15803D" : "#C1220E");

const commonStyles = () => `
    @page { margin: 0; size: A4; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #0A1420; margin: 0; padding: 0; }
    .page { padding: 40px 32px; page-break-after: always; }
    .page:last-child { page-break-after: auto; }
    h1 { color: #0A1420; margin: 0; font-size: 22px; }
    .sub { color: #b45309; font-size: 11px; letter-spacing: 1.2px; font-weight: 700; }
    .classbox { width: 92px; height: 92px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 34px; font-weight: 800; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 4px; color: #fff; font-weight: bold; font-size: 12px; }
    .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; margin-top: 12px; }
    .card b { font-size: 12px; letter-spacing: 0.5px; color: #0A1420; }
    .card p { margin: 6px 0 0; font-size: 12px; color: #374151; line-height: 1.5; }
    .imgwrap { text-align: center; margin-top: 10px; }
    .imgwrap img { max-width: 100%; max-height: 260px; border-radius: 8px; object-fit: contain; }
    .caption { color: #64748b; font-size: 10px; margin-top: 4px; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; margin-top: 6px; }
    .meta-grid div { font-size: 11px; color: #374151; padding: 4px 0; border-bottom: 1px solid #eef2f7; }
    .meta-grid span { color: #64748b; margin-right: 6px; }
    .cover { padding: 44px 36px; page-break-after: always; }
    .cover-hero { background: linear-gradient(135deg,#0A1420 0%, #3A2A10 70%); color: #fff; padding: 28px; border-radius: 12px; }
    .cover-hero .brand { color: #F59E0B; font-size: 12px; letter-spacing: 2px; font-weight: 700; }
    .cover-hero h1 { color: #fff; font-size: 26px; margin-top: 6px; }
    .cover-hero .caption { color: #CBD5E1; font-size: 12px; margin-top: 4px; }
    .stat-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 18px; }
    .stat-cell { background: #F1F5F9; border-radius: 8px; padding: 10px; text-align: center; }
    .stat-cell .k { font-size: 9px; color: #64748b; letter-spacing: 1px; text-transform: uppercase; }
    .stat-cell .v { font-size: 22px; font-weight: 800; color: #0A1420; margin-top: 4px; }
    .toc { width: 100%; border-collapse: collapse; margin-top: 22px; }
    .toc th { background: #0A1420; color: #fff; font-size: 10px; letter-spacing: 0.5px; padding: 8px 6px; text-align: left; text-transform: uppercase; }
    .toc td { padding: 8px 6px; border-bottom: 1px solid #e5e7eb; font-size: 11px; color: #0A1420; }
`;

async function embed(path) {
  const url = fileUrl(path || "", 1600);
  if (!url) return "";
  return (await imageToDataUri(url)) || url;
}

function renderSample(test, imgSrc, index, total) {
  const scolor = statusColor(test.status);
  const tag = index && total ? ` · SAMPLE ${index}/${total}` : "";
  return `
    <div class="page">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1px solid #e5e7eb;padding-bottom:8px">
        <div>
          <div class="sub">COPPER STRIP · ASTM D130 / IP 154${tag}</div>
          <h1>${esc(test.meta.sample_id || "—")}</h1>
        </div>
        <div style="text-align:right">
          <div style="font-size:10px;color:#64748b">${esc(fmtDateTime(test.created_at))}</div>
          <div style="margin-top:4px"><span class="badge" style="background:${scolor}">${esc(statusLabel(test.status))}</span></div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:18px;margin-top:14px">
        <div class="classbox" style="background:${esc(test.color)};color:${textOnColor(test.color)}">${esc(String(test.classification).toUpperCase())}</div>
        <div style="flex:1">
          <div style="font-size:16px;color:#0A1420;font-weight:800">${esc(test.group || "—")}</div>
          <div style="font-size:11px;color:#64748b;margin-top:2px">Confidence ${Number(test.confidence).toFixed(1)}%</div>
          <div style="font-size:11px;color:#374151;margin-top:4px">${esc(test.description || "")}</div>
        </div>
      </div>
      <div class="imgwrap">
        <img src="${esc(imgSrc)}" alt="sample"/>
        <div class="caption">Foto sampel copper strip — ${esc(test.meta.sample_id || "—")}</div>
      </div>
      <div class="card"><b>Deskripsi Kondisi</b><p>${esc(test.ai_summary || "—")}</p></div>
      <div class="card"><b>Rekomendasi</b><p>${esc(test.recommendation || "—")}</p></div>
      <div class="card">
        <b>Test Information</b>
        <div class="meta-grid">
          <div><span>Product / Fuel</span>${esc(test.meta.product || "—")}</div>
          <div><span>Batch / Lot</span>${esc(test.meta.batch || "—")}</div>
          <div><span>Operator</span>${esc(test.meta.operator || "—")}</div>
          <div><span>Condition</span>${test.meta.temperature_c}&deg;C · ${test.meta.duration_hours}h</div>
          <div><span>Classification</span>${esc(String(test.classification).toUpperCase())} (${esc(test.group)})</div>
          <div><span>AI Model</span>${esc(test.ai_model)}</div>
        </div>
      </div>
    </div>`;
}

const wrap = (title, body) => `<!DOCTYPE html><html><head><meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <title>${esc(title)}</title>
    <style>${commonStyles()}</style>
  </head><body>${body}</body></html>`;

export async function buildCopperSingleHtml(test) {
  const img = await embed(test.crop_path || test.image_path);
  return wrap(`Copper Strip Report ${test.meta.sample_id || test.id}`, renderSample(test, img));
}

function renderCover(tests) {
  const total = tests.length;
  const passed = tests.filter((t) => statusLabel(t.status) === "CLEAR").length;
  const failed = total - passed;
  const rows = tests
    .map((t, i) => {
      const c = statusColor(t.status);
      return `<tr>
        <td>#${i + 1}</td>
        <td>${esc(t.meta.sample_id || "—")}</td>
        <td>${esc(t.meta.product || "—")}</td>
        <td>${esc(fmtDate(t.created_at))}</td>
        <td style="font-weight:800">${esc(String(t.classification).toUpperCase())}</td>
        <td><span class="badge" style="background:${c}">${esc(statusLabel(t.status))}</span></td>
      </tr>`;
    })
    .join("");
  return `
    <div class="cover">
      <div class="cover-hero">
        <div class="brand">COPPER STRIP · ASTM D130 / IP 154</div>
        <h1>Combined Corrosion Report</h1>
        <div class="caption">${total} sampel · Dihasilkan ${esc(fmtDateTime(new Date().toISOString()))}</div>
      </div>
      <div class="stat-row">
        <div class="stat-cell"><div class="k">Total Sampel</div><div class="v">${total}</div></div>
        <div class="stat-cell"><div class="k">Clear</div><div class="v" style="color:#15803D">${passed}</div></div>
        <div class="stat-cell"><div class="k">Tarnish</div><div class="v" style="color:#C1220E">${failed}</div></div>
      </div>
      <table class="toc">
        <thead><tr><th>#</th><th>Sample ID</th><th>Product</th><th>Tanggal</th><th>Class</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

export async function buildCopperCombinedHtml(tests) {
  const imgs = await Promise.all(tests.map((t) => embed(t.crop_path || t.image_path)));
  const total = tests.length;
  const pages = tests.map((t, i) => renderSample(t, imgs[i], i + 1, total)).join("\n");
  return wrap("Copper Strip Combined Report", `${renderCover(tests)}${pages}`);
}
