import jsPDF from "jspdf";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { getReportLogoDataUrl, loadImageAsDataUrl } from "@/lib/pdf/clubLogo";
import {
  JUDO_METRIC_GROUPS,
  formatMetric,
  summarizeTournamentRounds,
  type JudoTournamentSummary,
  type JudoRoundStatsRow,
} from "@/lib/judo/tournamentStats";
import { tournamentLevelLabel } from "@/lib/judo/competitionAnalytics";

// ---- Palette aligned with the on-screen theme (GROUP_THEMES) ----------------
type RGB = [number, number, number];

const GROUP_COLORS: Record<string, { bar: [RGB, RGB]; head: RGB; title: RGB; row: RGB }> = {
  "Bilan combats": {
    bar: [[99, 102, 241], [56, 189, 248]],   // indigo → sky
    head: [238, 242, 255],
    title: [55, 48, 163],
    row: [245, 247, 255],
  },
  Scores: {
    bar: [[245, 158, 11], [251, 191, 36]],   // amber → yellow
    head: [255, 247, 224],
    title: [146, 64, 14],
    row: [255, 251, 235],
  },
  Discipline: {
    bar: [[244, 63, 94], [251, 113, 133]],   // rose
    head: [255, 231, 236],
    title: [136, 19, 55],
    row: [255, 241, 244],
  },
  "Ne-waza": {
    bar: [[139, 92, 246], [217, 70, 239]],   // violet → fuchsia
    head: [243, 232, 255],
    title: [91, 33, 182],
    row: [250, 245, 255],
  },
  "Défense": {
    bar: [[16, 185, 129], [45, 212, 191]],   // emerald → teal
    head: [220, 252, 231],
    title: [6, 95, 70],
    row: [240, 253, 244],
  },
  Tactique: {
    bar: [[6, 182, 212], [59, 130, 246]],    // cyan → blue
    head: [224, 242, 254],
    title: [22, 78, 99],
    row: [239, 246, 255],
  },
};
const DEFAULT_GROUP = {
  bar: [[100, 116, 139], [148, 163, 184]] as [RGB, RGB],
  head: [241, 245, 249] as RGB,
  title: [30, 41, 59] as RGB,
  row: [248, 250, 252] as RGB,
};

const BRAND: RGB = [37, 99, 235];
const TEXT: RGB = [15, 23, 42];
const MUTED: RGB = [100, 116, 139];
const BORDER: RGB = [226, 232, 240];

// ---- Public types ----------------------------------------------------------

export type JudoPdfMode = "general" | "compare" | "by-level";

export interface JudoPdfTournament {
  id: string;
  label: string;
  matchDate: string;
  location?: string | null;
  competition?: string | null;
  tournamentLevel?: string | null;
  rounds: JudoRoundStatsRow[];
}

export interface JudoPdfExportArgs {
  categoryId: string;
  /** Athlete UUID, or "all" for a category-wide export */
  playerId: string;
  mode: JudoPdfMode;
  /** Tournaments already filtered by the selected athlete */
  tournaments: JudoPdfTournament[];
}

// ---- Helpers ---------------------------------------------------------------

function drawGradientBar(pdf: jsPDF, x: number, y: number, w: number, h: number, from: RGB, to: RGB) {
  const steps = 60;
  const stepW = w / steps;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const r = Math.round(from[0] + (to[0] - from[0]) * t);
    const g = Math.round(from[1] + (to[1] - from[1]) * t);
    const b = Math.round(from[2] + (to[2] - from[2]) * t);
    pdf.setFillColor(r, g, b);
    pdf.rect(x + i * stepW, y, stepW + 0.3, h, "F");
  }
}

function ensureSpace(pdf: jsPDF, y: number, needed: number, pageH: number, margin: number) {
  if (y + needed > pageH - margin) {
    pdf.addPage();
    return margin;
  }
  return y;
}

function modeLabel(m: JudoPdfMode) {
  return m === "general"
    ? "Statistiques générales"
    : m === "compare"
    ? "Comparaison des tournois"
    : "Positionnement par niveau";
}

function slug(s: string) {
  return (s || "export").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// Try to load an athlete photo (avatar_url may be public or in Supabase storage).
async function loadAvatar(url?: string | null): Promise<string | null> {
  if (!url) return null;
  return loadImageAsDataUrl(url);
}

// ---- Main export -----------------------------------------------------------

export async function exportJudoCompetitionPdf(args: JudoPdfExportArgs): Promise<void> {
  const { categoryId, playerId, mode, tournaments } = args;

  // ---- Fetch context (category + club + player) ----------------------------
  const [{ data: category }, { data: player }] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, club_id, clubs(name, logo_url)")
      .eq("id", categoryId)
      .maybeSingle(),
    playerId && playerId !== "all"
      ? supabase
          .from("players")
          .select("id, name, first_name, avatar_url, discipline, position")
          .eq("id", playerId)
          .maybeSingle()
      : Promise.resolve({ data: null as any }),
  ]);

  const clubName: string = (category as any)?.clubs?.name || "";
  const categoryName: string = (category as any)?.name || "";
  const clubId: string | null = (category as any)?.club_id || null;

  const [logoData, avatarData] = await Promise.all([
    getReportLogoDataUrl({ categoryId, clubId }),
    loadAvatar((player as any)?.avatar_url),
  ]);

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 12;

  // ---- HEADER --------------------------------------------------------------
  drawGradientBar(pdf, 0, 0, pageW, 34, [30, 41, 59], BRAND);

  // logo top-right
  if (logoData) {
    try {
      pdf.addImage(logoData, "PNG", pageW - margin - 22, 5, 22, 22);
    } catch { /* ignore */ }
  }

  // Athlete photo (left) — square rounded
  const photoSize = 22;
  const photoX = margin;
  const photoY = 6;
  if (avatarData) {
    try {
      pdf.addImage(avatarData, "PNG", photoX, photoY, photoSize, photoSize);
      pdf.setDrawColor(255, 255, 255);
      pdf.setLineWidth(0.6);
      pdf.rect(photoX, photoY, photoSize, photoSize, "S");
    } catch { /* ignore */ }
  } else if (player) {
    // avatar placeholder w/ initials
    pdf.setFillColor(255, 255, 255);
    pdf.rect(photoX, photoY, photoSize, photoSize, "F");
    const initials = `${((player as any).first_name || "?")[0]}${((player as any).name || "?")[0]}`.toUpperCase();
    pdf.setTextColor(30, 41, 59);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text(initials, photoX + photoSize / 2, photoY + photoSize / 2 + 3, { align: "center" });
  }

  const infoX = player || avatarData ? margin + photoSize + 5 : margin;

  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  const title = player
    ? `${((player as any).name || "").toUpperCase()} ${(player as any).first_name || ""}`.trim()
    : "Tous les athlètes";
  pdf.text(title, infoX, 14);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9.5);
  const line2Parts: string[] = [];
  const weight = (player as any)?.discipline as string | undefined;
  if (weight) line2Parts.push(weight.replace(/^judo_/i, "").replace(/_/g, " "));
  if (categoryName) line2Parts.push(categoryName);
  if (clubName) line2Parts.push(clubName);
  if (line2Parts.length > 0) {
    pdf.text(line2Parts.join("  ·  "), infoX, 20);
  }

  // Section chip
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setFillColor(255, 255, 255);
  pdf.setTextColor(30, 41, 59);
  const chipLabel = `Judo — ${modeLabel(mode)}`;
  const chipW = pdf.getTextWidth(chipLabel) + 6;
  pdf.roundedRect(infoX, 23.5, chipW, 6, 1.5, 1.5, "F");
  pdf.text(chipLabel, infoX + 3, 27.8);

  // Generation date + tournaments summary
  pdf.setTextColor(226, 232, 240);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text(
    `Généré le ${format(new Date(), "d MMMM yyyy 'à' HH:mm", { locale: fr })}`,
    pageW - margin - 25,
    30,
    { align: "right" },
  );

  let y = 40;

  // ---- Tournaments block ---------------------------------------------------
  if (tournaments.length > 0) {
    pdf.setDrawColor(...BORDER);
    pdf.setFillColor(248, 250, 252);
    pdf.roundedRect(margin, y, pageW - 2 * margin, 12 + Math.min(tournaments.length, 6) * 4.5, 2, 2, "FD");
    pdf.setTextColor(...MUTED);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.text(
      tournaments.length === 1
        ? "TOURNOI"
        : `${tournaments.length} TOURNOIS SÉLECTIONNÉS`,
      margin + 3,
      y + 5,
    );
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...TEXT);
    pdf.setFontSize(8.5);
    const showList = tournaments.slice(0, 6);
    showList.forEach((t, i) => {
      const date = format(new Date(t.matchDate), "d MMM yyyy", { locale: fr });
      const parts = [t.label || t.competition || "Tournoi", date];
      if (t.location) parts.push(t.location);
      parts.push(tournamentLevelLabel(t.tournamentLevel));
      pdf.text(`• ${parts.join(" · ")}`, margin + 3, y + 9 + i * 4.5);
    });
    if (tournaments.length > 6) {
      pdf.setTextColor(...MUTED);
      pdf.text(`+ ${tournaments.length - 6} autre(s)`, margin + 3, y + 9 + 6 * 4.5);
    }
    y += 14 + Math.min(tournaments.length, 6) * 4.5;
  }

  y += 2;

  // ---- Body ---------------------------------------------------------------
  if (mode === "general") {
    y = renderGeneral(pdf, y, pageW, pageH, margin, tournaments);
  } else if (mode === "compare") {
    y = renderCompare(pdf, y, pageW, pageH, margin, tournaments);
  } else {
    y = renderByLevel(pdf, y, pageW, pageH, margin, tournaments);
  }

  // ---- Footer pagination --------------------------------------------------
  const total = pdf.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    pdf.setPage(i);
    pdf.setDrawColor(...BORDER);
    pdf.line(margin, pageH - 8, pageW - margin, pageH - 8);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...MUTED);
    pdf.text("CocoriCoach Club — Judo", margin, pageH - 4);
    pdf.text(`Page ${i} / ${total}`, pageW - margin, pageH - 4, { align: "right" });
  }

  const filename = `judo-${mode}-${slug(title)}-${format(new Date(), "yyyy-MM-dd")}.pdf`;
  pdf.save(filename);
}

// ---- Renderers -------------------------------------------------------------

function renderGeneral(
  pdf: jsPDF,
  yStart: number,
  pageW: number,
  pageH: number,
  margin: number,
  tournaments: JudoPdfTournament[],
): number {
  let y = yStart;
  const allRounds = tournaments.flatMap((t) => t.rounds);
  const summary = summarizeTournamentRounds(allRounds);

  // Headline KPI strip
  const headline: { label: string; value: string; color: RGB }[] = [
    { label: "Combats", value: `${summary.combats}`, color: BRAND },
    { label: "Victoires", value: `${summary.wins}`, color: [16, 185, 129] },
    { label: "Défaites", value: `${summary.losses}`, color: [239, 68, 68] },
    { label: "% Victoires", value: `${summary.winRate}%`, color: BRAND },
    { label: "Golden Score", value: `${summary.goldenScoreCount}`, color: [139, 92, 246] },
  ];
  const kpiW = (pageW - 2 * margin - 4 * 3) / 5;
  const kpiH = 18;
  y = ensureSpace(pdf, y, kpiH + 4, pageH, margin);
  headline.forEach((k, i) => {
    const x = margin + i * (kpiW + 3);
    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(...BORDER);
    pdf.roundedRect(x, y, kpiW, kpiH, 2, 2, "FD");
    // side accent bar
    pdf.setFillColor(...k.color);
    pdf.rect(x, y, 1.6, kpiH, "F");
    pdf.setTextColor(...MUTED);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.text(k.label.toUpperCase(), x + 4, y + 5);
    pdf.setTextColor(...TEXT);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.text(k.value, x + 4, y + 14);
  });
  y += kpiH + 6;

  // Groups (skip "Bilan combats" already covered by KPI strip)
  for (const group of JUDO_METRIC_GROUPS.filter((g) => g.title !== "Bilan combats")) {
    const theme = GROUP_COLORS[group.title] || DEFAULT_GROUP;
    const cols = 3;
    const rows = Math.ceil(group.metrics.length / cols);
    const cardH = 14;
    const gap = 3;
    const totalH = 12 + rows * (cardH + gap);

    y = ensureSpace(pdf, y, totalH + 4, pageH, margin);

    // header
    drawGradientBar(pdf, margin, y, pageW - 2 * margin, 1.4, theme.bar[0], theme.bar[1]);
    pdf.setFillColor(theme.head[0], theme.head[1], theme.head[2]);
    pdf.rect(margin, y + 1.4, pageW - 2 * margin, 8, "F");
    pdf.setTextColor(theme.title[0], theme.title[1], theme.title[2]);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.text(group.title, margin + 3, y + 7);
    y += 12;

    // grid cards
    const cardW = (pageW - 2 * margin - gap * (cols - 1)) / cols;
    group.metrics.forEach((m, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const x = margin + col * (cardW + gap);
      const cy = y + row * (cardH + gap);
      pdf.setFillColor(theme.row[0], theme.row[1], theme.row[2]);
      pdf.setDrawColor(...BORDER);
      pdf.roundedRect(x, cy, cardW, cardH, 1.5, 1.5, "FD");
      pdf.setTextColor(...MUTED);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      pdf.text(m.label, x + 3, cy + 5);
      pdf.setTextColor(...TEXT);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.text(formatMetric(summary[m.key] as number, m.format), x + 3, cy + 11.5);
    });
    y += rows * (cardH + gap) + 3;
  }
  return y;
}

function renderCompare(
  pdf: jsPDF,
  yStart: number,
  pageW: number,
  pageH: number,
  margin: number,
  tournaments: JudoPdfTournament[],
): number {
  let y = yStart;
  const ordered = [...tournaments].sort(
    (a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime(),
  );
  const rows = ordered.map((t) => ({
    id: t.id,
    label: t.label,
    summary: summarizeTournamentRounds(t.rounds),
  }));

  if (rows.length < 2) {
    pdf.setTextColor(...MUTED);
    pdf.setFontSize(10);
    pdf.text("Sélectionne au moins 2 tournois pour la comparaison.", margin, y + 8);
    return y + 16;
  }

  const reference = rows[0];
  pdf.setTextColor(...MUTED);
  pdf.setFontSize(8.5);
  pdf.text(
    `Référence : ${reference.label} — évolution en % vs cette référence`,
    margin,
    y + 4,
  );
  y += 10;

  for (const group of JUDO_METRIC_GROUPS) {
    const theme = GROUP_COLORS[group.title] || DEFAULT_GROUP;
    y = ensureSpace(pdf, y, 20, pageH, margin);
    // Header
    drawGradientBar(pdf, margin, y, pageW - 2 * margin, 1.4, theme.bar[0], theme.bar[1]);
    pdf.setFillColor(theme.head[0], theme.head[1], theme.head[2]);
    pdf.rect(margin, y + 1.4, pageW - 2 * margin, 7, "F");
    pdf.setTextColor(theme.title[0], theme.title[1], theme.title[2]);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.text(group.title, margin + 3, y + 6.5);
    y += 11;

    // Table
    const labelCol = 48;
    const colW = (pageW - 2 * margin - labelCol) / rows.length;
    // head row
    pdf.setFillColor(theme.row[0], theme.row[1], theme.row[2]);
    pdf.rect(margin, y, pageW - 2 * margin, 7, "F");
    pdf.setTextColor(...MUTED);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    pdf.text("STATISTIQUE", margin + 2, y + 4.7);
    rows.forEach((r, i) => {
      const cx = margin + labelCol + i * colW + colW / 2;
      const lbl = truncate(r.label, Math.max(12, Math.floor(colW / 1.8)));
      pdf.text(lbl, cx, y + 4.7, { align: "center" });
      if (i === 0) {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(6.5);
        pdf.text("(référence)", cx, y + 7.4, { align: "center" });
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7);
      }
    });
    y += 9;

    // rows
    for (let ri = 0; ri < group.metrics.length; ri++) {
      const m = group.metrics[ri];
      y = ensureSpace(pdf, y, 7, pageH, margin);
      if (ri % 2 === 1) {
        pdf.setFillColor(249, 250, 251);
        pdf.rect(margin, y - 1, pageW - 2 * margin, 6.5, "F");
      }
      pdf.setTextColor(...TEXT);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.text(m.label, margin + 2, y + 3.5);

      const refVal = reference.summary[m.key] as number;
      rows.forEach((r, i) => {
        const val = r.summary[m.key] as number;
        const cx = margin + labelCol + i * colW + colW / 2;
        pdf.setTextColor(...TEXT);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9);
        pdf.text(formatMetric(val, m.format), cx, y + 3.5, { align: "center" });
        if (i > 0) {
          const delta = computeDelta(val, refVal, m.higherIsBetter);
          if (delta) {
            const color: RGB = delta.better ? [16, 185, 129] : delta.equal ? [148, 163, 184] : [239, 68, 68];
            const arrow = delta.equal ? "=" : delta.better ? "▲" : "▼";
            pdf.setTextColor(...color);
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(7);
            pdf.text(`${arrow} ${delta.text}`, cx + 10, y + 3.5);
          }
        }
      });
      y += 6.5;
    }
    y += 4;
  }
  return y;
}

function renderByLevel(
  pdf: jsPDF,
  yStart: number,
  pageW: number,
  pageH: number,
  margin: number,
  tournaments: JudoPdfTournament[],
): number {
  let y = yStart;
  // Group by tournament_level, ordered local→international
  const order = ["local", "departmental", "regional", "national", "international", "other", "unknown"];
  const map = new Map<string, JudoPdfTournament[]>();
  for (const t of tournaments) {
    const key = t.tournamentLevel || "unknown";
    const list = map.get(key) || [];
    list.push(t);
    map.set(key, list);
  }
  const groups = order
    .filter((lvl) => map.has(lvl))
    .map((lvl) => {
      const list = map.get(lvl)!;
      const rounds = list.flatMap((t) => t.rounds);
      return {
        id: lvl,
        label: lvl === "unknown" ? "Non défini" : tournamentLevelLabel(lvl),
        tournamentsCount: list.length,
        combatsCount: rounds.length,
        summary: summarizeTournamentRounds(rounds),
      };
    });

  if (groups.length === 0) {
    pdf.setTextColor(...MUTED);
    pdf.setFontSize(10);
    pdf.text("Aucun tournoi disponible.", margin, y + 8);
    return y + 16;
  }
  if (groups.length === 1) {
    pdf.setTextColor(...MUTED);
    pdf.setFontSize(10);
    pdf.text(
      `Un seul niveau (${groups[0].label}) enregistré. Renseigne d'autres niveaux pour comparer.`,
      margin,
      y + 8,
    );
    return y + 16;
  }

  const reference = groups[0];
  pdf.setTextColor(...MUTED);
  pdf.setFontSize(8.5);
  pdf.text(
    `Référence : ${reference.label} — évolution lorsque le niveau monte`,
    margin,
    y + 4,
  );
  y += 10;

  // Volume strip
  const stripCols = groups.length;
  const stripW = (pageW - 2 * margin - 3 * (stripCols - 1)) / stripCols;
  const stripH = 16;
  y = ensureSpace(pdf, y, stripH + 4, pageH, margin);
  groups.forEach((g, i) => {
    const x = margin + i * (stripW + 3);
    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(...BORDER);
    pdf.roundedRect(x, y, stripW, stripH, 2, 2, "FD");
    pdf.setFillColor(...BRAND);
    pdf.rect(x, y, 1.6, stripH, "F");
    pdf.setTextColor(...MUTED);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.8);
    pdf.text(g.label.toUpperCase(), x + 4, y + 4.5);
    pdf.setTextColor(...TEXT);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text(`${g.tournamentsCount}`, x + 4, y + 11);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.8);
    pdf.setTextColor(...MUTED);
    pdf.text(`${g.combatsCount} combat(s)`, x + 4, y + 14.5);
  });
  y += stripH + 5;

  // Grouped tables (reuse compare style)
  for (const group of JUDO_METRIC_GROUPS) {
    const theme = GROUP_COLORS[group.title] || DEFAULT_GROUP;
    y = ensureSpace(pdf, y, 20, pageH, margin);
    drawGradientBar(pdf, margin, y, pageW - 2 * margin, 1.4, theme.bar[0], theme.bar[1]);
    pdf.setFillColor(theme.head[0], theme.head[1], theme.head[2]);
    pdf.rect(margin, y + 1.4, pageW - 2 * margin, 7, "F");
    pdf.setTextColor(theme.title[0], theme.title[1], theme.title[2]);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.text(group.title, margin + 3, y + 6.5);
    y += 11;

    const labelCol = 48;
    const colW = (pageW - 2 * margin - labelCol) / groups.length;

    pdf.setFillColor(theme.row[0], theme.row[1], theme.row[2]);
    pdf.rect(margin, y, pageW - 2 * margin, 7, "F");
    pdf.setTextColor(...MUTED);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    pdf.text("STATISTIQUE", margin + 2, y + 4.7);
    groups.forEach((g, i) => {
      const cx = margin + labelCol + i * colW + colW / 2;
      pdf.text(truncate(g.label, Math.max(10, Math.floor(colW / 1.8))), cx, y + 4.7, { align: "center" });
      if (i === 0) {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(6.5);
        pdf.text("(référence)", cx, y + 7.4, { align: "center" });
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7);
      }
    });
    y += 9;

    for (let ri = 0; ri < group.metrics.length; ri++) {
      const m = group.metrics[ri];
      y = ensureSpace(pdf, y, 7, pageH, margin);
      if (ri % 2 === 1) {
        pdf.setFillColor(249, 250, 251);
        pdf.rect(margin, y - 1, pageW - 2 * margin, 6.5, "F");
      }
      pdf.setTextColor(...TEXT);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.text(m.label, margin + 2, y + 3.5);

      const refVal = reference.summary[m.key] as number;
      groups.forEach((g, i) => {
        const val = g.summary[m.key] as number;
        const cx = margin + labelCol + i * colW + colW / 2;
        pdf.setTextColor(...TEXT);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9);
        pdf.text(formatMetric(val, m.format), cx, y + 3.5, { align: "center" });
        if (i > 0) {
          const delta = computeDelta(val, refVal, m.higherIsBetter);
          if (delta) {
            const color: RGB = delta.better ? [16, 185, 129] : delta.equal ? [148, 163, 184] : [239, 68, 68];
            const arrow = delta.equal ? "=" : delta.better ? "▲" : "▼";
            pdf.setTextColor(...color);
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(7);
            pdf.text(`${arrow} ${delta.text}`, cx + 10, y + 3.5);
          }
        }
      });
      y += 6.5;
    }
    y += 4;
  }
  return y;
}

// ---- Utils -----------------------------------------------------------------

function computeDelta(current: number, previous: number, higherIsBetter: boolean) {
  if (previous === 0 && current === 0) return { equal: true, better: false, text: "0%" };
  if (previous === 0) {
    const better = higherIsBetter ? current > 0 : current < 0;
    return { equal: false, better, text: "—" };
  }
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const equal = Math.abs(pct) < 0.5;
  const better = higherIsBetter ? pct > 0 : pct < 0;
  return { equal, better, text: `${pct > 0 ? "+" : ""}${pct.toFixed(0)}%` };
}

function truncate(s: string, n: number) {
  if (!s) return "";
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}
