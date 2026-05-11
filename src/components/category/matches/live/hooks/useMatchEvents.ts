import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { MatchEvent } from "../types";

const KEY = (matchId: string) => ["match_events", matchId];

export function useMatchEvents(matchId: string) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: KEY(matchId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_events" as any)
        .select("*")
        .eq("match_id", matchId)
        .order("minute", { ascending: true })
        .order("second", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as MatchEvent[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`match_events:${matchId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "match_events", filter: `match_id=eq.${matchId}` },
        () => qc.invalidateQueries({ queryKey: KEY(matchId) }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [matchId, qc]);

  const create = useMutation({
    mutationFn: async (payload: Partial<MatchEvent>) => {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("match_events" as any)
        .insert({ ...payload, match_id: matchId, created_by: u.user?.id ?? null } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as MatchEvent;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(matchId) }),
    onError: (e: any) => toast.error(e?.message ?? "Erreur lors de l'ajout"),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<MatchEvent> }) => {
      const { error } = await supabase.from("match_events" as any).update(patch as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(matchId) }),
    onError: (e: any) => toast.error(e?.message ?? "Erreur de mise à jour"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("match_events" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(matchId) }),
    onError: (e: any) => toast.error(e?.message ?? "Erreur de suppression"),
  });

  return { ...query, events: query.data ?? [], create, update, remove };
}
