import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus } from "lucide-react";
import { AddPeriodDialog } from "./AddPeriodDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface PeriodsSectionProps {
  categoryId: string;
}

export function PeriodsSection({ categoryId }: PeriodsSectionProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: periods, isLoading } = useQuery({
    queryKey: ["training_periods", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_periods")
        .select("*")
        .eq("category_id", categoryId)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  const getPeriodTypeBadge = (type: string) => {
    const config = {
      préparation: { label: "Préparation", variant: "default" as const },
      compétition: { label: "Compétition", variant: "destructive" as const },
      récupération: { label: "Récupération", variant: "secondary" as const },
      trêve: { label: "Trêve", variant: "outline" as const },
    };
    const { label, variant } = config[type as keyof typeof config] || { label: type, variant: "default" as const };
    return <Badge variant={variant}>{label}</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Périodes d'Entraînement</h3>
        <Button onClick={() => setIsDialogOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Ajouter une Période
        </Button>
      </div>

      {periods && periods.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Début</TableHead>
              <TableHead>Fin</TableHead>
              <TableHead>Charge Cible (%)</TableHead>
              <TableHead>Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {periods.map((period) => (
              <TableRow key={period.id}>
                <TableCell className="font-medium">{period.name}</TableCell>
                <TableCell>{getPeriodTypeBadge(period.period_type)}</TableCell>
                <TableCell>
                  {format(new Date(period.start_date), "dd MMM yyyy", { locale: fr })}
                </TableCell>
                <TableCell>
                  {format(new Date(period.end_date), "dd MMM yyyy", { locale: fr })}
                </TableCell>
                <TableCell>{period.target_load_percentage || "—"}</TableCell>
                <TableCell className="max-w-xs truncate">
                  {period.description || "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="text-center text-muted-foreground py-8">
          Aucune période définie. Créez votre première période d'entraînement.
        </p>
      )}

      <AddPeriodDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        categoryId={categoryId}
      />
    </div>
  );
}
