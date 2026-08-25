import { getDateLocale } from "@/lib/i18n/dateLocale";
import { useEffect, useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, startOfWeek, addDays, addWeeks, subWeeks } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, X, Clock, MapPin, Download, Printer, Target, Trophy, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { exportWeeklyPlanningToPdf, printElement } from "@/lib/pdfExport";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useViewerModeContext } from "@/contexts/ViewerModeContext";
import { EXERCISE_CATEGORIES } from "@/lib/constants/rugbyPrecisionExercises";
import { isRugbyType } from "@/lib/constants/sportTypes";
import { PrecisionFieldTracker } from "@/components/rugby/PrecisionFieldTracker";
import { useTranslation } from "react-i18next";

interface WeeklyPlanningCalendarProps {
  categoryId: string;
}

const DAYS_FALLBACK = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

interface PlanningItem {
  id: string;
  day_of_week: number;
  time_slot: string | null;
  custom_title: string | null;
  location: string | null;
  status: string | null;
  template_id: string | null;
  is_match?: boolean;
  match_opponent?: string | null;
  notes?: string | null;
  template?: {
    name: string;
    session_type: string;
    duration_minutes: number | null;
    intensity: string | null;
  } | null;
}

type SessionMode = "session" | "match" | "precision";

export function WeeklyPlanningCalendar({ categoryId }: WeeklyPlanningCalendarProps) {
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [newItemTitle, setNewItemTitle] = useState("");
  const [newItemTime, setNewItemTime] = useState("");
  const [newItemLocation, setNewItemLocation] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("none");
  const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null);
  const [sessionMode, setSessionMode] = useState<SessionMode>("session");
  const [matchOpponent, setMatchOpponent] = useState("");
  const [isHomeMatch, setIsHomeMatch] = useState(true);
  const [precisionCategory, setPrecisionCategory] = useState<string>("buteur");
  const [precisionTrackerOpen, setPrecisionTrackerOpen] = useState(false);
  const [precisionItemDate, setPrecisionItemDate] = useState<string | null>(null);
  const [precisionSessionId, setPrecisionSessionId] = useState<string | null>(null);

  const { t } = useTranslation();
  const DAYS = (t("planning.weeklyCalendar.days", { returnObjects: true }) as string[]) || DAYS_FALLBACK;

  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { isViewer } = useViewerModeContext();

  const weekStartStr = format(currentWeekStart, "yyyy-MM-dd");

  // Fetch category sport type
  const { data: category } = useQuery({
    queryKey: ["category-sport-type-planning", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("rugby_type")
        .eq("id", categoryId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const sportType = category?.rugby_type || "";
  const isRugby = isRugbyType(sportType);

  const { data: planning, isLoading } = useQuery({
    queryKey: ["weekly-planning", categoryId, weekStartStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weekly_planning")
        .select(`
          *,
          template:session_templates(name, session_type, duration_minutes, intensity)
        `)
        .eq("category_id", categoryId)
        .eq("week_start_date", weekStartStr);
      if (error) throw error;
      return data as PlanningItem[];
    },
  });

  // Fetch matches for the current week from the matches table
  const weekEndStr = format(addDays(currentWeekStart, 6), "yyyy-MM-dd");
  const { data: weekMatches = [] } = useQuery({
    queryKey: ["weekly-matches", categoryId, weekStartStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("id, match_date, match_time, opponent, location, is_finalized, is_home, score_home, score_away, competition, event_type")
        .eq("category_id", categoryId)
        .eq("is_personal", false)
        .or("event_type.is.null,event_type.neq.training")
        .gte("match_date", weekStartStr)
        .lte("match_date", weekEndStr);
      if (error) throw error;
      return data || [];
    },
  });

  // Group matches by day of week
  const matchesByDay = useMemo(() => {
    const result: Record<number, typeof weekMatches> = {};
    DAYS.forEach((_, i) => { result[i] = []; });
    weekMatches.forEach((m) => {
      const matchDate = new Date(m.match_date + "T00:00:00");
      const dayIndex = DAYS.findIndex((_, i) => {
        const dayDate = format(addDays(currentWeekStart, i), "yyyy-MM-dd");
        return dayDate === m.match_date;
      });
      if (dayIndex >= 0) {
        result[dayIndex].push(m);
      }
    });
    return result;
  }, [weekMatches, currentWeekStart]);

  const { data: templates } = useQuery({
    queryKey: ["session-templates", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("session_templates")
        .select("*")
        .eq("category_id", categoryId);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!pendingTemplateId) return;
    const exists = templates?.some((t) => t.id === pendingTemplateId);
    if (exists) {
      setSelectedTemplateId(pendingTemplateId);
      setPendingTemplateId(null);
    }
  }, [pendingTemplateId, templates]);

  const addPlanningItem = useMutation({
    mutationFn: async () => {
      if (selectedDay === null) return;
      
      const itemDate = format(addDays(currentWeekStart, selectedDay), "yyyy-MM-dd");
      
      // If it's a match, also create it in the matches table
      if (sessionMode === "match" && matchOpponent) {
        const { error: matchError } = await supabase.from("matches").insert({
          category_id: categoryId,
          opponent: matchOpponent,
          match_date: itemDate,
          match_time: newItemTime || null,
          location: newItemLocation || null,
          is_home: isHomeMatch,
        });
        if (matchError) throw matchError;
      }

      // If precision session, also create a training_session
      if (sessionMode === "precision") {
        const catLabel = EXERCISE_CATEGORIES.find(c => c.key === precisionCategory)?.label || "Précision";
        const firstExercise = EXERCISE_CATEGORIES.find(c => c.key === precisionCategory)?.exercises[0];
        const precisionMeta = JSON.stringify({ id: firstExercise?.value || precisionCategory, label: catLabel });
        const { error: tsError } = await supabase.from("training_sessions").insert({
          category_id: categoryId,
          session_date: itemDate,
          session_start_time: newItemTime || null,
          training_type: "precision",
          notes: `<!--PRECISION_EXERCISE:${precisionMeta}-->`,
        });
        if (tsError) throw tsError;
      }

      const customTitle = sessionMode === "match" 
        ? `Match vs ${matchOpponent}` 
        : sessionMode === "precision"
          ? `🎯 ${EXERCISE_CATEGORIES.find(c => c.key === precisionCategory)?.label || "Précision"}`
          : (newItemTitle || null);

      const { error } = await supabase.from("weekly_planning").insert({
        category_id: categoryId,
        week_start_date: weekStartStr,
        day_of_week: selectedDay,
        time_slot: newItemTime || null,
        custom_title: customTitle,
        location: newItemLocation || null,
        template_id: (sessionMode === "session" && selectedTemplateId && selectedTemplateId !== "none") ? selectedTemplateId : null,
        created_by: user?.id,
        notes: sessionMode === "precision" ? `precision:${precisionCategory}` : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      const wasPrecision = sessionMode === "precision";
      queryClient.invalidateQueries({ queryKey: ["weekly-planning", categoryId, weekStartStr] });
      queryClient.invalidateQueries({ queryKey: ["matches", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["weekly-planning-all", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["today-training-sessions", categoryId] });
      toast.success(
        sessionMode === "match" ? t("planning.weeklyCalendar.toasts.matchAdded") : 
        wasPrecision ? t("planning.weeklyCalendar.toasts.precisionSessionAdded") : 
        t("planning.weeklyCalendar.toasts.sessionAdded")
      );
      resetAddDialog();
      // Auto-open precision tracker after creating precision session
      if (wasPrecision && selectedDay !== null) {
        const itemDate = format(addDays(currentWeekStart, selectedDay), "yyyy-MM-dd");
        setPrecisionItemDate(itemDate);
        // Find the just-created session
        setTimeout(async () => {
          const { data: sessions } = await supabase
            .from("training_sessions")
            .select("id")
            .eq("category_id", categoryId)
            .eq("session_date", itemDate)
            .eq("training_type", "precision")
            .order("created_at", { ascending: false })
            .limit(1);
          if (sessions && sessions.length > 0) {
            setPrecisionSessionId(sessions[0].id);
          }
          setPrecisionTrackerOpen(true);
        }, 500);
      }
    },
    onError: () => {
      toast.error(t("planning.weeklyCalendar.toasts.addError"));
    },
  });

  const deletePlanningItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("weekly_planning").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weekly-planning", categoryId, weekStartStr] });
      toast.success(t("planning.weeklyCalendar.toasts.sessionDeleted"));
    },
    onError: () => {
      toast.error(t("planning.weeklyCalendar.toasts.deleteError"));
    },
  });

  const resetAddDialog = () => {
    setAddDialogOpen(false);
    setSelectedDay(null);
    setNewItemTitle("");
    setNewItemTime("");
    setNewItemLocation("");
    setSelectedTemplateId("none");
    setPendingTemplateId(null);
    setSessionMode("session");
    setMatchOpponent("");
    setIsHomeMatch(true);
    setPrecisionCategory("buteur");
  };

  const handleDropOnDay = (dayIndex: number, templateData: string) => {
    try {
      const template = JSON.parse(templateData);
      setSelectedDay(dayIndex);
      setNewItemTitle("");

      setPendingTemplateId(template.id);
      const exists = templates?.some((t) => t.id === template.id);
      if (exists) {
        setSelectedTemplateId(template.id);
        setPendingTemplateId(null);
      } else {
        setSelectedTemplateId("none");
      }

      setAddDialogOpen(true);
    } catch (e) {
      console.error("Failed to parse dropped template:", e);
    }
  };

  const planningByDay = useMemo(() => {
    const result: Record<number, PlanningItem[]> = {};
    DAYS.forEach((_, i) => {
      result[i] = [];
    });
    planning?.forEach((item) => {
      if (result[item.day_of_week]) {
        result[item.day_of_week].push(item);
      }
    });
    return result;
  }, [planning]);

  const calendarRef = useRef<HTMLDivElement>(null);

  const handleExportPdf = () => {
    if (planning) {
      exportWeeklyPlanningToPdf(planning, currentWeekStart, "Catégorie");
      toast.success(t("planning.weeklyCalendar.toasts.pdfExported"));
    }
  };

  const handlePrint = () => {
    if (calendarRef.current) {
      printElement(calendarRef.current, t("planning.weeklyCalendar.printTitle", { date: format(currentWeekStart, "d MMMM yyyy", { locale: getDateLocale() }) }));
    }
  };

  const isPrecisionItem = (item: PlanningItem) => {
    return item.notes?.startsWith("precision:") || item.custom_title?.startsWith("🎯");
  };

  const getPrecisionTheme = (item: PlanningItem): string | null => {
    if (!isPrecisionItem(item)) return null;
    const catKey = item.notes?.replace("precision:", "");
    const cat = EXERCISE_CATEGORIES.find(c => c.key === catKey);
    return cat?.label || null;
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">{t("planning.weeklyCalendar.title")}</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[200px] text-center">
                {t("planning.weeklyCalendar.weekOf", { date: format(currentWeekStart, "d MMMM yyyy", { locale: getDateLocale() }) })}
              </span>
              <Button variant="outline" size="icon" onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <div className="flex gap-1 ml-2">
                <Button variant="outline" size="icon" onClick={handlePrint} title={t("planning.weeklyCalendar.print")}>
                  <Printer className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={handleExportPdf} title={t("planning.weeklyCalendar.exportPdf")}>
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent ref={calendarRef}>
          <div className="grid grid-cols-7 gap-2">
            {DAYS.map((day, index) => (
              <div
                key={day}
                className={cn(
                  "min-h-[200px] border rounded-lg p-2 transition-colors",
                  "hover:border-primary/50"
                )}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.add("bg-primary/10");
                }}
                onDragLeave={(e) => {
                  e.currentTarget.classList.remove("bg-primary/10");
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove("bg-primary/10");
                  const templateData = e.dataTransfer.getData("template");
                  if (templateData) {
                    handleDropOnDay(index, templateData);
                  }
                }}
              >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-xs font-medium">{day}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(addDays(currentWeekStart, index), "d MMM", { locale: getDateLocale() })}
                      </p>
                    </div>
                    {!isViewer && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => {
                          setSelectedDay(index);
                          setSelectedTemplateId("none");
                          setPendingTemplateId(null);
                          setNewItemTitle("");
                          setSessionMode("session");
                          setAddDialogOpen(true);
                        }}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                
                <div className="space-y-1">
                  {/* Matches from competition tab */}
                  {matchesByDay[index]?.map((match) => (
                    <div
                      key={`match-${match.id}`}
                      className="rounded p-2 text-xs bg-destructive/10 border border-destructive/30"
                    >
                      <div className="flex items-center gap-1 font-medium">
                        <Trophy className="h-3 w-3 text-destructive shrink-0" />
                        <span className="truncate">
                          {match.opponent}
                        </span>
                      </div>
                      {match.competition && (
                        <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                          {match.competition}
                        </p>
                      )}
                      {match.match_time && (
                        <div className="flex items-center gap-1 text-muted-foreground mt-0.5">
                          <Clock className="h-3 w-3" />
                          {match.match_time.substring(0, 5)}
                        </div>
                      )}
                      {match.location && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{match.location}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1 mt-1">
                        {match.is_finalized ? (
                          <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 gap-0.5">
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            {t("planning.weeklyCalendar.completed")}
                            {match.score_home != null && match.score_away != null && (
                              <span className="ml-0.5">{match.score_home}-{match.score_away}</span>
                            )}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-destructive/40 text-destructive">
                            {t("planning.weeklyCalendar.inProgress")}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {/* Planning items */}
                  {planningByDay[index]?.map((item) => (
                      <div
                        key={item.id}
                        className={cn(
                          "group relative rounded p-2 text-xs",
                          isPrecisionItem(item) ? "bg-amber-500/15 border border-amber-500/30" : "bg-primary/10"
                        )}
                      >
                        {!isViewer && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute -top-1 -right-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => deletePlanningItem.mutate(item.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                        <p className="font-medium truncate">
                        {item.template?.name || item.custom_title || t("planning.weeklyCalendar.sessionFallback")}
                      </p>
                      {isPrecisionItem(item) && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-amber-500/40 text-amber-700 dark:text-amber-400 mt-0.5">
                          {getPrecisionTheme(item) || t("planning.weeklyCalendar.precisionFallback")}
                        </Badge>
                      )}
                      {item.time_slot && (
                        <div className="flex items-center gap-1 text-muted-foreground mt-1">
                          <Clock className="h-3 w-3" />
                          {item.time_slot.substring(0, 5)}
                        </div>
                      )}
                      {item.location && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{item.location}</span>
                        </div>
                      )}
                      {/* Precision session: button to open tracker */}
                      {isPrecisionItem(item) && !isViewer && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full mt-1.5 h-6 text-[10px] gap-1 border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                          onClick={async () => {
                            const itemDate = format(addDays(currentWeekStart, index), "yyyy-MM-dd");
                            setPrecisionItemDate(itemDate);
                            const { data: sessions } = await supabase
                              .from("training_sessions")
                              .select("id")
                              .eq("category_id", categoryId)
                              .eq("session_date", itemDate)
                              .eq("training_type", "precision")
                              .order("created_at", { ascending: false })
                              .limit(1);
                            if (sessions && sessions.length > 0) {
                              setPrecisionSessionId(sessions[0].id);
                            } else {
                              setPrecisionSessionId(null);
                            }
                            setPrecisionTrackerOpen(true);
                          }}
                        >
                          <Target className="h-3 w-3" />
                          {t("planning.weeklyCalendar.enterStats")}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {!isViewer && (
            <p className="text-xs text-muted-foreground mt-3 text-center">
              {t("planning.weeklyCalendar.dragDropHint")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Add dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("planning.weeklyCalendar.addSessionTitle", { day: selectedDay !== null ? DAYS[selectedDay] : "" })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50 flex-wrap">
              <Label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={sessionMode === "session"}
                  onChange={() => setSessionMode("session")}
                  className="accent-primary"
                />
                {t("planning.weeklyCalendar.modeSession")}
              </Label>
              <Label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={sessionMode === "match"}
                  onChange={() => setSessionMode("match")}
                  className="accent-primary"
                />
                {t("planning.weeklyCalendar.modeMatch")}
              </Label>
              {isRugby && (
                <Label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={sessionMode === "precision"}
                    onChange={() => setSessionMode("precision")}
                    className="accent-primary"
                  />
                  <span className="flex items-center gap-1">
                    <Target className="h-3.5 w-3.5" />
                    {t("planning.weeklyCalendar.modePrecision")}
                  </span>
                </Label>
              )}
            </div>

            {sessionMode === "match" && (
              <>
                <div className="space-y-2">
                  <Label>{t("planning.weeklyCalendar.opponentLabel")}</Label>
                  <Input
                    value={matchOpponent}
                    onChange={(e) => setMatchOpponent(e.target.value)}
                    placeholder={t("planning.weeklyCalendar.opponentPlaceholder")}
                  />
                </div>
                <div className="flex items-center gap-4">
                  <Label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={isHomeMatch}
                      onChange={() => setIsHomeMatch(true)}
                      className="accent-primary"
                    />
                    {t("planning.weeklyCalendar.home")}
                  </Label>
                  <Label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={!isHomeMatch}
                      onChange={() => setIsHomeMatch(false)}
                      className="accent-primary"
                    />
                    {t("planning.weeklyCalendar.away")}
                  </Label>
                </div>
              </>
            )}

            {sessionMode === "precision" && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>{t("planning.weeklyCalendar.precisionThemeLabel")}</Label>
                  <Select value={precisionCategory} onValueChange={setPrecisionCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper" className="z-[200]">
                      {EXERCISE_CATEGORIES.map((cat) => (
                        <SelectItem key={cat.key} value={cat.key}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Preview of what will be available */}
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
                  {precisionCategory === "buteur" && (
                    <>
                      <p className="text-xs font-medium text-primary">{t("planning.weeklyCalendar.precisionAvailableExercises")}</p>
                      <div className="flex items-center gap-3 flex-wrap">
                        {EXERCISE_CATEGORIES.find(c => c.key === "buteur")?.exercises.map(ex => (
                          <span key={ex.value} className="flex items-center gap-1.5 text-xs">
                            <span style={{ color: ex.color }}>
                              {ex.shape === "circle" ? "●" : ex.shape === "square" ? "■" : "◆"}
                            </span>
                            {ex.label}
                          </span>
                        ))}
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {t("planning.weeklyCalendar.precisionKickTypesHint")}
                      </p>
                    </>
                  )}
                  {precisionCategory === "zone_kicks" && (
                    <p className="text-xs text-muted-foreground">
                      {t("planning.weeklyCalendar.precisionZoneKicksHint")}
                    </p>
                  )}
                  {precisionCategory === "lineout" && (
                    <p className="text-xs text-muted-foreground">
                      {t("planning.weeklyCalendar.precisionLineoutHint")}
                    </p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("planning.weeklyCalendar.precisionAutoOpenHint")}
                </p>
              </div>
            )}

            {sessionMode === "session" && (
              <>
                <div className="space-y-2">
                  <Label>{t("planning.weeklyCalendar.templateLabel")}</Label>
                  <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("planning.weeklyCalendar.templatePlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("planning.weeklyCalendar.noTemplate")}</SelectItem>
                      {templates?.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {(!selectedTemplateId || selectedTemplateId === "none") && (
                  <div className="space-y-2">
                    <Label>{t("planning.weeklyCalendar.customTitleLabel")}</Label>
                    <Input
                      value={newItemTitle}
                      onChange={(e) => setNewItemTitle(e.target.value)}
                      placeholder={t("planning.weeklyCalendar.customTitlePlaceholder")}
                    />
                  </div>
                )}
              </>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("planning.weeklyCalendar.timeLabel")}</Label>
                <Input
                  type="time"
                  value={newItemTime}
                  onChange={(e) => setNewItemTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("planning.weeklyCalendar.locationLabel")}</Label>
                <Input
                  value={newItemLocation}
                  onChange={(e) => setNewItemLocation(e.target.value)}
                  placeholder={t("planning.weeklyCalendar.locationPlaceholder")}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={resetAddDialog}>
                {t("planning.weeklyCalendar.cancel")}
              </Button>
              <Button 
                onClick={() => addPlanningItem.mutate()}
                disabled={
                  (sessionMode === "match" ? !matchOpponent : 
                   sessionMode === "precision" ? !precisionCategory :
                   ((!selectedTemplateId || selectedTemplateId === "none") && !newItemTitle)) || 
                  addPlanningItem.isPending
                }
              >
                {t("planning.weeklyCalendar.add")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Precision tracker dialog */}
      {isRugby && (
        <Dialog open={precisionTrackerOpen} onOpenChange={setPrecisionTrackerOpen}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                {t("planning.weeklyCalendar.precisionTrackerTitle")}
                {precisionItemDate && (
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    — {format(new Date(precisionItemDate), "d MMMM yyyy", { locale: getDateLocale() })}
                  </span>
                )}
              </DialogTitle>
            </DialogHeader>
            <PrecisionFieldTracker 
              categoryId={categoryId} 
              sessionId={precisionSessionId || undefined}
              sessionDate={precisionItemDate || undefined}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
