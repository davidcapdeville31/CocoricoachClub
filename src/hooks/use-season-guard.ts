import { useCallback } from "react";
import { toast } from "sonner";
import { useSeasonRosterFilter } from "@/contexts/SeasonRosterFilterContext";
import { useSeasonFilteredPlayerIds } from "@/hooks/use-season-filtered-players";

/**
 * Defense-in-depth guard for mutations.
 *
 * When the "Saison active uniquement" toggle is ON, any attempt to write data
 * for a player NOT in the active-season roster — or for a date OUTSIDE the
 * active-season window — is rejected with a toast.
 *
 * Usage:
 *   const guard = useSeasonGuard(categoryId);
 *   if (!guard.assertPlayer(playerId)) return;
 *   if (!guard.assertDate(formDate)) return;
 *   await mutation.mutateAsync(payload);
 */
export function useSeasonGuard(categoryId: string | null | undefined) {
  const {
    activeSeasonOnly,
    activeSeasonId,
    activeSeasonStart,
    activeSeasonEnd,
    isDateInActiveSeason,
  } = useSeasonRosterFilter();
  const { allowedIds } = useSeasonFilteredPlayerIds(categoryId);

  const isPlayerAllowed = useCallback(
    (playerId: string | null | undefined) => {
      if (!activeSeasonOnly || !activeSeasonId) return true;
      if (!allowedIds) return true;
      if (!playerId) return false;
      return allowedIds.has(playerId);
    },
    [activeSeasonOnly, activeSeasonId, allowedIds]
  );

  const isDateAllowed = useCallback(
    (date: string | Date | null | undefined) => {
      if (!activeSeasonOnly || !activeSeasonId) return true;
      return isDateInActiveSeason(date);
    },
    [activeSeasonOnly, activeSeasonId, isDateInActiveSeason]
  );

  const assertPlayer = useCallback(
    (playerId: string | null | undefined) => {
      if (isPlayerAllowed(playerId)) return true;
      toast.error("Athlète hors saison active", {
        description:
          "Désactivez le filtre « Saison active uniquement » pour modifier les données de cet athlète.",
      });
      return false;
    },
    [isPlayerAllowed]
  );

  const assertDate = useCallback(
    (date: string | Date | null | undefined) => {
      if (isDateAllowed(date)) return true;
      toast.error("Date hors saison active", {
        description: `La date sélectionnée est en dehors de la fenêtre de la saison active${activeSeasonStart && activeSeasonEnd ? ` (${activeSeasonStart} → ${activeSeasonEnd})` : ""}.`,
      });
      return false;
    },
    [isDateAllowed, activeSeasonStart, activeSeasonEnd]
  );

  const assertPlayers = useCallback(
    (ids: Array<string | null | undefined>) => {
      const blocked = ids.filter((id) => !isPlayerAllowed(id));
      if (blocked.length === 0) return true;
      toast.error(
        blocked.length === 1
          ? "Athlète hors saison active"
          : `${blocked.length} athlètes hors saison active`,
        { description: "Désactivez le filtre saison pour les inclure." }
      );
      return false;
    },
    [isPlayerAllowed]
  );

  return {
    /** True when the toggle is ON and a real active season exists. */
    isFiltering: !!activeSeasonOnly && !!activeSeasonId,
    allowedIds,
    isPlayerAllowed,
    isDateAllowed,
    assertPlayer,
    assertPlayers,
    assertDate,
  };
}
