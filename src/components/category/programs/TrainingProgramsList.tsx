import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Plus, FolderOpen, Dumbbell, Search, Library, ChevronDown, ChevronRight } from "lucide-react";
import { ProgramBuilderDialog } from "./ProgramBuilderDialog";
import { AssignProgramDialog } from "./AssignProgramDialog";
import { ProgramDetailsDialog } from "./ProgramDetailsDialog";
import { ProgramCard } from "./ProgramCard";
import { toast } from "sonner";
import { useViewerModeContext } from "@/contexts/ViewerModeContext";

interface TrainingProgramsListProps {
  categoryId: string;
}

// Theme labels mirror ProgramBuilderDialog BASE_THEMES
const THEME_LABELS: Record<string, string> = {
  musculation: "Musculation / Hypertrophie",
  course: "Course",
  reathletisation: "Réathlétisation",
  terrain: "Terrain",
};

const SUBTHEME_LABELS: Record<string, string> = {
  force: "Force",
  hypertrophie: "Hypertrophie",
  puissance: "Puissance",
  vitesse: "Vitesse",
  endurance_force: "Endurance de force",
  ef: "Endurance Fondamentale",
  seuil: "Seuil",
  vma: "VMA",
  fractionne: "Fractionné",
  tempo_run: "Tempo Run",
  fartlek: "Fartlek",
  cote: "Côtes",
  sprint: "Sprint",
  recup_active: "Récupération active",
  phase_1: "Phase 1",
  phase_2: "Phase 2",
  phase_3: "Phase 3",
  phase_4: "Phase 4",
  physique: "Physique général",
  collectif: "Collectif",
  bronco: "Bronco",
  yoyo_test: "Yo-Yo Test",
  intermittent: "Intermittent",
};

const UNCATEGORIZED = "__uncategorized__";

export function TrainingProgramsList({ categoryId }: TrainingProgramsListProps) {
  const { isViewer } = useViewerModeContext();
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingProgram, setEditingProgram] = useState<string | null>(null);
  const [assigningProgram, setAssigningProgram] = useState<string | null>(null);
  const [viewingProgram, setViewingProgram] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTheme, setSelectedTheme] = useState<string>("all");

  const { data: programs, isLoading, refetch } = useQuery({
    queryKey: ["training-programs", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_programs")
        .select(`
          *,
          program_weeks(
            id,
            week_number,
            program_sessions(id)
          ),
          program_assignments(
            id,
            player_id,
            is_active,
            players(name)
          )
        `)
        .eq("category_id", categoryId)
        .or("program_kind.eq.training,program_kind.is.null")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const handleDelete = async (programId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce programme ?")) return;

    const { error } = await supabase
      .from("training_programs")
      .delete()
      .eq("id", programId);

    if (error) {
      toast.error("Erreur lors de la suppression");
      return;
    }

    toast.success("Programme supprimé");
    refetch();
  };

  const handleDuplicate = async (programId: string) => {
    const program = programs?.find((p) => p.id === programId);
    if (!program) return;

    try {
      const { data: newProgram, error: programError } = await supabase
        .from("training_programs")
        .insert({
          category_id: categoryId,
          name: `${program.name} (copie)`,
          description: program.description,
          level: program.level,
          body_zone: program.body_zone,
          theme: program.theme,
          reathletisation_phase: program.reathletisation_phase,
          is_active: false,
        })
        .select()
        .single();

      if (programError) throw programError;

      const { data: weeks, error: weeksError } = await supabase
        .from("program_weeks")
        .select(`
          *,
          program_sessions(
            *,
            program_exercises(*)
          )
        `)
        .eq("program_id", programId)
        .order("week_number");

      if (weeksError) throw weeksError;

      for (const week of weeks || []) {
        const { data: newWeek, error: weekError } = await supabase
          .from("program_weeks")
          .insert({
            program_id: newProgram.id,
            week_number: week.week_number,
            name: week.name,
          })
          .select()
          .single();

        if (weekError) throw weekError;

        for (const session of week.program_sessions || []) {
          const { data: newSession, error: sessionError } = await supabase
            .from("program_sessions")
            .insert({
              week_id: newWeek.id,
              session_number: session.session_number,
              name: session.name,
              day_of_week: session.day_of_week,
              scheduled_day: session.scheduled_day,
            })
            .select()
            .single();

          if (sessionError) throw sessionError;

          const exercises = session.program_exercises || [];
          if (exercises.length > 0) {
            const exercisesToInsert = exercises.map((ex: any) => ({
              session_id: newSession.id,
              exercise_name: ex.exercise_name,
              library_exercise_id: ex.library_exercise_id,
              exercise_category: ex.exercise_category,
              order_index: ex.order_index,
              method: ex.method,
              sets: ex.sets,
              reps: ex.reps,
              percentage_1rm: ex.percentage_1rm,
              tempo: ex.tempo,
              rest_seconds: ex.rest_seconds,
              group_id: ex.group_id,
              group_order: ex.group_order,
              notes: ex.notes,
              drop_sets: ex.drop_sets,
              cluster_sets: ex.cluster_sets,
              is_rm_test: ex.is_rm_test,
              rm_test_type: ex.rm_test_type,
              target_velocity: ex.target_velocity,
              target_force_newton: ex.target_force_newton,
              erg_data: ex.erg_data,
              running_data: ex.running_data,
            }));

            await supabase.from("program_exercises").insert(exercisesToInsert);
          }
        }
      }

      toast.success("Programme dupliqué avec succès");
      refetch();
    } catch (error: any) {
      console.error("Duplicate error:", error);
      toast.error("Erreur lors de la duplication: " + error.message);
    }
  };

  // Filter + search
  const filteredPrograms = useMemo(() => {
    if (!programs) return [];
    const term = searchTerm.trim().toLowerCase();
    return programs.filter((p: any) => {
      const themeKey = p.theme || UNCATEGORIZED;
      if (selectedTheme !== "all" && themeKey !== selectedTheme) return false;
      if (!term) return true;
      const haystack = [
        p.name,
        p.description,
        THEME_LABELS[p.theme] || "",
        SUBTHEME_LABELS[p.reathletisation_phase] || "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [programs, searchTerm, selectedTheme]);

  // Group by theme for display
  const groupedPrograms = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const p of filteredPrograms) {
      const key = p.theme || UNCATEGORIZED;
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    }
    // Order: known themes first, uncategorized last
    const ordered = Object.entries(groups).sort(([a], [b]) => {
      if (a === UNCATEGORIZED) return 1;
      if (b === UNCATEGORIZED) return -1;
      return (THEME_LABELS[a] || a).localeCompare(THEME_LABELS[b] || b);
    });
    return ordered;
  }, [filteredPrograms]);

  // Theme counts for the dropdown
  const themeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of programs || []) {
      const key = p.theme || UNCATEGORIZED;
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [programs]);

  const availableThemes = Object.keys(themeCounts);

  return (
    <div className="space-y-6">
      {/* Hero header — Bibliothèque de Programmes */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-6 shadow-sm">
        <div className="flex flex-col items-center text-center gap-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center justify-center gap-2">
              <Library className="h-6 w-6 text-primary" />
              Bibliothèque de Programmes
            </h2>
            <p className="text-muted-foreground mt-1">
              Vos programmes sont sauvegardés ici par thématique pour les
              réutiliser et les attribuer à tout moment
            </p>
          </div>
          {!isViewer && (
            <Button
              onClick={() => setShowBuilder(true)}
              size="lg"
              className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 font-semibold px-8 rounded-2xl"
            >
              <Plus className="h-5 w-5" />
              Créer un programme d'entraînement
            </Button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher un programme..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-muted/40 rounded-2xl"
        />
      </div>

      {/* Theme filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant={selectedTheme === "all" ? "default" : "outline"}
          className="cursor-pointer px-3 py-1.5 text-sm"
          onClick={() => setSelectedTheme("all")}
        >
          Toutes ({programs?.length || 0})
        </Badge>

        <Select
          value={selectedTheme !== "all" ? selectedTheme : ""}
          onValueChange={setSelectedTheme}
        >
          <SelectTrigger className="w-[280px] h-9 rounded-2xl">
            <SelectValue placeholder="Filtrer par thématique..." />
          </SelectTrigger>
          <SelectContent>
            {availableThemes.map((key) => (
              <SelectItem key={key} value={key}>
                {key === UNCATEGORIZED
                  ? "Sans thématique"
                  : THEME_LABELS[key] || key}{" "}
                ({themeCounts[key]})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedTheme !== "all" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedTheme("all")}
            className="text-xs h-7"
          >
            Réinitialiser
          </Button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">
          Chargement...
        </div>
      ) : !programs?.length ? (
        <Card className="border-dashed rounded-2xl">
          <CardContent className="py-12 text-center">
            <Dumbbell className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              Votre bibliothèque est vide. Créez votre premier programme
              d'entraînement pour le retrouver ici.
            </p>
          </CardContent>
        </Card>
      ) : filteredPrograms.length === 0 ? (
        <Card className="border-dashed rounded-2xl">
          <CardContent className="py-12 text-center">
            <FolderOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              Aucun programme ne correspond à votre recherche.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {groupedPrograms.map(([themeKey, themePrograms]) => (
            <section key={themeKey} className="space-y-3">
              <div className="flex items-center gap-3 border-l-4 border-primary pl-3">
                <h3 className="text-lg font-bold uppercase tracking-wide text-foreground">
                  {themeKey === UNCATEGORIZED
                    ? "Sans thématique"
                    : THEME_LABELS[themeKey] || themeKey}
                </h3>
                <Badge variant="secondary" className="rounded-full">
                  {themePrograms.length}
                </Badge>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {themePrograms.map((program: any) => (
                  <ProgramCard
                    key={program.id}
                    program={program}
                    isViewer={isViewer}
                    onEdit={setEditingProgram}
                    onDuplicate={handleDuplicate}
                    onAssign={setAssigningProgram}
                    onDelete={handleDelete}
                    onViewDetails={setViewingProgram}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {showBuilder && (
        <ProgramBuilderDialog
          categoryId={categoryId}
          open={showBuilder}
          onOpenChange={(open) => {
            setShowBuilder(open);
            if (!open) refetch();
          }}
        />
      )}

      {editingProgram && (
        <ProgramBuilderDialog
          categoryId={categoryId}
          programId={editingProgram}
          open={!!editingProgram}
          onOpenChange={(open) => {
            if (!open) {
              setEditingProgram(null);
              refetch();
            }
          }}
        />
      )}

      {assigningProgram && (
        <AssignProgramDialog
          categoryId={categoryId}
          programId={assigningProgram}
          open={!!assigningProgram}
          onOpenChange={(open) => {
            if (!open) {
              setAssigningProgram(null);
              refetch();
            }
          }}
        />
      )}

      {viewingProgram && (
        <ProgramDetailsDialog
          programId={viewingProgram}
          open={!!viewingProgram}
          onOpenChange={(open) => {
            if (!open) setViewingProgram(null);
          }}
          onEdit={(programId) => {
            setViewingProgram(null);
            setEditingProgram(programId);
          }}
        />
      )}
    </div>
  );
}
