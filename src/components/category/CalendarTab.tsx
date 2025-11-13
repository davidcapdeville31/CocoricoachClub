import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AddSessionDialog } from "./AddSessionDialog";

interface CalendarTabProps {
  categoryId: string;
}

const trainingTypeLabels: Record<string, string> = {
  collectif: "Collectif",
  technique_individuelle: "Technique Individuelle",
  physique: "Physique",
  musculation: "Musculation",
  repos: "Repos",
  test: "Test",
};

export function CalendarTab({ categoryId }: CalendarTabProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["training_sessions", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_sessions")
        .select("*")
        .eq("category_id", categoryId)
        .order("session_date", { ascending: false })
        .order("session_time", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const deleteSession = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase
        .from("training_sessions")
        .delete()
        .eq("id", sessionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training_sessions", categoryId] });
      toast.success("Séance supprimée avec succès");
    },
    onError: () => {
      toast.error("Erreur lors de la suppression de la séance");
    },
  });

  if (isLoading) {
    return <p className="text-muted-foreground">Chargement...</p>;
  }

  return (
    <Card className="bg-gradient-card shadow-md">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Calendrier des entraînements</CardTitle>
          <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Ajouter une séance
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {sessions && sessions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">Aucune séance enregistrée</p>
            <Button onClick={() => setIsAddDialogOpen(true)} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Ajouter la première séance
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Heure</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Intensité</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions?.map((session) => (
                  <TableRow key={session.id} className="animate-fade-in">
                    <TableCell>
                      {new Date(session.session_date).toLocaleDateString("fr-FR")}
                    </TableCell>
                    <TableCell>
                      {session.session_time || "-"}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-primary/10 text-primary">
                        {trainingTypeLabels[session.training_type]}
                      </span>
                    </TableCell>
                    <TableCell>
                      {session.intensity ? `${session.intensity}/10` : "-"}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {session.notes || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm("Êtes-vous sûr de vouloir supprimer cette séance ?")) {
                            deleteSession.mutate(session.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <AddSessionDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        categoryId={categoryId}
      />
    </Card>
  );
}
