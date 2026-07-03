import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useRef } from "react";

interface UnreadCounts {
  total: number;
  byConversation: Record<string, number>;
}

const unreadDebug = (label: string, data: Record<string, unknown>) => {
  console.info(`[UNREAD_RT_DEBUG] ${label}`, data);
};

export function useUnreadMessages(categoryId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const debugKey = ["unread-messages", categoryId, user?.id] as const;

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

      unreadDebug("queryFn start", {
        categoryId,
        userId: user.id,
        queryKey: ["unread-messages", categoryId, user.id],
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
        return { total: 0, byConversation: {} };
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
        return { total: 0, byConversation: {} };
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
        queryKey: ["unread-messages", categoryId, user.id],
      });

      return { total, byConversation };
    },
    enabled: !!user && !!categoryId,
    // Pas de refetchInterval: le channel Realtime ci-dessous met à jour le cache localement.
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });

  // Realtime: incrémente localement le compteur de la conversation concernée
  // au lieu de refetch N conversations. Filet de sécurité: debounce d'invalidation
  // uniquement si le message concerne une conversation inconnue du cache local.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!user || !categoryId) return;

    unreadDebug("realtime subscribe", {
      channel: `unread-messages-${categoryId}`,
      categoryId,
      userId: user.id,
      queryKey: ["unread-messages", categoryId, user.id],
    });

    const channel = supabase
      .channel(`unread-messages-${categoryId}`)
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
          unreadDebug("realtime INSERT received", {
            categoryId,
            userId: user.id,
            conversationId: row?.conversation_id,
            senderId: row?.sender_id,
            queryKey: ["unread-messages", categoryId, user.id],
          });
          if (!row?.conversation_id || !row.sender_id) return;
          // Ignorer ses propres messages
          if (row.sender_id === user.id) {
            unreadDebug("realtime INSERT ignored: own message", {
              categoryId,
              userId: user.id,
              conversationId: row.conversation_id,
            });
            return;
          }

          const current = queryClient.getQueryData<UnreadCounts>([
            "unread-messages",
            categoryId,
            user.id,
          ]);

          unreadDebug("cache before realtime update", {
            categoryId,
            userId: user.id,
            conversationId: row.conversation_id,
            queryKey: ["unread-messages", categoryId, user.id],
            current,
            byConversation: current?.byConversation,
          });

          // Si on ne connaît pas encore cette conversation (pas participant côté cache local
          // ou catégorie différente), on ignore : le prochain montage / navigation refetchera.
          if (!current) {
            unreadDebug("realtime INSERT missing cache: validating conversation", {
              categoryId,
              userId: user.id,
              conversationId: row.conversation_id,
              queryKey: ["unread-messages", categoryId, user.id],
            });

            const { data: conversation } = await supabase
              .from("conversations")
              .select("id")
              .eq("id", row.conversation_id)
              .eq("category_id", categoryId)
              .maybeSingle();

            const { data: participation } = await supabase
              .from("conversation_participants")
              .select("conversation_id")
              .eq("conversation_id", row.conversation_id)
              .eq("user_id", user.id)
              .maybeSingle();

            if (!conversation || !participation) {
              unreadDebug("realtime INSERT ignored: missing cache invalid conversation", {
                categoryId,
                userId: user.id,
                conversationId: row.conversation_id,
                queryKey: ["unread-messages", categoryId, user.id],
              });
              return;
            }

            queryClient.setQueryData<UnreadCounts>(
              ["unread-messages", categoryId, user.id],
              { total: 1, byConversation: { [row.conversation_id]: 1 } }
            );
            return;
          }

          // Filet de sécurité: si l'INSERT vient d'une conv d'une autre catégorie,
          // on ne peut pas le savoir depuis le payload → on incrémente uniquement si
          // la conv fait partie du cache participations (byConversation existant ou 0).
          // On applique l'incrément prudemment : seulement si la conv est déjà présente
          // OU on invalide de manière debouncée en cas de doute.
          const knownConv = row.conversation_id in current.byConversation;
          if (knownConv) {
            const next: UnreadCounts = {
              total: current.total + 1,
              byConversation: {
                ...current.byConversation,
                [row.conversation_id]: (current.byConversation[row.conversation_id] || 0) + 1,
              },
            };
            unreadDebug("setQueryData", {
              categoryId,
              userId: user.id,
              conversationId: row.conversation_id,
              queryKey: ["unread-messages", categoryId, user.id],
              previous: current,
              previousByConversation: current.byConversation,
              next,
              nextByConversation: next.byConversation,
            });
            queryClient.setQueryData<UnreadCounts>(
              ["unread-messages", categoryId, user.id],
              next
            );
          } else {
            unreadDebug("realtime INSERT unknown conversation", {
              categoryId,
              userId: user.id,
              conversationId: row.conversation_id,
              knownConversationIds: Object.keys(current.byConversation),
              queryKey: ["unread-messages", categoryId, user.id],
            });

            const { data: conversation } = await supabase
              .from("conversations")
              .select("id")
              .eq("id", row.conversation_id)
              .eq("category_id", categoryId)
              .maybeSingle();

            const { data: participation } = await supabase
              .from("conversation_participants")
              .select("conversation_id")
              .eq("conversation_id", row.conversation_id)
              .eq("user_id", user.id)
              .maybeSingle();

            if (conversation && participation) {
              queryClient.setQueryData<UnreadCounts>(
                ["unread-messages", categoryId, user.id],
                (previous) => {
                  const safePrevious = previous ?? current;
                  const previousConversationCount = safePrevious.byConversation[row.conversation_id] || 0;
                  const next: UnreadCounts = {
                    total: safePrevious.total + 1,
                    byConversation: {
                      ...safePrevious.byConversation,
                      [row.conversation_id]: previousConversationCount + 1,
                    },
                  };

                  unreadDebug("setQueryData unknown conversation validated", {
                    categoryId,
                    userId: user.id,
                    conversationId: row.conversation_id,
                    queryKey: ["unread-messages", categoryId, user.id],
                    previous: safePrevious,
                    next,
                  });

                  return next;
                }
              );
              return;
            }

            // Conv inconnue du cache et non validée pour cette catégorie/utilisateur
            // → un seul refetch debouncé pour resynchroniser sans faux positif.
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => {
              unreadDebug("invalidate debounced", {
                categoryId,
                userId: user.id,
                conversationId: row.conversation_id,
                queryKey: ["unread-messages", categoryId, user.id],
              });
              queryClient.invalidateQueries({
                queryKey: ["unread-messages", categoryId, user.id],
              });
            }, 2000);
          }
        }
      )
      .subscribe((status) => {
        unreadDebug("realtime status", {
          status,
          channel: `unread-messages-${categoryId}`,
          categoryId,
          userId: user.id,
          queryKey: ["unread-messages", categoryId, user.id],
        });
      });

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      unreadDebug("realtime unsubscribe", {
        channel: `unread-messages-${categoryId}`,
        categoryId,
        userId: user.id,
        queryKey: ["unread-messages", categoryId, user.id],
      });
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
