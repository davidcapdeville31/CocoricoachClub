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

interface ManageParticipantsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  categoryId: string;
}

interface Candidate {
  user_id: string;
  name: string;
  kind: "staff" | "athlete";
}

export function ManageParticipantsDialog({
  open,
  onOpenChange,
  conversationId,
  categoryId,
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
      if (ids.length === 0) return [] as Array<{ user_id: string; is_admin: boolean; name: string }>;
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ids);
      return (data || []).map((p) => ({
        user_id: p.user_id,
        is_admin: !!p.is_admin,
        name: profiles?.find((pr) => pr.id === p.user_id)?.full_name || "Utilisateur",
      }));
    },
    enabled: open,
  });

  // Available candidates (staff + athletes of the category)
  const { data: candidates } = useQuery({
    queryKey: ["conv-candidates", categoryId],
    queryFn: async () => {
      const { data: category } = await supabase
        .from("categories")
        .select("club_id")
        .eq("id", categoryId)
        .single();

      const result: Candidate[] = [];

      if (category) {
        const { data: staff } = await supabase
          .from("club_members")
          .select("user_id")
          .eq("club_id", category.club_id);
        const staffIds = (staff || []).map((s) => s.user_id).filter(Boolean);
        if (staffIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", staffIds);
          staffIds.forEach((uid) => {
            result.push({
              user_id: uid,
              name: profiles?.find((p) => p.id === uid)?.full_name || "Staff",
              kind: "staff",
            });
          });
        }
      }

      const { data: athletes } = await supabase
        .from("category_members")
        .select("user_id")
        .eq("category_id", categoryId)
        .eq("role", "athlete");
      const athleteIds = (athletes || []).map((a) => a.user_id).filter(Boolean);
      if (athleteIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", athleteIds);
        athleteIds.forEach((uid) => {
          if (!result.find((r) => r.user_id === uid)) {
            result.push({
              user_id: uid,
              name: profiles?.find((p) => p.id === uid)?.full_name || "Athlète",
              kind: "athlete",
            });
          }
        });
      }

      return result;
    },
    enabled: open,
  });

  const participantIds = useMemo(
    () => new Set((participants || []).map((p) => p.user_id)),
    [participants]
  );

  const filteredAvailable = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (candidates || [])
      .filter((c) => !participantIds.has(c.user_id))
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
            Ajoutez ou retirez des participants de cette conversation.
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
                    {p.user_id !== user?.id && (
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
              </div>
            </ScrollArea>
          </TabsContent>

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
                      key={c.user_id}
                      className="flex items-center gap-3 p-2 rounded-lg border border-border/40"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">{initials(c.name)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{c.name}</p>
                        <Badge variant="outline" className="text-[10px] h-4">
                          {c.kind === "staff" ? "Staff" : "Athlète"}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => addMember.mutate(c.user_id)}
                        disabled={addMember.isPending}
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
      </DialogContent>
    </Dialog>
  );
}
