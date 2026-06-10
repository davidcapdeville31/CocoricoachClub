import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface SeasonRosterFilterValue {
  activeSeasonOnly: boolean;
  setActiveSeasonOnly: (v: boolean) => void;
  activeSeasonId: string | null;
  activeSeasonName: string | null;
  /** Returns true if the filter should keep this player */
  matches: (player: { season_id?: string | null }) => boolean;
  /** True only when a club + active season exist; otherwise toggle is hidden */
  available: boolean;
}

const SeasonRosterFilterContext = createContext<SeasonRosterFilterValue>({
  activeSeasonOnly: false,
  setActiveSeasonOnly: () => {},
  activeSeasonId: null,
  activeSeasonName: null,
  matches: () => true,
  available: false,
});

interface ProviderProps {
  clubId?: string | null;
  categoryId?: string | null;
  children: ReactNode;
}

export function SeasonRosterFilterProvider({ clubId, categoryId, children }: ProviderProps) {
  const storageKey = categoryId ? `season-roster-filter:${categoryId}` : null;
  const [activeSeasonOnly, setActiveSeasonOnlyState] = useState<boolean>(() => {
    if (typeof window === "undefined" || !storageKey) return false;
    return window.localStorage.getItem(storageKey) === "1";
  });

  useEffect(() => {
    if (typeof window === "undefined" || !storageKey) return;
    window.localStorage.setItem(storageKey, activeSeasonOnly ? "1" : "0");
  }, [activeSeasonOnly, storageKey]);

  const { data: activeSeason } = useQuery({
    queryKey: ["active-season", clubId],
    queryFn: async () => {
      if (!clubId) return null;
      const { data, error } = await supabase
        .from("seasons")
        .select("id, name")
        .eq("club_id", clubId)
        .eq("is_active", true)
        .maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: !!clubId,
  });

  const value = useMemo<SeasonRosterFilterValue>(() => {
    const seasonId = activeSeason?.id ?? null;
    return {
      activeSeasonOnly,
      setActiveSeasonOnly: setActiveSeasonOnlyState,
      activeSeasonId: seasonId,
      activeSeasonName: activeSeason?.name ?? null,
      available: !!seasonId,
      matches: (player) => {
        if (!activeSeasonOnly || !seasonId) return true;
        return player?.season_id === seasonId;
      },
    };
  }, [activeSeasonOnly, activeSeason?.id, activeSeason?.name]);

  return (
    <SeasonRosterFilterContext.Provider value={value}>
      {children}
    </SeasonRosterFilterContext.Provider>
  );
}

export function useSeasonRosterFilter() {
  return useContext(SeasonRosterFilterContext);
}
