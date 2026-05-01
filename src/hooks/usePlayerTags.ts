import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PlayerTagsResult {
  tags: Record<string, string | null>;
  flatTags: string[];
}

/**
 * Lit la vue dynamique `player_tags` qui calcule à la volée :
 *  - genre, age_category, sport_principal, position primaire, etc.
 *  - un tableau plat `flat_tags` exploitable pour filtrer barèmes/analytiques
 */
export function usePlayerTags(playerId?: string | null) {
  return useQuery<PlayerTagsResult | null>({
    queryKey: ["player_tags", playerId],
    enabled: !!playerId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_tags")
        .select("tags, flat_tags")
        .eq("player_id", playerId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        tags: (data.tags as Record<string, string | null>) ?? {},
        flatTags: (data.flat_tags as string[]) ?? [],
      };
    },
  });
}

/**
 * Helper pour vérifier la présence d'un tag (`genre:female`, `age:U18`, ...).
 */
export function hasTag(flatTags: string[] | undefined, tag: string): boolean {
  if (!flatTags) return false;
  return flatTags.includes(tag);
}

/**
 * Helper pour récupérer la valeur d'une dimension (ex: `position` → `pilier`).
 */
export function getTagValue(
  flatTags: string[] | undefined,
  dimension: string,
): string | null {
  if (!flatTags) return null;
  const prefix = `${dimension}:`;
  const found = flatTags.find((t) => t.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}
