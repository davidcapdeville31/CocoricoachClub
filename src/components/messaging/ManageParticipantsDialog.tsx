import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, X, Search, Shield, LogOut } from "lucide-react";
import { toast } from "sonner";
import { useCategoryMembers } from "@/hooks/useCategoryMembers";
import { resolveUserDisplayNames } from "./userDisplayNames";
import { UserAvatar } from "./UserAvatar";

interface ManageParticipantsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  categoryId: string;
  /** Peut retirer les autres membres (staff/admin/coach) */
  canManage: boolean;
  /** L'utilisateur courant est participant de la conversation */
  isParticipant?: boolean;
  /** Callback quand l'utilisateur quitte la conversation */
  onLeft?: () => void;
}

export function ManageParticipantsDialog({
  open,
  onOpenChange,
  conversationId,
  categoryId,
  canManage,
  isParticipant = true,
  onLeft,
}: ManageParticipantsDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  // Participants actuels
  const { data: participants } = useQuery({
    queryKey: ["conv-participants-manage", conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversation_participants")
        .select("user_id, is_admin")
        .eq("conversation_id", conversationId);
      if (error) throw error;
      const ids = (data || []).map((p) => p.user_id);
      const nameMap = await resolveUserDisplayNames({
        categoryId,
        userIds: ids,
        currentUser: user,
      });
      return (data || []).map((p) => ({
        user_id: p.user_id,
        is_admin: !!p.is_admin,
        name: nameMap[p.user_id] || "Utilisateur",
      }));
    },
    enabled: open,
  });

  // Membres de la catégorie (staff + joueurs avec compte)
  const { data: categoryMembers } = useCategoryMembers(open ? categoryId : null);

  const participantIds = useMemo(
    () => new Set((participants || []).map((p) => p.user_id)),
    [participants]
  );

  const filteredAvailable = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (categoryMembers || [])
      .filter((m) => !participantIds.has(m.userId))
      .filter((m) => (term ? m.name.toLowerCase().includes(term) : true));
  }, [categoryMembers, participantIds, search]);

  const addMember = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("conversation_participants")
        .insert({ conversation_id: conversationId, user_id: userId, is_admin: false });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conv-participants-manage", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversation-participants", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversation-participant-names", conversationId] });
      toast.success("Membre ajouté");
    },
    onError: (e: any) => toast.error(e.message || "Impossible d'ajouter ce membre"),
  });

  const removeMember = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("conversation_participants")
        .delete()
        .eq("conversation_id", conversationId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: (_data, userId) => {
      queryClient.invalidateQueries({ queryKey: ["conv-participants-manage", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversation-participants", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversation-participant-names", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      if (userId === user?.id) {
        toast.success("Vous avez quitté la conversation");
        onOpenChange(false);
        onLeft?.();
      } else {
        toast.success("Membre retiré");
      }
    },
    onError: (e: any) => toast.error(e.message || "Impossible de retirer ce membre"),
  });

  const currentUserIsParticipant = isParticipant && !!user?.id && participantIds.has(user.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Gérer les membres</DialogTitle>
          <DialogDescription>
            Ajoutez des membres du staff ou des joueurs. Chacun peut quitter la conversation
            à tout moment et pourra être réinvité plus tard.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="members" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="members">
              Membres ({participants?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="add">Ajouter</TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="mt-4">
            <ScrollArea className="h-[320px] pr-3">
              <div className="space-y-2">
                {participants?.map((p) => {
                  const isSelf = p.user_id === user?.id;
                  const memberInfo = categoryMembers?.find((m) => m.userId === p.user_id);
                  return (
                    <div
                      key={p.user_id}
                      className="flex items-center gap-3 p-2 rounded-lg border border-border/40"
                    >
                      <UserAvatar
                        
                        name={p.name}
                        photoUrl={memberInfo?.photoUrl ?? null}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {p.name}
                          {isSelf && (
                            <span className="text-xs text-muted-foreground ml-1">(vous)</span>
                          )}
                        </p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {memberInfo?.kind && (
                            <Badge variant="outline" className="text-[10px] h-4">
                              {memberInfo.kind === "staff" ? "Staff" : "Athlète"}
                            </Badge>
                          )}
                          {p.is_admin && (
                            <Badge variant="secondary" className="text-[10px] h-4 gap-1">
                              <Shield className="h-2.5 w-2.5" /> Admin
                            </Badge>
                          )}
                        </div>
                      </div>
                      {isSelf ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-destructive gap-1"
                          onClick={() => removeMember.mutate(p.user_id)}
                          disabled={removeMember.isPending}
                          title="Quitter la conversation"
                        >
                          <LogOut className="h-3.5 w-3.5" />
                          Quitter
                        </Button>
                      ) : (
                        canManage && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => removeMember.mutate(p.user_id)}
                            disabled={removeMember.isPending}
                            title="Retirer ce membre"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="add" className="mt-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un membre..."
                className="pl-8"
              />
            </div>
            <ScrollArea className="h-[280px] pr-3">
              <div className="space-y-2">
                {filteredAvailable.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Aucun membre disponible à ajouter.
                  </p>
                ) : (
                  filteredAvailable.map((m) => (
                    <div
                      key={m.userId}
                      className="flex items-center gap-3 p-2 rounded-lg border border-border/40"
                    >
                      <UserAvatar
                        
                        name={m.name}
                        photoUrl={m.photoUrl}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{m.name}</p>
                        <Badge variant="outline" className="text-[10px] h-4">
                          {m.kind === "staff" ? "Staff" : "Athlète"}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => addMember.mutate(m.userId)}
                        disabled={addMember.isPending}
                        title="Ajouter à la conversation"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {currentUserIsParticipant && (
          <DialogFooter className="sm:justify-between gap-2">
            <Button
              variant="outline"
              className="text-destructive gap-1"
              onClick={() => user?.id && removeMember.mutate(user.id)}
              disabled={removeMember.isPending}
            >
              <LogOut className="h-4 w-4" />
              Quitter la conversation
            </Button>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Fermer
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
