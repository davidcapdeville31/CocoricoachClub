import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CategoryAttributeRow {
  player_id: string;
  dimension: string;
  value: string;
  is_primary: boolean;
  weight: number | null;
}

/**
 * Charge en une fois tous les athlete_attributes des joueurs d'une catégorie
 * et expose des helpers pour interroger l'identité athlète sans N requêtes.
 *
 * Pourquoi : le moteur "Identité Athlète" autorise les profils multi-rôles
 * (un pilier qui dépanne 2e ligne, un sprinter qui fait du 200m). Tous les
 * filtres "par poste / par discipline" doivent regarder l'ensemble des valeurs
 * d'un joueur, pas seulement le champ legacy `players.position`.
 */
export function useCategoryAttributes(categoryId?: string | null) {
  const { data: playerIds = [] } = useQuery({
    queryKey: ["players_ids_only", categoryId],
    enabled: !!categoryId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id")
        .eq("category_id", categoryId!);
      if (error) throw error;
      return (data || []).map((p) => p.id);
    },
  });

  const { data: attributes = [], isLoading } = useQuery<CategoryAttributeRow[]>({
    queryKey: ["category_athlete_attributes", categoryId, playerIds.length],
    enabled: !!categoryId && playerIds.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("athlete_attributes")
        .select("player_id, dimension, value, is_primary, weight")
        .in("player_id", playerIds);
      if (error) throw error;
      return (data || []) as CategoryAttributeRow[];
    },
  });

  // Index : player_id -> dimension -> Set<value>
  const index = useMemo(() => {
    const map = new Map<string, Map<string, Set<string>>>();
    for (const a of attributes) {
      if (!map.has(a.player_id)) map.set(a.player_id, new Map());
      const dimMap = map.get(a.player_id)!;
      if (!dimMap.has(a.dimension)) dimMap.set(a.dimension, new Set());
      dimMap.get(a.dimension)!.add(a.value);
    }
    return map;
  }, [attributes]);

  // Index inversé : dimension -> value -> Set<player_id>
  const reverseIndex = useMemo(() => {
    const map = new Map<string, Map<string, Set<string>>>();
    for (const a of attributes) {
      if (!map.has(a.dimension)) map.set(a.dimension, new Map());
      const valueMap = map.get(a.dimension)!;
      if (!valueMap.has(a.value)) valueMap.set(a.value, new Set());
      valueMap.get(a.value)!.add(a.player_id);
    }
    return map;
  }, [attributes]);

  const playerHasAttribute = (
    playerId: string,
    dimension: string,
    value: string,
  ): boolean => {
    return !!index.get(playerId)?.get(dimension)?.has(value);
  };

  const getPlayerValues = (playerId: string, dimension: string): string[] => {
    const set = index.get(playerId)?.get(dimension);
    return set ? Array.from(set) : [];
  };

  const getPlayerPrimary = (playerId: string, dimension: string): string | null => {
    const list = attributes.filter(
      (a) => a.player_id === playerId && a.dimension === dimension,
    );
    return list.find((a) => a.is_primary)?.value ?? list[0]?.value ?? null;
  };

  const getPlayersByValue = (dimension: string, value: string): string[] => {
    const set = reverseIndex.get(dimension)?.get(value);
    return set ? Array.from(set) : [];
  };

  return {
    attributes,
    isLoading,
    playerHasAttribute,
    getPlayerValues,
    getPlayerPrimary,
    getPlayersByValue,
  };
}
