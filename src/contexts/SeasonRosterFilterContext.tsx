import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface SeasonRosterFilterValue {
  activeSeasonOnly: boolean;
  setActiveSeasonOnly: (v: boolean) => void;
  activeSeasonId: string | null;
  activeSeasonName: string | null;
  activeSeasonStart: string | null; // ISO date (yyyy-mm-dd)
  activeSeasonEnd: string | null;   // ISO date (yyyy-mm-dd)
  /** Returns true if the filter should keep this player */
  matches: (player: { season_id?: string | null }) => boolean;
  /** Returns true if the given date string/Date is within the active season window. Always true when filter is OFF. */
  isDateInActiveSeason: (date: string | Date | null | undefined) => boolean;
  /** True only when a club + active season exist; otherwise toggle is hidden */
  available: boolean;
}

const SeasonRosterFilterContext = createContext<SeasonRosterFilterValue>({
  activeSeasonOnly: false,
  setActiveSeasonOnly: () => {},
  activeSeasonId: null,
  activeSeasonName: null,
  activeSeasonStart: null,
  activeSeasonEnd: null,
  matches: () => true,
  isDateInActiveSeason: () => true,
  available: false,
});

interface ProviderProps {
  clubId?: string | null;
  categoryId?: string | null;
  children: ReactNode;
}

export function SeasonRosterFilterProvider({ clubId, categoryId, children }: ProviderProps) {
  const storageKey = categoryId ? `season-roster-filter:${categoryId}` : null;
  // Default ON: only switch to false if the user has explicitly disabled it before.
  const [activeSeasonOnly, setActiveSeasonOnlyState] = useState<boolean>(() => {
    if (typeof window === "undefined" || !storageKey) return true;
    const stored = window.localStorage.getItem(storageKey);
    if (stored === null) return true;
    return stored === "1";
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
        .select("id, name, start_date, end_date")
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
    const start = (activeSeason as any)?.start_date ?? null;
    const end = (activeSeason as any)?.end_date ?? null;
    const startTs = start ? new Date(start + "T00:00:00").getTime() : null;
    const endTs = end ? new Date(end + "T23:59:59").getTime() : null;
    return {
      activeSeasonOnly,
      setActiveSeasonOnly: setActiveSeasonOnlyState,
      activeSeasonId: seasonId,
      activeSeasonName: activeSeason?.name ?? null,
      activeSeasonStart: start,
      activeSeasonEnd: end,
      available: !!seasonId,
      matches: (player) => {
        if (!activeSeasonOnly || !seasonId) return true;
        return player?.season_id === seasonId;
      },
      isDateInActiveSeason: (d) => {
        if (!activeSeasonOnly || !seasonId || startTs === null || endTs === null) return true;
        if (!d) return false;
        const t = d instanceof Date ? d.getTime() : new Date(d as string).getTime();
        if (Number.isNaN(t)) return false;
        return t >= startTs && t <= endTs;
      },
    };
  }, [activeSeasonOnly, activeSeason?.id, activeSeason?.name, (activeSeason as any)?.start_date, (activeSeason as any)?.end_date]);

  return (
    <SeasonRosterFilterContext.Provider value={value}>
      {children}
    </SeasonRosterFilterContext.Provider>
  );
}

export function useSeasonRosterFilter() {
  return useContext(SeasonRosterFilterContext);
}
