import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useRef } from "react";

interface UnreadCounts {
  total: number;
  byConversation: Record<string, number>;
}

export function useUnreadMessages(categoryId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: unreadCounts = { total: 0, byConversation: {} } } = useQuery<UnreadCounts>({
    queryKey: ["unread-messages", categoryId, user?.id],
    queryFn: async () => {
      if (!user || !categoryId) return { total: 0, byConversation: {} };

      // 1. Fetch conversations IDs for this category (filtered by RLS)
      const { data: convs, error: convErr } = await supabase
        .from("conversations")
        .select("id")
        .eq("category_id", categoryId);
      if (convErr) throw convErr;
      const convIds = (convs || []).map((c) => c.id);
      if (convIds.length === 0) return { total: 0, byConversation: {} };

      // 2. Fetch this user's participations (last_read_at) for those conversations
      const { data: participations, error: partError } = await supabase
        .from("conversation_participants")
        .select("conversation_id, last_read_at")
        .eq("user_id", user.id)
        .in("conversation_id", convIds);
      if (partError) throw partError;
      if (!participations || participations.length === 0) {
        return { total: 0, byConversation: {} };
      }

      const byConversation: Record<string, number> = {};
      let total = 0;

      // 3. Count unread per conversation in parallel
      await Promise.all(
        participations.map(async (participation) => {
          const convId = participation.conversation_id;
          const lastRead = participation.last_read_at;

          let query = supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("conversation_id", convId)
            .neq("sender_id", user.id);

          if (lastRead) {
            query = query.gt("created_at", lastRead);
          }

          const { count, error } = await query;
          if (error) return;

          const unread = count || 0;
          if (unread > 0) {
            byConversation[convId] = unread;
            total += unread;
          }
        })
      );

      return { total, byConversation };
    },
    enabled: !!user && !!categoryId,
    // Pas de refetchInterval: le channel Realtime ci-dessous invalide déjà à l'INSERT.
    refetchIntervalInBackground: false,
    staleTime: 30_000,
  });

  // Subscribe to realtime message inserts to invalidate — invalidation debouncée à 2s
  // pour absorber les rafales (envois multiples, salves de notifications, etc.).
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!user || !categoryId) return;

    const channel = supabase
      .channel(`unread-messages-${categoryId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        () => {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ["unread-messages", categoryId, user.id] });
          }, 2000);
        }
      )
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [user, categoryId, queryClient]);

  return unreadCounts;
}

export async function markConversationAsRead(conversationId: string, userId: string) {
  await supabase
    .from("conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);
}
