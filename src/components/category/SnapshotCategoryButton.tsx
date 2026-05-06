import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  categoryId: string;
  categoryName?: string;
}

export function SnapshotCategoryButton({ categoryId, categoryName }: Props) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");

  const snapshot = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("snapshot_category_full" as any, {
        _category_id: categoryId,
        _notes: notes || null,
      });
      if (error) throw error;
      const result = data as { success: boolean; error?: string; version?: number; players_count?: number };
      if (!result?.success) throw new Error(result?.error || "Échec de l'enregistrement");
      return result;
    },
    onSuccess: (r) => {
      toast.success(`Enregistrement v${r.version} créé (${r.players_count ?? 0} athlètes). Disponible dans Super Admin → Archives.`);
      setOpen(false);
      setNotes("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <Button variant="outline" size="icon" onClick={() => setOpen(true)} title="Enregistrer la catégorie" aria-label="Enregistrer la catégorie">
        <Save className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enregistrer la catégorie</DialogTitle>
            <DialogDescription>
              Crée un instantané complet de {categoryName ? <strong>{categoryName}</strong> : "cette catégorie"} (athlètes,
              séances, tests, charges, santé, compétitions, vidéos…). La catégorie reste active.
              L'enregistrement est consultable et restaurable depuis Super Admin → Archives.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Note optionnelle (ex: avant tournoi, fin de cycle…)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={() => snapshot.mutate()} disabled={snapshot.isPending}>
              {snapshot.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Créer l'enregistrement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
