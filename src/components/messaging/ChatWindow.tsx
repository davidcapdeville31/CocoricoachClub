import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentUserIdentity } from "@/hooks/useCurrentUserIdentity";
import { markConversationAsRead } from "@/hooks/useUnreadMessages";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Send, Users, Bell, Check, CheckCheck, BarChart3, ChevronUp, ChevronDown, UserPlus, Pencil, Hash } from "lucide-react";
import { toast } from "sonner";
import { ManageParticipantsDialog } from "./ManageParticipantsDialog";
import { RenameGroupDialog } from "./RenameGroupDialog";
import { UserAvatar } from "./UserAvatar";
import { usePresence } from "@/hooks/usePresence";
import { useCategoryMembers } from "@/hooks/useCategoryMembers";
import { cn } from "@/lib/utils";
import { MessageReactions } from "./MessageReactions";
import { PollMessage } from "./PollMessage";
import { CreatePollDialog } from "./CreatePollDialog";
import { PollSummaryPanel } from "./PollSummaryPanel";
import { getOrderedDistinctResolvedNames, resolveUserDisplayNames } from "./userDisplayNames";

interface Message {
  id: string;
  sender_id: string;
  content: string;
  is_announcement: boolean;
  is_urgent: boolean;
  read_by: string[];
  created_at: string;
  message_type: string;
  poll_id: string | null;
  action_data: any;
}

interface ChatWindowProps {
  conversationId: string;
  categoryId: string;
}

export function ChatWindow({ conversationId, categoryId }: ChatWindowProps) {
  const [newMessage, setNewMessage] = useState("");
  const [isAnnouncement, setIsAnnouncement] = useState(false);
  const [pollDialogOpen, setPollDialogOpen] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const online = usePresence(categoryId);
  const { data: categoryMembers } = useCategoryMembers(categoryId);

  const { data: messages } = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Message[];
    },
    // Pas de refetchInterval: Realtime pousse déjà les nouveaux messages en temps réel.
    staleTime: 30_000, // absorbe les focus rapprochés sans refetch inutile
    refetchOnWindowFocus: false,
  });

  const { data: participants } = useQuery({
    queryKey: ["conversation-participants", conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversation_participants")
        .select("user_id")
        .eq("conversation_id", conversationId);
      if (error) throw error;
      return data;
    },
  });

  const { data: conversation } = useQuery({
    queryKey: ["conversation-meta", conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("conversation_type, name")
        .eq("id", conversationId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Only staff (club owner / admin / coach, or category admin / coach) can manage members
  // Optimisation: on lit l'identité (super admin, owner, memberships) depuis le cache partagé
  // au lieu de refaire 4 requêtes Supabase à chaque ouverture du chat.
  const identity = useCurrentUserIdentity();
  const { data: chatCategoryClubId } = useQuery({
    queryKey: ["chat-category-club", categoryId],
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("club_id")
        .eq("id", categoryId)
        .maybeSingle();
      return data?.club_id ?? null;
    },
    enabled: !!categoryId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const isChatManager =
    !!user &&
    (identity.isClubOwner(chatCategoryClubId) ||
      ["admin", "coach"].includes(identity.getClubRole(chatCategoryClubId) ?? "") ||
      ["admin", "coach"].includes(identity.getCategoryRole(categoryId) ?? ""));


  const canManageMembers =
    !!conversation && conversation.conversation_type !== "direct" && !!isChatManager;
  const currentUserIsParticipant = !!user?.id && !!participants?.some((p) => p.user_id === user.id);
  const canOpenMemberDialog =
    !!conversation && conversation.conversation_type !== "direct" && (canManageMembers || currentUserIsParticipant);

  // Fetch participant profile names for header display
  const { data: participantNames } = useQuery({
    queryKey: ["conversation-participant-names", conversationId, user?.id],
    queryFn: async () => {
      if (!participants || participants.length === 0) return [];
      const userIds = participants.map(p => p.user_id);
      const nameMap = await resolveUserDisplayNames({ categoryId, userIds, currentUser: user });
      return getOrderedDistinctResolvedNames(userIds, nameMap);
    },
    enabled: !!participants && participants.length > 0,
  });

  const { data: senderProfiles } = useQuery({
    queryKey: ["sender-profiles", conversationId, user?.id],
    queryFn: async () => {
      if (!messages) return {};
      const uniqueIds = [...new Set(messages.map(m => m.sender_id))];
      if (uniqueIds.length === 0) return {};
      return resolveUserDisplayNames({ categoryId, userIds: uniqueIds, currentUser: user });
    },
    enabled: !!messages && messages.length > 0,
  });

  // Ref vers les messages pour l'invalidation des reactions sans redéclencher l'abonnement Realtime
  const messagesRef = useRef<Message[] | undefined>(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // Subscribe to realtime messages — ne dépend PAS de `messages` pour éviter le churn du channel
  useEffect(() => {
    const suffix = Math.random().toString(36).slice(2, 8);
    const channel = supabase
      .channel(`messages-${conversationId}-${suffix}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
      })
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "message_reactions",
      }, () => {
        messagesRef.current?.forEach(m => {
          queryClient.invalidateQueries({ queryKey: ["message-reactions", m.id] });
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId, queryClient]);

  // Mark conversation as read — uniquement à l'entrée dans la conversation.
  // Au lieu d'invalider ["unread-messages", ...] (qui déclenche N HEAD requests),
  // on remet à 0 le compteur de cette conversation localement via setQueryData.
  useEffect(() => {
    if (user && conversationId) {
      markConversationAsRead(conversationId, user.id);
      const key = ["unread-messages", categoryId, user.id] as const;
      const current = queryClient.getQueryData<{
        total: number;
        byConversation: Record<string, number>;
      }>(key as unknown as readonly unknown[]);
      console.debug("[ChatWindow] mark-as-read cache before", {
        categoryId,
        userId: user.id,
        conversationId,
        queryKey: key,
        current,
        byConversation: current?.byConversation,
      });
      if (current && current.byConversation[conversationId]) {
        const removed = current.byConversation[conversationId];
        // Garder la clé (à 0) pour que le handler Realtime reconnaisse toujours
        // la conversation et incrémente immédiatement les prochains messages.
        const next = {
          total: Math.max(0, current.total - removed),
          byConversation: { ...current.byConversation, [conversationId]: 0 },
        };
        console.debug("[ChatWindow] mark-as-read setQueryData", {
          categoryId,
          userId: user.id,
          conversationId,
          queryKey: key,
          previous: current,
          next,
        });
        queryClient.setQueryData(key as unknown as readonly unknown[], {
          total: next.total,
          byConversation: next.byConversation,
        });
      }
    }
  }, [conversationId, user, categoryId, queryClient]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!newMessage.trim() || !user) return null;
      const messageContent = newMessage.trim();
      const { data: inserted, error } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content: messageContent,
          is_announcement: isAnnouncement,
          read_by: [user.id],
          message_type: "text",
        })
        .select("*")
        .single();
      if (error) throw error;

      // Push notification (fire & forget)
      try {
        const otherParticipants = participants?.filter(p => p.user_id !== user.id) || [];
        if (otherParticipants.length > 0) {
          await supabase.functions.invoke("send-targeted-notification", {
            body: {
              title: isAnnouncement ? "📢 Nouvelle annonce" : "💬 Nouveau message",
              message: messageContent.length > 100 ? messageContent.substring(0, 100) + "..." : messageContent,
              target_user_ids: otherParticipants.map(p => p.user_id),
              channels: ["push"],
              data: { conversationId, type: "chat_message" },
            },
          });
        }
      } catch (e) {
        console.warn("[ChatWindow] Push notification failed:", e);
      }

      return inserted as Message;
    },
    onSuccess: (inserted) => {
      setNewMessage("");
      setIsAnnouncement(false);
      // Mise à jour optimiste ciblée du cache local côté émetteur (Realtime ne redéclenche pas
      // toujours pour ses propres inserts). Pas d'invalidation → aucune requête réseau supplémentaire.
      if (inserted) {
        queryClient.setQueryData<Message[] | undefined>(
          ["messages", conversationId],
          (old) => {
            if (!old) return [inserted];
            if (old.some(m => m.id === inserted.id)) return old;
            return [...old, inserted];
          },
        );
      }
    },
    onError: () => { toast.error("Erreur lors de l'envoi"); },
  });

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage.mutate();
    }
  };

  const isOwnMessage = (senderId: string) => senderId === user?.id;
  const getSenderName = (senderId: string) => senderProfiles?.[senderId] || senderId.substring(0, 2).toUpperCase();

  // Header info (avatar + status) for DM vs group
  const isDirect = conversation?.conversation_type === "direct";
  const memberByUserId = (userId: string) => categoryMembers?.find((m) => m.userId === userId);
  const dmPeerId = isDirect
    ? participants?.find((p) => p.user_id !== user?.id)?.user_id
    : undefined;
  const dmPeer = dmPeerId ? memberByUserId(dmPeerId) : undefined;
  const headerName = isDirect
    ? dmPeer?.name || "Message privé"
    : conversation?.name || "Groupe";
  const headerPhoto = isDirect ? dmPeer?.photoUrl : null;
  const headerOnline = isDirect && dmPeerId ? online.has(dmPeerId) : undefined;
  const canRename = !isDirect && isChatManager;

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {isDirect ? (
              <UserAvatar
                name={headerName}
                photoUrl={headerPhoto}
                online={headerOnline}
                size="md"
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                {conversation?.conversation_type === "channel" ? (
                  <Hash className="h-5 w-5" />
                ) : (
                  <Users className="h-5 w-5" />
                )}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base truncate flex items-center gap-2">
                <span className="truncate">{headerName}</span>
                {canRename && (
                  <button
                    onClick={() => setRenameOpen(true)}
                    className="text-muted-foreground hover:text-foreground shrink-0"
                    title="Renommer le groupe"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </CardTitle>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {isDirect
                  ? headerOnline
                    ? "En ligne"
                    : "Hors ligne"
                  : participantNames && participantNames.length > 0
                    ? participantNames.join(", ")
                    : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {!isDirect && (
              <Badge variant="outline" className="hidden sm:inline-flex">
                <Users className="h-3 w-3 mr-1" />
                {participants?.length || 0}
              </Badge>
            )}
            {canManageMembers && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setManageOpen(true)}
                title="Gérer les membres"
                className="h-8 w-8"
              >
                <UserPlus className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSummary(!showSummary)}
              className="text-xs h-8"
            >
              {showSummary ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              <span className="hidden sm:inline ml-1">Résumé</span>
            </Button>
          </div>
        </div>
        {showSummary && (
          <div className="mt-2">
            <PollSummaryPanel conversationId={conversationId} categoryId={categoryId} />
          </div>
        )}
      </CardHeader>


      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-3">
          {messages?.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-2 group",
                isOwnMessage(message.sender_id) ? "flex-row-reverse" : "flex-row"
              )}
            >
              <UserAvatar
                name={getSenderName(message.sender_id)}
                photoUrl={memberByUserId(message.sender_id)?.photoUrl}
                size="sm"
                showDot={false}
              />
              <div className={cn("max-w-[75%]", isOwnMessage(message.sender_id) ? "items-end" : "items-start")}>
                {!isOwnMessage(message.sender_id) && (
                  <p className="text-xs text-muted-foreground mb-0.5 px-1">
                    {getSenderName(message.sender_id)}
                  </p>
                )}
                <div
                  className={cn(
                    "rounded-lg p-3",
                    isOwnMessage(message.sender_id)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted",
                    message.is_announcement && "border-2 border-yellow-500",
                    message.message_type === "poll" && "bg-transparent p-0 text-foreground"
                  )}
                >
                  {message.is_announcement && message.message_type !== "poll" && (
                    <div className="flex items-center gap-1 text-xs mb-1 opacity-80">
                      <Bell className="h-3 w-3" />
                      Annonce
                    </div>
                  )}
                  
                  {message.message_type === "poll" ? (
                    <>
                      <p className="text-sm font-medium whitespace-pre-wrap mb-2">{message.content}</p>
                      {message.poll_id && (
                        <PollMessage pollId={message.poll_id} isOwnMessage={isOwnMessage(message.sender_id)} />
                      )}
                    </>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  )}
                  
                  {message.message_type !== "poll" && (
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span className="text-xs opacity-70">
                        {format(new Date(message.created_at), "HH:mm", { locale: fr })}
                      </span>
                      {isOwnMessage(message.sender_id) && (
                        message.read_by.length > 1 ? (
                          <CheckCheck className="h-3 w-3" />
                        ) : (
                          <Check className="h-3 w-3" />
                        )
                      )}
                    </div>
                  )}
                </div>
                <MessageReactions messageId={message.id} isOwnMessage={isOwnMessage(message.sender_id)} />
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="p-3 border-t">
        <div className="flex gap-2">
          <Button
            variant={isAnnouncement ? "default" : "outline"}
            size="icon"
            onClick={() => setIsAnnouncement(!isAnnouncement)}
            title="Envoyer comme annonce"
            className="shrink-0"
          >
            <Bell className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setPollDialogOpen(true)}
            title="Créer un sondage"
            className="shrink-0"
          >
            <BarChart3 className="h-4 w-4" />
          </Button>
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Écrire un message..."
            className="flex-1"
          />
          <Button
            onClick={() => sendMessage.mutate()}
            disabled={!newMessage.trim() || sendMessage.isPending}
            className="shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <CreatePollDialog
        open={pollDialogOpen}
        onOpenChange={setPollDialogOpen}
        conversationId={conversationId}
        categoryId={categoryId}
      />

      <ManageParticipantsDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        conversationId={conversationId}
        categoryId={categoryId}
        canManage={canManageMembers}
      />

      <RenameGroupDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        conversationId={conversationId}
        currentName={conversation?.name ?? null}
      />
    </Card>
  );
}
