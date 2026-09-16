import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PlayerGroup {
  id: string;
  name: string;
  color: string;
  playerIds: string[];
}

export const PLAYER_GROUP_COLORS = [
  "#6366f1",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#a855f7",
  "#ec4899",
  "#64748b",
];

/** Groupes d'athlètes personnalisables d'une catégorie (toutes disciplines). */
export function usePlayerGroups(categoryId?: string | null) {
  return useQuery<PlayerGroup[]>({
    queryKey: ["player-groups", categoryId],
    enabled: !!categoryId,
    queryFn: async () => {
      const { data: groups, error } = await supabase
        .from("player_groups")
        .select("id, name, color")
        .eq("category_id", categoryId!)
        .order("name");
      if (error) throw error;
      const ids = (groups || []).map((g: any) => g.id);
      if (ids.length === 0) return [];

      const { data: members, error: memberError } = await supabase
        .from("player_group_members")
        .select("group_id, player_id")
        .in("group_id", ids);
      if (memberError) throw memberError;

      return (groups || []).map((g: any) => ({
        id: g.id as string,
        name: g.name as string,
        color: (g.color as string) || PLAYER_GROUP_COLORS[0],
        playerIds: (members || [])
          .filter((m: any) => m.group_id === g.id)
          .map((m: any) => m.player_id as string),
      }));
    },
  });
}

export function usePlayerGroupMutations(categoryId: string) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["player-groups", categoryId] });

  const createGroup = useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Nom du groupe requis");
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("player_groups")
        .insert({
          category_id: categoryId,
          name: trimmed,
          color,
          created_by: userData?.user?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: invalidate,
  });

  const updateGroup = useMutation({
    mutationFn: async ({ id, name, color }: { id: string; name?: string; color?: string }) => {
      const payload: Record<string, unknown> = {};
      if (name !== undefined) {
        const trimmed = name.trim();
        if (!trimmed) throw new Error("Nom du groupe requis");
        payload.name = trimmed;
      }
      if (color !== undefined) payload.color = color;
      const { error } = await supabase.from("player_groups").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteGroup = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("player_groups").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const setMembers = useMutation({
    mutationFn: async ({ groupId, playerIds }: { groupId: string; playerIds: string[] }) => {
      const { data: existing, error: readError } = await supabase
        .from("player_group_members")
        .select("player_id")
        .eq("group_id", groupId);
      if (readError) throw readError;

      const current = (existing || []).map((m: any) => m.player_id as string);
      const toAdd = playerIds.filter((id) => !current.includes(id));
      const toRemove = current.filter((id) => !playerIds.includes(id));

      if (toAdd.length > 0) {
        const { error } = await supabase
          .from("player_group_members")
          .insert(toAdd.map((player_id) => ({ group_id: groupId, player_id })));
        if (error) throw error;
      }
      if (toRemove.length > 0) {
        const { error } = await supabase
          .from("player_group_members")
          .delete()
          .eq("group_id", groupId)
          .in("player_id", toRemove);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });

  return { createGroup, updateGroup, deleteGroup, setMembers };
}
