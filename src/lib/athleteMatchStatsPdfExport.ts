import jsPDF from "jspdf";
import { format, parseISO } from "date-fns";
import { getDateLocale } from "@/lib/i18n/dateLocale";
import { supabase } from "@/integrations/supabase/client";
import { getReportLogoDataUrl } from "@/lib/pdf/clubLogo";
import { getStatsForSport, getStatCategories } from "@/lib/constants/sportStats";

export interface AthleteStatsMatchInfo {
  id: string;
  match_date: string;
  opponent: string | null;
  competition: string | null;
  location: string | null;
}

const NAVY: [number, number, number] = [16, 38, 74];
const RED: [number, number, number] = [245, 47, 59];
const SLATE: [number, number, number] = [71, 85, 105];
const LIGHT: [number, number, number] = [241, 245, 249];

/**
 * Export PDF des statistiques personnelles d'un athlète sur une ou plusieurs
 * compétitions. Ne lit que les lignes player_match_stats de l'athlète
 * (le SELECT est déjà restreint côté droits, le filtre player_id est un garde-fou).
 */
export async function exportAthleteMatchStatsPdf(opts: {
  playerId: string;
  playerName?: string | null;
  categoryId: string;
  sportType: string;
  matches: AthleteStatsMatchInfo[];
}): Promise<void> {
  const { playerId, playerName, categoryId, sportType, matches } = opts;
  if (matches.length === 0) return;

  const matchIds = matches.map((m) => m.id);
  const { data: rows, error } = await supabase
    .from("player_match_stats")
    .select("*")
    .eq("player_id", playerId)
    .in("match_id", matchIds);
  if (error) throw error;

  const statsByMatch = new Map<string, Record<string, unknown>>();
  (rows || []).forEach((r: any) => statsByMatch.set(r.match_id, r));

  const allStats = [
    ...getStatsForSport(sportType, false),
    ...getStatsForSport(sportType, true),
  ];
  const seen = new Set<string>();
  const stats = allStats.filter((s) => (seen.has(s.key) ? false : (seen.add(s.key), true)));
  const categories = getStatCategories(sportType).filter((cat) =>
    stats.some((s) => s.category === cat.key),
  );

  const logo = await getReportLogoDataUrl({ categoryId });

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = 0;

  const drawHeader = (subtitle: string) => {
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, pageW, 26, "F");
    try {
      doc.addImage(logo, "PNG", margin, 4, 18, 18);
    } catch {
      // logo optionnel
    }
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Mes statistiques de compétition", margin + 22, 11);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(subtitle, margin + 22, 18);
    doc.setFillColor(...RED);
    doc.rect(0, 26, pageW, 1.2, "F");
    y = 36;
  };

  const ensureSpace = (needed: number, subtitle: string) => {
    if (y + needed > pageH - 14) {
      doc.addPage();
      drawHeader(subtitle);
    }
  };

  const dateLocale = getDateLocale();
  const subtitleBase = `${playerName || "Athlète"} — généré le ${format(new Date(), "d MMMM yyyy", { locale: dateLocale })}`;

  matches.forEach((match, idx) => {
    const label = match.competition || match.opponent || "Compétition";
    const dateLabel = match.match_date
      ? format(parseISO(match.match_date), "EEEE d MMMM yyyy", { locale: dateLocale })
      : "";
    const subtitle = `${subtitleBase} — ${label}`;

    if (idx === 0) {
      drawHeader(subtitle);
    } else {
      ensureSpace(40, subtitle);
    }

    // Titre du match
    doc.setFillColor(...LIGHT);
    doc.roundedRect(margin, y, pageW - margin * 2, 12, 2, 2, "F");
    doc.setTextColor(...NAVY);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(label, margin + 3, y + 5);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...SLATE);
    const meta = [dateLabel, match.opponent && match.competition ? `vs ${match.opponent}` : null, match.location]
      .filter(Boolean)
      .join("  •  ");
    doc.text(meta, margin + 3, y + 10);
    y += 17;

    const row = statsByMatch.get(match.id);
    const sportData = ((row as any)?.sport_data || {}) as Record<string, number>;

    const valueFor = (key: string): number => {
      const snake = key.replace(/([A-Z])/g, "_$1").toLowerCase();
      const v = sportData[key] ?? (row?.[key] as number | undefined) ?? (row?.[snake] as number | undefined);
      return typeof v === "number" ? v : 0;
    };

    if (!row) {
      doc.setFontSize(9);
      doc.setTextColor(...SLATE);
      doc.setFont("helvetica", "italic");
      doc.text("Aucune statistique enregistrée pour cette compétition.", margin + 3, y + 4);
      y += 12;
      return;
    }

    categories.forEach((cat) => {
      const catStats = stats.filter((s) => s.category === cat.key);
      const filled = catStats
        .map((s) => ({ stat: s, value: valueFor(s.key) }))
        .filter(({ stat, value }) => value !== 0 || stat.computedFrom);
      if (filled.length === 0) return;

      ensureSpace(10 + filled.length * 6, subtitle);

      doc.setFontSize(9.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...NAVY);
      doc.text(cat.label.toUpperCase(), margin + 3, y + 4);
      y += 7;

      filled.forEach(({ stat, value }) => {
        ensureSpace(6, subtitle);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...SLATE);
        doc.text(stat.label, margin + 6, y + 3.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...NAVY);
        const display = stat.computedFrom || stat.type === "percentage" ? `${value} %` : String(value);
        doc.text(display, pageW - margin - 3, y + 3.5, { align: "right" });
        doc.setDrawColor(226, 232, 240);
        doc.line(margin + 6, y + 5, pageW - margin - 3, y + 5);
        y += 6;
      });
      y += 3;
    });

    y += 6;
  });

  // Pied de page
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...SLATE);
    doc.text(
      `CocoriCoach Club — statistiques personnelles — page ${i}/${pages}`,
      pageW / 2,
      pageH - 7,
      { align: "center" },
    );
  }

  const safeName = (playerName || "athlete").replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase();
  doc.save(`statistiques-${safeName}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
}
