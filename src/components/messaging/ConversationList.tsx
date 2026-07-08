import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { usePresence } from "@/hooks/usePresence";
import { useCategoryMembers } from "@/hooks/useCategoryMembers";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, Hash, Trash2, MoreVertical } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useRealtimeMembers } from "@/hooks/useRealtimeMembers";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "./UserAvatar";
import { CreateGroupDialog } from "./CreateGroupDialog";

interface Conversation {
  id: string;
  name: string | null;
  conversation_type: string;
  created_at: string;
  avatar_url?: string | null;
}

interface ConversationListProps {
  categoryId: string;
  selectedId?: string;
  onSelect: (id: string) => void;
  isAthlete?: boolean;
}

export function ConversationList({
  categoryId,
  selectedId,
  onSelect,
  isAthlete = false,
}: ConversationListProps) {
  useRealtimeMembers(`chat-${categoryId ?? "all"}`);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { byConversation: unreadByConversation } = useUnreadMessages(categoryId);
  const online = usePresence(categoryId);
  const { data: members } = useCategoryMembers(categoryId);

  const memberMap = useMemo(() => {
    const map = new Map<string, { name: string; photoUrl: string | null }>();
    (members || []).forEach((m) => map.set(m.userId, { name: m.name, photoUrl: m.photoUrl }));
    return map;
  }, [members]);

  const { data: conversations } = useQuery({
    queryKey: ["conversations", categoryId, user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: participantData, error: partError } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", user.id);
      if (partError) throw partError;
      const participantConvIds = (participantData || []).map((p) => p.conversation_id);

      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .eq("category_id", categoryId)
        .order("updated_at", { ascending: false });
      if (error) throw error;

      return (data as Conversation[]).filter((conv) => {
        if (!participantConvIds.includes(conv.id)) return false;
        if (isAthlete && conv.name === "Staff") return false;
        return true;
      });
    },
    enabled: !!user,
  });

  // Récupère tous les participants des conversations affichées pour identifier l'autre partie en DM
  const convIds = useMemo(() => (conversations || []).map((c) => c.id), [conversations]);
  const { data: allParticipants } = useQuery({
    queryKey: ["conv-participants-all", categoryId, convIds.join(",")],
    enabled: convIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversation_participants")
        .select("conversation_id, user_id")
        .in("conversation_id", convIds);
      if (error) throw error;
      return data as { conversation_id: string; user_id: string }[];
    },
  });

  const dmPeerByConv = useMemo(() => {
    const map = new Map<string, string>();
    (allParticipants || []).forEach((p) => {
      if (p.user_id !== user?.id && !map.has(p.conversation_id)) {
        map.set(p.conversation_id, p.user_id);
      }
    });
    return map;
  }, [allParticipants, user?.id]);

  // Auto-create default groups (Staff + Staff+Joueurs) — logique inchangée
  useQuery({
    queryKey: ["default-conversations-check", categoryId, isAthlete, user?.id],
    enabled: !!user && !!conversations,
    queryFn: async () => {
      if (!user) return true;
      const staffGroupName = "Staff";
      const allGroupName = "Staff + Joueurs";
      const { data: existingGroups } = await supabase
        .from("conversations")
        .select("id, name")
        .eq("category_id", categoryId)
        .eq("conversation_type", "group")
        .in("name", [staffGroupName, allGroupName]);
      const staffGroupConv = existingGroups?.find((c) => c.name === staffGroupName);
      const allGroupConv = existingGroups?.find((c) => c.name === allGroupName);

      if (!isAthlete) {
        if (!staffGroupConv) {
          const { data: conv } = await supabase
            .from("conversations")
            .insert({
              category_id: categoryId,
              name: staffGroupName,
              conversation_type: "group",
              created_by: user.id,
            })
            .select()
            .single();
          if (conv) {
            await supabase.from("conversation_participants").insert({
              conversation_id: conv.id,
              user_id: user.id,
              is_admin: true,
            });
          }
        } else {
          await supabase
            .from("conversation_participants")
            .upsert(
              { conversation_id: staffGroupConv.id, user_id: user.id, is_admin: false },
              { onConflict: "conversation_id,user_id" }
            );
        }

        if (!allGroupConv) {
          const { data: conv } = await supabase
            .from("conversations")
            .insert({
              category_id: categoryId,
              name: allGroupName,
              conversation_type: "group",
              created_by: user.id,
            })
            .select()
            .single();
          if (conv) {
            await supabase.from("conversation_participants").insert({
              conversation_id: conv.id,
              user_id: user.id,
              is_admin: true,
            });
            const { data: athleteMembers } = await supabase
              .from("category_members")
              .select("user_id")
              .eq("category_id", categoryId)
              .eq("role", "athlete");
            if (athleteMembers && athleteMembers.length > 0) {
              const rows = athleteMembers
                .filter((m) => m.user_id !== user.id)
                .map((m) => ({
                  conversation_id: conv.id,
                  user_id: m.user_id,
                  is_admin: false,
                }));
              if (rows.length > 0) {
                await supabase.from("conversation_participants").insert(rows);
              }
            }
            const { data: cat } = await supabase
              .from("categories")
              .select("club_id")
              .eq("id", categoryId)
              .single();
            if (cat?.club_id) {
              const { data: staffData } = await supabase
                .from("club_members")
                .select("user_id")
                .eq("club_id", cat.club_id);
              if (staffData && staffData.length > 0) {
                const staffRows = staffData
                  .filter((m) => m.user_id !== user.id)
                  .map((m) => ({
                    conversation_id: conv.id,
                    user_id: m.user_id,
                    is_admin: false,
                  }));
                if (staffRows.length > 0) {
                  await supabase
                    .from("conversation_participants")
                    .upsert(staffRows, { onConflict: "conversation_id,user_id" });
                }
              }
            }
          }
        } else {
          await supabase
            .from("conversation_participants")
            .upsert(
              { conversation_id: allGroupConv.id, user_id: user.id, is_admin: false },
              { onConflict: "conversation_id,user_id" }
            );
        }
        queryClient.invalidateQueries({ queryKey: ["conversations", categoryId] });
      } else if (allGroupConv) {
        await supabase
          .from("conversation_participants")
          .upsert(
            { conversation_id: allGroupConv.id, user_id: user.id, is_admin: false },
            { onConflict: "conversation_id,user_id" }
          );
        queryClient.invalidateQueries({ queryKey: ["conversations", categoryId] });
      }
      return true;
    },
  });

  const deleteConversation = useMutation({
    mutationFn: async (conversationId: string) => {
      await supabase.from("messages").delete().eq("conversation_id", conversationId);
      await supabase.from("conversation_participants").delete().eq("conversation_id", conversationId);
      const { error } = await supabase.from("conversations").delete().eq("id", conversationId);
      if (error) throw error;
      return conversationId;
    },
    onSuccess: (deletedId) => {
      setDeleteDialogOpen(false);
      if (selectedId === deletedId) onSelect("");
      queryClient.invalidateQueries({ queryKey: ["conversations", categoryId] });
      setConversationToDelete(null);
      toast.success("Conversation supprimée");
    },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  const isDefaultGroup = (convName: string | null) =>
    convName === "Staff" || convName === "Staff + Joueurs";

  const getConvDisplay = (conv: Conversation) => {
    if (conv.conversation_type === "direct") {
      const peerId = dmPeerByConv.get(conv.id);
      const peer = peerId ? memberMap.get(peerId) : undefined;
      return {
        name: peer?.name || conv.name || "Message privé",
        photoUrl: peer?.photoUrl || null,
        online: peerId ? online.has(peerId) : false,
        showDot: true,
        subtitle: peerId && online.has(peerId) ? "En ligne" : "Message privé",
      };
    }
    return {
      name: conv.name || "Groupe",
      photoUrl: conv.avatar_url || null,
      online: undefined as boolean | undefined,
      showDot: false,
      subtitle: conv.conversation_type === "channel" ? "Canal" : "Groupe",
    };
  };

  return (
    <>
      <div className="flex flex-col h-full">
        <CardHeader className="pb-3 pt-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Conversations</CardTitle>
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8"
              onClick={() => setCreateOpen(true)}
              title="Créer un groupe"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            {conversations?.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Aucune conversation. Ouvrez l'onglet Membres pour discuter avec quelqu'un.
              </div>
            ) : (
              <div className="space-y-1 p-2">
                {conversations?.map((conv) => {
                  const info = getConvDisplay(conv);
                  const unread = unreadByConversation[conv.id] || 0;
                  return (
                    <div
                      key={conv.id}
                      className={cn(
                        "w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors group",
                        selectedId === conv.id
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-muted"
                      )}
                    >
                      <button
                        onClick={() => onSelect(conv.id)}
                        className="flex items-center gap-3 flex-1 min-w-0"
                      >
                        {conv.conversation_type === "direct" ? (
                          <UserAvatar
                            name={info.name}
                            photoUrl={info.photoUrl}
                            online={info.online}
                            size="md"
                          />
                        ) : (
                          <div className="relative shrink-0">
                            <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                              {conv.conversation_type === "channel" ? (
                                <Hash className="h-5 w-5" />
                              ) : (
                                <Users className="h-5 w-5" />
                              )}
                            </div>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate text-sm">{info.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {info.subtitle}
                          </p>
                        </div>
                        {unread > 0 && (
                          <Badge
                            variant="destructive"
                            className="h-5 min-w-[20px] flex items-center justify-center p-0 text-xs rounded-full"
                          >
                            {unread > 9 ? "9+" : unread}
                          </Badge>
                        )}
                      </button>

                      {!isDefaultGroup(conv.name) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConversationToDelete(conv.id);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </div>

      <CreateGroupDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        categoryId={categoryId}
        onCreated={onSelect}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la conversation ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action supprimera définitivement la conversation et tous ses messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                conversationToDelete && deleteConversation.mutate(conversationToDelete)
              }
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Silence unused-import warning if future refactor removes usage
useEffect;
