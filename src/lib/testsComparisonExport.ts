import jsPDF from "jspdf";
import { format } from "date-fns";
import { preparePdfWithSettings } from "@/lib/pdfExport";
import { generateCsv, downloadCsv } from "@/lib/csv";

export interface TestsComparisonRow {
  name: string;
  value: number;
  delta: number | null;
  date: string;
  count?: number;
}

export interface TestsComparisonChart {
  label: string;
  unit: string | null;
  rows: TestsComparisonRow[];
}

export interface TestsComparisonExportContext {
  categoryId: string;
  mode: "players" | "groups";
  charts: TestsComparisonChart[];
}

const hexToRgb = (hex: string): [number, number, number] => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
  if (!m) return [34, 67, 120];
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
};

const fmtDate = (iso: string) => {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "dd/MM/yyyy");
  } catch {
    return iso;
  }
};

const fmtDelta = (d: number | null) => (d == null ? "" : d > 0 ? `+${d}` : String(d));

/** Export CSV — une ligne par test et par athlète (ou groupe). */
export function exportTestsComparisonCsv(ctx: TestsComparisonExportContext) {
  const subjectLabel = ctx.mode === "players" ? "Athlète" : "Groupe";
  const valueLabel = ctx.mode === "players" ? "Valeur" : "Moyenne";

  const headers = [
    "Test",
    "Unité",
    subjectLabel,
    valueLabel,
    "Date",
    "Évolution (1er → dernier)",
    "Athlètes pris en compte",
  ];

  const rows: (string | number | null)[][] = [];
  ctx.charts.forEach((c) => {
    c.rows.forEach((r) => {
      rows.push([
        c.label,
        c.unit || "",
        r.name,
        r.value,
        fmtDate(r.date),
        fmtDelta(r.delta),
        r.count ?? "",
      ]);
    });
  });

  downloadCsv(
    `comparaison_tests_${format(new Date(), "yyyyMMdd")}.csv`,
    generateCsv(headers, rows),
  );
}

/** Export PDF — un bloc par test avec le classement des athlètes / groupes. */
export async function exportTestsComparisonPdf(ctx: TestsComparisonExportContext) {
  const { settings, clubName, categoryName, seasonName } = await preparePdfWithSettings(ctx.categoryId);
  const headerRgb = hexToRgb(settings?.header_color || "#224378");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentW = pageW - margin * 2;

  doc.setFillColor(...headerRgb);
  doc.rect(0, 0, pageW, 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Comparaison & évolution des tests", margin, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    [settings?.club_name_override || clubName, categoryName, seasonName].filter(Boolean).join("  •  "),
    margin,
    19,
  );

  let y = 34;
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(10);
  doc.text(
    ctx.mode === "players"
      ? "Comparaison par athlète — dernière valeur enregistrée par test"
      : "Comparaison par groupe — moyenne du groupe par test",
    margin,
    y,
  );
  y += 4;
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text("Évolution = écart entre le premier et le dernier résultat enregistré.", margin, y);
  y += 8;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - 16) {
      doc.addPage();
      y = 20;
    }
  };

  const subjectW = contentW * 0.42;
  const valueW = contentW * 0.18;
  const dateW = contentW * 0.2;

  ctx.charts.forEach((c) => {
    ensureSpace(24);

    doc.setFillColor(244, 246, 251);
    doc.rect(margin, y - 5, contentW, 9, "F");
    doc.setTextColor(30, 30, 30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`${c.label}${c.unit ? ` (${c.unit})` : ""}`, margin + 2, y + 1);
    y += 11;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 110);
    doc.text(ctx.mode === "players" ? "Athlète" : "Groupe", margin + 2, y);
    doc.text(ctx.mode === "players" ? "Valeur" : "Moyenne", margin + 2 + subjectW, y);
    doc.text("Date", margin + 2 + subjectW + valueW, y);
    doc.text("Évolution", margin + 2 + subjectW + valueW + dateW, y);
    y += 4.5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    c.rows.forEach((r, i) => {
      ensureSpace(8);
      if (i % 2 === 1) {
        doc.setFillColor(250, 251, 253);
        doc.rect(margin, y - 4, contentW, 6, "F");
      }
      doc.setTextColor(40, 40, 40);
      doc.text(`${r.name}${r.count ? ` (${r.count})` : ""}`, margin + 2, y);
      doc.text(`${r.value}${c.unit ? ` ${c.unit}` : ""}`, margin + 2 + subjectW, y);
      doc.setTextColor(110, 110, 110);
      doc.text(fmtDate(r.date), margin + 2 + subjectW + valueW, y);
      if (r.delta == null) {
        doc.text("—", margin + 2 + subjectW + valueW + dateW, y);
      } else {
        if (r.delta > 0) doc.setTextColor(16, 129, 85);
        else if (r.delta < 0) doc.setTextColor(190, 30, 60);
        doc.text(fmtDelta(r.delta), margin + 2 + subjectW + valueW + dateW, y);
      }
      y += 6;
    });
    y += 4;
  });

  if (settings?.footer_text) {
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(settings.footer_text, pageW / 2, pageH - 8, { align: "center" });
  }

  doc.save(`comparaison_tests_${format(new Date(), "yyyyMMdd")}.pdf`);
}
