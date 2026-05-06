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
  clubId: string;
  clubName?: string;
}

export function SnapshotClubButton({ clubId, clubName }: Props) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");

  const snapshot = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("snapshot_club_full" as any, {
        _club_id: clubId,
        _notes: notes || null,
      });
      if (error) throw error;
      const result = data as { success: boolean; error?: string; version?: number };
      if (!result?.success) throw new Error(result?.error || "Échec de l'enregistrement");
      return result;
    },
    onSuccess: (r) => {
      toast.success(`Enregistrement v${r.version} créé. Disponible dans Super Admin → Archives.`);
      setOpen(false);
      setNotes("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        onClick={() => setOpen(true)}
        title="Enregistrer les données du club"
        aria-label="Enregistrer les données du club"
      >
        <Save className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enregistrer les données du club</DialogTitle>
            <DialogDescription>
              Crée un instantané complet de {clubName ? <strong>{clubName}</strong> : "ce club"} (catégories,
              athlètes, séances, tests, santé...). L'enregistrement est consultable dans
              Super Admin → Archives. Les données actuelles ne sont pas modifiées.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Note optionnelle (ex: fin de saison 2024-2025)"
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
