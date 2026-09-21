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

  // Tests physiques en matrice : tests en lignes, athlètes/groupes en colonnes.
  const testLabels = Array.from(
    new Map(
      ctx.subjects.flatMap((subject) =>
        subject.tests.map((test) => [test.label, { label: test.label, unit: test.unit }]),
      ),
    ).values(),
  );
  const subjectChunks: Athlete360ExportSubject[][] = [];
  for (let i = 0; i < ctx.subjects.length; i += 7) {
    subjectChunks.push(ctx.subjects.slice(i, i + 7));
  }

  const drawTestsSectionHeader = (chunk: Athlete360ExportSubject[]) => {
    const tableX = margin;
    const tableW = contentW;
    const labelW = 70;
    const subjectW = (tableW - labelW) / Math.max(chunk.length, 1);

    doc.setDrawColor(222, 225, 231);
    doc.setLineWidth(0.35);
    doc.roundedRect(tableX, y, tableW, 18, 3, 3, "S");

    // Petit pictogramme graphique, comme dans l'interface.
    doc.setDrawColor(35, 55, 79);
    doc.setLineWidth(0.65);
    doc.line(tableX + 4, y + 10, tableX + 4, y + 4);
    doc.line(tableX + 4, y + 10, tableX + 10, y + 10);
    doc.line(tableX + 6, y + 9, tableX + 6, y + 6);
    doc.line(tableX + 8, y + 9, tableX + 8, y + 3.5);
    doc.line(tableX + 10, y + 9, tableX + 10, y + 7);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(31, 41, 55);
    doc.text("Tests physiques", tableX + 14, y + 7.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(107, 114, 128);
    doc.text("dernier résultat et évolution depuis le premier", tableX + 48, y + 7.5);

    y += 13;
    doc.setFillColor(249, 250, 251);
    doc.rect(tableX + 0.4, y, tableW - 0.8, 10, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text("Test", tableX + 3, y + 6.2);
    chunk.forEach((subject, index) => {
      const centerX = tableX + labelW + subjectW * index + subjectW / 2;
      const name = subject.count ? `${subject.name} (${subject.count})` : subject.name;
      const fittedName = doc.splitTextToSize(name, subjectW - 3).slice(0, 2);
      doc.text(fittedName, centerX, y + (fittedName.length > 1 ? 4.3 : 6.2), { align: "center" });
    });
    y += 10;
    doc.setDrawColor(222, 225, 231);
    doc.line(tableX, y, tableX + tableW, y);

    return { tableX, tableW, labelW, subjectW };
  };

  subjectChunks.forEach((chunk, chunkIndex) => {
    if (testLabels.length === 0) return;
    if (chunkIndex > 0 || y + 31 > pageH - 12) {
      doc.addPage();
      y = 14;
    } else {
      y += 8;
    }

    let layout = drawTestsSectionHeader(chunk);
    testLabels.forEach((testMeta) => {
      const rowH = 15;
      if (y + rowH > pageH - 12) {
        doc.addPage();
        y = 14;
        layout = drawTestsSectionHeader(chunk);
      }

      const { tableX, tableW, labelW, subjectW } = layout;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.7);
      doc.setTextColor(31, 41, 55);
      const label = testMeta.unit ? `${testMeta.label}  (${testMeta.unit})` : testMeta.label;
      const fittedLabel = doc.splitTextToSize(label, labelW - 6).slice(0, 2);
      doc.text(fittedLabel, tableX + 3, y + (fittedLabel.length > 1 ? 5.3 : 8));

      chunk.forEach((subject, index) => {
        const result = subject.tests.find((test) => test.label === testMeta.label);
        const centerX = tableX + labelW + subjectW * index + subjectW / 2;
        if (result?.value == null) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.setTextColor(107, 114, 128);
          doc.text("—", centerX, y + 8, { align: "center" });
          return;
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(31, 41, 55);
        doc.text(String(result.value), centerX, y + 5.8, { align: "center" });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.4);
        const dateText = fmtDate(result.date);
        const deltaText = result.delta == null || result.delta === 0 ? "" : ` ${fmtDelta(result.delta)}`;
        const dateWidth = doc.getTextWidth(dateText);
        const deltaWidth = doc.getTextWidth(deltaText);
        const startX = centerX - (dateWidth + deltaWidth) / 2;
        doc.setTextColor(107, 114, 128);
        doc.text(dateText, startX, y + 11);
        if (deltaText) {
          if (result.delta != null && result.delta > 0) doc.setTextColor(5, 150, 105);
          else doc.setTextColor(220, 70, 70);
          doc.text(deltaText, startX + dateWidth, y + 11);
        }
      });

      y += rowH;
      doc.setDrawColor(222, 225, 231);
      doc.setLineWidth(0.25);
      doc.line(tableX, y, tableX + tableW, y);
    });
    y += 3;
  });

  if (settings?.footer_text) {
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(settings.footer_text, pageW / 2, pageH - 6, { align: "center" });
  }

  doc.save(`comparaison_360_${format(new Date(), "yyyyMMdd")}.pdf`);
}
