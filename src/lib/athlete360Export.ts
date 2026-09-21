import jsPDF from "jspdf";
import { format } from "date-fns";
import { preparePdfWithSettings } from "@/lib/pdfExport";
import { generateCsv, downloadCsv } from "@/lib/csv";

export interface Athlete360ExportSubject {
  name: string;
  /** Nombre d'athlètes agrégés (mode groupes) */
  count?: number;
  appRate: number | null;
  wellnessRate: number | null;
  rpeRate: number | null;
  trainingRate: number | null;
  muscuRate: number | null;
  terrainRate: number | null;
  matchRate: number | null;
  matchPresent: number;
  matchCalled: number;
  weeklyLoad: number | null;
  acwr: number | null;
  acwrInsufficient: boolean;
  injuryCount: number;
  injuryDays: number;
  weightLast: number | null;
  weightDelta: number | null;
  tests: { label: string; unit: string | null; value: number | null; date: string | null; delta: number | null }[];
}

export interface Athlete360ExportContext {
  categoryId: string;
  mode: "players" | "groups";
  periodLabel: string;
  subjects: Athlete360ExportSubject[];
}

const hexToRgb = (hex: string): [number, number, number] => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
  if (!m) return [34, 67, 120];
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
};

const pct = (v: number | null) => (v == null ? "—" : `${v} %`);
const num = (v: number | null, digits = 0) => (v == null ? "—" : v.toFixed(digits));
const fmtDate = (iso: string | null) => {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "dd/MM/yyyy");
  } catch {
    return iso;
  }
};
const fmtDelta = (d: number | null) => (d == null ? "—" : d > 0 ? `+${d}` : String(d));

export function exportAthlete360Csv(ctx: Athlete360ExportContext) {
  const subjectLabel = ctx.mode === "players" ? "Athlète" : "Groupe";
  const headers = [
    subjectLabel,
    "Assiduité app (%)",
    "Wellness (%)",
    "RPE (%)",
    "Présence entraînements (%)",
    "Musculation (%)",
    "Terrain (%)",
    "Présence compétitions (%)",
    "Compétitions (présent/convoqué)",
    "Charge hebdo moyenne",
    "Ratio charge (ACWR)",
    "Blessures (épisodes)",
    "Jours indisponible",
    "Dernier poids (kg)",
    "Variation poids (kg)",
  ];

  const rows: (string | number | null)[][] = ctx.subjects.map((s) => [
    s.count ? `${s.name} (${s.count})` : s.name,
    s.appRate,
    s.wellnessRate,
    s.rpeRate,
    s.trainingRate,
    s.muscuRate,
    s.terrainRate,
    s.matchRate,
    `${s.matchPresent}/${s.matchCalled}`,
    s.weeklyLoad,
    s.acwrInsufficient ? "Reprise — lecture limitée" : s.acwr != null ? s.acwr.toFixed(2) : "",
    s.injuryCount,
    s.injuryDays,
    s.weightLast,
    s.weightDelta,
  ]);

  // Section tests
  rows.push([]);
  rows.push(["Tests physiques"]);
  rows.push(["Test", "Unité", subjectLabel, "Dernier résultat", "Date", "Évolution"]);
  ctx.subjects.forEach((s) => {
    s.tests.forEach((t) => {
      rows.push([t.label, t.unit || "", s.name, t.value, fmtDate(t.date), fmtDelta(t.delta)]);
    });
  });

  downloadCsv(
    `comparaison_360_${format(new Date(), "yyyyMMdd")}.csv`,
    generateCsv(headers, rows),
  );
}

export async function exportAthlete360Pdf(ctx: Athlete360ExportContext) {
  const { settings, clubName, categoryName, seasonName } = await preparePdfWithSettings(ctx.categoryId);
  const headerRgb = hexToRgb(settings?.header_color || "#224378");

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;
  const contentW = pageW - margin * 2;

  doc.setFillColor(...headerRgb);
  doc.rect(0, 0, pageW, 24, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Comparaison 360° des athlètes", margin, 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    [settings?.club_name_override || clubName, categoryName, seasonName, ctx.periodLabel]
      .filter(Boolean)
      .join("  •  "),
    margin,
    18,
  );

  let y = 32;
  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - 12) {
      doc.addPage();
      y = 20;
    }
  };

  const cols = [
    { label: ctx.mode === "players" ? "Athlète" : "Groupe", w: 0.2 },
    { label: "App", w: 0.07 },
    { label: "Entr.", w: 0.07 },
    { label: "Muscu", w: 0.07 },
    { label: "Terrain", w: 0.07 },
    { label: "Compét.", w: 0.09 },
    { label: "Charge/sem", w: 0.1 },
    { label: "Ratio", w: 0.09 },
    { label: "Bless.", w: 0.08 },
    { label: "Poids", w: 0.08 },
    { label: "Δ Poids", w: 0.08 },
  ];
  const xs: number[] = [];
  let acc = margin + 1;
  cols.forEach((c) => {
    xs.push(acc);
    acc += c.w * contentW;
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(110, 110, 110);
  cols.forEach((c, i) => doc.text(c.label, xs[i], y));
  y += 4.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  ctx.subjects.forEach((s, i) => {
    ensureSpace(8);
    if (i % 2 === 1) {
      doc.setFillColor(250, 251, 253);
      doc.rect(margin, y - 4, contentW, 6, "F");
    }
    doc.setTextColor(40, 40, 40);
    const values = [
      s.count ? `${s.name} (${s.count})` : s.name,
      pct(s.appRate),
      pct(s.trainingRate),
      pct(s.muscuRate),
      pct(s.terrainRate),
      `${s.matchPresent}/${s.matchCalled}`,
      num(s.weeklyLoad),
      s.acwrInsufficient ? "Reprise" : s.acwr != null ? s.acwr.toFixed(2) : "—",
      `${s.injuryCount} (${s.injuryDays} j)`,
      s.weightLast != null ? `${s.weightLast} kg` : "—",
      fmtDelta(s.weightDelta),
    ];
    values.forEach((v, idx) => doc.text(String(v), xs[idx], y));
    y += 6;
  });

  // Tests par sujet
  ctx.subjects.forEach((s) => {
    if (s.tests.length === 0) return;
    ensureSpace(20);
    y += 6;
    doc.setFillColor(244, 246, 251);
    doc.rect(margin, y - 5, contentW, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(30, 30, 30);
    doc.text(`Tests — ${s.name}`, margin + 2, y);
    y += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    s.tests.forEach((t) => {
      ensureSpace(7);
      doc.setTextColor(40, 40, 40);
      doc.text(t.label, margin + 2, y);
      doc.text(
        t.value != null ? `${t.value}${t.unit ? ` ${t.unit}` : ""}` : "—",
        margin + 2 + contentW * 0.4,
        y,
      );
      doc.setTextColor(110, 110, 110);
      doc.text(fmtDate(t.date), margin + 2 + contentW * 0.6, y);
      doc.text(fmtDelta(t.delta), margin + 2 + contentW * 0.75, y);
      y += 5.5;
    });
  });

  if (settings?.footer_text) {
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(settings.footer_text, pageW / 2, pageH - 6, { align: "center" });
  }

  doc.save(`comparaison_360_${format(new Date(), "yyyyMMdd")}.pdf`);
}
