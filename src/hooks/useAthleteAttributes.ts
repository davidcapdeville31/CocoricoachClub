import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

export type AthleteDimension = Database["public"]["Enums"]["athlete_attribute_dimension"];

export interface AthleteAttribute {
  id: string;
  player_id: string;
  dimension: AthleteDimension;
  value: string;
  is_primary: boolean;
  weight: number | null;
  sport_context: string | null;
  valid_from: string | null;
  valid_to: string | null;
  metadata: any;
}

export interface NewAthleteAttribute {
  dimension: AthleteDimension;
  value: string;
  is_primary?: boolean;
  weight?: number | null;
  sport_context?: string | null;
  metadata?: any;
}

/**
 * Liste tous les attributs actifs d'un athlète (toutes dimensions confondues).
 */
export function useAthleteAttributes(playerId?: string | null) {
  return useQuery<AthleteAttribute[]>({
    queryKey: ["athlete_attributes", playerId],
    enabled: !!playerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("athlete_attributes")
        .select("*")
        .eq("player_id", playerId!)
        .order("dimension", { ascending: true })
        .order("is_primary", { ascending: false })
        .order("weight", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as AthleteAttribute[];
    },
  });
}

export function useAddAthleteAttribute(playerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (attr: NewAthleteAttribute) => {
      const { error } = await supabase.from("athlete_attributes").insert({
        player_id: playerId,
        dimension: attr.dimension,
        value: attr.value,
        is_primary: attr.is_primary ?? false,
        weight: attr.weight ?? null,
        sport_context: attr.sport_context ?? null,
        metadata: attr.metadata ?? {},
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Attribut ajouté");
      qc.invalidateQueries({ queryKey: ["athlete_attributes", playerId] });
      qc.invalidateQueries({ queryKey: ["player_tags", playerId] });
    },
    onError: (e: any) => toast.error(e?.message || "Erreur ajout attribut"),
  });
}

export function useUpdateAthleteAttribute(playerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<Pick<AthleteAttribute, "value" | "is_primary" | "weight" | "sport_context" | "metadata">>;
    }) => {
      const { error } = await supabase
        .from("athlete_attributes")
        .update(patch)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["athlete_attributes", playerId] });
      qc.invalidateQueries({ queryKey: ["player_tags", playerId] });
    },
    onError: (e: any) => toast.error(e?.message || "Erreur mise à jour"),
  });
}

export function useDeleteAthleteAttribute(playerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("athlete_attributes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Attribut supprimé");
      qc.invalidateQueries({ queryKey: ["athlete_attributes", playerId] });
      qc.invalidateQueries({ queryKey: ["player_tags", playerId] });
    },
    onError: (e: any) => toast.error(e?.message || "Erreur suppression"),
  });
}

/**
 * Charge la config d'un sport (postes, disciplines, styles autorisés).
 */
export function useSportConfig(sportKey?: string | null) {
  return useQuery({
    queryKey: ["sports_config", sportKey],
    enabled: !!sportKey,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sports_config")
        .select("*")
        .eq("sport_key", sportKey!)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });
}
