import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BadgeCheck, Crosshair, FileDown, Loader2, Save, Sparkles, Trash2, UserCheck, X } from "lucide-react";
import { toast } from "sonner";
import { useAnalyzeRustMethod, useDeleteRust, useLocateRustGrid, useRustTest, useSwitchRustMethod, useUpdateRust, RUST_GRADES, gradeForCount } from "@/lib/rust/api";
import RustGrid from "@/components/rust/Grid";
import { Card, InfoRow } from "@/components/kht/ui";
import { fileUrl, imageToDataUri } from "@/lib/kht/api";
import { fmtDateTime } from "@/lib/kht/format";
import { METHOD_INFO, hitBox, renderCalcFigure, renderOverlay } from "@/lib/rust/figure";
import { buildRustSingleHtml, printHtmlOnWeb } from "@/lib/rust/pdf";

const Label = ({ children, right }) => (
  <div className="mb-3 flex items-center justify-between gap-2">
    <div className="font-mono text-[11px] tracking-[0.15em] text-amber-400">{children}</div>
    {right}
  </div>
);

const Seg = ({ options, value, onChange, testId }) => (
  <div className="flex rounded-md border border-zinc-700 bg-zinc-950 p-0.5" data-testid={testId}>
    {options.map(([k, label]) => (
      <button key={k} type="button" onClick={() => onChange(k)} data-testid={`${testId}-${k}`}
        className={`rounded px-2.5 py-1 font-mono text-[10px] font-bold tracking-widest ${value === k ? "bg-amber-500 text-zinc-950" : "text-zinc-400 hover:text-zinc-100"}`}>{label}</button>
    ))}
  </div>
);

function MethodDetail({ snap, method, official, boxesForCalc }) {
  const calc = useMemo(() => renderCalcFigure(boxesForCalc, { method }), [boxesForCalc, method]);
  const n = (boxesForCalc || []).filter(Boolean).length;
  const g = gradeForCount(n); const spec = RUST_GRADES[g];
  return (
    <div className="mt-4 flex flex-col gap-3" data-testid={`rust-method-detail-${method}`}>
      <div className="font-mono text-[11px] tracking-[0.15em] text-amber-400">DETAIL ANALISA · {METHOD_INFO[method].label.toUpperCase()}</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[["KOTAK BERKARAT", `${n}/100`, "rust-detail-count"], ["LUAS TERDAMPAK", `${n}%`, "rust-detail-area"], ["GRADE", g, "rust-detail-grade"], ["CONFIDENCE AI", `${Number(snap.confidence || 0).toFixed(0)}%`, "rust-detail-confidence"]].map(([k, v, t]) => (
          <div key={k} className="rounded border border-zinc-700 bg-zinc-950 p-2 text-center">
            <div className="font-mono text-[9px] tracking-widest text-zinc-500">{k}</div>
            <div className="mt-1 font-heading text-2xl font-bold" style={{ color: k === "GRADE" ? spec.color : "#fafafa" }} data-testid={t}>{v}</div>
          </div>
        ))}
      </div>
      <div className="rounded border p-2 text-center font-mono text-[11px]" style={{ color: spec.color, borderColor: `${spec.color}66`, backgroundColor: `${spec.color}12` }}>
        {spec.status} · {spec.label} {official ? "· HASIL RESMI" : "· PEMBANDING"}
      </div>
      {method === "full" && snap.specimen_box_count != null && <div className="font-mono text-[11px] text-zinc-400" data-testid="rust-detail-specimen">Kotak berisi permukaan spesimen: {snap.specimen_box_count}/100 · karat pada spesimen: {n} kotak</div>}
      <p className="font-mono text-[12px] leading-5 text-zinc-200" data-testid="rust-detail-summary">{snap.ai_summary || "—"}</p>
      <p className="font-mono text-[11px] leading-4 text-zinc-400">{snap.recommendation || ""}</p>
      <div className="overflow-hidden rounded-lg border border-zinc-700 bg-white" data-testid="rust-detail-calc"><img src={calc} alt="perhitungan ASTM D1748" className="w-full" /></div>
      <div className="font-mono text-[10px] text-zinc-500">Dianalisa {fmtDateTime(snap.analyzed_at || snap.created_at)}{snap.edited ? " · grid dikoreksi inspector" : ""}</div>
    </div>
  );
}

function OverlayCard({ data, boxes, onToggle, onSave, dirty, saving }) {
  const locate = useLocateRustGrid();
  const switcher = useSwitchRustMethod();
  const [stage, setStage] = useState("");
  const analyze = useAnalyzeRustMethod((sec) => setStage(`AI Vision menganalisa… ${sec}s`));
  const [photo, setPhoto] = useState(null);
  const [viewMethod, setViewMethod] = useState(data.method || "zone");
  const [view, setView] = useState("ai");
  const [zoom, setZoom] = useState("zoom");
  const [img, setImg] = useState(null);
  const [geom, setGeom] = useState(null);
  const [estimated, setEstimated] = useState(false);
  useEffect(() => { setViewMethod(data.method || "zone"); }, [data.method]);

  const results = data.method_results || {};
  const official = viewMethod === (data.method || "zone");
  const snap = official ? data : results[viewMethod];
  const srcBoxes = useMemo(() => {
    if (!snap) return Array(100).fill(false);
    if (view === "ai") return snap.ai_grid_boxes || snap.grid_boxes;
    return official ? boxes : snap.grid_boxes;
  }, [snap, view, official, boxes]);

  useEffect(() => {
    let alive = true;
    const url = fileUrl(data.image_path, 1600);
    imageToDataUri(url).then((d) => alive && setPhoto(d || url));
    return () => { alive = false; };
  }, [data.image_path]);

  useEffect(() => {
    if (!photo) return undefined;
    let alive = true;
    renderOverlay(photo, snap?.grid_corners, srcBoxes, { zoom: zoom === "zoom", method: viewMethod, label: !snap ? "BELUM DIANALISA" : view === "ai" ? "AI VISION" : "KOREKSI" })
      .then((r) => { if (alive) { setImg(r.dataUrl); setGeom(r.geom); setEstimated(r.estimated); } })
      .catch(() => alive && setImg(null));
    return () => { alive = false; };
  }, [photo, snap, srcBoxes, zoom, view, viewMethod]);

  async function runAnalyze() {
    if (snap?.edited && !window.confirm("Analisa ulang akan mengganti koreksi grid untuk metode ini. Lanjutkan?")) return;
    try {
      const rec = await analyze.mutateAsync({ id: data.id, method: viewMethod });
      toast.success(`Analisa ${METHOD_INFO[viewMethod].label} selesai — ${rec.rusted_box_count}/100 kotak, Grade ${rec.grade}. Dijadikan hasil resmi.`);
    } catch (e) { toast.error(String(e?.message || "Analisa gagal").slice(0, 160)); } finally { setStage(""); }
  }
  async function makeOfficial() {
    try { const rec = await switcher.mutateAsync({ id: data.id, method: viewMethod }); toast.success(`Hasil resmi: ${METHOD_INFO[viewMethod].label} — Grade ${rec.grade}.`); }
    catch (e) { toast.error(String(e?.message || "Gagal mengganti metode").slice(0, 140)); }
  }
  async function detect() {
    try { await locate.mutateAsync(data.id); toast.success("Posisi zona 50×50 mm terdeteksi AI."); }
    catch (e) { toast.error(String(e?.message || "Deteksi grid gagal").slice(0, 140)); }
  }
  function clickPhoto(e) {
    if (!geom || !snap) return;
    if (!official) { toast.info("Jadikan metode ini hasil resmi dulu untuk mengoreksi kotak."); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    const idx = hitBox(geom, ((e.clientX - rect.left) / rect.width) * geom.w, ((e.clientY - rect.top) / rect.height) * geom.h);
    if (idx < 0) return;
    if (view !== "corr") setView("corr");
    onToggle(idx);
  }
  const corrN = boxes.filter(Boolean).length;
  const corrG = gradeForCount(corrN);
  const busy = analyze.isPending || switcher.isPending;
  const btn = "flex items-center gap-2 rounded-md px-3 py-2 font-mono text-[11px] font-bold tracking-widest disabled:opacity-50";

  return (
    <Card data-testid="rust-overlay-card">
      <Label right={<div className="flex flex-wrap justify-end gap-2">
        {snap && <Seg testId="rust-overlay-view" value={view} onChange={setView} options={[["ai", "AI"], ["corr", "KOREKSI"]]} />}
        {viewMethod === "zone" && <Seg testId="rust-overlay-zoom" value={zoom} onChange={setZoom} options={[["zoom", "ZONA"], ["full", "FOTO"]]} />}
      </div>}>PETA GRID PADA FOTO</Label>

      <div className="mb-3 grid grid-cols-2 gap-2" data-testid="rust-method-tabs">
        {["zone", "full"].map((m) => {
          const r = m === (data.method || "zone") ? data : results[m];
          const isOff = m === (data.method || "zone");
          return (
            <button key={m} type="button" onClick={() => setViewMethod(m)} data-testid={`rust-method-tab-${m}`} aria-pressed={viewMethod === m}
              className={`rounded-lg border p-2.5 text-left transition-colors ${viewMethod === m ? "border-amber-500 bg-amber-500/10" : "border-zinc-700 bg-zinc-950 hover:border-zinc-500"}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] font-bold tracking-widest text-zinc-50">{METHOD_INFO[m].short}</span>
                {isOff && <span className="rounded bg-amber-500 px-1.5 py-0.5 font-mono text-[9px] font-bold text-zinc-950" data-testid={`rust-method-official-${m}`}>RESMI</span>}
              </div>
              <div className="mt-1 font-mono text-[11px] text-zinc-400">{r ? `${r.rusted_box_count}/100 · Grade ${r.grade}` : "Belum dianalisa"}</div>
            </button>
          );
        })}
      </div>

      <div className="flex min-h-[220px] items-center justify-center overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950" data-testid="rust-overlay-wrap">
        {img ? <img src={img} alt="overlay grid ASTM D1748" onClick={clickPhoto} className={`max-h-[520px] max-w-full ${snap && official ? "cursor-crosshair" : ""}`} data-testid="rust-overlay-image" /> : <Loader2 className="h-6 w-6 animate-spin text-amber-400" />}
      </div>
      {snap && official && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-red-500/40 bg-red-500/10 p-2" data-testid="rust-overlay-edit-bar">
          <span className="font-mono text-[11px] text-zinc-200">Klik kotak pada foto untuk menghapus/menambah kotak merah · <b data-testid="rust-overlay-live-count">{corrN}/100</b> · Grade <b style={{ color: RUST_GRADES[corrG].color }} data-testid="rust-overlay-live-grade">{corrG}</b></span>
          <button type="button" onClick={onSave} disabled={!dirty || saving} data-testid="rust-overlay-save" className={`${btn} bg-amber-500 text-zinc-950 hover:bg-amber-400`}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}SIMPAN KOREKSI
          </button>
        </div>
      )}
      <div className="mt-2 font-mono text-[10px] text-zinc-500">{METHOD_INFO[viewMethod].desc}</div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className={`font-mono text-[10px] ${!snap || estimated ? "text-amber-400" : "text-zinc-500"}`} data-testid="rust-overlay-note">
          {!snap ? "Metode ini belum dianalisa untuk foto ini." : estimated ? "Posisi grid belum dideteksi — overlay memakai estimasi seluruh foto." : viewMethod === "full" ? "Seluruh foto = active zone. Kotak merah = karat." : "Zona 50×50 mm dipetakan AI. Kotak merah = karat."}
        </span>
        <div className="flex flex-wrap gap-2">
          {snap && !official && (
            <button type="button" onClick={makeOfficial} disabled={busy} data-testid="rust-method-make-official" className={`${btn} bg-amber-500 text-zinc-950 hover:bg-amber-400`}>
              {switcher.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}JADIKAN HASIL RESMI
            </button>
          )}
          <button type="button" onClick={runAnalyze} disabled={busy} data-testid="rust-method-analyze" className={`${btn} ${snap ? "border border-zinc-600 text-zinc-200 hover:bg-zinc-800" : "bg-amber-500 text-zinc-950 hover:bg-amber-400"}`}>
            {analyze.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {analyze.isPending ? <span data-testid="rust-method-stage">{stage || "MEMPROSES…"}</span> : snap ? "ANALISA ULANG" : "ANALISA METODE INI"}
          </button>
          {viewMethod === "zone" && snap && (
            <button type="button" onClick={detect} disabled={locate.isPending || busy} data-testid="rust-locate-grid" className={`${btn} border border-amber-500/60 text-amber-400 hover:bg-amber-500/10`}>
              {locate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
              {locate.isPending ? "MENDETEKSI…" : estimated ? "DETEKSI POSISI GRID" : "DETEKSI ULANG"}
            </button>
          )}
        </div>
      </div>

      {snap && <MethodDetail snap={snap} method={viewMethod} official={official} boxesForCalc={srcBoxes} />}
    </Card>
  );
}

function InspectorCard({ data }) {
  const update = useUpdateRust();
  const [count, setCount] = useState("");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  useEffect(() => {
    setCount(data.inspector_count ?? "");
    setName(data.inspector_name || data.meta?.operator || "");
    setNotes(data.inspector_notes || "");
  }, [data.id, data.inspector_count, data.inspector_name, data.inspector_notes, data.meta?.operator]);
  const n = count === "" ? null : Math.max(0, Math.min(100, Number(count) || 0));
  const g = n === null ? null : gradeForCount(n);
  const spec = g ? RUST_GRADES[g] : null;
  const aiN = data.ai_rusted_box_count ?? data.rusted_box_count;

  async function save() {
    if (n === null) { toast.error("Isi jumlah kotak berkarat (0–100)."); return; }
    try { await update.mutateAsync({ id: data.id, changes: { inspector_count: n, inspector_name: name, inspector_notes: notes } }); toast.success(`Penilaian inspector tersimpan — Grade ${g}.`); }
    catch (e) { toast.error(String(e?.message || "Gagal menyimpan").slice(0, 120)); }
  }
  async function clear() {
    try { await update.mutateAsync({ id: data.id, changes: { inspector_count: -1, inspector_notes: "" } }); toast.success("Penilaian manual dihapus."); }
    catch (e) { toast.error(String(e?.message || "Gagal menghapus").slice(0, 120)); }
  }

  return (
    <Card data-testid="rust-inspector-card">
      <Label right={data.inspector_at ? <span className="font-mono text-[10px] text-zinc-500">Disimpan {fmtDateTime(data.inspector_at)}</span> : null}>PENILAIAN MANUAL INSPECTOR</Label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="flex flex-1 flex-col gap-1">
          <span className="font-mono text-[11px] text-zinc-300">Kotak berkarat (0–100)</span>
          <input data-testid="rust-inspector-count" type="number" min={0} max={100} value={count} onChange={(e) => setCount(e.target.value)} placeholder={`AI: ${aiN}`}
            className="h-11 rounded-md border border-zinc-700 bg-zinc-900 px-3 font-mono text-sm text-zinc-50 outline-none focus:border-amber-500" />
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className="font-mono text-[11px] text-zinc-300">Nama inspector</span>
          <input data-testid="rust-inspector-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama inspector"
            className="h-11 rounded-md border border-zinc-700 bg-zinc-900 px-3 font-mono text-sm text-zinc-50 outline-none focus:border-amber-500" />
        </label>
        <div className="flex min-w-[120px] flex-col items-center justify-center rounded-md border px-3 py-1" data-testid="rust-inspector-grade"
          style={spec ? { borderColor: `${spec.color}88`, backgroundColor: `${spec.color}14` } : { borderColor: "#3f3f46" }}>
          <span className="font-heading text-3xl font-bold" style={{ color: spec?.color || "#71717a" }}>{g || "—"}</span>
          <span className="font-mono text-[9px] tracking-widest text-zinc-500">{spec ? spec.status : "GRADE"}</span>
        </div>
      </div>
      <label className="mt-3 flex flex-col gap-1">
        <span className="font-mono text-[11px] text-zinc-300">Catatan inspector</span>
        <textarea data-testid="rust-inspector-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Observasi visual, alasan perbedaan dengan AI, dll."
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-[13px] text-zinc-50 outline-none focus:border-amber-500" />
      </label>
      {n !== null && <div className="mt-2 font-mono text-[11px] text-zinc-400" data-testid="rust-inspector-diff">Selisih vs AI Vision: {n - aiN > 0 ? "+" : ""}{n - aiN} kotak (AI {aiN} · Grade {data.ai_grade || gradeForCount(aiN)})</div>}
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={save} disabled={update.isPending} data-testid="rust-inspector-save"
          className="flex flex-1 items-center justify-center gap-2 rounded-md bg-amber-500 py-3 font-mono text-xs font-bold tracking-widest text-zinc-950 hover:bg-amber-400 disabled:opacity-50">
          <UserCheck className="h-4 w-4" />{update.isPending ? "MENYIMPAN…" : "SIMPAN PENILAIAN"}
        </button>
        {data.inspector_count != null && (
          <button type="button" onClick={clear} disabled={update.isPending} data-testid="rust-inspector-clear"
            className="flex items-center justify-center gap-1 rounded-md border border-zinc-700 px-4 font-mono text-xs text-zinc-300 hover:bg-zinc-800"><X className="h-4 w-4" />HAPUS</button>
        )}
      </div>
    </Card>
  );
}

export default function RustResult() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useRustTest(id);
  const update = useUpdateRust();
  const del = useDeleteRust();
  const [boxes, setBoxes] = useState([]);
  const [exporting, setExporting] = useState(false);
  useEffect(() => { if (data) setBoxes(data.grid_boxes || Array(100).fill(false)); }, [data]);
  if (isLoading) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-amber-400" /></div>;
  if (isError || !data) return <div className="py-24 text-center font-mono text-xs text-zinc-500" data-testid="rust-result-not-found">Inspection tidak ditemukan.</div>;
  const count = boxes.filter(Boolean).length;
  const liveGrade = gradeForCount(count);
  const grade = RUST_GRADES[liveGrade];
  const dirty = JSON.stringify(boxes) !== JSON.stringify(data.grid_boxes);
  const toggleBox = (index) => setBoxes((prev) => prev.map((value, i) => (i === index ? !value : value)));
  const aiN = data.ai_rusted_box_count ?? data.rusted_box_count;
  const aiGrade = data.ai_grade || gradeForCount(aiN);

  async function saveGrid() { try { await update.mutateAsync({ id, changes: { grid_boxes: boxes } }); toast.success(`Grid tersimpan — ${count}/100 kotak, Grade ${gradeForCount(count)}.`); } catch (e) { toast.error(String(e?.message || "Gagal menyimpan grid").slice(0, 120)); } }
  async function deleteRecord() { try { await del.mutateAsync(id); toast.success("Inspeksi dihapus."); navigate("/rust-preventing/history"); } catch (e) { toast.error(String(e?.message || "Gagal menghapus").slice(0, 120)); } }
  async function exportPdf() {
    setExporting(true);
    try { printHtmlOnWeb(await buildRustSingleHtml(data)); toast.success("Menyiapkan PDF — pilih \"Save as PDF\" di dialog print."); }
    catch (e) { toast.error(String(e?.message || "Gagal export PDF").slice(0, 120)); }
    finally { setExporting(false); }
  }
  function resetToAi() { setBoxes([...(data.ai_grid_boxes || data.grid_boxes)]); }

  return (
    <div className="flex flex-col gap-4 animate-fade-up" data-testid="rust-result">
      <Card>
        <div className="flex items-center justify-between">
          <div className="font-mono text-[11px] tracking-[0.15em] text-amber-400">ASTM D1748 INSPECTION RESULT</div>
          <button type="button" onClick={exportPdf} disabled={exporting} data-testid="rust-export-pdf" title="Export PDF" className="flex h-10 items-center gap-2 rounded-md px-3 font-mono text-[11px] font-bold tracking-widest text-amber-400 hover:bg-zinc-800 disabled:opacity-50">
            {exporting ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileDown className="h-5 w-5" />}<span className="hidden sm:inline">{exporting ? "MENYIAPKAN…" : "EXPORT PDF"}</span>
          </button>
        </div>
        <div className="mt-2 font-mono text-[15px] font-bold text-zinc-50" data-testid="rust-result-sample-id">{data.meta.sample_id || "—"}</div>
        <div className="my-5 flex items-center justify-center gap-6">
          <div className="text-center"><div className="font-heading text-7xl font-bold" style={{ color: grade.color }} data-testid="rust-result-grade">{liveGrade}</div><div className="font-mono text-[10px] tracking-widest text-zinc-500">GRADE RATING</div></div>
          <div className="h-20 w-px bg-zinc-700" />
          <div className="text-center"><div className="font-heading text-5xl font-bold text-zinc-50" data-testid="rust-result-count">{count}</div><div className="font-mono text-[10px] tracking-widest text-zinc-500">RUSTED / 100</div></div>
        </div>
        <div className="rounded border p-3 text-center font-mono text-xs" style={{ color: grade.color, borderColor: `${grade.color}66`, backgroundColor: `${grade.color}12` }} data-testid="rust-result-status">{grade.status} · {grade.label}</div>
        <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-[10px]" data-testid="rust-result-verdicts">
          <div className="rounded border border-zinc-700 bg-zinc-950 p-2 text-center"><div className="tracking-widest text-zinc-500">AI VISION · {METHOD_INFO[data.method || "zone"].short}</div><div className="mt-1 text-sm font-bold text-zinc-50" data-testid="rust-result-ai-original">{aiN}/100 · {aiGrade}</div></div>
          <div className="rounded border border-zinc-700 bg-zinc-950 p-2 text-center"><div className="tracking-widest text-zinc-500">KOREKSI GRID</div><div className="mt-1 text-sm font-bold text-zinc-50">{data.rusted_box_count}/100 · {data.grade}</div></div>
          <div className="rounded border border-zinc-700 bg-zinc-950 p-2 text-center"><div className="tracking-widest text-zinc-500">MANUAL</div><div className="mt-1 text-sm font-bold text-zinc-50" data-testid="rust-result-manual">{data.inspector_count != null ? `${data.inspector_count}/100 · ${data.inspector_grade}` : "—"}</div></div>
        </div>
      </Card>

      <OverlayCard data={data} boxes={boxes} onToggle={toggleBox} onSave={saveGrid} dirty={dirty} saving={update.isPending} />

      <Card>
        <Label right={<span className="font-mono text-[10px] text-zinc-500">Klik kotak untuk audit/koreksi</span>}>AI GRID DETECTION · {METHOD_INFO[data.method || "zone"].short}</Label>
        <RustGrid boxes={boxes} interactive onToggle={toggleBox} />
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={saveGrid} disabled={update.isPending || !dirty} data-testid="rust-save-grid" className="flex flex-1 items-center justify-center gap-2 rounded-md bg-amber-500 py-3 font-mono text-xs font-bold tracking-widest text-zinc-950 hover:bg-amber-400 disabled:opacity-50"><Save className="h-4 w-4" />{update.isPending ? "MENYIMPAN…" : "SIMPAN KOREKSI GRID"}</button>
          <button type="button" onClick={resetToAi} data-testid="rust-reset-grid-ai" className="rounded-md border border-zinc-700 px-3 font-mono text-[11px] text-zinc-300 hover:bg-zinc-800">RESET KE AI</button>
        </div>
      </Card>

      <InspectorCard data={data} />

      <Card><div className="font-mono text-[11px] tracking-[0.15em] text-amber-400">CATATAN ANALISIS</div><p className="mt-2 font-mono text-[13px] leading-5 text-zinc-200" data-testid="rust-result-summary">{data.ai_summary || "—"}</p><p className="mt-2 font-mono text-[11px] leading-4 text-zinc-400">{data.recommendation || "—"}</p></Card>
      <Card><div className="font-mono text-[11px] tracking-[0.15em] text-amber-400">TEST INFORMATION</div><InfoRow k="Product / Oil" v={data.meta.product || "—"} /><InfoRow k="Batch / Lot" v={data.meta.batch || "—"} /><InfoRow k="Exposure" v={`${data.meta.exposure_hours}h @ ${data.meta.temperature_c}°C`} /><InfoRow k="Humidity" v={`${data.meta.humidity_pct}% RH`} /><InfoRow k="Substrate" v={data.meta.substrate || "—"} /><InfoRow k="Operator" v={data.meta.operator || "—"} /><InfoRow k="AI confidence" v={`${Number(data.confidence).toFixed(0)}%`} /><InfoRow k="Analyzed" v={fmtDateTime(data.created_at)} last /></Card>
      <button type="button" onClick={deleteRecord} disabled={del.isPending} data-testid="rust-delete-result" className="flex items-center justify-center gap-2 py-3 font-mono text-xs text-red-500 hover:text-red-400"><Trash2 className="h-4 w-4" /> HAPUS INSPEKSI</button>
    </div>
  );
}
