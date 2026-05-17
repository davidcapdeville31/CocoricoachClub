// ============================================================
// Hook scouting : fetch profil complet + autosave debouncée par bloc
// ============================================================
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ScoutingBlockKey =
  | "general_profile"
  | "kumikata_profile"
  | "tokui_waza"
  | "attack_systems"
  | "newaza_profile"
  | "tactical_profile"
  | "physical_profile"
  | "tactical_plan"
  | "video_sequences"
  | "scouting_notes"
  | "danger_level";

export interface ScoutingProfile {
  id: string;
  club_id: string;
  last_name: string;
  first_name: string | null;
  photo_url: string | null;
  gender: string | null;
  weight_category: string | null;
  age_category: string | null;
  birth_year: number | null;
  handedness: string | null;
  country: string | null;
  club_origin: string | null;
  palmares: string | null;
  scouting_notes: string | null;
  danger_level: number | null;
  last_analyzed_at: string | null;
  general_profile: Record<string, any>;
  kumikata_profile: Record<string, any>;
  tokui_waza: any[];
  attack_systems: Record<string, any>;
  newaza_profile: Record<string, any>;
  tactical_profile: Record<string, any>;
  physical_profile: Record<string, any>;
  tactical_plan: Record<string, any>;
  video_sequences: any[];
  // legacy fields
  combat_profile?: number | null;
  style_mask?: number | null;
  ground_standing_pref?: number | null;
}

const DEBOUNCE_MS = 800;

export function useOpponentScouting(opponentId: string | null) {
  const qc = useQueryClient();
  const [localPatch, setLocalPatch] = useState<Partial<ScoutingProfile>>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPatch = useRef<Partial<ScoutingProfile>>({});

  const { data: remote, isLoading } = useQuery({
    queryKey: ["opponent-scouting", opponentId],
    enabled: !!opponentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("opponent_profiles")
        .select("*")
        .eq("id", opponentId!)
        .maybeSingle();
      if (error) throw error;
      return data as ScoutingProfile;
    },
  });

  // Profil consolidé (remote + patches locaux non encore flushés)
  const profile = useMemo<ScoutingProfile | null>(() => {
    if (!remote) return null;
    return { ...remote, ...localPatch } as ScoutingProfile;
  }, [remote, localPatch]);

  // Synchro vers Supabase
  const flush = useCallback(async () => {
    if (!opponentId) return;
    const patch = pendingPatch.current;
    if (Object.keys(patch).length === 0) return;
    pendingPatch.current = {};
    setSaving(true);
    try {
      const { error } = await supabase
        .from("opponent_profiles")
        .update({ ...patch, last_analyzed_at: new Date().toISOString() })
        .eq("id", opponentId);
      if (error) throw error;
      setDirty(false);
      // invalidate list queries
      qc.invalidateQueries({ queryKey: ["opponent-profiles"] });
      qc.invalidateQueries({ queryKey: ["opponent-scouting", opponentId] });
    } catch (e: any) {
      toast.error(e?.message || "Erreur d'enregistrement");
      // re-merge échec : remettre dans pending
      pendingPatch.current = { ...patch, ...pendingPatch.current };
      setDirty(true);
    } finally {
      setSaving(false);
    }
  }, [opponentId, qc]);

  // Patch + planification flush
  const update = useCallback(
    (patch: Partial<ScoutingProfile>) => {
      setLocalPatch((p) => ({ ...p, ...patch }));
      pendingPatch.current = { ...pendingPatch.current, ...patch };
      setDirty(true);
      if (flushTimer.current) clearTimeout(flushTimer.current);
      flushTimer.current = setTimeout(() => {
        void flush();
      }, DEBOUNCE_MS);
    },
    [flush],
  );

  // Flush au démontage
  useEffect(() => {
    return () => {
      if (flushTimer.current) clearTimeout(flushTimer.current);
      void flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset local patch quand on change d'adversaire ou que les données fraîches arrivent
  useEffect(() => {
    setLocalPatch({});
  }, [opponentId, remote?.id]);

  return {
    profile,
    isLoading,
    saving,
    dirty,
    update,
    flush,
  };
}
