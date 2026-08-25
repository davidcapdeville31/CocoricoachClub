import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, HeartPulse, Pencil, Trash2 } from "lucide-react";
import { ProgramBuilderDialog } from "./ProgramBuilderDialog";
import { toast } from "sonner";
import { useViewerModeContext } from "@/contexts/ViewerModeContext";
import { useTranslation } from "react-i18next";

interface RehabProgramsListProps {
  categoryId: string;
}

export function RehabProgramsList({ categoryId }: RehabProgramsListProps) {
  const { t } = useTranslation();
  const { isViewer } = useViewerModeContext();
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingProgram, setEditingProgram] = useState<string | null>(null);

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
    if (!confirm(t("programmation.rehab.confirmDelete"))) return;
    const { error } = await supabase.from("training_programs").delete().eq("id", id);
    if (error) {
      toast.error(t("programmation.rehab.deleteError"));
      return;
    }
    toast.success(t("programmation.rehab.deleteSuccess"));
    refetch();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <HeartPulse className="h-5 w-5 text-rose-500" />
          <h2 className="text-xl font-semibold">{t("programmation.rehab.title")}</h2>
        </div>
        <div className="flex gap-2">
          {!isViewer && (
            <Button onClick={() => setShowBuilder(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t("programmation.rehab.newProgram")}
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">{t("programmation.rehab.loading")}</div>
      ) : !programs?.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <HeartPulse className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-2">{t("programmation.rehab.empty")}</p>
            <p className="text-sm text-muted-foreground mb-4">
              {t("programmation.rehab.emptyDesc")}
            </p>
            {!isViewer && (
              <Button onClick={() => setShowBuilder(true)}>
                <Plus className="h-4 w-4 mr-2" />
                {t("programmation.rehab.createFirst")}
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
                    📋 {t("programmation.rehab.weeksSessions", { weeks, sessionsCount: sessions })}
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

    </div>
  );
}
