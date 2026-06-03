import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Users, User, TrendingUp, Flag, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

interface Props {
  playerId: string;
  categoryId: string;
}

const goalTypeLabels: Record<string, string> = {
  team: "Équipe",
  physical: "Physique",
  tactical: "Tactique",
  technical: "Technique",
  mental: "Mental",
};

const goalTypeColors: Record<string, string> = {
  team: "bg-blue-500",
  physical: "bg-emerald-500",
  tactical: "bg-purple-500",
  technical: "bg-orange-500",
  mental: "bg-sky-500",
};

const statusLabels: Record<string, string> = {
  pending: "À faire",
  in_progress: "En cours",
  completed: "Terminé",
};

const currentYear = new Date().getFullYear();

export function AthleteSpaceObjectives({ playerId, categoryId }: Props) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [formGoalType, setFormGoalType] = useState("physical");
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formTargetDate, setFormTargetDate] = useState("");
  const [formIsMeasurable, setFormIsMeasurable] = useState(false);
  const [formMetricName, setFormMetricName] = useState("");
  const [formMetricUnit, setFormMetricUnit] = useState("");
  const [formTargetValue, setFormTargetValue] = useState("");

  const resetForm = () => {
    setFormGoalType("physical");
    setFormTitle("");
    setFormDescription("");
    setFormTargetDate("");
    setFormIsMeasurable(false);
    setFormMetricName("");
    setFormMetricUnit("");
    setFormTargetValue("");
  };

  // Team objectives (season_goals)
  const { data: teamGoals = [] } = useQuery({
    queryKey: ["athlete-team-goals", categoryId, currentYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("season_goals")
        .select("*")
        .eq("category_id", categoryId)
        .eq("season_year", currentYear)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Personal objectives (player_objectives)
  const { data: personalObjectives = [] } = useQuery({
    queryKey: ["athlete-personal-objectives", playerId, categoryId, currentYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_objectives")
        .select("*")
        .eq("player_id", playerId)
        .eq("category_id", categoryId)
        .eq("season_year", currentYear)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Test reminders
  const { data: testReminders = [] } = useQuery({
    queryKey: ["athlete-space-test-reminders", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_reminders")
        .select("*")
        .eq("category_id", categoryId)
        .eq("is_active", true)
        .order("start_date", { ascending: true })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("player_objectives").insert({
        category_id: categoryId,
        player_id: playerId,
        season_year: currentYear,
        objective_type: formIsMeasurable ? "measurable" : "text",
        goal_type: formGoalType,
        title: formTitle,
        description: formDescription || null,
        target_date: formTargetDate || null,
        metric_name: formIsMeasurable ? formMetricName : null,
        metric_unit: formIsMeasurable ? formMetricUnit : null,
        target_value: formIsMeasurable && formTargetValue ? parseFloat(formTargetValue) : null,
        created_by: user?.id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["athlete-personal-objectives"] });
      toast.success("Objectif ajouté");
      setDialogOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(e?.message || "Erreur lors de l'ajout"),
  });

  const updateMutation = useMutation({
    mutationFn: async (params: { id: string; status?: string; progress?: number; current_value?: number }) => {
      const updates: Record<string, any> = {};
      if (params.status !== undefined) updates.status = params.status;
      if (params.progress !== undefined) updates.progress_percentage = params.progress;
      if (params.current_value !== undefined) updates.current_value = params.current_value;
      const { error } = await supabase.from("player_objectives").update(updates).eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["athlete-personal-objectives"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erreur de mise à jour"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("player_objectives").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["athlete-personal-objectives"] });
      toast.success("Objectif supprimé");
    },
    onError: (e: any) => toast.error(e?.message || "Erreur lors de la suppression"),
  });

  const teamCompletedCount = teamGoals.filter(g => g.status === "completed").length;
  const personalCompletedCount = personalObjectives.filter(o => o.status === "completed").length;
  const totalPersonal = personalObjectives.length;
  const personalProgress = totalPersonal > 0
    ? Math.round(personalObjectives.reduce((s, o) => s + (o.progress_percentage || 0), 0) / totalPersonal)
    : 0;

  return (
    <div className="space-y-6">
      {/* Personal objectives */}
      <Card className="bg-gradient-card shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                Mes Objectifs Personnels
              </CardTitle>
              {totalPersonal > 0 && (
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <Badge variant="secondary" className="text-xs gap-1">
                    <TrendingUp className="h-3 w-3" />
                    {personalCompletedCount}/{totalPersonal} terminés
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    Progression: {personalProgress}%
                  </Badge>
                </div>
              )}
            </div>
            <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
              <DialogTrigger asChild>
                <Button size="sm" className="shrink-0">
                  <Plus className="h-4 w-4 mr-1" />
                  Ajouter
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Nouvel objectif personnel</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Type</Label>
                    <Select value={formGoalType} onValueChange={setFormGoalType}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(goalTypeLabels)
                          .filter(([v]) => v !== "team")
                          .map(([v, l]) => (
                            <SelectItem key={v} value={v}>{l}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Titre</Label>
                    <Input
                      value={formTitle}
                      onChange={e => setFormTitle(e.target.value)}
                      placeholder="Ex: Améliorer ma moyenne strike à 70%"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Description (optionnel)</Label>
                    <Textarea
                      value={formDescription}
                      onChange={e => setFormDescription(e.target.value)}
                      placeholder="Détails..."
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Date cible (optionnel)</Label>
                    <Input
                      type="date"
                      value={formTargetDate}
                      onChange={e => setFormTargetDate(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <Switch checked={formIsMeasurable} onCheckedChange={setFormIsMeasurable} />
                    <div>
                      <Label className="text-sm font-medium">Objectif mesurable (KPI)</Label>
                      <p className="text-xs text-muted-foreground">Suivi automatique de la progression</p>
                    </div>
                  </div>
                  {formIsMeasurable && (
                    <div className="space-y-3 p-3 rounded-lg border border-accent/30">
                      <div>
                        <Label className="text-xs">Métrique</Label>
                        <Input
                          value={formMetricName}
                          onChange={e => setFormMetricName(e.target.value)}
                          placeholder="Ex: Moyenne strikes"
                          className="mt-1 h-8"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Valeur cible</Label>
                          <Input
                            type="number"
                            value={formTargetValue}
                            onChange={e => setFormTargetValue(e.target.value)}
                            placeholder="Ex: 70"
                            className="mt-1 h-8"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Unité</Label>
                          <Input
                            value={formMetricUnit}
                            onChange={e => setFormMetricUnit(e.target.value)}
                            placeholder="Ex: %"
                            className="mt-1 h-8"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  <Button
                    onClick={() => {
                      if (!formTitle.trim()) {
                        toast.error("Veuillez saisir un titre");
                        return;
                      }
                      addMutation.mutate();
                    }}
                    className="w-full"
                  >
                    Ajouter l'objectif
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {personalObjectives.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucun objectif personnel défini. Clique sur "Ajouter" pour en créer un.
            </p>
          ) : (
            <div className="space-y-3">
              {personalObjectives.map(obj => (
                <div key={obj.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${goalTypeColors[obj.goal_type] || "bg-muted"}`} />
                      <span className="font-medium text-sm">{obj.title}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Badge variant={obj.status === "completed" ? "default" : "secondary"} className="text-xs">
                        {statusLabels[obj.status]}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => deleteMutation.mutate(obj.id)}
                      >
                        <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  </div>
                  {obj.description && (
                    <p className="text-xs text-muted-foreground">{obj.description}</p>
                  )}
                  {obj.objective_type === "measurable" && obj.target_value ? (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>{obj.metric_name}: {obj.current_value || 0} / {obj.target_value} {obj.metric_unit || ""}</span>
                        <span>{obj.progress_percentage || 0}%</span>
                      </div>
                      <Progress value={obj.progress_percentage || 0} className="h-1.5" />
                      <div className="flex gap-2 items-center mt-1">
                        <Label className="text-xs shrink-0">Valeur actuelle:</Label>
                        <Input
                          type="number"
                          className="w-20 h-7 text-xs"
                          defaultValue={obj.current_value || 0}
                          onBlur={e => updateMutation.mutate({ id: obj.id, current_value: Number(e.target.value) })}
                        />
                        <span className="text-xs text-muted-foreground">{obj.metric_unit}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>Progression</span>
                        <span>{obj.progress_percentage || 0}%</span>
                      </div>
                      <Progress value={obj.progress_percentage || 0} className="h-1.5" />
                      <div className="flex gap-2 items-center mt-1">
                        <Select
                          value={obj.status}
                          onValueChange={status => updateMutation.mutate({
                            id: obj.id,
                            status,
                            progress: status === "completed" ? 100 : obj.progress_percentage || 0,
                          })}
                        >
                          <SelectTrigger className="w-[110px] h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">À faire</SelectItem>
                            <SelectItem value="in_progress">En cours</SelectItem>
                            <SelectItem value="completed">Terminé</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          className="w-16 h-7 text-xs"
                          defaultValue={obj.progress_percentage || 0}
                          onBlur={e => updateMutation.mutate({ id: obj.id, progress: Number(e.target.value) })}
                        />
                        <span className="text-xs">%</span>
                      </div>
                    </div>
                  )}
                  {obj.target_date && (
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Échéance: {format(new Date(obj.target_date), "d MMMM yyyy", { locale: fr })}
                    </p>
                  )}
                  <Badge variant="outline" className="text-[10px]">
                    {goalTypeLabels[obj.goal_type]}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Team objectives */}
      <Card className="bg-gradient-card shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-accent" />
            Objectifs d'Équipe
          </CardTitle>
          {teamGoals.length > 0 && (
            <Badge variant="secondary" className="text-xs gap-1 w-fit mt-1">
              {teamCompletedCount}/{teamGoals.length} terminés
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          {teamGoals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucun objectif d'équipe défini pour cette saison.
            </p>
          ) : (
            <div className="space-y-3">
              {teamGoals.map(goal => (
                <div key={goal.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${goalTypeColors[goal.goal_type] || "bg-muted"}`} />
                      <span className="font-medium text-sm">{goal.title}</span>
                    </div>
                    <Badge variant={goal.status === "completed" ? "default" : "secondary"} className="text-xs shrink-0">
                      {statusLabels[goal.status]}
                    </Badge>
                  </div>
                  {goal.description && (
                    <p className="text-xs text-muted-foreground">{goal.description}</p>
                  )}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>Progression</span>
                      <span>{goal.progress_percentage || 0}%</span>
                    </div>
                    <Progress value={goal.progress_percentage || 0} className="h-1.5" />
                  </div>
                  {goal.target_date && (
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Échéance: {format(new Date(goal.target_date), "d MMMM yyyy", { locale: fr })}
                    </p>
                  )}
                  <Badge variant="outline" className="text-[10px]">
                    {goalTypeLabels[goal.goal_type]}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test reminders */}
      <Card className="bg-gradient-card shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Flag className="h-4 w-4 text-warning" />
            Tests prévus
          </CardTitle>
        </CardHeader>
        <CardContent>
          {testReminders.length > 0 ? (
            <div className="space-y-2">
              {testReminders.map((reminder) => (
                <div key={reminder.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">{reminder.test_type}</p>
                    <p className="text-xs text-muted-foreground">Tous les {reminder.frequency_weeks} semaines</p>
                  </div>
                  {reminder.start_date && (
                    <Badge variant="outline" className="whitespace-nowrap">
                      {format(new Date(reminder.start_date), "dd MMM", { locale: fr })}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucun test prévu pour le moment.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
