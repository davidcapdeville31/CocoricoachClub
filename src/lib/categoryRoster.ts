import { supabase } from "@/integrations/supabase/client";

export interface FetchRosterOptions {
  /** Include archived athletes in the returned list. Default: false. */
  includeArchived?: boolean;
}

export async function fetchCategoryRosterPlayers(
  categoryId: string,
  options: FetchRosterOptions = {},
) {
  const { includeArchived = false } = options;

  const { data: directPlayers, error } = await supabase
    .from("players_safe")
    .select("*")
    .eq("category_id", categoryId)
    .order("name");

  if (error) throw error;

  const { data: linkedEntries, error: linkedError } = await supabase
    .from("player_categories")
    .select("player_id")
    .eq("category_id", categoryId)
    .eq("status", "accepted");

  if (linkedError) throw linkedError;

  const directIds = new Set((directPlayers || []).map((player: any) => player.id));
  const linkedIds = (linkedEntries || [])
    .map((entry: any) => entry.player_id)
    .filter((playerId: string) => !!playerId && !directIds.has(playerId));

  let linkedPlayers: any[] = [];
  if (linkedIds.length > 0) {
    const { data, error: linkedPlayersError } = await supabase
      .from("players_safe")
      .select("*")
      .in("id", linkedIds)
      .order("name");
    if (linkedPlayersError) throw linkedPlayersError;
    linkedPlayers = data || [];
  }

  const all = [
    ...(directPlayers || []),
    ...linkedPlayers.map((player: any) => ({ ...player, _linked: true })),
  ];

  if (includeArchived) return all;
  return all.filter((p: any) => !p.archived_at);
}
