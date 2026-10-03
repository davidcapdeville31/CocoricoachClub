import { Gauge } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useCompetitionPlannedRpe, useUpdateCompetitionPlannedRpe } from "@/hooks/useCompetitionPlannedRpe";

export function CompetitionRpeSetting({ categoryId }: { categoryId: string }) {
  const current = useCompetitionPlannedRpe(categoryId);
  const update = useUpdateCompetitionPlannedRpe(categoryId);

  const choose = (v: number) => {
    if (v === current) return;
    update.mutate(v, {
      onSuccess: () => toast.success(`RPE de compétition fixé à ${v}/10`),
      onError: () => toast.error("Impossible d'enregistrer le RPE de compétition"),
    });
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-2">
          <Gauge className="h-4 w-4 mt-0.5 text-primary" />
          <div>
            <p className="text-sm font-semibold">RPE de compétition</p>
            <p className="text-xs text-muted-foreground">
              Objectif d'intensité appliqué à toutes les compétitions (matchs amicaux, championnat, tournois) dans le calendrier de charge et la comparaison RPE prévu/réel.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
            <Button
              key={v}
              type="button"
              size="sm"
              variant={v === current ? "default" : "outline"}
              className={cn("w-10")}
              onClick={() => choose(v)}
            >
              {v}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
