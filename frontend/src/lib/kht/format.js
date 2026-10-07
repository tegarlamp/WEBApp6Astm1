import dayjs from "dayjs";

export const fmtDate = (iso) => (iso ? dayjs(iso).format("DD MMM YYYY") : "-");
export const fmtDateTime = (iso) => (iso ? dayjs(iso).format("DD MMM YYYY · HH:mm") : "-");

export const RATING_BANDS = [
  { score: "10", color: "#166534", pct: "0%", sub: "None", grade: "EXCELLENT" },
  { score: "9", color: "#15803D", pct: "< 5%", sub: "Very Slight", grade: "EXCELLENT" },
  { score: "8", color: "#22A85B", pct: "5 – 15%", sub: "Slight", grade: "VERY GOOD" },
  { score: "7", color: "#2563A8", pct: "15 – 30%", sub: "Light", grade: "GOOD" },
  { score: "6", color: "#D9A106", pct: "30 – 45%", sub: "Moderate", grade: "FAIR" },
  { score: "5", color: "#E08A0B", pct: "45 – 60%", sub: "Moderate Heavy", grade: "FAIR" },
  { score: "4", color: "#E5620E", pct: "60 – 75%", sub: "Heavy", grade: "POOR" },
  { score: "3", color: "#D9370E", pct: "75 – 90%", sub: "Very Heavy", grade: "POOR" },
  { score: "2", color: "#C1220E", pct: "90 – 100%", sub: "Extremely Heavy", grade: "VERY POOR" },
  { score: "0-1", color: "#991B1B", pct: "100%", sub: "Plugged", grade: "FAILED" },
];

export function ratingColor(rating) {
  if (rating >= 9) return "#15803D";
  if (rating >= 8) return "#22A85B";
  if (rating >= 7) return "#2563A8";
  if (rating >= 5) return "#E08A0B";
  if (rating >= 3) return "#E5620E";
  return "#C1220E";
}

export function paramRows(p) {
  return [
    { label: "Deposit Area", value: `${p.deposit_area_pct.toFixed(1)} %` },
    { label: "Deposit Length", value: `${p.deposit_length_mm.toFixed(0)} mm` },
    { label: "Deposit Coverage", value: `${p.deposit_coverage_pct.toFixed(1)} %` },
    { label: "Average Intensity (L*)", value: p.avg_intensity_l.toFixed(1) },
    { label: "Average Color (a*)", value: p.avg_color_a.toFixed(1) },
    { label: "Average Color (b*)", value: p.avg_color_b.toFixed(1) },
    { label: "Max Intensity", value: p.max_intensity.toFixed(0) },
    { label: "Deposit Thickness Index", value: `${p.thickness_index_mm.toFixed(2)} mm` },
  ];
}

export function defaultSampleId() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  const rnd = String(Math.floor(Math.random() * 900) + 100);
  return `KHT-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${rnd}`;
}



export function defaultSecretOilCode() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  const rnd = String(Math.floor(Math.random() * 900) + 100);
  return `KHT-PROD-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${rnd}`;
}