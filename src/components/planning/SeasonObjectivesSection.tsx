import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, Target, Flag, CheckCircle2, TrendingUp, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { PlayerObjectivesSection } from "./PlayerObjectivesSection";

interface SeasonObjectivesSectionProps {
  categoryId: string;
}

const currentYear = new Date().getFullYear();

const goalTypeLabels: Record<string, string> = {
  team: "Équipe",
  physical: "Physique",
  tactical: "Tactique",
  technical: "Technique",
};

const goalTypeColors: Record<string, string> = {
  team: "bg-blue-500",
  physical: "bg-green-500",
  tactical: "bg-purple-500",
  technical: "bg-orange-500",
};

const statusLabels: Record<string, string> = {
  pending: "À faire",
  in_progress: "En cours",
  completed: "Terminé",
};

const milestoneTypeLabels: Record<string, string> = {
  competition: "Compétition",
  training: "Entraînement",
  evaluation: "Évaluation",
  other: "Autre",
};

export function SeasonObjectivesSection({ categoryId }: SeasonObjectivesSectionProps) {
  const queryClient = useQueryClient();
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [milestoneDialogOpen, setMilestoneDialogOpen] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState(currentYear);

  // Form states for goal
  const [goalType, setGoalType] = useState<string>("team");
  const [goalTitle, setGoalTitle] = useState("");
  const [goalDescription, setGoalDescription] = useState("");
  const [goalTargetDate, setGoalTargetDate] = useState("");

  // Form states for milestone
  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [milestoneDescription, setMilestoneDescription] = useState("");
  const [milestoneDate, setMilestoneDate] = useState("");
  const [milestoneType, setMilestoneType] = useState<string>("competition");

  const { data: goals = [] } = useQuery({
    queryKey: ["season-goals", categoryId, selectedSeason],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("season_goals")
        .select("*")
        .eq("category_id", categoryId)
        .eq("season_year", selectedSeason)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: milestones = [] } = useQuery({
    queryKey: ["season-milestones", categoryId, selectedSeason],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("season_milestones")
        .select("*")
        .eq("category_id", categoryId)
        .eq("season_year", selectedSeason)
        .order("milestone_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const addGoalMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("season_goals").insert({
        category_id: categoryId,
        season_year: selectedSeason,
        goal_type: goalType,
        title: goalTitle,
        description: goalDescription || null,
        target_date: goalTargetDate || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["season-goals", categoryId] });
      toast.success("Objectif ajouté");
      setGoalDialogOpen(false);
      resetGoalForm();
    },
    onError: () => toast.error("Erreur lors de l'ajout"),
  });

  const addMilestoneMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("season_milestones").insert({
        category_id: categoryId,
        season_year: selectedSeason,
        title: milestoneTitle,
        description: milestoneDescription || null,
        milestone_date: milestoneDate,
        milestone_type: milestoneType,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["season-milestones", categoryId] });
      toast.success("Étape ajoutée");
      setMilestoneDialogOpen(false);
      resetMilestoneForm();
    },
    onError: () => toast.error("Erreur lors de l'ajout"),
  });

  const updateGoalMutation = useMutation({
    mutationFn: async ({ id, status, progress }: { id: string; status: string; progress: number }) => {
      const { error } = await supabase
        .from("season_goals")
        .update({ status, progress_percentage: progress })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["season-goals", categoryId] });
      toast.success("Objectif mis à jour");
    },
  });

  const deleteGoalMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("season_goals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["season-goals", categoryId] });
      toast.success("Objectif supprimé");
    },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  const deleteMilestoneMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("season_milestones").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["season-milestones", categoryId] });
      toast.success("Étape supprimée");
    },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  const toggleMilestoneMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase
        .from("season_milestones")
        .update({ is_completed: completed })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["season-milestones", categoryId] });
    },
  });

  const resetGoalForm = () => {
    setGoalType("team");
    setGoalTitle("");
    setGoalDescription("");
    setGoalTargetDate("");
  };

  const resetMilestoneForm = () => {
    setMilestoneTitle("");
    setMilestoneDescription("");
    setMilestoneDate("");
    setMilestoneType("competition");
  };

  const completedGoals = goals.filter((g) => g.status === "completed").length;
  const completedMilestones = milestones.filter((m) => m.is_completed).length;
  const overallProgress = goals.length > 0 
    ? Math.round(goals.reduce((sum, g) => sum + (g.progress_percentage || 0), 0) / goals.length) 
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold">Objectifs de Saison</h2>
          <p className="text-sm text-muted-foreground">Objectifs et étapes clés</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(selectedSeason)} onValueChange={(v) => setSelectedSeason(Number(v))}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[currentYear - 1, currentYear, currentYear + 1].map((year) => (
                <SelectItem key={year} value={String(year)}>
                  Saison {year}/{year + 1}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-500/10 rounded-lg">
                <Flag className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Étapes</p>
                <p className="text-lg font-bold">{completedMilestones}/{milestones.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>


      <div className="grid grid-cols-1 gap-6">


        {/* Milestones Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between py-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Flag className="h-4 w-4" />
              Étapes Clés
            </CardTitle>
            <Dialog open={milestoneDialogOpen} onOpenChange={setMilestoneDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Ajouter
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nouvelle Étape</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Type</label>
                    <Select value={milestoneType} onValueChange={setMilestoneType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(milestoneTypeLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Titre</label>
                    <Input 
                      value={milestoneTitle} 
                      onChange={(e) => setMilestoneTitle(e.target.value)}
                      placeholder="Ex: Début de la compétition"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Description</label>
                    <Textarea 
                      value={milestoneDescription} 
                      onChange={(e) => setMilestoneDescription(e.target.value)}
                      placeholder="Détails..."
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Date</label>
                    <Input 
                      type="date" 
                      value={milestoneDate} 
                      onChange={(e) => setMilestoneDate(e.target.value)}
                    />
                  </div>
                  <Button 
                    onClick={() => addMilestoneMutation.mutate()} 
                    disabled={!milestoneTitle || !milestoneDate}
                    className="w-full"
                  >
                    Ajouter l'étape
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
            {milestones.length === 0 ? (
              <p className="text-muted-foreground text-center py-6 text-sm">Aucune étape définie</p>
            ) : (
              milestones.map((milestone) => (
                <div 
                  key={milestone.id} 
                  className={`flex items-start gap-3 p-3 rounded-lg border ${
                    milestone.is_completed ? "bg-muted/50" : ""
                  }`}
                >
                  <Checkbox 
                    checked={milestone.is_completed}
                    onCheckedChange={(checked) => 
                      toggleMilestoneMutation.mutate({ id: milestone.id, completed: !!checked })
                    }
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-medium text-sm ${milestone.is_completed ? "line-through text-muted-foreground" : ""}`}>
                        {milestone.title}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {milestoneTypeLabels[milestone.milestone_type]}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(milestone.milestone_date), "d MMMM yyyy", { locale: fr })}
                    </p>
                    {milestone.description && (
                      <p className="text-xs text-muted-foreground mt-1">{milestone.description}</p>
                    )}
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer cette étape ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          « {milestone.title} » sera définitivement supprimée.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteMilestoneMutation.mutate(milestone.id)}>
                          Supprimer
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Individual player objectives */}
      <PlayerObjectivesSection categoryId={categoryId} />
    </div>
  );
}
