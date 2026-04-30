import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, HeartPulse, Library, Pencil, Trash2 } from "lucide-react";
import { ProgramBuilderDialog } from "./ProgramBuilderDialog";
import { InjuryLibraryDialog } from "./InjuryLibraryDialog";
import { toast } from "sonner";
import { useViewerModeContext } from "@/contexts/ViewerModeContext";

interface RehabProgramsListProps {
  categoryId: string;
}

export function RehabProgramsList({ categoryId }: RehabProgramsListProps) {
  const { isViewer } = useViewerModeContext();
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingProgram, setEditingProgram] = useState<string | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);

  const { data: programs, isLoading, refetch } = useQuery({
    queryKey: ["rehab-programs", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_programs")
        .select(`
          *,
          program_weeks(id, week_number, program_sessions(id)),
          injury_library(id, name, injury_category)
        `)
        .eq("category_id", categoryId)
        .eq("program_kind", "rehab")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer ce programme de réhabilitation ?")) return;
    const { error } = await supabase.from("training_programs").delete().eq("id", id);
    if (error) {
      toast.error("Erreur lors de la suppression");
      return;
    }
    toast.success("Programme supprimé");
    refetch();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <HeartPulse className="h-5 w-5 text-rose-500" />
          <h2 className="text-xl font-semibold">Programmes de réhabilitation</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowLibrary(true)}>
            <Library className="h-4 w-4 mr-2" />
            Bibliothèque blessures
          </Button>
          {!isViewer && (
            <Button onClick={() => setShowBuilder(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nouveau programme
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Chargement...</div>
      ) : !programs?.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <HeartPulse className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-2">Aucun programme de réhabilitation</p>
            <p className="text-sm text-muted-foreground mb-4">
              Crée un programme structuré (Blocs / Semaines / Séances) lié à une blessure de la bibliothèque.
            </p>
            {!isViewer && (
              <Button onClick={() => setShowBuilder(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Créer mon premier programme
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {programs.map((p: any) => {
            const weeks = p.program_weeks?.length || 0;
            const sessions = (p.program_weeks || []).reduce(
              (n: number, w: any) => n + (w.program_sessions?.length || 0), 0
            );
            return (
              <Card key={p.id} className="rounded-2xl">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm truncate">{p.name}</h3>
                      {p.injury_library && (
                        <Badge variant="outline" className="text-xs mt-1">
                          🩹 {p.injury_library.name}
                        </Badge>
                      )}
                    </div>
                    {!isViewer && (
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingProgram(p.id)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(p.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                  {p.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>
                  )}
                  <div className="text-xs text-muted-foreground">
                    📋 {weeks} sem. · {sessions} séance{sessions > 1 ? "s" : ""}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {showBuilder && (
        <ProgramBuilderDialog
          categoryId={categoryId}
          open={showBuilder}
          rehabMode
          onOpenChange={(o) => {
            setShowBuilder(o);
            if (!o) refetch();
          }}
        />
      )}

      {editingProgram && (
        <ProgramBuilderDialog
          categoryId={categoryId}
          programId={editingProgram}
          open={!!editingProgram}
          rehabMode
          onOpenChange={(o) => {
            if (!o) {
              setEditingProgram(null);
              refetch();
            }
          }}
        />
      )}

      {showLibrary && (
        <InjuryLibraryDialog
          categoryId={categoryId}
          open={showLibrary}
          onOpenChange={setShowLibrary}
        />
      )}
    </div>
  );
}
