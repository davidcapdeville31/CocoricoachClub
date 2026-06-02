import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

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
  const hasScopedIds = scopedUserIds.length > 0;
  const nameMap: Record<string, string> = {};

  let directPlayersQuery = supabase
    .from("players_safe")
    .select("id, user_id, first_name, name")
    .eq("category_id", categoryId)
    .not("user_id", "is", null);

  if (hasScopedIds) {
    directPlayersQuery = directPlayersQuery.in("user_id", scopedUserIds);
  }

  const { data: directPlayers } = await directPlayersQuery.order("name");

  const directPlayerIds = new Set<string>();
  directPlayers?.forEach((player) => {
    if (!player.id || !player.user_id || nameMap[player.user_id]) return;
    directPlayerIds.add(player.id);
    const displayName = [player.first_name, player.name].filter(Boolean).join(" ").trim();
    if (displayName) {
      nameMap[player.user_id] = displayName;
    }
  });

  const { data: linkedEntries } = await supabase
    .from("player_categories")
    .select("player_id")
    .eq("category_id", categoryId)
    .eq("status", "accepted");

  const linkedIds = (linkedEntries || [])
    .map((entry) => entry.player_id)
    .filter((playerId): playerId is string => !!playerId && !directPlayerIds.has(playerId));

  if (linkedIds.length > 0) {
    let linkedPlayersQuery = supabase
      .from("players_safe")
      .select("id, user_id, first_name, name")
      .in("id", linkedIds)
      .not("user_id", "is", null);

    if (hasScopedIds) {
      linkedPlayersQuery = linkedPlayersQuery.in("user_id", scopedUserIds);
    }

    const { data: linkedPlayers } = await linkedPlayersQuery.order("name");
    linkedPlayers?.forEach((player) => {
      if (!player.user_id || nameMap[player.user_id]) return;
      const displayName = [player.first_name, player.name].filter(Boolean).join(" ").trim();
      if (displayName) {
        nameMap[player.user_id] = displayName;
      }
    });
  }

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
