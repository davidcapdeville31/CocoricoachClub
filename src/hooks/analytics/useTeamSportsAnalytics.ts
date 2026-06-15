import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSeasonRosterFilter } from "@/contexts/SeasonRosterFilterContext";
import { useSeasonFilteredPlayerIds } from "@/hooks/use-season-filtered-players";
import type { MatchEvent } from "@/components/category/matches/live/types";

export interface MatchRow {
  id: string;
  match_date: string;
  match_time: string | null;
  opponent: string;
  is_home: boolean | null;
  location: string | null;
  competition: string | null;
  competition_stage: string | null;
  age_category: string | null;
  score_home: number | null;
  score_away: number | null;
  is_finalized: boolean | null;
  event_type: string | null;
}

export function useCategoryTeamName(categoryId: string) {
  return useQuery({
    queryKey: ["analytics_team_name", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("name, clubs(name)")
        .eq("id", categoryId)
        .maybeSingle();
      if (error) throw error;
      const club = (data as any)?.clubs?.name as string | undefined;
      return club || (data as any)?.name || "Notre équipe";
    },
  });
}

export function useCategoryMatches(categoryId: string) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["analytics_matches", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("id, match_date, match_time, opponent, is_home, location, competition, competition_stage, age_category, score_home, score_away, is_finalized, event_type")
        .eq("category_id", categoryId)
        .eq("is_personal", false)
        .order("match_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MatchRow[];
    },
  });

  useEffect(() => {
    if (!categoryId) return;
    const ch = supabase
      .channel(`analytics_matches:${categoryId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches", filter: `category_id=eq.${categoryId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["analytics_matches", categoryId] });
          // Aussi rafraîchir les events multi-matchs (compare/general)
          qc.invalidateQueries({ queryKey: ["analytics_multi_events"] });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [categoryId, qc]);

  return q;
}

export function useMatchEventsAnalytics(matchId: string | null) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["analytics_match_events", matchId],
    enabled: !!matchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_events" as any)
        .select("*")
        .eq("match_id", matchId!)
        .order("minute", { ascending: true })
        .order("second", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as MatchEvent[];
    },
  });

  useEffect(() => {
    if (!matchId) return;
    const ch = supabase
      .channel(`analytics_events:${matchId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "match_events", filter: `match_id=eq.${matchId}` },
        () => qc.invalidateQueries({ queryKey: ["analytics_match_events", matchId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [matchId, qc]);

  return q;
}

/** Fetches events for a list of matches (used by Compare across multiple matches). */
export function useMultiMatchEvents(matchIds: string[]) {
  const qc = useQueryClient();
  const sortedKey = [...matchIds].sort().join(",");
  const q = useQuery({
    queryKey: ["analytics_multi_events", sortedKey],
    enabled: matchIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_events" as any)
        .select("*")
        .in("match_id", matchIds)
        .order("minute", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as MatchEvent[];
    },
  });

  useEffect(() => {
    if (matchIds.length === 0) return;
    const ch = supabase
      .channel(`analytics_multi_events:${sortedKey}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match_events" },
        (payload: any) => {
          const mid = payload?.new?.match_id ?? payload?.old?.match_id;
          if (mid && matchIds.includes(mid)) {
            qc.invalidateQueries({ queryKey: ["analytics_multi_events", sortedKey] });
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sortedKey, matchIds, qc]);

  return q;
}

export interface PlayerLite {
  id: string;
  first_name: string | null;
  name: string | null;
  position: string | null;
  avatar_url: string | null;
}

export function useCategoryPlayers(categoryId: string) {
  return useQuery({
    queryKey: ["analytics_players", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, first_name, name, position, avatar_url")
        .eq("category_id", categoryId)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PlayerLite[];
    },
  });
}
