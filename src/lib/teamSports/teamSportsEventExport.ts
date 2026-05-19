/**
 * Exports PDF + Excel d'une rencontre sport co (rugby, foot, hand, volley, basket)
 * en se basant sur les `match_events` (même source que l'onglet Général).
 *
 * Modes :
 *   - "team"          : rapport complet de l'équipe (stats globales)
 *   - "all_players"   : un bloc par joueur (rapport individuel pour chacun)
 *   - "single_player" : un seul joueur
 */

import jsPDF from "jspdf";
import ExcelJS from "exceljs";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import {
  computeMatchAnalytics,
  tackleRatio,
  kickRatio,
} from "@/lib/analytics/team-sports/eventAggregator";
import type { TeamStats, PlayerAggStats } from "@/lib/analytics/team-sports/types";
import type { MatchEvent } from "@/components/category/matches/live/types";
import { preparePdfWithSettings, drawPdfHeader, type PdfCustomSettings } from "@/lib/pdfExport";
import { drawPdfRugbyField, drawPdfFieldLegend, svgPctToPdfPos, drawPdfGoalpostArrow } from "@/lib/pdfRugbyField";
import {
  getExcelBranding,
  addBrandedHeader,
  styleDataHeaderRow,
  addZebraRows,
  addFooter,
  downloadWorkbook,
} from "@/lib/excelExport";

export interface ExportMatchInfo {
  id: string;
  match_date: string;
  opponent: string;
  is_home: boolean | null;
  location?: string | null;
  competition?: string | null;
  age_category?: string | null;
  score_home?: number | null;
  score_away?: number | null;
}

export interface ExportPlayerInfo {
  id: string;
  first_name: string | null;
  name: string | null;
  position?: string | null;
  avatar_url?: string | null;
}

export type ExportMode = "team" | "all_players" | "single_player";

interface BaseExportOpts {
  categoryId: string;
  match: ExportMatchInfo;
  events: MatchEvent[];
  players: ExportPlayerInfo[];
  ourTeamName: string;
  mode: ExportMode;
  /** Required when mode === "single_player" */
  playerId?: string;
}

const playerLabel = (p?: ExportPlayerInfo) =>
  !p ? "—" : `${p.first_name ?? ""} ${p.name ?? ""}`.trim() || "Athlète";

const slug = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase().replace(/^-|-$/g, "");

// ----- Image loading (player avatars) -----
async function loadImageBase64(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function imageFormatFromDataUrl(dataUrl: string): "JPEG" | "PNG" | "WEBP" {
  if (dataUrl.startsWith("data:image/png")) return "PNG";
  if (dataUrl.startsWith("data:image/webp")) return "WEBP";
  return "JPEG";
}

// ----- Kick extraction from match_events -----
interface KickWithPos { x: number; y: number; success: boolean; kickType: "conversion" | "penalty" | "drop" }

function extractKicks(events: MatchEvent[], side: "home" | "away"): KickWithPos[] {
  const map: Record<string, "conversion" | "penalty" | "drop"> = {
    conversion: "conversion",
    penalty_kick: "penalty",
    drop: "drop",
  };
  const kicks: KickWithPos[] = [];
  for (const e of events) {
    const kind = map[e.event_type as string];
    if (!kind) continue;
    if (e.team_side !== side) continue;
    const m = (e.metadata || {}) as any;
    const x = typeof m.kickX === "number" ? m.kickX : m.position?.x;
    const y = typeof m.kickY === "number" ? m.kickY : m.position?.y;
    if (typeof x !== "number" || typeof y !== "number") continue;
    kicks.push({ x, y, success: e.outcome === "success", kickType: kind });
  }
  return kicks;
}

const KICK_GROUP_LABELS: Record<string, { label: string; color: [number, number, number] }> = {
  conversion: { label: "Transformations", color: [59, 130, 246] },
  penalty: { label: "Pénalités au pied", color: [249, 115, 22] },
  drop: { label: "Drops", color: [139, 92, 246] },
};

function drawKickMarker(
  pdf: jsPDF,
  cx: number,
  cy: number,
  kickType: "conversion" | "penalty" | "drop",
  success: boolean,
) {
  const fill = success ? [34, 197, 94] : [239, 68, 68];
  const stroke = KICK_GROUP_LABELS[kickType].color;
  pdf.setFillColor(fill[0], fill[1], fill[2]);
  pdf.setDrawColor(stroke[0], stroke[1], stroke[2]);
  pdf.setLineWidth(0.6);
  const r = 2;
  if (kickType === "conversion") {
    pdf.circle(cx, cy, r, "FD");
  } else if (kickType === "penalty") {
    pdf.rect(cx - r, cy - r, r * 2, r * 2, "FD");
  } else {
    // diamond centered at (cx, cy)
    pdf.lines(
      [[r, r], [-r, r], [-r, -r], [r, -r]],
      cx,
      cy - r,
      [1, 1],
      "FD",
      true,
    );
  }
}

function drawKickingMapsSection(
  pdf: jsPDF,
  kicks: KickWithPos[],
  yStart: number,
  drawHeader: () => number,
): number {
  if (kicks.length === 0) return yStart;
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 15;

  // Group totals
  const totals = {
    conversion: { ok: 0, total: 0 },
    penalty: { ok: 0, total: 0 },
    drop: { ok: 0, total: 0 },
  };
  for (const k of kicks) {
    totals[k.kickType].total++;
    if (k.success) totals[k.kickType].ok++;
  }

  // Section title
  let y = ensureSpace(pdf, yStart, 80, drawHeader);
  y = drawSectionTitle(pdf, "Cartographie des coups de pied", [16, 122, 66], y);

  // Recap line
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(71, 85, 105);
  const recap = (Object.keys(KICK_GROUP_LABELS) as Array<keyof typeof KICK_GROUP_LABELS>)
    .map((k) => {
      const t = totals[k as "conversion" | "penalty" | "drop"];
      const pct = t.total ? Math.round((t.ok / t.total) * 100) : 0;
      return `${KICK_GROUP_LABELS[k].label}: ${t.ok}/${t.total}${t.total ? ` (${pct}%)` : ""}`;
    })
    .join("   •   ");
  pdf.text(recap, pageW / 2, y, { align: "center" });
  y += 5;

  // Pitch
  const pitchH = 60;
  if (y + pitchH > pageH - 20) {
    pdf.addPage();
    y = drawHeader();
    y = drawSectionTitle(pdf, "Cartographie des coups de pied", [16, 122, 66], y);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(71, 85, 105);
    pdf.text(recap, pageW / 2, y, { align: "center" });
    y += 5;
  }
  const fb = drawPdfRugbyField(pdf, margin, y, pageW - margin * 2, pitchH, { showLabels: true });

  // Trajectory arrows (drawn first so markers sit on top)
  for (const k of kicks) {
    const { kx, ky } = svgPctToPdfPos(k, fb);
    drawPdfGoalpostArrow(pdf, kx, ky, fb);
  }
  // Markers
  for (const k of kicks) {
    const { kx, ky } = svgPctToPdfPos(k, fb);
    drawKickMarker(pdf, kx, ky, k.kickType, k.success);
  }
  y += pitchH + 3;

  // Marker legend
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.setTextColor(71, 85, 105);
  let lx = margin;
  const legendItems: Array<{ kind: "conversion" | "penalty" | "drop"; label: string }> = [
    { kind: "conversion", label: "Transformation" },
    { kind: "penalty", label: "Pénalité" },
    { kind: "drop", label: "Drop" },
  ];
  legendItems.forEach((it) => {
    drawKickMarker(pdf, lx + 2, y + 1.5, it.kind, true);
    pdf.text(it.label, lx + 6, y + 2.5);
    lx += 6 + pdf.getTextWidth(it.label) + 6;
  });
  // success / fail circles
  pdf.setFillColor(34, 197, 94);
  pdf.circle(lx + 2, y + 1.5, 2, "F");
  pdf.text("Réussi", lx + 6, y + 2.5);
  lx += 6 + pdf.getTextWidth("Réussi") + 6;
  pdf.setFillColor(239, 68, 68);
  pdf.circle(lx + 2, y + 1.5, 2, "F");
  pdf.text("Raté", lx + 6, y + 2.5);
  return y + 6;
}


// =================================================================
// STAT GROUPS — sections affichées dans les rapports
// =================================================================
interface StatRow {
  label: string;
  value: string | number;
  /** Ratio (0-100) optionnel pour colorer la valeur */
  pct?: number | null;
  /** Si true, "moins c'est mieux" */
  reverse?: boolean;
}
interface StatGroup {
  title: string;
  color: [number, number, number]; // RGB for PDF
  accentHex: string; // for Excel
  rows: StatRow[];
}

function buildGroups(s: TeamStats): StatGroup[] {
  const fmt = (n: number) => (Math.round(n * 10) / 10).toString();
  return [
    {
      title: "Score & Attaque",
      color: [16, 185, 129],
      accentHex: "10B981",
      rows: [
        { label: "Points marqués", value: s.points },
        { label: "Essais", value: s.tries },
        {
          label: "Transformations",
          value: `${s.conversionsMade}/${s.conversionsAttempted}`,
          pct: s.conversionsAttempted ? (s.conversionsMade / s.conversionsAttempted) * 100 : null,
        },
        {
          label: "Pénalités (tirs)",
          value: `${s.penaltiesMade}/${s.penaltiesAttempted}`,
          pct: s.penaltiesAttempted ? (s.penaltiesMade / s.penaltiesAttempted) * 100 : null,
        },
        {
          label: "Drops",
          value: `${s.drops}/${s.dropsAttempted}`,
          pct: s.dropsAttempted ? (s.drops / s.dropsAttempted) * 100 : null,
        },
        { label: "Mètres gagnés", value: `${fmt(s.meters)} m` },
        { label: "Franchissements", value: s.lineBreaks },
        { label: "Offloads", value: s.offloads },
        { label: "Portages", value: s.carries },
      ],
    },
    {
      title: "Défense",
      color: [56, 189, 248],
      accentHex: "38BDF8",
      rows: [
        {
          label: "Plaquages réussis",
          value: `${s.tackles}/${s.tackles + s.missedTackles}`,
          pct: tackleRatio(s),
        },
        { label: "Plaquages manqués", value: s.missedTackles, reverse: true },
        { label: "Turnovers gagnés", value: s.turnovers },
      ],
    },
    {
      title: "Conquête & Possession",
      color: [251, 191, 36],
      accentHex: "FBBF24",
      rows: [
        {
          label: "Touches gagnées",
          value: `${s.lineoutsWon}/${s.lineoutsWon + s.lineoutsLost}`,
          pct: s.lineoutsWon + s.lineoutsLost ? (s.lineoutsWon / (s.lineoutsWon + s.lineoutsLost)) * 100 : null,
        },
        {
          label: "Mêlées gagnées",
          value: `${s.scrumsWon}/${s.scrumsWon + s.scrumsLost}`,
          pct: s.scrumsWon + s.scrumsLost ? (s.scrumsWon / (s.scrumsWon + s.scrumsLost)) * 100 : null,
        },
        { label: "Ballons perdus", value: s.ballsLost, reverse: true },
        { label: "Ballons gagnés", value: s.ballsWon },
      ],
    },
    {
      title: "Jeu au pied & Passes",
      color: [168, 85, 247],
      accentHex: "A855F7",
      rows: [
        {
          label: "Passes",
          value: `${s.passes}/${s.passes + s.passesMissed}`,
          pct: s.passes + s.passesMissed ? (s.passes / (s.passes + s.passesMissed)) * 100 : null,
        },
        {
          label: "Coups de pied",
          value: `${s.kicks}/${s.kicks + s.kicksMissed}`,
          pct: s.kicks + s.kicksMissed ? (s.kicks / (s.kicks + s.kicksMissed)) * 100 : null,
        },
      ],
    },
    {
      title: "Discipline",
      color: [244, 63, 94],
      accentHex: "F43F5E",
      rows: [
        { label: "Pénalités concédées", value: s.fouls, reverse: true },
        { label: "En-avants", value: s.knockOns, reverse: true },
        { label: "Cartons jaunes", value: s.yellowCards, reverse: true },
        { label: "Cartons rouges", value: s.redCards, reverse: true },
      ],
    },
  ];
}

function pctColor(pct: number | null | undefined, reverse = false): [number, number, number] {
  if (pct == null) return [100, 116, 139];
  const v = reverse ? 100 - pct : pct;
  if (v >= 75) return [16, 185, 129];
  if (v >= 60) return [100, 116, 139];
  if (v >= 40) return [234, 179, 8];
  return [239, 68, 68];
}

// =================================================================
// PDF EXPORT
// =================================================================
async function loadLogo(categoryId: string) {
  const prep = await preparePdfWithSettings(categoryId);
  return prep;
}

function drawSectionTitle(pdf: jsPDF, title: string, color: [number, number, number], y: number) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  pdf.setFillColor(...color);
  pdf.rect(15, y, 4, 7, "F");
  pdf.setTextColor(30, 41, 59);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text(title, 22, y + 5.5);
  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(0.3);
  pdf.line(22 + pdf.getTextWidth(title) + 4, y + 5, pageWidth - 15, y + 5);
  return y + 11;
}

function drawStatRow(pdf: jsPDF, row: StatRow, x: number, y: number, w: number) {
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9.5);
  pdf.setTextColor(71, 85, 105);
  pdf.text(row.label, x + 3, y + 5);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10.5);
  const [r, g, b] = row.pct != null ? pctColor(row.pct, row.reverse) : [30, 41, 59];
  pdf.setTextColor(r, g, b);
  let valueText = String(row.value);
  if (row.pct != null) valueText += `  (${Math.round(row.pct)}%)`;
  const tw = pdf.getTextWidth(valueText);
  pdf.text(valueText, x + w - 3 - tw, y + 5);

  // Bottom hairline
  pdf.setDrawColor(241, 245, 249);
  pdf.setLineWidth(0.2);
  pdf.line(x + 2, y + 7.5, x + w - 2, y + 7.5);
}

function drawGroupCard(pdf: jsPDF, group: StatGroup, x: number, y: number, w: number): number {
  const rowH = 8;
  const headerH = 11;
  const cardH = headerH + rowH * group.rows.length + 4;

  // Card bg
  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(x, y, w, cardH, 2, 2, "FD");

  // Header strip
  const [r, g, b] = group.color;
  pdf.setFillColor(r, g, b);
  pdf.roundedRect(x, y, w, headerH, 2, 2, "F");
  pdf.setFillColor(r, g, b);
  pdf.rect(x, y + headerH - 2, w, 2, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text(group.title.toUpperCase(), x + 4, y + 7.5);

  let ry = y + headerH + 1;
  for (const row of group.rows) {
    drawStatRow(pdf, row, x, ry, w);
    ry += rowH;
  }
  return y + cardH + 4;
}

function ensureSpace(
  pdf: jsPDF,
  y: number,
  needed: number,
  drawHeader: () => number,
): number {
  const pageH = pdf.internal.pageSize.getHeight();
  if (y + needed > pageH - 15) {
    pdf.addPage();
    return drawHeader();
  }
  return y;
}

function drawScoreBanner(
  pdf: jsPDF,
  match: ExportMatchInfo,
  ourName: string,
  y: number,
  accentColor: [number, number, number],
): number {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 15;
  const w = pageWidth - margin * 2;
  const h = 28;

  pdf.setFillColor(248, 250, 252);
  pdf.setDrawColor(226, 232, 240);
  pdf.roundedRect(margin, y, w, h, 3, 3, "FD");

  const homeName = match.is_home ? ourName : match.opponent;
  const awayName = match.is_home ? match.opponent : ourName;
  const homeScore = match.score_home ?? 0;
  const awayScore = match.score_away ?? 0;

  pdf.setTextColor(100, 116, 139);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text((homeName || "Domicile").toUpperCase(), margin + 6, y + 8);
  pdf.text((awayName || "Extérieur").toUpperCase(), pageWidth - margin - 6 - pdf.getTextWidth((awayName || "Extérieur").toUpperCase()), y + 8);

  pdf.setTextColor(...accentColor);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(24);
  pdf.text(String(homeScore), margin + 6, y + 22);
  const awayText = String(awayScore);
  pdf.text(awayText, pageWidth - margin - 6 - pdf.getTextWidth(awayText), y + 22);

  pdf.setTextColor(100, 116, 139);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  const center = pageWidth / 2;
  pdf.text("VS", center, y + 13, { align: "center" });
  const dateStr = format(new Date(match.match_date), "EEEE d MMMM yyyy", { locale: fr });
  pdf.text(dateStr, center, y + 19, { align: "center" });
  const meta = [match.competition, match.location, match.age_category].filter(Boolean).join(" • ");
  if (meta) pdf.text(meta, center, y + 25, { align: "center" });

  return y + h + 5;
}

function renderTeamPdfSection(
  pdf: jsPDF,
  stats: TeamStats,
  yStart: number,
  drawHeader: () => number,
): number {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 15;
  const colW = (pageWidth - margin * 2 - 6) / 2;
  const groups = buildGroups(stats);

  let y = yStart;
  let col: 0 | 1 = 0;
  let rowYLeft = y;
  let rowYRight = y;

  for (const g of groups) {
    const targetY = col === 0 ? rowYLeft : rowYRight;
    const x = col === 0 ? margin : margin + colW + 6;
    const estH = 11 + 8 * g.rows.length + 8;

    const newY = ensureSpace(pdf, targetY, estH, () => {
      rowYLeft = drawHeader();
      rowYRight = rowYLeft;
      return rowYLeft;
    });
    const actualY = col === 0 ? rowYLeft : rowYRight;
    const finalY = newY > actualY ? newY : actualY;

    const after = drawGroupCard(pdf, g, x, finalY, colW);
    if (col === 0) rowYLeft = after;
    else rowYRight = after;
    col = col === 0 ? 1 : 0;
  }

  return Math.max(rowYLeft, rowYRight);
}

export async function exportTeamSportEventPdf(opts: BaseExportOpts): Promise<void> {
  const { categoryId, match, events, players, ourTeamName, mode, playerId } = opts;
  const prep = await loadLogo(categoryId);
  const settings = prep.settings as PdfCustomSettings | null;
  const logoBase64 = (prep as any).logoBase64 ?? null;
  const clubName = settings?.club_name_override || prep.clubName || ourTeamName;
  const categoryName = prep.categoryName || "";
  const seasonName = prep.seasonName || "";

  const analytics = computeMatchAnalytics(events, "all");
  const us = match.is_home ? analytics.home : analytics.away;

  const headerColor: [number, number, number] = settings?.header_color
    ? (settings.header_color.replace("#", "").match(/.{2}/g) || [])
        .slice(0, 3)
        .map((h) => parseInt(h, 16)) as [number, number, number]
    : [34, 67, 120];

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const matchLabel = `${match.is_home ? "vs" : "@"} ${match.opponent}`;

  const drawHeader = () => {
    const dateStr = format(new Date(match.match_date), "d MMM yyyy", { locale: fr });
    return drawPdfHeader(
      pdf,
      mode === "team" ? "Rapport d'équipe" : "Rapport individuel",
      `${clubName} • ${categoryName} • ${seasonName} — ${matchLabel} (${dateStr})`,
      format(new Date(), "dd/MM/yyyy HH:mm", { locale: fr }),
      settings,
      logoBase64,
    );
  };

  // Our team kicks with positions
  const ourSide: "home" | "away" = match.is_home ? "home" : "away";
  const ourKicks = extractKicks(events, ourSide);

  // ============ TEAM REPORT ============
  if (mode === "team") {
    let y = drawHeader();
    y = drawScoreBanner(pdf, match, ourTeamName, y, headerColor);

    // Kicking cartography (rugby) — placed first as visual recap
    if (ourKicks.length > 0) {
      y = drawKickingMapsSection(pdf, ourKicks, y, drawHeader);
    }

    // Section title
    y = ensureSpace(pdf, y, 30, drawHeader);
    y = drawSectionTitle(pdf, "Statistiques de l'équipe", headerColor, y);
    renderTeamPdfSection(pdf, us, y, drawHeader);

    // Players summary table
    const playerStats = Object.entries(analytics.players)
      .map(([pid, ps]) => ({ player: players.find((p) => p.id === pid), stats: ps }))
      .filter((x) => !!x.player)
      .sort((a, b) => b.stats.points - a.stats.points);

    if (playerStats.length > 0) {
      pdf.addPage();
      let yp = drawHeader();
      yp = drawSectionTitle(pdf, "Contributions individuelles", headerColor, yp);
      drawPlayerSummaryTable(pdf, playerStats, yp, drawHeader);
    }
  }

  // ============ ALL PLAYERS or SINGLE PLAYER ============
  if (mode === "all_players" || mode === "single_player") {
    const playerList: ExportPlayerInfo[] =
      mode === "single_player"
        ? players.filter((p) => p.id === playerId)
        : players.filter((p) => analytics.players[p.id]);

    // Pre-load avatars in parallel
    const avatarEntries = await Promise.all(
      playerList.map(async (p) => [p.id, await loadImageBase64(p.avatar_url)] as const),
    );
    const avatars = new Map(avatarEntries);

    if (playerList.length === 0) {
      // Still render an empty PDF with a message
      let y = drawHeader();
      y = drawScoreBanner(pdf, match, ourTeamName, y, headerColor);
      pdf.setFont("helvetica", "italic");
      pdf.setFontSize(11);
      pdf.setTextColor(100, 116, 139);
      pdf.text("Aucun événement enregistré pour ce joueur.", 15, y + 10);
    } else {
      playerList.forEach((p, idx) => {
        if (idx > 0) pdf.addPage();
        let y = drawHeader();
        y = drawScoreBanner(pdf, match, ourTeamName, y, headerColor);

        // Player banner with photo
        const pageWidth = pdf.internal.pageSize.getWidth();
        const bannerH = 20;
        pdf.setFillColor(...headerColor);
        pdf.roundedRect(15, y, pageWidth - 30, bannerH, 2, 2, "F");

        // Photo (left)
        const photoSize = 16;
        const photoX = 17;
        const photoY = y + 2;
        const avatar = avatars.get(p.id);
        if (avatar) {
          try {
            // White background circle for clean edges
            pdf.setFillColor(255, 255, 255);
            pdf.roundedRect(photoX, photoY, photoSize, photoSize, 2, 2, "F");
            pdf.addImage(
              avatar,
              imageFormatFromDataUrl(avatar),
              photoX + 0.5,
              photoY + 0.5,
              photoSize - 1,
              photoSize - 1,
            );
          } catch {
            // ignore image failures
          }
        } else {
          // Initials fallback
          pdf.setFillColor(255, 255, 255);
          pdf.roundedRect(photoX, photoY, photoSize, photoSize, 2, 2, "F");
          const initials =
            ((p.first_name?.[0] || "") + (p.name?.[0] || "")).toUpperCase() || "?";
          pdf.setTextColor(...headerColor);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(10);
          pdf.text(initials, photoX + photoSize / 2, photoY + photoSize / 2 + 2.5, {
            align: "center",
          });
        }

        const textX = photoX + photoSize + 4;
        pdf.setTextColor(255, 255, 255);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(13);
        pdf.text(playerLabel(p), textX, y + 11);
        if (p.position) {
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(9);
          pdf.text(p.position, textX, y + 16);
        }
        y += bannerH + 5;

        const ps = analytics.players[p.id];
        if (!ps) {
          pdf.setFont("helvetica", "italic");
          pdf.setFontSize(10);
          pdf.setTextColor(100, 116, 139);
          pdf.text("Pas de statistique enregistrée.", 15, y + 6);
          return;
        }

        // KPIs
        const kpis = [
          { label: "Temps de jeu", value: `${Math.round(ps.playTimeMinutes)}'` },
          { label: "Points", value: String(ps.points) },
          { label: "Essais", value: String(ps.tries) },
          { label: "Plaquages", value: `${ps.tackles}/${ps.tackles + ps.missedTackles}` },
        ];
        const kpiW = (pageWidth - 30 - 9) / 4;
        kpis.forEach((k, i) => {
          const x = 15 + i * (kpiW + 3);
          pdf.setFillColor(248, 250, 252);
          pdf.setDrawColor(226, 232, 240);
          pdf.roundedRect(x, y, kpiW, 18, 2, 2, "FD");
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(8);
          pdf.setTextColor(100, 116, 139);
          pdf.text(k.label.toUpperCase(), x + kpiW / 2, y + 6, { align: "center" });
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(14);
          pdf.setTextColor(...headerColor);
          pdf.text(k.value, x + kpiW / 2, y + 14, { align: "center" });
        });
        y += 23;

        renderTeamPdfSection(pdf, ps, y, drawHeader);
      });
    }
  }

  // Page numbers
  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    const pw = pdf.internal.pageSize.getWidth();
    const ph = pdf.internal.pageSize.getHeight();
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(148, 163, 184);
    pdf.text(`${i} / ${pageCount}`, pw - 15, ph - 5, { align: "right" });
    pdf.text("CocoriCoach Club", 15, ph - 5);
  }

  const dateStr = format(new Date(match.match_date), "yyyy-MM-dd");
  const suffix =
    mode === "team"
      ? "equipe"
      : mode === "single_player"
        ? slug(playerLabel(players.find((p) => p.id === playerId)))
        : "tous-les-joueurs";
  pdf.save(`rapport-match-${slug(match.opponent || "match")}-${dateStr}-${suffix}.pdf`);
}

function drawPlayerSummaryTable(
  pdf: jsPDF,
  rows: { player?: ExportPlayerInfo; stats: PlayerAggStats }[],
  yStart: number,
  drawHeader: () => number,
): number {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 15;
  const cols = [
    { key: "name", label: "Joueur", w: 60, align: "left" as const },
    { key: "pos", label: "Poste", w: 28, align: "left" as const },
    { key: "time", label: "Min", w: 14, align: "right" as const },
    { key: "pts", label: "Pts", w: 14, align: "right" as const },
    { key: "tries", label: "Essais", w: 18, align: "right" as const },
    { key: "tackles", label: "Plaq.", w: 20, align: "right" as const },
    { key: "turnovers", label: "Turn.", w: 18, align: "right" as const },
    { key: "lost", label: "Perdus", w: 16, align: "right" as const },
  ];
  const totalW = cols.reduce((s, c) => s + c.w, 0);
  const scale = (pageWidth - margin * 2) / totalW;
  cols.forEach((c) => (c.w *= scale));

  let y = yStart;
  const headerH = 9;
  const rowH = 8;

  const drawTableHeader = (yy: number) => {
    pdf.setFillColor(241, 245, 249);
    pdf.rect(margin, yy, pageWidth - margin * 2, headerH, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(51, 65, 85);
    let cx = margin;
    cols.forEach((c) => {
      const tx = c.align === "right" ? cx + c.w - 2 : cx + 2;
      pdf.text(c.label, tx, yy + 6, { align: c.align === "right" ? "right" : "left" });
      cx += c.w;
    });
    return yy + headerH;
  };

  y = drawTableHeader(y);

  rows.forEach((r, i) => {
    if (y + rowH > pdf.internal.pageSize.getHeight() - 15) {
      pdf.addPage();
      y = drawHeader();
      y = drawTableHeader(y);
    }
    if (i % 2 === 1) {
      pdf.setFillColor(250, 251, 253);
      pdf.rect(margin, y, pageWidth - margin * 2, rowH, "F");
    }
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(30, 41, 59);
    let cx = margin;
    const values: Record<string, string> = {
      name: playerLabel(r.player),
      pos: r.player?.position || "—",
      time: `${Math.round(r.stats.playTimeMinutes)}'`,
      pts: String(r.stats.points),
      tries: String(r.stats.tries),
      tackles: `${r.stats.tackles}/${r.stats.tackles + r.stats.missedTackles}`,
      turnovers: String(r.stats.turnovers),
      lost: String(r.stats.ballsLost),
    };
    cols.forEach((c) => {
      const tx = c.align === "right" ? cx + c.w - 2 : cx + 2;
      pdf.text(values[c.key] || "—", tx, y + 5.5, { align: c.align === "right" ? "right" : "left" });
      cx += c.w;
    });
    y += rowH;
  });
  return y;
}

// =================================================================
// EXCEL EXPORT
// =================================================================
function writeStatGroupToSheet(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  groupTitle: string,
  accentHex: string,
  rows: StatRow[],
): number {
  // Section title
  sheet.mergeCells(startRow, 1, startRow, 3);
  const titleCell = sheet.getCell(startRow, 1);
  titleCell.value = groupTitle;
  titleCell.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${accentHex}` } };
  titleCell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  sheet.getRow(startRow).height = 22;

  // Data header
  const dataHeader = sheet.getRow(startRow + 1);
  dataHeader.getCell(1).value = "Statistique";
  dataHeader.getCell(2).value = "Valeur";
  dataHeader.getCell(3).value = "% réussite";
  dataHeader.font = { bold: true, size: 10, color: { argb: "FF334155" } };
  dataHeader.alignment = { horizontal: "left", vertical: "middle" };
  dataHeader.eachCell((c) => {
    c.border = { bottom: { style: "thin", color: { argb: "FFCBD5E1" } } };
  });

  let r = startRow + 2;
  rows.forEach((row, i) => {
    const xr = sheet.getRow(r);
    xr.getCell(1).value = row.label;
    xr.getCell(2).value = row.value;
    xr.getCell(3).value = row.pct != null ? `${Math.round(row.pct)}%` : "—";
    xr.getCell(1).font = { size: 10 };
    xr.getCell(2).font = { size: 10, bold: true };
    xr.getCell(3).font = { size: 10 };
    if (row.pct != null) {
      const [rr, gg, bb] = pctColor(row.pct, row.reverse);
      const argb = `FF${[rr, gg, bb].map((n) => n.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
      xr.getCell(3).font = { size: 10, bold: true, color: { argb } };
    }
    if (i % 2 === 1) {
      xr.eachCell((c) => {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
      });
    }
    r++;
  });
  return r + 1;
}

export async function exportTeamSportEventExcel(opts: BaseExportOpts): Promise<void> {
  const { categoryId, match, events, players, ourTeamName, mode, playerId } = opts;
  const branding = await getExcelBranding(categoryId);
  const wb = new ExcelJS.Workbook();
  wb.creator = "CocoriCoach Club";
  wb.created = new Date();

  const analytics = computeMatchAnalytics(events, "all");
  const us = match.is_home ? analytics.home : analytics.away;
  const matchLabel = `${match.is_home ? "vs" : "@"} ${match.opponent}`;
  const dateStr = format(new Date(match.match_date), "d MMMM yyyy", { locale: fr });

  const writeMatchInfoSheet = (sheet: ExcelJS.Worksheet, title: string) => {
    sheet.columns = [{ width: 32 }, { width: 26 }, { width: 18 }];
    let row = addBrandedHeader(sheet, title, branding, [
      ["Compétition", matchLabel],
      ["Date", dateStr],
      ["Lieu", match.location || "—"],
      [
        "Score final",
        match.score_home != null && match.score_away != null
          ? `${match.score_home} - ${match.score_away}`
          : "—",
      ],
    ]);
    return row;
  };

  if (mode === "team") {
    const sheet = wb.addWorksheet("Équipe");
    let row = writeMatchInfoSheet(sheet, `Rapport équipe — ${matchLabel}`);
    for (const g of buildGroups(us)) {
      row = writeStatGroupToSheet(sheet, row, g.title, g.accentHex, g.rows);
    }
    // Players summary sheet
    const ps = wb.addWorksheet("Contributions");
    ps.columns = [
      { header: "Joueur", width: 28 },
      { header: "Poste", width: 18 },
      { header: "Min", width: 8 },
      { header: "Pts", width: 8 },
      { header: "Essais", width: 10 },
      { header: "Plaq. réussis", width: 14 },
      { header: "Plaq. ratés", width: 14 },
      { header: "Turnovers", width: 12 },
      { header: "Ballons perdus", width: 16 },
      { header: "Mètres", width: 10 },
      { header: "Pénalités conc.", width: 14 },
    ];
    let r2 = addBrandedHeader(ps, `Contributions individuelles — ${matchLabel}`, branding);
    const headerRow = ps.getRow(r2);
    ps.columns.forEach((c, i) => {
      headerRow.getCell(i + 1).value = (c.header as string) || "";
    });
    styleDataHeaderRow(ps, r2, ps.columns.length, branding.headerColor);
    let cursor = r2 + 1;
    const sorted = Object.entries(analytics.players)
      .map(([pid, st]) => ({ player: players.find((p) => p.id === pid), stats: st }))
      .filter((x) => !!x.player)
      .sort((a, b) => b.stats.points - a.stats.points);
    sorted.forEach((s) => {
      const r = ps.getRow(cursor);
      r.values = [
        playerLabel(s.player),
        s.player?.position || "—",
        Math.round(s.stats.playTimeMinutes),
        s.stats.points,
        s.stats.tries,
        s.stats.tackles,
        s.stats.missedTackles,
        s.stats.turnovers,
        s.stats.ballsLost,
        Math.round(s.stats.meters),
        s.stats.fouls,
      ];
      cursor++;
    });
    addZebraRows(ps, r2 + 1, cursor - 1, ps.columns.length);
    addFooter(ps, cursor, ps.columns.length, branding.footerText);
    addFooter(sheet, row, 3, branding.footerText);
  } else {
    const playerList: ExportPlayerInfo[] =
      mode === "single_player"
        ? players.filter((p) => p.id === playerId)
        : players.filter((p) => analytics.players[p.id]);

    if (playerList.length === 0) {
      const empty = wb.addWorksheet("Aucune donnée");
      empty.getCell("A1").value = "Aucun événement enregistré pour ce joueur sur ce match.";
    }
    playerList.forEach((p) => {
      const ps = analytics.players[p.id];
      const sheetName = playerLabel(p).slice(0, 28).replace(/[\\/*?:[\]]/g, " ");
      const sheet = wb.addWorksheet(sheetName || `Joueur ${p.id.slice(0, 4)}`);
      let row = writeMatchInfoSheet(sheet, `${playerLabel(p)} — ${matchLabel}`);
      if (!ps) {
        sheet.getCell(row, 1).value = "Aucune statistique enregistrée pour ce joueur.";
        return;
      }
      // KPI bar
      sheet.getCell(row, 1).value = "Temps de jeu";
      sheet.getCell(row, 2).value = `${Math.round(ps.playTimeMinutes)} min`;
      sheet.getRow(row).font = { bold: true };
      row++;
      sheet.getCell(row, 1).value = "Poste";
      sheet.getCell(row, 2).value = p.position || "—";
      row += 2;
      for (const g of buildGroups(ps)) {
        row = writeStatGroupToSheet(sheet, row, g.title, g.accentHex, g.rows);
      }
      addFooter(sheet, row, 3, branding.footerText);
    });
  }

  const suffix =
    mode === "team"
      ? "equipe"
      : mode === "single_player"
        ? slug(playerLabel(players.find((p) => p.id === playerId)))
        : "tous-les-joueurs";
  const dateOut = format(new Date(match.match_date), "yyyy-MM-dd");
  await downloadWorkbook(wb, `rapport-match-${slug(match.opponent || "match")}-${dateOut}-${suffix}.xlsx`);
}
