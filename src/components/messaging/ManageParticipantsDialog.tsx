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
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, X, Search, Shield } from "lucide-react";
import { toast } from "sonner";
import { fetchCategoryRosterPlayers } from "@/lib/categoryRoster";
import { fetchCategoryRosterUserNames, resolveUserDisplayNames } from "./userDisplayNames";

interface ManageParticipantsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  categoryId: string;
  canManage: boolean;
}

interface Candidate {
  key: string;
  player_id?: string;
  user_id: string;
  name: string;
  kind: "athlete";
  hasLinkedAccount: boolean;
}

export function ManageParticipantsDialog({
  open,
  onOpenChange,
  conversationId,
  categoryId,
  canManage,
}: ManageParticipantsDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  // Current participants
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

  // Available candidates: exact same athlete source as Effectif (active roster only)
  const { data: candidates } = useQuery({
    queryKey: ["conv-candidates", categoryId, open],
    queryFn: async () => {
      const rosterPlayers = await fetchCategoryRosterPlayers(categoryId);
      const athleteNameMap = await fetchCategoryRosterUserNames({ categoryId });
      const linkedUserIds = rosterPlayers
        .map((player: any) => player.user_id)
        .filter((userId: string | null | undefined): userId is string => !!userId);

      const nameMap = await resolveUserDisplayNames({
        categoryId,
        userIds: linkedUserIds,
        currentUser: user,
      });

      const result: Candidate[] = rosterPlayers.map((player: any) => {
        const fallbackName = [player.first_name, player.name].filter(Boolean).join(" ").trim();
        const resolvedName = player.user_id ? nameMap[player.user_id] || athleteNameMap[player.user_id] : fallbackName;

        return {
          key: player.user_id || player.id,
          player_id: player.id,
          user_id: player.user_id || "",
          name: resolvedName || fallbackName,
          kind: "athlete" as const,
          hasLinkedAccount: !!player.user_id,
        };
      }).filter((candidate) => !!candidate.name);

      result.sort((a, b) => a.name.localeCompare(b.name));
      return result;
    },
    enabled: open,
    refetchOnMount: "always",
  });

  const participantIds = useMemo(
    () => new Set((participants || []).map((p) => p.user_id)),
    [participants]
  );

  const filteredAvailable = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (candidates || [])
      .filter((c) => !c.user_id || !participantIds.has(c.user_id))
      .filter((c) => (term ? c.name.toLowerCase().includes(term) : true));
  }, [candidates, participantIds, search]);

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conv-participants-manage", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversation-participants", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversation-participant-names", conversationId] });
      toast.success("Membre retiré");
    },
    onError: (e: any) => toast.error(e.message || "Impossible de retirer ce membre"),
  });

  const initials = (name: string) =>
    name
      .split(" ")
      .map((p) => p[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Gérer les membres</DialogTitle>
          <DialogDescription>
            {canManage
              ? "Ajoutez ou retirez des participants de cette conversation."
              : "Liste des participants. Seuls les responsables (propriétaire, admin, coach) peuvent modifier les membres."}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="members" className="w-full">
          <TabsList className={`grid w-full ${canManage ? "grid-cols-2" : "grid-cols-1"}`}>
            <TabsTrigger value="members">
              Membres ({participants?.length || 0})
            </TabsTrigger>
            {canManage && <TabsTrigger value="add">Ajouter</TabsTrigger>}
          </TabsList>

          <TabsContent value="members" className="mt-4">
            <ScrollArea className="h-[320px] pr-3">
              <div className="space-y-2">
                {participants?.map((p) => (
                  <div
                    key={p.user_id}
                    className="flex items-center gap-3 p-2 rounded-lg border border-border/40"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">{initials(p.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      {p.is_admin && (
                        <Badge variant="secondary" className="text-[10px] h-4 gap-1">
                          <Shield className="h-2.5 w-2.5" /> Admin
                        </Badge>
                      )}
                    </div>
                    {canManage && p.user_id !== user?.id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => removeMember.mutate(p.user_id)}
                        disabled={removeMember.isPending}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}

                {(() => {
                  const unlinked = (candidates || []).filter((c) => !c.hasLinkedAccount);
                  if (unlinked.length === 0) return null;
                  return (
                    <div className="pt-3 mt-2 border-t border-border/40 space-y-2">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Athlètes de l'effectif sans compte
                      </p>
                      {unlinked.map((c) => (
                        <div
                          key={c.key}
                          className="flex items-center gap-3 p-2 rounded-lg border border-dashed border-border/50 bg-muted/30"
                        >
                          <Avatar className="h-8 w-8 opacity-60">
                            <AvatarFallback className="text-xs">{initials(c.name)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate text-muted-foreground">{c.name}</p>
                            <span className="text-[10px] text-muted-foreground">
                              Compte non lié — invitation requise pour rejoindre la conversation
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </ScrollArea>
          </TabsContent>

          {canManage && (
            <TabsContent value="add" className="mt-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher..."
                  className="pl-8"
                />
              </div>
              <ScrollArea className="h-[280px] pr-3">
                <div className="space-y-2">
                  {filteredAvailable.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      Aucune personne disponible à ajouter.
                    </p>
                  ) : (
                    filteredAvailable.map((c) => (
                      <div
                        key={c.key}
                        className="flex items-center gap-3 p-2 rounded-lg border border-border/40"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">{initials(c.name)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{c.name}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-[10px] h-4">
                              Athlète
                            </Badge>
                            {!c.hasLinkedAccount && (
                              <span className="text-[10px] text-muted-foreground">
                                Compte non lié
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => c.hasLinkedAccount && addMember.mutate(c.user_id)}
                          disabled={addMember.isPending || !c.hasLinkedAccount}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
