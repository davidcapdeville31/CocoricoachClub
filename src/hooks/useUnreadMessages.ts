import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";

interface UnreadCounts {
  total: number;
  byConversation: Record<string, number>;
}

const unreadDebug = (label: string, data: Record<string, unknown>) => {
  console.info(`[UNREAD_RT_DEBUG] ${label}`, data);
};

interface UnreadRealtimeEntry {
  channel: ReturnType<typeof supabase.channel>;
  channelName: string;
  refCount: number;
  clearDebounce: () => void;
}

const unreadRealtimeRegistry = new Map<string, UnreadRealtimeEntry>();

const createUnreadChannelName = (categoryId: string, userId: string) => {
  const suffix =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 12);

  return `unread-messages-${categoryId}-${userId}-${suffix}`;
};

const cleanupStaleUnreadChannels = (categoryId: string, userId: string) => {
  const getChannels = supabase.getChannels?.bind(supabase);
  if (!getChannels) return;

  const legacyTopic = `realtime:unread-messages-${categoryId}`;
  const currentUserPrefix = `realtime:unread-messages-${categoryId}-${userId}-`;

  getChannels().forEach((existingChannel) => {
    const topic = (existingChannel as { topic?: string }).topic;
    if (topic === legacyTopic || topic?.startsWith(currentUserPrefix)) {
      void supabase.removeChannel(existingChannel);
    }
  });
};

const subscribeToUnreadMessagesRealtime = ({
  categoryId,
  userId,
  queryClient,
}: {
  categoryId: string;
  userId: string;
  queryClient: QueryClient;
}) => {
  const registryKey = `${categoryId}:${userId}`;
  const existingEntry = unreadRealtimeRegistry.get(registryKey);

  if (existingEntry) {
    existingEntry.refCount += 1;
    unreadDebug("realtime reuse", {
      channel: existingEntry.channelName,
      categoryId,
      userId,
      refCount: existingEntry.refCount,
      queryKey: ["unread-messages", categoryId, userId],
    });

    return () => {
      const currentEntry = unreadRealtimeRegistry.get(registryKey);
      if (!currentEntry) return;

      currentEntry.refCount -= 1;
      unreadDebug("realtime release shared", {
        channel: currentEntry.channelName,
        categoryId,
        userId,
        refCount: currentEntry.refCount,
        queryKey: ["unread-messages", categoryId, userId],
      });

      if (currentEntry.refCount <= 0) {
        currentEntry.clearDebounce();
        unreadRealtimeRegistry.delete(registryKey);
        void supabase.removeChannel(currentEntry.channel);
      }
    };
  }

  cleanupStaleUnreadChannels(categoryId, userId);

  const channelName = createUnreadChannelName(categoryId, userId);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  unreadDebug("realtime subscribe", {
    channel: channelName,
    categoryId,
    userId,
    queryKey: ["unread-messages", categoryId, userId],
  });

  const channel = supabase
    .channel(channelName)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
      },
      async (payload) => {
        const row = payload.new as {
          conversation_id?: string;
          sender_id?: string;
        } | null;
        const queryKey = ["unread-messages", categoryId, userId] as const;
        unreadDebug("realtime INSERT received", {
          categoryId,
          userId,
          conversationId: row?.conversation_id,
          senderId: row?.sender_id,
          queryKey,
        });
        if (!row?.conversation_id || !row.sender_id) return;
        const conversationId = row.conversation_id;

        if (row.sender_id === userId) {
          unreadDebug("realtime INSERT ignored: own message", {
            categoryId,
            userId,
            conversationId,
          });
          return;
        }

        await queryClient.cancelQueries({ queryKey, exact: true });
        const current = queryClient.getQueryData<UnreadCounts>(queryKey);

        unreadDebug("cache before realtime update", {
          categoryId,
          userId,
          conversationId,
          queryKey,
          current,
          byConversation: current?.byConversation,
        });

        if (!current) {
          unreadDebug("realtime INSERT missing cache: validating conversation", {
            categoryId,
            userId,
            conversationId,
            queryKey,
          });

          const { data: conversation } = await supabase
            .from("conversations")
            .select("id")
            .eq("id", conversationId)
            .eq("category_id", categoryId)
            .maybeSingle();

          const { data: participation } = await supabase
            .from("conversation_participants")
            .select("conversation_id")
            .eq("conversation_id", conversationId)
            .eq("user_id", userId)
            .maybeSingle();

          if (!conversation || !participation) {
            unreadDebug("realtime INSERT ignored: missing cache invalid conversation", {
              categoryId,
              userId,
              conversationId,
              queryKey,
            });
            return;
          }

          queryClient.setQueryData<UnreadCounts>(queryKey, (previous) => {
            const safePrevious = previous ?? { total: 0, byConversation: {} };
            const previousConversationCount = safePrevious.byConversation[conversationId] || 0;
            const next: UnreadCounts = {
              total: safePrevious.total + 1,
              byConversation: {
                ...safePrevious.byConversation,
                [conversationId]: previousConversationCount + 1,
              },
            };

            unreadDebug("setQueryData missing cache validated", {
              categoryId,
              userId,
              conversationId,
              queryKey,
              previous: safePrevious,
              next,
            });

            return next;
          });
          return;
        }

        const knownConv = conversationId in current.byConversation;
        if (knownConv) {
          queryClient.setQueryData<UnreadCounts>(queryKey, (previous) => {
            const safePrevious = previous ?? current;
            const next: UnreadCounts = {
              total: safePrevious.total + 1,
              byConversation: {
                ...safePrevious.byConversation,
                [conversationId]: (safePrevious.byConversation[conversationId] || 0) + 1,
              },
            };
            unreadDebug("setQueryData", {
              categoryId,
              userId,
              conversationId,
              queryKey,
              previous: safePrevious,
              previousByConversation: safePrevious.byConversation,
              next,
              nextByConversation: next.byConversation,
            });
            return next;
          });
        } else {
          unreadDebug("realtime INSERT unknown conversation", {
            categoryId,
            userId,
            conversationId,
            knownConversationIds: Object.keys(current.byConversation),
            queryKey,
          });

          const { data: conversation } = await supabase
            .from("conversations")
            .select("id")
            .eq("id", conversationId)
            .eq("category_id", categoryId)
            .maybeSingle();

          const { data: participation } = await supabase
            .from("conversation_participants")
            .select("conversation_id")
            .eq("conversation_id", conversationId)
            .eq("user_id", userId)
            .maybeSingle();

          if (conversation && participation) {
            queryClient.setQueryData<UnreadCounts>(queryKey, (previous) => {
              const safePrevious = previous ?? current;
              const previousConversationCount = safePrevious.byConversation[conversationId] || 0;
              const next: UnreadCounts = {
                total: safePrevious.total + 1,
                byConversation: {
                  ...safePrevious.byConversation,
                  [conversationId]: previousConversationCount + 1,
                },
              };

              unreadDebug("setQueryData unknown conversation validated", {
                categoryId,
                userId,
                conversationId,
                queryKey,
                previous: safePrevious,
                next,
              });

              return next;
            });
            return;
          }

          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            unreadDebug("invalidate debounced", {
              categoryId,
              userId,
              conversationId,
              queryKey,
            });
            queryClient.invalidateQueries({ queryKey });
          }, 2000);
        }
      }
    )
    .subscribe((status) => {
      unreadDebug("realtime status", {
        status,
        channel: channelName,
        categoryId,
        userId,
        queryKey: ["unread-messages", categoryId, userId],
      });
    });

  unreadRealtimeRegistry.set(registryKey, {
    channel,
    channelName,
    refCount: 1,
    clearDebounce: () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
    },
  });

  return () => {
    const currentEntry = unreadRealtimeRegistry.get(registryKey);
    if (!currentEntry) return;

    currentEntry.refCount -= 1;
    unreadDebug("realtime unsubscribe", {
      channel: currentEntry.channelName,
      categoryId,
      userId,
      refCount: currentEntry.refCount,
      queryKey: ["unread-messages", categoryId, userId],
    });

    if (currentEntry.refCount <= 0) {
      currentEntry.clearDebounce();
      unreadRealtimeRegistry.delete(registryKey);
      void supabase.removeChannel(currentEntry.channel);
    }
  };
};

export function useUnreadMessages(categoryId: string) {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();
  const debugKey = ["unread-messages", categoryId, userId] as const;

  useEffect(() => {
    unreadDebug("mounted", {
      categoryId,
      userId: user?.id,
      queryKey: debugKey,
    });

    return () => {
      unreadDebug("unmounted", {
        categoryId,
        userId: user?.id,
        queryKey: debugKey,
      });
    };
  }, [categoryId, user?.id]);

  useEffect(() => {
    if (!user?.id || !categoryId) return;

    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      const eventData = event as {
        type?: string;
        action?: { type?: string };
        query?: {
          queryKey?: readonly unknown[];
          state?: { data?: unknown; dataUpdatedAt?: number };
        };
      };
      const eventKey = eventData.query?.queryKey;
      const isUnreadKey =
        Array.isArray(eventKey) &&
        eventKey.length === debugKey.length &&
        eventKey.every((part, index) => part === debugKey[index]);

      if (!isUnreadKey) return;

      unreadDebug("cache event", {
        eventType: eventData.type,
        actionType: eventData.action?.type,
        queryKey: eventKey,
        data: eventData.query?.state?.data,
        dataUpdatedAt: eventData.query?.state?.dataUpdatedAt,
      });
    });

    return unsubscribe;
  }, [categoryId, user?.id, queryClient]);

  const { data: unreadCounts = { total: 0, byConversation: {} } } = useQuery<UnreadCounts>({
    queryKey: ["unread-messages", categoryId, user?.id],
    queryFn: async () => {
      if (!user || !categoryId) return { total: 0, byConversation: {} };

      const queryKey = ["unread-messages", categoryId, user.id] as const;
      const fetchStartedAt = Date.now() - 1;
      const preserveNewerCache = (computed: UnreadCounts, reason: string): UnreadCounts => {
        const cacheState = queryClient.getQueryState<UnreadCounts>(queryKey);
        const cached = cacheState?.data;

        // Si un INSERT Realtime ou un mark-as-read local a modifié le cache pendant
        // que ce fetch était en vol, ne pas écraser cette valeur plus récente avec
        // un résultat calculé avant/pendant la course réseau.
        if (cached && (cacheState?.dataUpdatedAt ?? 0) > fetchStartedAt) {
          unreadDebug("queryFn preserve newer cache", {
            categoryId,
            userId: user.id,
            queryKey,
            reason,
            fetchStartedAt,
            dataUpdatedAt: cacheState?.dataUpdatedAt,
            computed,
            cached,
          });
          return cached;
        }

        return computed;
      };

      unreadDebug("queryFn start", {
        categoryId,
        userId: user.id,
        queryKey,
      });

      // 1. Fetch conversations IDs for this category (filtered by RLS)
      const { data: convs, error: convErr } = await supabase
        .from("conversations")
        .select("id")
        .eq("category_id", categoryId);
      if (convErr) throw convErr;
      const convIds = (convs || []).map((c) => c.id);
      if (convIds.length === 0) {
        unreadDebug("queryFn result", {
          categoryId,
          userId: user.id,
          convIdsCount: 0,
          total: 0,
          byConversation: {},
        });
        return preserveNewerCache({ total: 0, byConversation: {} }, "no conversations");
      }

      // 2. Fetch this user's participations (last_read_at) for those conversations
      const { data: participations, error: partError } = await supabase
        .from("conversation_participants")
        .select("conversation_id, last_read_at")
        .eq("user_id", user.id)
        .in("conversation_id", convIds);
      if (partError) throw partError;
      if (!participations || participations.length === 0) {
        unreadDebug("queryFn result", {
          categoryId,
          userId: user.id,
          convIdsCount: convIds.length,
          participationsCount: 0,
          total: 0,
          byConversation: {},
        });
        return preserveNewerCache({ total: 0, byConversation: {} }, "no participations");
      }

      // Pré-remplir avec 0 pour TOUTES les conversations connues (participant),
      // afin que le handler Realtime reconnaisse la conversation dès le 1er
      // message reçu, même après un mark-as-read local qui a remis le compteur à 0.
      const byConversation: Record<string, number> = {};
      for (const participation of participations) {
        byConversation[participation.conversation_id] = 0;
      }
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
          byConversation[convId] = unread;
          total += unread;
        })
      );

      unreadDebug("queryFn result", {
        categoryId,
        userId: user.id,
        convIdsCount: convIds.length,
        participationsCount: participations.length,
        total,
        byConversation,
        queryKey,
      });

      return preserveNewerCache({ total, byConversation }, "computed counts");
    },
    enabled: !!user && !!categoryId,
    // Pas de refetchInterval: le channel Realtime ci-dessous met à jour le cache localement.
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });

  // Realtime partagé: une seule souscription par utilisateur/catégorie, même si le badge
  // global et la liste de conversations montent le hook en même temps.
  useEffect(() => {
    if (!userId || !categoryId) return;

    return subscribeToUnreadMessagesRealtime({
      categoryId,
      userId,
      queryClient,
    });
  }, [userId, categoryId, queryClient]);

  return unreadCounts;
}

export async function markConversationAsRead(conversationId: string, userId: string) {
  await supabase
    .from("conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);
}
