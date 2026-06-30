import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUserIdentity } from "@/hooks/useCurrentUserIdentity";

interface MenuPermissions {
  [menuKey: string]: boolean;
}

/**
 * Maps app_role values to the corresponding column in role_menu_permissions.
 * Club owners are treated as admin.
 */
const ROLE_TO_COLUMN: Record<string, string> = {
  admin: "staff_admin_visible",
  coach: "staff_coach_visible",
  prepa_physique: "staff_prepa_visible",
  doctor: "staff_doctor_visible",
  administratif: "staff_administratif_visible",
  // Legacy roles map to closest match
  physio: "staff_doctor_visible",
  mental_coach: "staff_coach_visible",
  viewer: "player_visible",
};

/**
 * Hook that returns which menus are visible for the current user
 * based on the role_menu_permissions matrix and the user's role.
 *
 * Club owners and super admins see everything.
 *
 * Optimisation: l'identité (super admin, owner, memberships) est lue depuis
 * `useCurrentUserIdentity` (cache partagé 5 min) au lieu de re-requêter
 * super_admin_users / clubs / club_members / category_members à chaque page.
 */
export function useMenuPermissions(clubId?: string, categoryId?: string) {
  const identity = useCurrentUserIdentity();

  const roleLoading = identity.isLoading;
  let userRole: string | null = null;
  if (!roleLoading) {
    if (identity.isSuperAdmin) userRole = "super_admin";
    else if (identity.isClubOwner(clubId)) userRole = "owner";
    else if (clubId && identity.getClubRole(clubId)) userRole = identity.getClubRole(clubId);
    else if (categoryId && identity.getCategoryRole(categoryId)) userRole = identity.getCategoryRole(categoryId);
  }

  // Fetch the permissions matrix
  const { data: permissionsMatrix, isLoading: matrixLoading } = useQuery({
    queryKey: ["role-menu-permissions-matrix"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_menu_permissions")
        .select("*");
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000, // Cache 5 min
  });

  const isLoading = roleLoading || matrixLoading;

  // Build the visibility map
  const menuPermissions: MenuPermissions = {};
  // Viewers (compte invité via lien de consultation) doivent VOIR tous les onglets
  // en lecture seule. Les RLS + ViewerModeContext bloquent toute écriture.
  const isFullAccess =
    userRole === "super_admin" ||
    userRole === "owner" ||
    userRole === "admin" ||
    userRole === "administratif" ||
    userRole === "viewer";

  if (permissionsMatrix) {
    const column = userRole ? ROLE_TO_COLUMN[userRole] : null;

    for (const row of permissionsMatrix) {
      if (isFullAccess) {
        menuPermissions[row.menu_key] = true;
      } else if (column && column in row) {
        menuPermissions[row.menu_key] = (row as any)[column] === true;
      } else {
        menuPermissions[row.menu_key] = false;
      }
    }
  }

  const canSeeMenu = (menuKey: string): boolean => {
    if (isLoading) return true; // Show all while loading to avoid flash
    if (isFullAccess) return true;
    return menuPermissions[menuKey] ?? false;
  };

  return {
    canSeeMenu,
    userRole,
    isFullAccess,
    isLoading,
    menuPermissions,
  };
}
