import { supabase } from "@/integrations/supabase/client";

/** Ordre de composition : 1 → 15 (ou numéros titulaires), puis remplaçants 16 → 23. */
export function lineupNumberOrder(pos: unknown): number {
  if (pos == null) return 999;
  const s = String(pos).trim();
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  const sub = s.match(/^SUB\s*(\d+)$/i);
  if (sub) return 100 + parseInt(sub[1], 10);
  return 500;
}

export function compareLineup(
  a: { position?: unknown; is_starter?: boolean | null; players?: any },
  b: { position?: unknown; is_starter?: boolean | null; players?: any },
): number {
  const d = lineupNumberOrder(a.position) - lineupNumberOrder(b.position);
  if (d !== 0) return d;
  if (!!a.is_starter !== !!b.is_starter) return a.is_starter ? -1 : 1;
  const na = `${a.players?.name ?? ""} ${a.players?.first_name ?? ""}`;
  const nb = `${b.players?.name ?? ""} ${b.players?.first_name ?? ""}`;
  return na.localeCompare(nb, "fr");
}

/**
 * Enregistre le temps de jeu de chaque athlète d'une compétition et recalcule
 * la charge du match (RPE × minutes jouées).
 * - Si un RPE existe déjà pour ce match (saisi par l'athlète ou le staff), on
 *   recalcule sa charge avec le nouveau temps de jeu.
 * - Sinon, on crée une charge estimée avec le RPE prévu de la catégorie
 *   (marquée auto-remplie, remplacée dès que l'athlète saisit son RPE réel).
 * Un temps de jeu à 0 n'injecte aucune charge.
 */
export async function saveMatchPlayingTime(params: {
  matchId: string;
  categoryId: string;
  minutesByPlayer: Record<string, number>;
}) {
  const { matchId, categoryId, minutesByPlayer } = params;
  const entries = Object.entries(minutesByPlayer).map(([id, m]) => [id, Math.max(0, Math.round(Number(m) || 0))] as const);
  if (entries.length === 0) return;

  const [{ data: match }, { data: category }] = await Promise.all([
    supabase.from("matches").select("match_date").eq("id", matchId).maybeSingle(),
    supabase.from("categories").select("competition_planned_rpe").eq("id", categoryId).maybeSingle(),
  ]);
  const matchDate = (match as any)?.match_date?.split("T")[0];
  const plannedRpe = Number((category as any)?.competition_planned_rpe) || 8;

  for (const [playerId, minutes] of entries) {
    const { error } = await supabase
      .from("match_lineups")
      .update({ minutes_played: minutes })
      .eq("match_id", matchId)
      .eq("player_id", playerId);
    if (error) throw error;
  }

  if (!matchDate) return;
  const playerIds = entries.map(([id]) => id);
  const { data: rows, error: rowsErr } = await supabase
    .from("awcr_tracking")
    .select("id, player_id, rpe")
    .eq("category_id", categoryId)
    .eq("session_date", matchDate)
    .is("training_session_id", null)
    .in("player_id", playerIds);
  if (rowsErr) throw rowsErr;
  const byPlayer = new Map<string, { id: string; rpe: number | null }>();
  (rows ?? []).forEach((r: any) => { if (!byPlayer.has(r.player_id)) byPlayer.set(r.player_id, r); });

  const inserts: any[] = [];
  for (const [playerId, minutes] of entries) {
    const row = byPlayer.get(playerId);
    if (row) {
      const rpe = Number(row.rpe) || 0;
      await supabase
        .from("awcr_tracking")
        .update({ duration_minutes: minutes, training_load: rpe * minutes })
        .eq("id", row.id);
    } else if (minutes > 0) {
      inserts.push({
        player_id: playerId,
        category_id: categoryId,
        session_date: matchDate,
        rpe: plannedRpe,
        duration_minutes: minutes,
        training_load: plannedRpe * minutes,
        auto_filled: true,
      });
    }
  }
  if (inserts.length > 0) {
    const { error } = await supabase.from("awcr_tracking").insert(inserts);
    if (error) throw error;
  }
}
