import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const AMBER = [245, 158, 11];
const DARK = [24, 24, 27];
const GRAY = [90, 90, 95];

export function exportSamplePdf(module, sample) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;

  // Header band
  doc.setFillColor(...DARK);
  doc.rect(0, 0, pageW, 90, "F");
  doc.setFillColor(...AMBER);
  doc.rect(0, 88, pageW, 3, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Laboratorium Product Development", margin, 42);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(200, 200, 205);
  doc.text("Lubricant Testing & Product Development Report", margin, 60);
  doc.setTextColor(...AMBER);
  doc.setFontSize(11);
  doc.text(module.title, pageW - margin, 42, { align: "right" });
  doc.setTextColor(200, 200, 205);
  doc.setFontSize(9);
  doc.text(
    `Generated: ${new Date().toLocaleString()}`,
    pageW - margin,
    60,
    { align: "right" }
  );

  let y = 120;
  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Sample Information", margin, y);
  y += 8;

  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: DARK, textColor: 255 },
    body: [
      ["Sample Code", sample.sample_code || "-", "Sample Name", sample.sample_name || "-"],
      ["Product Type", sample.product_type || "-", "Operator", sample.operator || "-"],
      ["Test Date", sample.test_date || "-", module.ratingLabel, sample.rating || "-"],
    ],
    columnStyles: {
      0: { fontStyle: "bold", fillColor: [245, 245, 245] },
      2: { fontStyle: "bold", fillColor: [245, 245, 245] },
    },
    margin: { left: margin, right: margin },
  });

  y = doc.lastAutoTable.finalY + 24;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Test Parameters", margin, y);
  y += 8;

  const paramRows = module.parameters.map((p) => {
    const v = sample.parameters?.[p.key];
    return [p.label, v !== undefined && v !== "" ? String(v) : "-", p.unit || "-"];
  });

  autoTable(doc, {
    startY: y,
    theme: "striped",
    head: [["Parameter", "Result", "Unit"]],
    body: paramRows,
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: AMBER, textColor: DARK, fontStyle: "bold" },
    margin: { left: margin, right: margin },
  });

  y = doc.lastAutoTable.finalY + 24;

  if (sample.notes) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Operator Notes", margin, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    const notes = doc.splitTextToSize(sample.notes, pageW - margin * 2);
    doc.text(notes, margin, y);
    y += notes.length * 12 + 14;
    doc.setTextColor(30, 30, 30);
  }

  if (sample.ai_analysis) {
    if (y > 680) {
      doc.addPage();
      y = 60;
    }
    doc.setFillColor(59, 130, 246);
    doc.rect(margin, y - 10, 4, 16, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("AI Analysis", margin + 12, y);
    y += 18;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(50, 50, 55);
    const lines = doc.splitTextToSize(sample.ai_analysis, pageW - margin * 2);
    lines.forEach((line) => {
      if (y > 800) {
        doc.addPage();
        y = 60;
      }
      doc.text(line, margin, y);
      y += 13;
    });
  }

  const fname = `${module.slug}_${sample.sample_code || "report"}.pdf`.replace(/\s+/g, "_");
  doc.save(fname);
}
