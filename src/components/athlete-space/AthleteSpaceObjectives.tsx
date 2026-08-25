import { getDateLocale } from "@/lib/i18n/dateLocale";
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
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface Props {
  playerId: string;
  categoryId: string;
}

// goalTypeLabels are built inside the component via t()

const goalTypeColors: Record<string, string> = {
  team: "bg-blue-500",
  physical: "bg-emerald-500",
  tactical: "bg-purple-500",
  technical: "bg-orange-500",
  mental: "bg-sky-500",
};

// statusLabels are built inside the component via t()

const currentYear = new Date().getFullYear();

export function AthleteSpaceObjectives({ playerId, categoryId }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const goalTypeLabels: Record<string, string> = {
    team: t("athleteSpace.objectives.goalType.team"),
    physical: t("athleteSpace.objectives.goalType.physical"),
    tactical: t("athleteSpace.objectives.goalType.tactical"),
    technical: t("athleteSpace.objectives.goalType.technical"),
    mental: t("athleteSpace.objectives.goalType.mental"),
  };
  const statusLabels: Record<string, string> = {
    pending: t("athleteSpace.objectives.status.pending"),
    in_progress: t("athleteSpace.objectives.status.in_progress"),
    completed: t("athleteSpace.objectives.status.completed"),
  };
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

  const reminderTestLabels = useCustomTestLabels(
    (testReminders || []).map((r: any) => r.test_type)
  );



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
      toast.success(t("athleteSpace.objectives.objectiveAdded"));
      setDialogOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(e?.message || t("athleteSpace.objectives.addError")),
  });

  const updateMutation = useMutation({
    mutationFn: async (params: { id: string; status?: string; progress?: number; current_value?: number }) => {
      const updates: Record<string, any> = {};
      if (params.status !== undefined) updates.status = params.status;
      if (params.progress !== undefined) updates.progress_percentage = params.progress;
      if (params.current_value !== undefined) updates.current_value = params.current_value;
      const { error } = await supabase.from("player_objectives").update(updates as any).eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["athlete-personal-objectives"] });
    },
    onError: (e: any) => toast.error(e?.message || t("athleteSpace.objectives.updateError")),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("player_objectives").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["athlete-personal-objectives"] });
      toast.success(t("athleteSpace.objectives.objectiveDeleted"));
    },
    onError: (e: any) => toast.error(e?.message || t("athleteSpace.objectives.deleteError")),
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
                {t("athleteSpace.objectives.myPersonalObjectives")}
              </CardTitle>
              {totalPersonal > 0 && (
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <Badge variant="secondary" className="text-xs gap-1">
                    <TrendingUp className="h-3 w-3" />
                    {t("athleteSpace.objectives.completedCount", { completed: personalCompletedCount, total: totalPersonal })}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {t("athleteSpace.objectives.progress", { percent: personalProgress })}
                  </Badge>
                </div>
              )}
            </div>
            <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
              <DialogTrigger asChild>
                <Button size="sm" className="shrink-0">
                  <Plus className="h-4 w-4 mr-1" />
                  {t("athleteSpace.objectives.add")}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{t("athleteSpace.objectives.newPersonalObjective")}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>{t("athleteSpace.objectives.type")}</Label>
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
                    <Label>{t("athleteSpace.objectives.title")}</Label>
                    <Input
                      value={formTitle}
                      onChange={e => setFormTitle(e.target.value)}
                      placeholder={t("athleteSpace.objectives.titlePlaceholder")}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>{t("athleteSpace.objectives.descriptionOptional")}</Label>
                    <Textarea
                      value={formDescription}
                      onChange={e => setFormDescription(e.target.value)}
                      placeholder={t("athleteSpace.objectives.descriptionPlaceholder")}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>{t("athleteSpace.objectives.targetDateOptional")}</Label>
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
                      <Label className="text-sm font-medium">{t("athleteSpace.objectives.measurableGoal")}</Label>
                      <p className="text-xs text-muted-foreground">{t("athleteSpace.objectives.measurableGoalDesc")}</p>
                    </div>
                  </div>
                  {formIsMeasurable && (
                    <div className="space-y-3 p-3 rounded-lg border border-accent/30">
                      <div>
                        <Label className="text-xs">{t("athleteSpace.objectives.metric")}</Label>
                        <Input
                          value={formMetricName}
                          onChange={e => setFormMetricName(e.target.value)}
                          placeholder={t("athleteSpace.objectives.metricPlaceholder")}
                          className="mt-1 h-8"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">{t("athleteSpace.objectives.targetValue")}</Label>
                          <Input
                            type="number"
                            value={formTargetValue}
                            onChange={e => setFormTargetValue(e.target.value)}
                            placeholder={t("athleteSpace.objectives.targetValuePlaceholder")}
                            className="mt-1 h-8"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">{t("athleteSpace.objectives.unit")}</Label>
                          <Input
                            value={formMetricUnit}
                            onChange={e => setFormMetricUnit(e.target.value)}
                            placeholder={t("athleteSpace.objectives.unitPlaceholder")}
                            className="mt-1 h-8"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  <Button
                    onClick={() => {
                      if (!formTitle.trim()) {
                        toast.error(t("athleteSpace.objectives.titleRequired"));
                        return;
                      }
                      addMutation.mutate();
                    }}
                    className="w-full"
                  >
                    {t("athleteSpace.objectives.addObjective")}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {personalObjectives.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t("athleteSpace.objectives.noPersonalObjectives")}
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
                        <Label className="text-xs shrink-0">{t("athleteSpace.objectives.currentValue")}</Label>
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
                        <span>{t("athleteSpace.objectives.progressLabel")}</span>
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
                            <SelectItem value="pending">{t("athleteSpace.objectives.status.pending")}</SelectItem>
                            <SelectItem value="in_progress">{t("athleteSpace.objectives.status.in_progress")}</SelectItem>
                            <SelectItem value="completed">{t("athleteSpace.objectives.status.completed")}</SelectItem>
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
                      {t("athleteSpace.objectives.deadline", { date: format(new Date(obj.target_date), "d MMMM yyyy", { locale: getDateLocale() }) })}
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
            {t("athleteSpace.objectives.teamObjectives")}
          </CardTitle>
          {teamGoals.length > 0 && (
            <Badge variant="secondary" className="text-xs gap-1 w-fit mt-1">
              {t("athleteSpace.objectives.completedCount", { completed: teamCompletedCount, total: teamGoals.length })}
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          {teamGoals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t("athleteSpace.objectives.noTeamObjectives")}
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
                      <span>{t("athleteSpace.objectives.progressLabel")}</span>
                      <span>{goal.progress_percentage || 0}%</span>
                    </div>
                    <Progress value={goal.progress_percentage || 0} className="h-1.5" />
                  </div>
                  {goal.target_date && (
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {t("athleteSpace.objectives.deadline", { date: format(new Date(goal.target_date), "d MMMM yyyy", { locale: getDateLocale() }) })}
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
            {t("athleteSpace.objectives.plannedTests")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {testReminders.length > 0 ? (
            <div className="space-y-2">
              {testReminders.map((reminder) => (
                <div key={reminder.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">{labelizeTestType(reminder.test_type, reminderTestLabels)}</p>
                    <p className="text-xs text-muted-foreground">{t("athleteSpace.objectives.frequencyWeeks", { n: reminder.frequency_weeks })}</p>
                  </div>
                  {reminder.start_date && (
                    <Badge variant="outline" className="whitespace-nowrap">
                      {format(new Date(reminder.start_date), "dd MMM", { locale: getDateLocale() })}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t("athleteSpace.objectives.noPlannedTests")}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
