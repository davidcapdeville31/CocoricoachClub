import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ComparisonDimension =
  | "position"
  | "discipline"
  | "technical_style"
  
  | "genre"
  | "age_category";

export interface ComparisonGroup {
  /** Clé unique du groupe (ex: "position:pilier") */
  key: string;
  /** Dimension d'origine */
  dimension: ComparisonDimension | string;
  /** Valeur lisible (ex: "pilier", "U18", "female") */
  value: string;
  /** IDs joueurs appartenant à ce groupe (primaire OU secondaire) */
  playerIds: string[];
  /** IDs joueurs avec cette valeur en PRIMAIRE uniquement */
  primaryPlayerIds: string[];
}

type TagsRow = Database["public"]["Views"]["player_tags"]["Row"];

/**
 * Phase 5 — Identité Athlète :
 * Construit dynamiquement des groupes de comparaison à partir des tags d'identité
 * (vue `player_tags`) + attributs détaillés (`athlete_attributes`).
 *
 * Permet aux modules analytics d'agréger / comparer les athlètes par n'importe
 * quelle dimension (poste, discipline, genre, catégorie d'âge, profil...).
 */
export function useComparisonGroups(categoryId?: string | null) {
  // 1) Joueurs de la catégorie
  const { data: players = [] } = useQuery({
    queryKey: ["comparison_players", categoryId],
    enabled: !!categoryId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, name, first_name")
        .eq("category_id", categoryId!);
      if (error) throw error;
      return data || [];
    },
  });

  const playerIds = useMemo(() => players.map((p: any) => p.id), [players]);

  // 2) Tags calculés (genre, age_category, etc.) via vue dynamique
  const { data: tagsRows = [] } = useQuery<TagsRow[]>({
    queryKey: ["comparison_player_tags", categoryId, playerIds.length],
    enabled: playerIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_tags")
        .select("player_id, tags, flat_tags")
        .in("player_id", playerIds);
      if (error) throw error;
      return (data || []) as TagsRow[];
    },
  });

  // 3) Attributs multi-dimensions (postes/disciplines/styles)
  const { data: attributes = [] } = useQuery({
    queryKey: ["comparison_attributes", categoryId, playerIds.length],
    enabled: playerIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("athlete_attributes")
        .select("player_id, dimension, value, is_primary")
        .in("player_id", playerIds);
      if (error) throw error;
      return data || [];
    },
  });

  // 4) Construction des groupes
  const groupsByDimension = useMemo(() => {
    const map = new Map<string, Map<string, ComparisonGroup>>();

    const ensure = (dim: string, value: string): ComparisonGroup => {
      if (!map.has(dim)) map.set(dim, new Map());
      const dimMap = map.get(dim)!;
      const key = `${dim}:${value}`;
      if (!dimMap.has(value)) {
        dimMap.set(value, {
          key,
          dimension: dim,
          value,
          playerIds: [],
          primaryPlayerIds: [],
        });
      }
      return dimMap.get(value)!;
    };

    // Tags scalaires (genre, age_category, sport_principal, ...)
    for (const row of tagsRows) {
      const tags = (row.tags as Record<string, string | null>) ?? {};
      for (const [dim, val] of Object.entries(tags)) {
        if (!val) continue;
        const g = ensure(dim, String(val));
        if (!g.playerIds.includes(row.player_id!)) g.playerIds.push(row.player_id!);
        if (!g.primaryPlayerIds.includes(row.player_id!)) g.primaryPlayerIds.push(row.player_id!);
      }
    }

    // Attributs multi-valeurs (positions, disciplines, styles, profils)
    for (const a of attributes as any[]) {
      const g = ensure(a.dimension, a.value);
      if (!g.playerIds.includes(a.player_id)) g.playerIds.push(a.player_id);
      if (a.is_primary && !g.primaryPlayerIds.includes(a.player_id)) {
        g.primaryPlayerIds.push(a.player_id);
      }
    }

    // Sérialisation finale : Map<dimension, ComparisonGroup[]>
    const out = new Map<string, ComparisonGroup[]>();
    for (const [dim, dimMap] of map.entries()) {
      const arr = Array.from(dimMap.values()).sort(
        (a, b) => b.playerIds.length - a.playerIds.length,
      );
      out.set(dim, arr);
    }
    return out;
  }, [tagsRows, attributes]);

  /** Liste plate de toutes les dimensions disponibles, triées par richesse */
  const availableDimensions = useMemo(() => {
    return Array.from(groupsByDimension.keys()).sort((a, b) => {
      const sa = groupsByDimension.get(a)?.length ?? 0;
      const sb = groupsByDimension.get(b)?.length ?? 0;
      return sb - sa;
    });
  }, [groupsByDimension]);

  /** Récupère tous les groupes pour une dimension donnée */
  const getGroups = (dim: string): ComparisonGroup[] => {
    return groupsByDimension.get(dim) ?? [];
  };

  /**
   * Agrège des valeurs numériques par groupe pour une dimension donnée.
   * Renvoie [{ group, count, avg, min, max }] prêt à brancher sur Recharts.
   */
  const aggregateByDimension = (
    dim: string,
    values: Map<string, number>, // playerId -> valeur
    options: { primaryOnly?: boolean } = {},
  ) => {
    const groups = getGroups(dim);
    return groups
      .map((g) => {
        const ids = options.primaryOnly ? g.primaryPlayerIds : g.playerIds;
        const nums = ids
          .map((id) => values.get(id))
          .filter((v): v is number => typeof v === "number" && !isNaN(v));
        if (nums.length === 0) {
          return { group: g, count: 0, avg: null, min: null, max: null };
        }
        const sum = nums.reduce((a, b) => a + b, 0);
        return {
          group: g,
          count: nums.length,
          avg: Math.round((sum / nums.length) * 100) / 100,
          min: Math.min(...nums),
          max: Math.max(...nums),
        };
      })
      .filter((r) => r.count > 0);
  };

  return {
    players,
    groupsByDimension,
    availableDimensions,
    getGroups,
    aggregateByDimension,
  };
}
