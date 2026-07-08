import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchCategoryRosterPlayers } from "@/lib/categoryRoster";

export interface CategoryMember {
  userId: string;
  name: string;
  photoUrl: string | null;
  kind: "player" | "staff";
  playerId?: string;
  role?: string;
}

/**
 * Membres d'une catégorie (staff du club + joueurs du roster avec un compte).
 */
export function useCategoryMembers(categoryId: string | null | undefined) {
  return useQuery({
    queryKey: ["category-members-with-photos", categoryId],
    enabled: !!categoryId,
    queryFn: async (): Promise<CategoryMember[]> => {
      if (!categoryId) return [];

      // Joueurs du roster (direct + rattachés)
      const roster = await fetchCategoryRosterPlayers(categoryId);
      const playerMembers: CategoryMember[] = (roster || [])
        .filter((p: any) => !!p.user_id)
        .map((p: any) => ({
          userId: p.user_id as string,
          name: [p.first_name, p.name].filter(Boolean).join(" ").trim() || "Athlète",
          photoUrl: (p.avatar_url as string) ?? null,
          kind: "player",
          playerId: p.id as string,
        }));

      // Staff : membres du club de cette catégorie
      const { data: category } = await supabase
        .from("categories")
        .select("club_id")
        .eq("id", categoryId)
        .maybeSingle();

      let staffMembers: CategoryMember[] = [];
      if (category?.club_id) {
        const { data: members } = await supabase
          .from("club_members")
          .select("user_id, role")
          .eq("club_id", category.club_id);

        const staffUserIds = (members || []).map((m: any) => m.user_id).filter(Boolean);
        if (staffUserIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, full_name, email")
            .in("id", staffUserIds);

          staffMembers = (members || []).map((m: any) => {
            const prof = profiles?.find((p: any) => p.id === m.user_id);
            const name =
              prof?.full_name?.trim() ||
              prof?.email?.split("@")[0] ||
              "Staff";
            return {
              userId: m.user_id as string,
              name,
              photoUrl: null,
              kind: "staff" as const,
              role: m.role,
            };
          });
        }
      }

      // Merge & dédup par userId (le staff qui est aussi joueur reste comme joueur)
      const map = new Map<string, CategoryMember>();
      playerMembers.forEach((m) => map.set(m.userId, m));
      staffMembers.forEach((m) => {
        if (!map.has(m.userId)) map.set(m.userId, m);
      });

      return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "fr"));
    },
  });
}
