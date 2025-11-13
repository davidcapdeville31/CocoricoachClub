import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface AddClubDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddClubDialog({ open, onOpenChange }: AddClubDialogProps) {
  const [clubName, setClubName] = useState("");
  const queryClient = useQueryClient();

  const addClub = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from("clubs").insert({ name });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clubs"] });
      toast.success("Club ajouté avec succès");
      setClubName("");
      onOpenChange(false);
    },
    onError: () => {
      toast.error("Erreur lors de l'ajout du club");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (clubName.trim()) {
      addClub.mutate(clubName.trim());
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter un nouveau club</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="clubName">Nom du club</Label>
              <Input
                id="clubName"
                value={clubName}
                onChange={(e) => setClubName(e.target.value)}
                placeholder="Ex: Colomiers Rugby"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={!clubName.trim() || addClub.isPending}>
              {addClub.isPending ? "Ajout..." : "Ajouter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
