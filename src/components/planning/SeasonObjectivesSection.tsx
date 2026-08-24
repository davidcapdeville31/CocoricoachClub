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
import { useTranslation } from "react-i18next";

interface SeasonObjectivesSectionProps {
  categoryId: string;
}

const currentYear = new Date().getFullYear();

function useGoalTypeLabels(t: (k: string) => string): Record<string, string> {
  return {
    team: t("planning.objectives.goalTypes.team"),
    physical: t("planning.objectives.goalTypes.physical"),
    tactical: t("planning.objectives.goalTypes.tactical"),
    technical: t("planning.objectives.goalTypes.technical"),
  };
}

const goalTypeColors: Record<string, string> = {
  team: "bg-blue-500",
  physical: "bg-green-500",
  tactical: "bg-purple-500",
  technical: "bg-orange-500",
};

function useStatusLabels(t: (k: string) => string): Record<string, string> {
  return {
    pending: t("planning.objectives.status.pending"),
    in_progress: t("planning.objectives.status.inProgress"),
    completed: t("planning.objectives.status.completed"),
  };
}

function useMilestoneTypeLabels(t: (k: string) => string): Record<string, string> {
  return {
    competition: t("planning.objectives.milestoneTypes.competition"),
    training: t("planning.objectives.milestoneTypes.training"),
    evaluation: t("planning.objectives.milestoneTypes.evaluation"),
    other: t("planning.objectives.milestoneTypes.other"),
  };
}

export function SeasonObjectivesSection({ categoryId }: SeasonObjectivesSectionProps) {
  const { t } = useTranslation();
  const goalTypeLabels = useGoalTypeLabels(t);
  const statusLabels = useStatusLabels(t);
  const milestoneTypeLabels = useMilestoneTypeLabels(t);
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
      toast.success(t("planning.objectives.toasts.goalAdded"));
      setGoalDialogOpen(false);
      resetGoalForm();
    },
    onError: () => toast.error(t("planning.objectives.toasts.addError")),
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
      toast.success(t("planning.objectives.toasts.milestoneAdded"));
      setMilestoneDialogOpen(false);
      resetMilestoneForm();
    },
    onError: () => toast.error(t("planning.objectives.toasts.addError")),
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
      toast.success(t("planning.objectives.toasts.goalUpdated"));
    },
  });

  const deleteGoalMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("season_goals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["season-goals", categoryId] });
      toast.success(t("planning.objectives.toasts.goalDeleted"));
    },
    onError: () => toast.error(t("planning.objectives.toasts.deleteError")),
  });

  const deleteMilestoneMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("season_milestones").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["season-milestones", categoryId] });
      toast.success(t("planning.objectives.toasts.milestoneDeleted"));
    },
    onError: () => toast.error(t("planning.objectives.toasts.deleteError")),
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
          <h2 className="text-xl font-bold">{t("planning.objectives.seasonTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("planning.objectives.seasonSubtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(selectedSeason)} onValueChange={(v) => setSelectedSeason(Number(v))}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[currentYear - 1, currentYear, currentYear + 1].map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {t("planning.objectives.seasonYear", { year, nextYear: year + 1 })}
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
                <p className="text-xs text-muted-foreground">{t("planning.objectives.milestones")}</p>
                <p className="text-lg font-bold">{completedMilestones}/{milestones.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>


      {/* Individual / group player objectives */}
      <PlayerObjectivesSection categoryId={categoryId} />

      <div className="grid grid-cols-1 gap-6">


        {/* Milestones Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between py-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Flag className="h-4 w-4" />
              {t("planning.objectives.keyMilestones")}
            </CardTitle>
            <Dialog open={milestoneDialogOpen} onOpenChange={setMilestoneDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  {t("planning.objectives.add")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("planning.objectives.newMilestone")}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">{t("planning.objectives.type")}</label>
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
                    <label className="text-sm font-medium">{t("planning.objectives.titleLabel")}</label>
                    <Input 
                      value={milestoneTitle} 
                      onChange={(e) => setMilestoneTitle(e.target.value)}
                      placeholder={t("planning.objectives.milestoneTitlePlaceholder")}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">{t("planning.objectives.description")}</label>
                    <Textarea 
                      value={milestoneDescription} 
                      onChange={(e) => setMilestoneDescription(e.target.value)}
                      placeholder={t("planning.objectives.detailsPlaceholder")}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">{t("planning.objectives.date")}</label>
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
                    {t("planning.objectives.addMilestone")}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
            {milestones.length === 0 ? (
              <p className="text-muted-foreground text-center py-6 text-sm">{t("planning.objectives.noMilestones")}</p>
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
                        <AlertDialogTitle>{t("planning.objectives.confirmDeleteMilestoneTitle")}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t("planning.objectives.confirmDeleteMilestoneDesc", { title: milestone.title })}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t("planning.objectives.cancel")}</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteMilestoneMutation.mutate(milestone.id)}>
                          {t("planning.objectives.delete")}
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
    </div>
  );
}
