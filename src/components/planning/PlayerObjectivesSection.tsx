import { useMemo, useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { translateOnSave } from "@/lib/i18n/contentTranslation";
import { useContentTranslation } from "@/hooks/use-content-translation";
import { Plus, Target, User, TrendingUp, Trash2, Users } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useTranslation } from "react-i18next";

interface PlayerObjectivesSectionProps {
  categoryId: string;
}

function useGoalTypeLabels(t: (k: string) => string): Record<string, string> {
  return {
    physical: t("planning.objectives.goalTypes.physical"),
    tactical: t("planning.objectives.goalTypes.tactical"),
    technical: t("planning.objectives.goalTypes.technical"),
    mental: t("planning.objectives.goalTypes.mental"),
  };
}

const goalTypeColors: Record<string, string> = {
  physical: "bg-emerald-500",
  tactical: "bg-purple-500",
  technical: "bg-orange-500",
  mental: "bg-sky-500",
};

function useStatusLabels(t: (k: string) => string): Record<string, string> {
  return {
    pending: t("planning.objectives.status.pending"),
    in_progress: t("planning.objectives.status.inProgress"),
    completed: t("planning.objectives.status.completed"),
  };
}

const currentYear = new Date().getFullYear();

export function PlayerObjectivesSection({ categoryId }: PlayerObjectivesSectionProps) {
  const { t } = useTranslation();
  const goalTypeLabels = useGoalTypeLabels(t);
  const statusLabels = useStatusLabels(t);
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("all");
  const [selectedSeason, setSelectedSeason] = useState(currentYear);

  // Form
  const [formPlayerIds, setFormPlayerIds] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [formGoalType, setFormGoalType] = useState("physical");
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formTargetDate, setFormTargetDate] = useState("");
  const [formIsMeasurable, setFormIsMeasurable] = useState(false);
  const [formMetricName, setFormMetricName] = useState("");
  const [formMetricUnit, setFormMetricUnit] = useState("");
  const [formTargetValue, setFormTargetValue] = useState("");

  const { data: players = [] } = useQuery({
    queryKey: ["category-players-objectives", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, name, first_name")
        .eq("category_id", categoryId)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: objectives = [] } = useQuery({
    queryKey: ["player-objectives", categoryId, selectedSeason, selectedPlayerId],
    queryFn: async () => {
      let query = supabase
        .from("player_objectives")
        .select("*, players!player_objectives_player_id_fkey(name, first_name)")
        .eq("category_id", categoryId)
        .eq("season_year", selectedSeason)
        .order("created_at", { ascending: false });

      if (selectedPlayerId !== "all") {
        query = query.eq("player_id", selectedPlayerId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { tc } = useContentTranslation(
    useMemo(
      () => (objectives ?? []).flatMap((o: any) => [o.title, o.description]),
      [objectives],
    ),
  );

  const addMutation = useMutation({
    mutationFn: async () => {
      if (formPlayerIds.length === 0) {
        throw new Error(t("planning.objectives.selectAtLeastOne"));
      }
      if (!formTitle.trim()) {
        throw new Error(t("planning.objectives.titleRequired"));
      }
      const { data: { user } } = await supabase.auth.getUser();
      const rows = formPlayerIds.map((pid) => ({
        category_id: categoryId,
        player_id: pid,
        season_year: selectedSeason,
        objective_type: formIsMeasurable ? "measurable" : "text",
        goal_type: formGoalType,
        title: formTitle,
        description: formDescription || null,
        target_date: formTargetDate || null,
        metric_name: formIsMeasurable ? formMetricName : null,
        metric_unit: formIsMeasurable ? formMetricUnit : null,
        target_value: formIsMeasurable && formTargetValue ? parseFloat(formTargetValue) : null,
        created_by: user?.id || null,
      }));
      const { error } = await supabase.from("player_objectives").insert(rows);
      if (error) throw error;
      return rows.length;
      void translateOnSave([formTitle, formDescription, formMetricName]);
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["player-objectives"] });
      toast.success(count && count > 1 ? t("planning.objectives.groupGoalAdded", { count }) : t("planning.objectives.toasts.goalAdded"));
      setDialogOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(e?.message || t("planning.objectives.toasts.addError")),
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
      queryClient.invalidateQueries({ queryKey: ["player-objectives"] });
      toast.success(t("planning.objectives.toasts.goalUpdated"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("player_objectives").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["player-objectives"] });
      toast.success(t("planning.objectives.toasts.goalDeleted"));
    },
  });

  const resetForm = () => {
    setFormPlayerIds([]);
    setFormGoalType("physical");
    setFormTitle("");
    setFormDescription("");
    setFormTargetDate("");
    setFormIsMeasurable(false);
    setFormMetricName("");
    setFormMetricUnit("");
    setFormTargetValue("");
  };

  const getPlayerName = (obj: any) => {
    const p = obj.players;
    if (!p) return t("planning.objectives.unknown");
    return p.first_name ? `${p.first_name} ${p.name}` : p.name;
  };

  const completedCount = objectives.filter(o => o.status === "completed").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            {t("planning.objectives.title")}
          </h3>
          <p className="text-sm text-muted-foreground">{t("planning.objectives.individualOrGroup")}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={selectedPlayerId} onValueChange={setSelectedPlayerId}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t("planning.objectives.allPlayers")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("planning.objectives.allPlayers")}</SelectItem>
              {players.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.first_name ? `${p.first_name} ${p.name}` : p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                {t("planning.objectives.objectiveLabel")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t("planning.objectives.newObjective")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      {t("planning.objectives.concernedAthletes")}
                      {formPlayerIds.length > 1 && (
                        <Badge variant="secondary" className="text-[10px]">
                          {t("planning.objectives.groupGoalCount", { count: formPlayerIds.length })}
                        </Badge>
                      )}
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() =>
                        setFormPlayerIds(
                          formPlayerIds.length === players.length ? [] : players.map((p) => p.id),
                        )
                      }
                    >
                      {formPlayerIds.length === players.length ? t("planning.objectives.uncheckAll") : t("planning.objectives.checkAll")}
                    </Button>
                  </div>
                  <div className="mt-1 max-h-48 overflow-y-auto rounded-lg border p-2 space-y-1">
                    {players.length === 0 && (
                      <p className="text-xs text-muted-foreground p-2">{t("planning.objectives.noAthleteInCategory")}</p>
                    )}
                    {players.map((p) => {
                      const checked = formPlayerIds.includes(p.id);
                      return (
                        <label
                          key={p.id}
                          className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60 cursor-pointer"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) =>
                              setFormPlayerIds((prev) =>
                                v ? [...prev, p.id] : prev.filter((id) => id !== p.id),
                              )
                            }
                          />
                          <span className="text-sm">
                            {p.first_name ? `${p.first_name} ${p.name}` : p.name}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <Label>{t("planning.objectives.type")}</Label>
                  <Select value={formGoalType} onValueChange={setFormGoalType}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(goalTypeLabels).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("planning.objectives.titleLabel")}</Label>
                  <Input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder={t("planning.objectives.titlePlaceholder")} className="mt-1" />
                </div>
                <div>
                  <Label>{t("planning.objectives.descriptionOptional")}</Label>
                  <Textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} placeholder={t("planning.objectives.detailsPlaceholder")} className="mt-1" />
                </div>
                <div>
                  <Label>{t("planning.objectives.targetDateOptional")}</Label>
                  <Input type="date" value={formTargetDate} onChange={e => setFormTargetDate(e.target.value)} className="mt-1" />
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Switch checked={formIsMeasurable} onCheckedChange={setFormIsMeasurable} />
                  <div>
                    <Label className="text-sm font-medium">{t("planning.objectives.measurableGoal")}</Label>
                    <p className="text-xs text-muted-foreground">{t("planning.objectives.autoProgressTracking")}</p>
                  </div>
                </div>

                {formIsMeasurable && (
                  <div className="space-y-3 p-3 rounded-lg border border-accent/30">
                    <div>
                      <Label className="text-xs">{t("planning.objectives.metric")}</Label>
                      <Input value={formMetricName} onChange={e => setFormMetricName(e.target.value)} placeholder={t("planning.objectives.metricPlaceholder")} className="mt-1 h-8" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">{t("planning.objectives.targetValue")}</Label>
                        <Input type="number" value={formTargetValue} onChange={e => setFormTargetValue(e.target.value)} placeholder={t("planning.objectives.targetValuePlaceholder")} className="mt-1 h-8" />
                      </div>
                      <div>
                        <Label className="text-xs">{t("planning.objectives.unit")}</Label>
                        <Input value={formMetricUnit} onChange={e => setFormMetricUnit(e.target.value)} placeholder={t("planning.objectives.unitPlaceholder")} className="mt-1 h-8" />
                      </div>
                    </div>
                  </div>
                )}

                <Button onClick={() => addMutation.mutate()} className="w-full">
                  {formPlayerIds.length > 1
                    ? t("planning.objectives.addObjectiveForCount", { count: formPlayerIds.length })
                    : t("planning.objectives.addObjective")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-3">
        <Badge variant="secondary" className="gap-1">
          <Target className="h-3 w-3" /> {t("planning.objectives.objectivesCount", { count: objectives.length })}
        </Badge>
        <Badge variant="secondary" className="gap-1 text-status-optimal">
          <TrendingUp className="h-3 w-3" /> {t("planning.objectives.completedCount", { count: completedCount })}
        </Badge>
      </div>

      {/* Objectives list */}
      {objectives.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-muted-foreground text-center text-sm">
              {t("planning.objectives.noObjectivesHint")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {objectives.map((obj) => (
            <Card key={obj.id} className="overflow-hidden">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${goalTypeColors[obj.goal_type] || "bg-muted"}`} />
                    <span className="font-medium text-sm truncate">{tc(obj.title)}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge variant="outline" className="text-xs">{getPlayerName(obj)}</Badge>
                    <Badge variant={obj.status === "completed" ? "default" : "secondary"} className="text-xs">
                      {statusLabels[obj.status]}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      title={t("planning.objectives.deleteObjective")}
                      onClick={() => setDeleteTarget(obj)}
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
                      <Label className="text-xs shrink-0">{t("planning.objectives.currentValue")}</Label>
                      <Input
                        type="number"
                        className="w-20 h-7 text-xs"
                        value={obj.current_value || 0}
                        onChange={e => updateMutation.mutate({ id: obj.id, current_value: Number(e.target.value) })}
                      />
                      <span className="text-xs text-muted-foreground">{obj.metric_unit}</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>{t("planning.objectives.progress")}</span>
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
                        <SelectTrigger className="w-[100px] h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">{t("planning.objectives.status.pending")}</SelectItem>
                          <SelectItem value="in_progress">{t("planning.objectives.status.inProgress")}</SelectItem>
                          <SelectItem value="completed">{t("planning.objectives.status.completed")}</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        className="w-16 h-7 text-xs"
                        value={obj.progress_percentage || 0}
                        onChange={e => updateMutation.mutate({ id: obj.id, status: obj.status, progress: Number(e.target.value) })}
                      />
                      <span className="text-xs">%</span>
                    </div>
                  </div>
                )}

                {obj.target_date && (
                  <p className="text-[10px] text-muted-foreground">
                    {t("planning.objectives.deadline")}: {format(new Date(obj.target_date), "d MMM yyyy", { locale: fr })}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("planning.objectives.confirmDeleteObjectiveTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("planning.objectives.confirmDeleteObjectiveDesc", { title: deleteTarget?.title })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("planning.objectives.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              {t("planning.objectives.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
