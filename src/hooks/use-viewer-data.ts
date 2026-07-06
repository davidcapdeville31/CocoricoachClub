import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePublicDataContext } from "@/contexts/PublicDataContext";
import { fetchCategoryRosterPlayers } from "@/lib/categoryRoster";
import { useSeasonRosterFilter } from "@/contexts/SeasonRosterFilterContext";

type PublicDataKey = 
  | "players" 
  | "matches" 
  | "sessions" 
  | "todaySessions"
  | "injuries" 
  | "wellness" 
  | "awcr" 
  | "attendance" 
  | "programs"
  | "matchLineups"
  | "category";

interface UseViewerDataOptions<T> {
  queryKey: string[];
  queryFn: () => Promise<T>;
  publicDataKey: PublicDataKey;
  enabled?: boolean;
}

/**
 * Hook that automatically uses public data context when in viewer mode,
 * or fetches directly from Supabase when authenticated.
 */
export function useViewerData<T>({
  queryKey,
  queryFn,
  publicDataKey,
  enabled = true,
}: UseViewerDataOptions<T>): {
  data: T | undefined;
  isLoading: boolean;
  error: Error | null;
} {
  const publicContext = usePublicDataContext();
  const isPublicMode = publicContext.isPublicMode;

  // Direct query for authenticated users
  const directQuery = useQuery({
    queryKey: [...queryKey, "direct"],
    queryFn,
    enabled: enabled && !isPublicMode,
  });

  // In public mode, return data from context
  if (isPublicMode) {
    const publicData = publicContext[publicDataKey];
    return {
      data: publicData as T,
      isLoading: publicContext.isLoading,
      error: publicContext.error ? new Error(publicContext.error) : null,
    };
  }

  return {
    data: directQuery.data,
    isLoading: directQuery.isLoading,
    error: directQuery.error,
  };
}

/**
 * Hook for fetching players that works in both authenticated and viewer modes
 */
export function useViewerPlayers(categoryId: string) {
  const result = useViewerData<any[]>({
    queryKey: ["players", categoryId, "roster"],
    queryFn: async () => fetchCategoryRosterPlayers(categoryId),
    publicDataKey: "players",
    enabled: !!categoryId,
  });
  const { matches, activeSeasonOnly, activeSeasonId } = useSeasonRosterFilter();
  const filtered = useMemo(() => {
    if (!result.data) return result.data;
    if (!activeSeasonOnly || !activeSeasonId) return result.data;
    return result.data.filter((p: any) => matches(p));
  }, [result.data, activeSeasonOnly, activeSeasonId, matches]);
  return { ...result, data: filtered };
}

/**
 * Hook for fetching sessions that works in both authenticated and viewer modes
 */
export function useViewerSessions(categoryId: string) {
  return useViewerData<any[]>({
    queryKey: ["sessions", categoryId],
    queryFn: async () => {
      // 1) Sessions directly attached to this category
      const { data: directSessions, error } = await supabase
        .from("training_sessions")
        .select("*")
        .eq("category_id", categoryId)
        .order("session_date", { ascending: false });
      if (error) throw error;

      // 2) Personal sessions created by athletes who ALSO belong to this
      // category through another structure (multi-category shared profile).
      // We fetch the player ids linked to this category and pull any session
      // they created outside of it, so their calendar stays consistent across
      // every structure they belong to.
      const { data: linkedPlayers } = await supabase
        .from("player_categories")
        .select("player_id")
        .eq("category_id", categoryId);

      const playerIds = (linkedPlayers || [])
        .map((p: any) => p.player_id)
        .filter(Boolean);

      let sharedSessions: any[] = [];
      if (playerIds.length > 0) {
        const { data: shared } = await supabase
          .from("training_sessions")
          .select("*")
          .in("created_by_player_id", playerIds)
          .neq("category_id", categoryId)
          .order("session_date", { ascending: false });
        sharedSessions = shared || [];
      }

      // Merge & de-duplicate by id (single row per session, shown in both structures)
      const map = new Map<string, any>();
      for (const s of [...(directSessions || []), ...sharedSessions]) {
        map.set(s.id, s);
      }
      return Array.from(map.values()).sort((a, b) =>
        (b.session_date || "").localeCompare(a.session_date || ""),
      );
    },
    publicDataKey: "sessions",
    enabled: !!categoryId,
  });
}

/**
 * Hook for fetching matches that works in both authenticated and viewer modes
 */
export function useViewerMatches(categoryId: string) {
  return useViewerData<any[]>({
    queryKey: ["matches", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("*")
        .eq("category_id", categoryId)
        .eq("is_personal", false)
        .order("match_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    publicDataKey: "matches",
    enabled: !!categoryId,
  });
}

/**
 * Hook for fetching injuries that works in both authenticated and viewer modes
 */
export function useViewerInjuries(categoryId: string) {
  return useViewerData<any[]>({
    queryKey: ["injuries", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("injuries")
        .select("*, players(name)")
        .eq("category_id", categoryId);
      if (error) throw error;
      return data || [];
    },
    publicDataKey: "injuries",
    enabled: !!categoryId,
  });
}

/**
 * Hook for fetching wellness data that works in both authenticated and viewer modes
 */
export function useViewerWellness(categoryId: string) {
  return useViewerData<any[]>({
    queryKey: ["wellness", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wellness_tracking")
        .select("*, players(name)")
        .eq("category_id", categoryId)
        .order("wellness_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    publicDataKey: "wellness",
    enabled: !!categoryId,
  });
}

/**
 * Hook for fetching AWCR data that works in both authenticated and viewer modes
 */
export function useViewerAwcr(categoryId: string) {
  return useViewerData<any[]>({
    queryKey: ["awcr", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("awcr_tracking")
        .select("*, players(name)")
        .eq("category_id", categoryId)
        .order("session_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    publicDataKey: "awcr",
    enabled: !!categoryId,
  });
}

/**
 * Hook for fetching attendance data that works in both authenticated and viewer modes
 */
export function useViewerAttendance(categoryId: string) {
  return useViewerData<any[]>({
    queryKey: ["attendance", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_attendance")
        .select("*, players(name), training_sessions(session_date, training_type)")
        .eq("category_id", categoryId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    publicDataKey: "attendance",
    enabled: !!categoryId,
  });
}
