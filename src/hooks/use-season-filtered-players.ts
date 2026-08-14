import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSeasonRosterFilter } from "@/contexts/SeasonRosterFilterContext";
import { fetchCategoryRosterPlayers } from "@/lib/categoryRoster";

/**
 * Returns the set of player ids in `categoryId` that match the current
 * "active season only" toggle. When the filter is OFF (or no active season),
 * `allowedIds` is `null` meaning "no filtering, keep everything".
 */
export function useSeasonFilteredPlayerIds(categoryId: string | undefined | null) {
  const { activeSeasonOnly, activeSeasonId } = useSeasonRosterFilter();
  const enabled = !!categoryId && activeSeasonOnly && !!activeSeasonId;

  const { data } = useQuery({
    queryKey: ["season-filtered-player-ids", categoryId, activeSeasonId],
    queryFn: async () => {
      const players = await fetchCategoryRosterPlayers(categoryId as string);
      return players
        .filter((p: any) => p.season_id === activeSeasonId)
        .map((p: any) => p.id as string);
    },
    enabled,
  });

  return useMemo(() => {
    // While the roster is still loading, do not filter anything out:
    // an empty set would hide every record and look like "no data".
    if (!enabled || data === undefined) {
      return { allowedIds: null as Set<string> | null, isFiltering: false };
    }
    return { allowedIds: new Set<string>(data), isFiltering: true };
  }, [enabled, data]);
}

/** Convenience predicate that always lets records through when not filtering. */
export function makePlayerIdFilter(allowedIds: Set<string> | null) {
  return (playerId: string | null | undefined) => {
    if (!allowedIds) return true;
    if (!playerId) return false;
    return allowedIds.has(playerId);
  };
}
