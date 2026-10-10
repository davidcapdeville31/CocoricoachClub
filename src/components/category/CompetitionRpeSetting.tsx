import { useState } from "react";
import { Gauge, Settings2, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useCompetitionPlannedRpe, useUpdateCompetitionPlannedRpe } from "@/hooks/useCompetitionPlannedRpe";
import { useAthleteCompetitionEntry, useUpdateAthleteCompetitionEntry } from "@/hooks/useAthleteCompetitionEntry";

export function CompetitionRpeSetting({ categoryId }: { categoryId: string }) {
  const [open, setOpen] = useState(false);
  const current = useCompetitionPlannedRpe(categoryId);
  const update = useUpdateCompetitionPlannedRpe(categoryId);
  const entryEnabled = useAthleteCompetitionEntry(categoryId);
  const updateEntry = useUpdateAthleteCompetitionEntry(categoryId);

  const choose = (v: number) => {
    if (v === current) return;
    update.mutate(v, {
      onSuccess: () => toast.success(`RPE de compétition fixé à ${v}/10`),
      onError: () => toast.error("Impossible d'enregistrer le RPE de compétition"),
    });
  };

  const toggleEntry = (v: boolean) => {
    updateEntry.mutate(v, {
      onSuccess: () =>
        toast.success(v ? "Les athlètes peuvent saisir leurs données" : "Saisie athlète désactivée"),
      onError: () => toast.error("Impossible d'enregistrer ce réglage"),
    });
  };

  return (
    <>
      <div className="flex justify-end">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
          <Settings2 className="h-4 w-4" />
          Personnaliser les compétitions
        </Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Personnaliser les compétitions</DialogTitle>
            <DialogDescription>Réglages appliqués à toutes les compétitions de cette catégorie.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <Gauge className="h-4 w-4 mt-0.5 text-primary" />
              <div>
                <p className="text-sm font-semibold">RPE de compétition</p>
                <p className="text-xs text-muted-foreground">
                  Objectif d'intensité utilisé dans le calendrier de charge et la comparaison RPE prévu/réel.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
                <Button
                  key={v}
                  type="button"
                  size="sm"
                  variant="outline"
                  data-rpe={v}
                  aria-pressed={v === current}
                  className={cn("min-h-11 min-w-11")}
                  onClick={() => choose(v)}
                >
                  {v}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-start justify-between gap-3 border-t border-border pt-4">
            <div className="flex items-start gap-2">
              <UserCheck className="h-4 w-4 mt-0.5 text-primary" />
              <div>
                <p className="text-sm font-semibold">Saisie par les athlètes</p>
                <p className="text-xs text-muted-foreground">
                  Les athlètes assignés à une compétition peuvent saisir leurs résultats et leur RPE de compétition.
                </p>
              </div>
            </div>
            <Switch checked={entryEnabled} onCheckedChange={toggleEntry} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
