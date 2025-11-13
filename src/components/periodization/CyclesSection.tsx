import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus } from "lucide-react";
import { AddCycleDialog } from "./AddCycleDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface CyclesSectionProps {
  categoryId: string;
}

export function CyclesSection({ categoryId }: CyclesSectionProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: cycles, isLoading } = useQuery({
    queryKey: ["training_cycles", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_cycles")
        .select(`
          *,
          training_periods(name)
        `)
        .eq("category_id", categoryId)
        .order("week_number", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Cycles d'Entraînement</h3>
        <Button onClick={() => setIsDialogOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Ajouter un Cycle
        </Button>
      </div>

      {cycles && cycles.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Semaine</TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Période</TableHead>
              <TableHead>Début</TableHead>
              <TableHead>Fin</TableHead>
              <TableHead>Intensité Cible</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cycles.map((cycle) => (
              <TableRow key={cycle.id}>
                <TableCell className="font-medium">S{cycle.week_number}</TableCell>
                <TableCell>{cycle.name}</TableCell>
                <TableCell>
                  {cycle.training_periods ? cycle.training_periods.name : "—"}
                </TableCell>
                <TableCell>
                  {format(new Date(cycle.start_date), "dd MMM", { locale: fr })}
                </TableCell>
                <TableCell>
                  {format(new Date(cycle.end_date), "dd MMM", { locale: fr })}
                </TableCell>
                <TableCell>{cycle.target_intensity || "—"}</TableCell>
                <TableCell className="max-w-xs truncate">
                  {cycle.notes || "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="text-center text-muted-foreground py-8">
          Aucun cycle défini. Créez votre premier cycle d'entraînement.
        </p>
      )}

      <AddCycleDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        categoryId={categoryId}
      />
    </div>
  );
}
