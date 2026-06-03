import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { fetchCategoryRosterPlayers } from "@/lib/categoryRoster";

interface ResolveUserDisplayNamesParams {
  categoryId?: string;
  userIds: string[];
  currentUser?: User | null;
}

function getUserMetadataDisplayName(user: User | null | undefined) {
  if (!user) return null;

  const fullName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    [user.user_metadata?.first_name, user.user_metadata?.last_name].filter(Boolean).join(" ").trim();

  if (fullName) return fullName;

  return user.email?.split("@")[0] || null;
}

export async function fetchCategoryRosterUserNames({
  categoryId,
  userIds,
}: {
  categoryId: string;
  userIds?: string[];
}) {
  const scopedUserIds = [...new Set((userIds || []).filter(Boolean))];
  const nameMap: Record<string, string> = {};

  const rosterPlayers = await fetchCategoryRosterPlayers(categoryId);
  rosterPlayers.forEach((player: any) => {
    if (!player?.user_id) return;
    if (scopedUserIds.length > 0 && !scopedUserIds.includes(player.user_id)) return;
    if (nameMap[player.user_id]) return;

    const displayName = [player.first_name, player.name].filter(Boolean).join(" ").trim();
    if (displayName) {
      nameMap[player.user_id] = displayName;
    }
  });

  return nameMap;
}

export async function resolveUserDisplayNames({
  categoryId,
  userIds,
  currentUser,
}: ResolveUserDisplayNamesParams) {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  const nameMap: Record<string, string> = {};

  if (uniqueUserIds.length === 0) {
    return nameMap;
  }

  // In chat/category context, prefer only the athlete name from the current roster.
  if (categoryId) {
    const rosterNameMap = await fetchCategoryRosterUserNames({
      categoryId,
      userIds: uniqueUserIds,
    });
    Object.assign(nameMap, rosterNameMap);
  }

  // Outside a category-specific context, prefer any player record first.
  if (!categoryId) {
    const { data: players } = await supabase
      .from("players")
      .select("user_id, first_name, name")
      .in("user_id", uniqueUserIds)
      .not("user_id", "is", null);

    players?.forEach((player) => {
      if (!player.user_id || nameMap[player.user_id]) return;
      const displayName = [player.first_name, player.name].filter(Boolean).join(" ").trim();
      if (displayName) {
        nameMap[player.user_id] = displayName;
      }
    });
  }

  // Then fall back to staff/profile names for unresolved users.
  const idsForProfiles = uniqueUserIds.filter((id) => !nameMap[id]);
  if (idsForProfiles.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", idsForProfiles);

    profiles?.forEach((profile) => {
      if (nameMap[profile.id]) return;
      if (profile.full_name?.trim()) {
        nameMap[profile.id] = profile.full_name.trim();
        return;
      }
      // 3) Email prefix as last resort instead of generic "Utilisateur".
      if (profile.email?.trim()) {
        nameMap[profile.id] = profile.email.split("@")[0];
      }
    });
  }

  // Current authenticated user fallback via JWT metadata.
  if (currentUser && uniqueUserIds.includes(currentUser.id) && !nameMap[currentUser.id]) {
    const currentUserName = getUserMetadataDisplayName(currentUser);
    if (currentUserName) {
      nameMap[currentUser.id] = currentUserName;
    }
  }

  return nameMap;
}

export function getOrderedDistinctResolvedNames(userIds: string[], nameMap: Record<string, string>) {
  return userIds.reduce<string[]>((names, userId) => {
    const resolvedName = nameMap[userId]?.trim();
    if (!resolvedName || names.includes(resolvedName)) {
      return names;
    }

    names.push(resolvedName);
    return names;
  }, []);
}
