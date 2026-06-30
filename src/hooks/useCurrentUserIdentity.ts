import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * useCurrentUserIdentity
 *
 * Hook centralisé qui charge une seule fois (par session, cache partagé
 * via React Query) les informations d'identité/permissions de l'utilisateur :
 *  - statut super admin
 *  - clubs possédés (owner)
 *  - appartenances `club_members` (id + role)
 *  - appartenances `category_members` (id + role)
 *
 * Objectif : éviter que chaque page / hook (useMenuPermissions,
 * ViewerModeContext, ChatWindow, ...) ne refasse les mêmes requêtes.
 *
 * Notes :
 *  - On NE change pas les RLS, on lit simplement les lignes accessibles à l'user.
 *  - staleTime 5 min / gcTime 30 min pour partager le cache largement.
 *  - Helpers `getClubRole` / `getCategoryRole` pour remplacer les `.maybeSingle()`
 *    dispersés dans le code.
 */

export interface ClubMembershipLite {
  club_id: string;
  role: string;
}

export interface CategoryMembershipLite {
  category_id: string;
  role: string;
}

export interface CurrentUserIdentity {
  userId: string | null;
  isSuperAdmin: boolean;
  ownedClubIds: string[];
  clubMemberships: ClubMembershipLite[];
  categoryMemberships: CategoryMembershipLite[];
  getClubRole: (clubId?: string | null) => string | null;
  getCategoryRole: (categoryId?: string | null) => string | null;
  isClubOwner: (clubId?: string | null) => boolean;
}

const EMPTY_IDENTITY: Omit<CurrentUserIdentity, "getClubRole" | "getCategoryRole" | "isClubOwner"> = {
  userId: null,
  isSuperAdmin: false,
  ownedClubIds: [],
  clubMemberships: [],
  categoryMemberships: [],
};

export function useCurrentUserIdentity() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["current-user-identity", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async (): Promise<typeof EMPTY_IDENTITY> => {
      if (!user?.id) return EMPTY_IDENTITY;

      const [superAdminRes, ownedClubsRes, clubMembersRes, categoryMembersRes] =
        await Promise.all([
          supabase
            .from("super_admin_users")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase.from("clubs").select("id").eq("user_id", user.id),
          supabase
            .from("club_members")
            .select("club_id, role")
            .eq("user_id", user.id),
          supabase
            .from("category_members")
            .select("category_id, role")
            .eq("user_id", user.id),
        ]);

      return {
        userId: user.id,
        isSuperAdmin: !!superAdminRes.data,
        ownedClubIds: (ownedClubsRes.data ?? []).map((c: any) => c.id),
        clubMemberships: (clubMembersRes.data ?? []) as ClubMembershipLite[],
        categoryMemberships: (categoryMembersRes.data ?? []) as CategoryMembershipLite[],
      };
    },
  });

  const data = query.data ?? EMPTY_IDENTITY;

  const identity: CurrentUserIdentity = {
    ...data,
    userId: user?.id ?? null,
    isClubOwner: (clubId) => !!clubId && data.ownedClubIds.includes(clubId),
    getClubRole: (clubId) =>
      clubId
        ? data.clubMemberships.find((m) => m.club_id === clubId)?.role ?? null
        : null,
    getCategoryRole: (categoryId) =>
      categoryId
        ? data.categoryMemberships.find((m) => m.category_id === categoryId)?.role ??
          null
        : null,
  };

  return {
    ...identity,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
}
