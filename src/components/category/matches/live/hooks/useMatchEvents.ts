import { useEffect, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  queueOperation,
  getPendingOperationsByTable,
  removeOperation,
} from "@/lib/offlineQueue";
import type { MatchEvent } from "../types";

const KEY = (matchId: string) => ["match_events", matchId];

const isOnline = () => (typeof navigator === "undefined" ? true : navigator.onLine);

/**
 * Construit une vue fusionnée events Supabase + events en attente locaux pour ce match.
 * Permet d'afficher immédiatement les saisies offline dans la timeline et le scoreboard.
 */
async function loadPendingForMatch(matchId: string): Promise<MatchEvent[]> {
  const ops = await getPendingOperationsByTable("match_events");
  return ops
    .filter((o) => o.operation === "insert" && (o.data as any).match_id === matchId)
    .map((o) => ({ ...(o.data as any), id: o.id, _pendingSync: true } as unknown as MatchEvent));
}

export function useMatchEvents(matchId: string) {
  const qc = useQueryClient();
  const [pendingLocal, setPendingLocal] = useState<MatchEvent[]>([]);

  const refreshPending = useCallback(async () => {
    try {
      setPendingLocal(await loadPendingForMatch(matchId));
    } catch {
      setPendingLocal([]);
    }
  }, [matchId]);

  useEffect(() => { refreshPending(); }, [refreshPending]);

  const query = useQuery({
    queryKey: KEY(matchId),
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("match_events" as any)
          .select("*")
          .eq("match_id", matchId)
          .order("minute", { ascending: true })
          .order("second", { ascending: true })
          .order("created_at", { ascending: true });
        if (error) throw error;
        return (data ?? []) as unknown as MatchEvent[];
      } catch (e) {
        // Offline ou erreur réseau : fallback à une liste vide, l'overlay local prendra le relais.
        return [] as MatchEvent[];
      }
    },
  });

  // Realtime sync (best-effort — n'a pas d'effet quand offline)
  useEffect(() => {
    const ch = supabase
      .channel(`match_events:${matchId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "match_events", filter: `match_id=eq.${matchId}` },
        () => qc.invalidateQueries({ queryKey: KEY(matchId) }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [matchId, qc]);

  // Lorsque la connexion revient, rafraîchir les pending (la sync globale les videra)
  useEffect(() => {
    const onOnline = () => {
      qc.invalidateQueries({ queryKey: KEY(matchId) });
      refreshPending();
    };
    const onSwMessage = (e: MessageEvent) => {
      if (e.data?.type === "SYNC_PENDING_DATA") onOnline();
    };
    window.addEventListener("online", onOnline);
    if ("serviceWorker" in navigator) navigator.serviceWorker.addEventListener("message", onSwMessage);
    return () => {
      window.removeEventListener("online", onOnline);
      if ("serviceWorker" in navigator) navigator.serviceWorker.removeEventListener("message", onSwMessage);
    };
  }, [matchId, qc, refreshPending]);

  const create = useMutation({
    mutationFn: async (payload: Partial<MatchEvent>) => {
      const { data: u } = await supabase.auth.getUser();
      const fullPayload = { ...payload, match_id: matchId, created_by: u.user?.id ?? null };

      // Offline ? → queue immédiatement, pas d'aller-retour réseau
      if (!isOnline()) {
        const localId = await queueOperation("match_events", "insert", fullPayload as any);
        await refreshPending();
        toast.info("Action enregistrée hors-ligne", { duration: 1500 });
        return { ...(fullPayload as any), id: localId, _pendingSync: true } as unknown as MatchEvent;
      }

      try {
        const { data, error } = await supabase
          .from("match_events" as any)
          .insert(fullPayload as any)
          .select()
          .single();
        if (error) throw error;
        return data as unknown as MatchEvent;
      } catch (err: any) {
        // Réseau échoué → fallback queue
        const localId = await queueOperation("match_events", "insert", fullPayload as any);
        await refreshPending();
        toast.info("Réseau indisponible — action enregistrée localement", { duration: 2000 });
        return { ...(fullPayload as any), id: localId, _pendingSync: true } as unknown as MatchEvent;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(matchId) }),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<MatchEvent> }) => {
      const isLocal = String(id).startsWith("local-");
      if (!isOnline() || isLocal) {
        await queueOperation("match_events", "update", { id, ...patch } as any);
        await refreshPending();
        return;
      }
      try {
        const { error } = await supabase.from("match_events" as any).update(patch as any).eq("id", id);
        if (error) throw error;
      } catch {
        await queueOperation("match_events", "update", { id, ...patch } as any);
        await refreshPending();
        toast.info("Modification enregistrée localement");
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(matchId) }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const isLocal = String(id).startsWith("local-");
      if (isLocal) {
        await removeOperation(id);
        await refreshPending();
        return;
      }
      if (!isOnline()) {
        await queueOperation("match_events", "delete", { id } as any);
        await refreshPending();
        return;
      }
      try {
        const { error } = await supabase.from("match_events" as any).delete().eq("id", id);
        if (error) throw error;
      } catch {
        await queueOperation("match_events", "delete", { id } as any);
        await refreshPending();
        toast.info("Suppression enregistrée localement");
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(matchId) }),
    onError: (e: any) => toast.error(e?.message ?? "Erreur de suppression"),
  });

  // Fusion serveur + local pending → ordre par minute/seconde puis insertion locale
  const mergedEvents: MatchEvent[] = (() => {
    const server = (query.data ?? []) as MatchEvent[];
    if (pendingLocal.length === 0) return server;
    const seen = new Set(server.map((e) => e.id));
    const extras = pendingLocal.filter((e) => !seen.has(e.id));
    return [...server, ...extras].sort((a: any, b: any) => {
      const am = (a.minute ?? 0) * 60 + (a.second ?? 0);
      const bm = (b.minute ?? 0) * 60 + (b.second ?? 0);
      return am - bm;
    });
  })();

  return { ...query, events: mergedEvents, create, update, remove };
}
