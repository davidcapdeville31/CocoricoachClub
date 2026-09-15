import jsPDF from "jspdf";
import { preparePdfWithSettings } from "@/lib/pdfExport";
import { generateCsv, downloadCsv } from "@/lib/csv";

export interface LoadExportPlayerRow {
  name: string;
  position?: string | null;
  currentLoad: number | null;
  acute: number | null;
  chronic: number | null;
  ratio: number | null;
  weeklyChange: number | null;
  riskLevel: string | null;
}

export interface LoadExportDailyRow {
  date: string;
  rawValue: number | null;
  acute: number | null;
  chronic: number | null;
  ratio: number | null;
  riskLevel: string | null;
}

export interface LoadExportContext {
  categoryId: string;
  /** "EWMA" | "AWCR" */
  model: string;
  metricLabel: string;
  periodLabel: string;
  /** Nom de l'athlète si export individuel, sinon undefined (effectif) */
  playerName?: string;
  teamRows: LoadExportPlayerRow[];
  dailyRows: LoadExportDailyRow[];
}

const RISK_LABELS: Record<string, string> = {
  optimal: "Optimal",
  warning: "Vigilance",
  danger: "Risque élevé",
  low: "Sous-charge",
};

const riskLabel = (r: string | null | undefined) => (r ? RISK_LABELS[r] || r : "—");
const num = (v: number | null | undefined, d = 1) =>
  v == null || !Number.isFinite(v) ? "—" : v.toFixed(d);

const hexToRgb = (hex: string): [number, number, number] => {
  const h = (hex || "#224378").replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
};

const fileStamp = () => new Date().toISOString().slice(0, 10);

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase();

/** ---------- CSV ---------- */

export function exportTrainingLoadCsv(ctx: LoadExportContext) {
  const meta = [
    ["Modèle", ctx.model],
    ["Métrique", ctx.metricLabel],
    ["Période", ctx.periodLabel],
    ["Export", new Date().toLocaleString("fr-FR")],
  ];

  const lines: string[] = [];
  lines.push(generateCsv(["Paramètre", "Valeur"], meta));
  lines.push("");

  if (ctx.playerName) {
    lines.push(
      generateCsv(
        ["Date", "Charge du jour", "Charge aiguë (7j)", "Charge chronique (28j)", "Ratio", "Zone"],
        ctx.dailyRows.map((r) => [
          r.date,
          num(r.rawValue, 0),
          num(r.acute),
          num(r.chronic),
          num(r.ratio, 2),
          riskLabel(r.riskLevel),
        ])
      )
    );
  } else {
    lines.push(
      generateCsv(
        [
          "Athlète",
          "Poste",
          "Charge du jour",
          "Charge aiguë (7j)",
          "Charge chronique (28j)",
          "Ratio",
          "Variation hebdo (%)",
          "Zone",
        ],
        ctx.teamRows.map((p) => [
          p.name,
          p.position || "",
          num(p.currentLoad, 0),
          num(p.acute),
          num(p.chronic),
          num(p.ratio, 2),
          num(p.weeklyChange),
          riskLabel(p.riskLevel),
        ])
      )
    );
  }

  const name = ctx.playerName
    ? `charge_${slug(ctx.playerName)}_${fileStamp()}.csv`
    : `charge_effectif_${fileStamp()}.csv`;
  downloadCsv(name, lines.join("\n"));
}

/** ---------- PDF ---------- */

export async function exportTrainingLoadPdf(ctx: LoadExportContext) {
  const { settings, clubName, categoryName, seasonName } = await preparePdfWithSettings(ctx.categoryId);
  const headerRgb = hexToRgb(settings?.header_color || "#224378");

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;

  doc.setFillColor(...headerRgb);
  doc.rect(0, 0, pageW, 24, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(
    ctx.playerName ? `Charge d'entraînement — ${ctx.playerName}` : "Charge d'entraînement — Effectif",
    margin,
    11
  );
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    [settings?.club_name_override || clubName, categoryName, seasonName].filter(Boolean).join("  •  "),
    margin,
    18
  );

  let y = 32;
  doc.setTextColor(70, 70, 70);
  doc.setFontSize(9);
  doc.text(
    `Modèle : ${ctx.model}   •   Métrique : ${ctx.metricLabel}   •   Période : ${ctx.periodLabel}   •   Édité le ${new Date().toLocaleDateString("fr-FR")}`,
    margin,
    y
  );
  y += 10;

  type Col = { label: string; w: number; value: (row: any) => string };

  const teamCols: Col[] = [
    { label: "Athlète", w: 60, value: (r) => r.name },
    { label: "Poste", w: 32, value: (r) => r.position || "—" },
    { label: "Charge jour", w: 28, value: (r) => num(r.currentLoad, 0) },
    { label: "Aiguë 7j", w: 28, value: (r) => num(r.acute) },
    { label: "Chronique 28j", w: 32, value: (r) => num(r.chronic) },
    { label: "Ratio", w: 22, value: (r) => num(r.ratio, 2) },
    { label: "Var. hebdo", w: 26, value: (r) => `${num(r.weeklyChange)}%` },
    { label: "Zone", w: 32, value: (r) => riskLabel(r.riskLevel) },
  ];

  const dailyCols: Col[] = [
    { label: "Date", w: 40, value: (r) => new Date(r.date).toLocaleDateString("fr-FR") },
    { label: "Charge du jour", w: 40, value: (r) => num(r.rawValue, 0) },
    { label: "Aiguë 7j", w: 38, value: (r) => num(r.acute) },
    { label: "Chronique 28j", w: 40, value: (r) => num(r.chronic) },
    { label: "Ratio", w: 28, value: (r) => num(r.ratio, 2) },
    { label: "Zone", w: 40, value: (r) => riskLabel(r.riskLevel) },
  ];

  const cols = ctx.playerName ? dailyCols : teamCols;
  const rows: any[] = ctx.playerName ? ctx.dailyRows : ctx.teamRows;

  const drawHead = () => {
    doc.setFillColor(...headerRgb);
    doc.rect(margin, y - 5, pageW - margin * 2, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    let x = margin + 2;
    cols.forEach((c) => {
      doc.text(c.label, x, y);
      x += c.w;
    });
    y += 9;
    doc.setFont("helvetica", "normal");
  };

  if (rows.length === 0) {
    doc.setTextColor(120, 120, 120);
    doc.text("Aucune donnée de charge sur la période sélectionnée.", margin, y);
  } else {
    drawHead();
    rows.forEach((r, i) => {
      if (y + 7 > pageH - 14) {
        doc.addPage();
        y = 20;
        drawHead();
      }
      if (i % 2 === 0) {
        doc.setFillColor(245, 247, 250);
        doc.rect(margin, y - 5, pageW - margin * 2, 7, "F");
      }
      let x = margin + 2;
      doc.setFontSize(8.5);
      doc.setTextColor(45, 45, 45);
      cols.forEach((c) => {
        doc.text(String(c.value(r)), x, y);
        x += c.w;
      });
      y += 7;
    });
  }

  if (settings?.footer_text) {
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(settings.footer_text, pageW / 2, pageH - 7, { align: "center" });
  }

  const name = ctx.playerName
    ? `charge_${slug(ctx.playerName)}_${fileStamp()}.pdf`
    : `charge_effectif_${fileStamp()}.pdf`;
  doc.save(name);
}
