import { useMemo, useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { UserAvatar } from "./UserAvatar";
import { useCategoryMembers } from "@/hooks/useCategoryMembers";

interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
  onCreated: (conversationId: string) => void;
}

export function CreateGroupDialog({
  open,
  onOpenChange,
  categoryId,
  onCreated,
}: CreateGroupDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: members } = useCategoryMembers(categoryId);
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) {
      setName("");
      setSearch("");
      setSelected(new Set());
    }
  }, [open]);

  const filtered = useMemo(() => {
    const list = (members || []).filter((m) => m.userId !== user?.id);
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((m) => m.name.toLowerCase().includes(q));
  }, [members, search, user?.id]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const createGroup = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Non authentifié");
      if (!name.trim()) throw new Error("Nom du groupe requis");
      if (selected.size === 0) throw new Error("Sélectionnez au moins un membre");

      const newId = (globalThis.crypto as Crypto).randomUUID();
      const { error: convErr } = await supabase.from("conversations").insert({
        id: newId,
        category_id: categoryId,
        name: name.trim(),
        conversation_type: "group",
        created_by: user.id,
      });
      if (convErr) throw convErr;

      const rows = [
        { conversation_id: newId, user_id: user.id, is_admin: true },
        ...[...selected].map((uid) => ({
          conversation_id: newId,
          user_id: uid,
          is_admin: false,
        })),
      ];
      const { error: partErr } = await supabase
        .from("conversation_participants")
        .insert(rows);
      if (partErr) throw partErr;

      return newId;
    },
    onSuccess: (convId) => {
      queryClient.invalidateQueries({ queryKey: ["conversations", categoryId] });
      toast.success("Groupe créé");
      onOpenChange(false);
      onCreated(convId);
    },
    onError: (e: any) => toast.error(e?.message || "Erreur"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Créer un groupe</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nom du groupe</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: U18 - Attaquants"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label>Membres ({selected.size} sélectionnés)</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher..."
                className="pl-7 h-8"
              />
            </div>
            <ScrollArea className="h-64 border rounded-md">
              <div className="p-2 space-y-1">
                {filtered.map((m) => (
                  <label
                    key={m.userId}
                    className="flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer"
                  >
                    <Checkbox
                      checked={selected.has(m.userId)}
                      onCheckedChange={() => toggle(m.userId)}
                    />
                    <UserAvatar name={m.name} photoUrl={m.photoUrl} size="sm" showDot={false} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.kind === "player" ? "Athlète" : "Staff"}
                      </p>
                    </div>
                  </label>
                ))}
                {filtered.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center p-4">
                    Aucun membre
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={() => createGroup.mutate()}
            disabled={createGroup.isPending || !name.trim() || selected.size === 0}
          >
            Créer le groupe
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
