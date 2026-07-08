import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface RenameGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  currentName: string | null;
}

export function RenameGroupDialog({
  open,
  onOpenChange,
  conversationId,
  currentName,
}: RenameGroupDialogProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(currentName ?? "");

  useEffect(() => {
    if (open) setName(currentName ?? "");
  }, [open, currentName]);

  const rename = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Nom requis");
      const { error } = await supabase.rpc("rename_conversation", {
        _conversation_id: conversationId,
        _new_name: trimmed,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversation-meta", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      toast.success("Groupe renommé");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message || "Erreur"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Renommer le groupe</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Nouveau nom</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={() => rename.mutate()}
            disabled={rename.isPending || !name.trim() || name.trim() === (currentName ?? "")}
          >
            Renommer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
