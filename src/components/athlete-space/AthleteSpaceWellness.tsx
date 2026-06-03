import { useState, useEffect, useMemo } from "react";
import { AthleteSpaceWellnessHistory } from "./AthleteSpaceWellnessHistory";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CheckCircle2, Heart, ChevronDown, ChevronUp, Activity, CalendarIcon, Pencil } from "lucide-react";
import { toast } from "sonner";
import { NAV_COLORS } from "@/components/ui/colored-nav-tabs";
import { cn } from "@/lib/utils";
import { PAIN_ZONES } from "@/lib/constants/pain-locations";
import { sleepHoursToScore, sleepScoreToHours } from "@/lib/sleepConversion";
import { getWellnessButtonClasses, getSleepHoursButtonClasses } from "@/lib/wellnessColors";
import { useWellnessQuestions } from "@/lib/wellness/questionConfig";
import { BodyPainSelector, type BodyPainValue } from "@/components/wellness/BodyPainSelector";
import { format, subDays, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";


interface Props {
  playerId: string;
  categoryId: string;
  hideHistory?: boolean;
}

// Plages horaires de sommeil — la valeur stockée est l'heure médiane de la plage
const SLEEP_RANGES: { label: string; value: number }[] = [
  { label: "<6h", value: 5 },
  { label: "6-7h", value: 6.5 },
  { label: "7-8h", value: 7.5 },
  { label: "8-9h", value: 8.5 },
  { label: "9-10h", value: 9.5 },
  { label: ">10h", value: 11 },
];

export function AthleteSpaceWellness({ playerId, categoryId, hideHistory }: Props) {
  const queryClient = useQueryClient();
  const today = new Date().toISOString().split("T")[0];

  // Date sélectionnée pour la saisie (aujourd'hui par défaut, max = aujourd'hui, jusqu'à -30j)
  const [selectedDate, setSelectedDate] = useState<Date>(() => startOfDay(new Date()));
  const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
  const isToday = selectedDateStr === today;
  const isPastDate = !isToday;

  const [expanded, setExpanded] = useState(false);
  // Quand on choisit un jour passé, on force l'ouverture du formulaire
  // pour offrir la saisie/édition immédiate.
  const [forceEdit, setForceEdit] = useState(false);

  const { data: wellnessQuestions } = useWellnessQuestions(categoryId);
  const activeQuestions = useMemo(() => wellnessQuestions?.filter(q => q.enabled) ?? [], [wellnessQuestions]);

  const { data: schedule } = useQuery({
    queryKey: ["wellness_schedule", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wellness_schedules")
        .select("days_of_week")
        .eq("category_id", categoryId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const scheduledDays: number[] = schedule?.days_of_week ?? [0, 1, 2, 3, 4, 5, 6];
  const todayDow = new Date().getDay();
  const isScheduledToday = scheduledDays.includes(todayDow);

  const { data: existingWellness, isLoading } = useQuery({
    queryKey: ["athlete-space-wellness", playerId, selectedDateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wellness_tracking")
        .select("*")
        .eq("player_id", playerId)
        .eq("tracking_date", selectedDateStr)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Dynamic values state keyed by question key
  const [values, setValues] = useState<Record<string, number>>({});

  const [hasSpecificPain, setHasSpecificPain] = useState(false);
  const [painData, setPainData] = useState<Partial<BodyPainValue>>({});
  const [notes, setNotes] = useState("");
  const [showHrv, setShowHrv] = useState(false);
  const [hrvMs, setHrvMs] = useState("");
  const [restingHr, setRestingHr] = useState("");

  const [touched, setTouched] = useState<Set<string>>(new Set());

  // Initialise / pré-remplit les valeurs du formulaire depuis l'entrée existante
  // (ou des valeurs par défaut) à chaque changement de date ou de questions.
  useEffect(() => {
    const initial: Record<string, number> = {};
    const ew: any = existingWellness;
    for (const q of activeQuestions) {
      if (ew) {
        const raw = q.is_custom
          ? (ew.custom_answers?.[q.key] ?? 1)
          : (ew[q.key] ?? 1);
        if (q.is_sleep_duration) {
          // En base : score 1-5. UI : heures (médiane de plage).
          initial[q.key] = raw ? sleepScoreToHours(Number(raw)) : 7.5;
        } else {
          initial[q.key] = Number(raw) || 1;
        }
      } else {
        initial[q.key] = q.is_sleep_duration ? 7.5 : 1;
      }
    }
    setValues(initial);
    // Si on a une entrée existante, tous les champs comptent comme "touchés"
    // pour autoriser l'enregistrement immédiat après édition partielle.
    setTouched(existingWellness ? new Set(activeQuestions.map(q => q.key)) : new Set());

    if (ew) {
      setHasSpecificPain(!!ew.has_specific_pain);
      setPainData({
        zone: ew.pain_zone ?? undefined,
        region: ew.pain_location ?? undefined,
        nature: ew.pain_nature ?? undefined,
        intensity: ew.pain_intensity ?? undefined,
      });
      setNotes(ew.notes ?? "");
    } else {
      setHasSpecificPain(false);
      setPainData({});
      setNotes("");
    }
  }, [activeQuestions, existingWellness, selectedDateStr]);

  const allFieldsFilled = useMemo(() => {

    return activeQuestions.every(q => touched.has(q.key));
  }, [activeQuestions, touched]);

  // (legacy zone dropdown removed in favor of BodyPainSelector)

  const score = useMemo(() => {
    if (!existingWellness || activeQuestions.length === 1) return 1;
    let total = 1;
    let count = 1;
    for (const q of activeQuestions) {
      if (q.is_sleep_duration) continue;
      const raw = (existingWellness as any)[q.key] || 1;
      const normalized = q.inverted ? (6 - raw) : raw;
      total += normalized;
      count++;
    }
    return count > 1 ? Math.round((total / count) * 20) : 1;
  }, [existingWellness, activeQuestions]);

  const submitWellness = useMutation({
    mutationFn: async () => {
      const insertData: any = {
        player_id: playerId,
        category_id: categoryId,
        tracking_date: selectedDateStr,
        has_specific_pain: hasSpecificPain,
        pain_zone: hasSpecificPain ? painData.zone ?? null : null,
        pain_location: hasSpecificPain ? painData.region ?? null : null,
        pain_nature: hasSpecificPain ? painData.nature ?? null : null,
        pain_intensity: hasSpecificPain ? painData.intensity ?? null : null,
        notes: notes || null,
      };

      const customAnswers: Record<string, number> = {};

      for (const q of activeQuestions) {
        if (q.is_custom) {
          customAnswers[q.key] = values[q.key];
        } else if (q.is_sleep_duration) {
          insertData[q.key] = sleepHoursToScore(values[q.key]);
        } else {
          insertData[q.key] = values[q.key];
        }
      }

      if (Object.keys(customAnswers).length > 1) {
        insertData.custom_answers = customAnswers;
      }

      // Upsert pour permettre la mise à jour d'un wellness existant
      // (notamment pour rattraper / corriger un jour passé).
      const { error } = await supabase
        .from("wellness_tracking")
        .upsert(insertData, { onConflict: "player_id,tracking_date" });
      if (error) throw error;

      // Insert HRV morning data if provided
      if (showHrv && (hrvMs || restingHr)) {
        const { error: hrvError } = await supabase.from("hrv_records").insert({
          player_id: playerId,
          category_id: categoryId,
          record_date: selectedDateStr,
          record_type: "morning",
          hrv_ms: hrvMs ? parseFloat(hrvMs) : null,
          resting_hr_bpm: restingHr ? parseFloat(restingHr) : null,
        });
        if (hrvError) {
          console.error("HRV insert error:", hrvError);
          toast.error("Wellness enregistré mais erreur HRV");
        }
      }
    },
    onSuccess: () => {
      toast.success(
        isToday
          ? "Wellness enregistré !"
          : `Wellness du ${format(selectedDate, "d MMM", { locale: fr })} enregistré !`,
      );
      queryClient.invalidateQueries({ queryKey: ["athlete-space-wellness"] });
      queryClient.invalidateQueries({ queryKey: ["athlete-space-wellness-today"] });
      if (showHrv) {
        queryClient.invalidateQueries({ queryKey: ["hrv_records"] });
      }
      setExpanded(false);
      setForceEdit(false);
    },
    onError: () => toast.error("Erreur lors de l'enregistrement"),
  });


  if (isLoading) return null;

  const minDate = subDays(startOfDay(new Date()), 30);
  const maxDate = startOfDay(new Date());

  const DateSelector = (
    <div className="flex flex-wrap items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-9 gap-2 text-xs font-normal",
              isPastDate && "border-amber-400 text-amber-700 dark:text-amber-300",
            )}
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            {isToday
              ? `Aujourd'hui · ${format(selectedDate, "EEEE d MMM", { locale: fr })}`
              : format(selectedDate, "EEEE d MMM yyyy", { locale: fr })}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(d) => {
              if (d) {
                setSelectedDate(startOfDay(d));
                setExpanded(true);
                setForceEdit(true);
              }
            }}
            disabled={(d) => d > maxDate || d < minDate}
            initialFocus
            locale={fr}
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
      {isPastDate && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 text-xs"
          onClick={() => {
            setSelectedDate(startOfDay(new Date()));
            setForceEdit(false);
          }}
        >
          Revenir à aujourd'hui
        </Button>
      )}
    </div>
  );

  // Wellness not scheduled today — skip rendering the form, but keep history visible
  // (uniquement pour la date du jour : pour les jours passés, on autorise toujours la saisie de rattrapage)
  if (isToday && !existingWellness && !isScheduledToday) {
    const dayNames = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
    const nextDay = (() => {
      for (let i = 1; i <= 7; i++) {
        const d = (todayDow + i) % 7;
        if (scheduledDays.includes(d)) return dayNames[d];
      }
      return null;
    })();
    return (
      <>
        <Card className="bg-gradient-card shadow-md">
          <CardContent className="py-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${NAV_COLORS.sante.base}15` }}>
                <Heart className="h-5 w-5" style={{ color: NAV_COLORS.sante.base }} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm">Pas de wellness à remplir aujourd'hui</p>
                <p className="text-xs text-muted-foreground">
                  {nextDay ? `Prochain wellness : ${nextDay}` : "Aucun jour planifié par le staff."}
                </p>
              </div>
            </div>
            <div className="pt-1">
              <p className="text-[11px] text-muted-foreground mb-1">Rattraper un jour passé :</p>
              {DateSelector}
            </div>
          </CardContent>
        </Card>
        {!hideHistory && <AthleteSpaceWellnessHistory playerId={playerId} categoryId={categoryId} />}
      </>
    );
  }

  // Already filled (vue résumé seulement pour aujourd'hui ; pour les jours passés on affiche toujours le formulaire éditable)
  if (existingWellness && isToday && !forceEdit) {
    return (
      <>
      <Card className="bg-gradient-card shadow-md">
        <CardContent className="py-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${NAV_COLORS.sante.base}20` }}>
              <CheckCircle2 className="h-5 w-5 text-status-optimal" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">Wellness du jour enregistré</p>
              <p className="text-xs text-muted-foreground">Score global : <span className="font-bold text-foreground">{score}%</span></p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={() => { setForceEdit(true); setExpanded(true); }}
            >
              <Pencil className="h-3 w-3" />
              Modifier
            </Button>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {activeQuestions.map(q => {
              const raw = (existingWellness as any)[q.key] ?? (existingWellness.custom_answers as any)?.[q.key];
              let display: string | number = raw ?? "-";
              if (q.is_sleep_duration && raw) {
                display = `${(9.5 - Number(raw)).toFixed(1)}h`;
              }
              return (
                <div key={q.key} className="text-center p-2 rounded-lg" style={{ backgroundColor: `${NAV_COLORS.sante.base}08` }}>
                  <p className="text-lg font-bold" style={{ color: NAV_COLORS.sante.base }}>{display}</p>
                  <p className="text-[9px] text-muted-foreground leading-tight">{q.label}</p>
                </div>
              );
            })}
          </div>
          <div className="border-t pt-3">
            <p className="text-[11px] text-muted-foreground mb-1">Rattraper / corriger un jour passé :</p>
            {DateSelector}
          </div>
        </CardContent>
      </Card>
      {!hideHistory && <AthleteSpaceWellnessHistory playerId={playerId} categoryId={categoryId} />}
      </>
    );
  }

  // Formulaire éditable (jour courant non rempli, ou jour passé, ou édition forcée)
  const shouldBeExpanded = expanded || isPastDate || forceEdit;
  return (
    <>

    <Card className="shadow-md border-2" style={{ borderColor: `${NAV_COLORS.sante.base}40`, backgroundColor: `${NAV_COLORS.sante.base}06` }}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-left flex-1 min-w-0"
          >
            <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${NAV_COLORS.sante.base}20` }}>
              <Heart className="h-4 w-4" style={{ color: NAV_COLORS.sante.base }} />
            </div>
            <span className="truncate" style={{ color: NAV_COLORS.sante.base }}>
              {isToday
                ? "Wellness du jour à remplir"
                : `Wellness du ${format(selectedDate, "EEEE d MMM", { locale: fr })}`}
            </span>
          </button>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className="text-xs" style={{ borderColor: NAV_COLORS.sante.base, color: NAV_COLORS.sante.base }}>
              {existingWellness ? "À modifier" : "À remplir"}
            </Badge>
            {shouldBeExpanded ? (
              <ChevronUp className="h-4 w-4" style={{ color: NAV_COLORS.sante.base }} />
            ) : (
              <ChevronDown className="h-4 w-4" style={{ color: NAV_COLORS.sante.base }} />
            )}
          </div>
        </CardTitle>
        <div className="pt-2">{DateSelector}</div>
      </CardHeader>

      {shouldBeExpanded && (
        <CardContent className="space-y-1.5 pt-0 pb-3 px-2 sm:px-4">

          {activeQuestions.map(q => {
            const currentValue = values[q.key] ?? 1;

            // Sleep duration special case
            if (q.is_sleep_duration) {
              return (
                <div key={q.key}>
                  <Label className="text-[11px] flex items-center gap-1 mb-1">
                    <span className="text-xs">{q.emoji}</span>
                    {q.label}
                    {currentValue > 1 && (
                      <Badge variant="secondary" className="ml-auto text-[10px] font-bold px-1 py-0 leading-tight">
                        {SLEEP_RANGES.find(r => r.value === currentValue)?.label ?? `${currentValue}h`}
                      </Badge>
                    )}
                  </Label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1">
                    {SLEEP_RANGES.map(range => {
                      const isSelected = currentValue === range.value;
                      return (
                        <button
                          key={range.label}
                          type="button"
                          onClick={() => {
                            setValues(prev => ({ ...prev, [q.key]: range.value }));
                            setTouched(prev => new Set(prev).add(q.key));
                          }}
                          className={cn(
                            "h-9 sm:h-10 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-150",
                            "border active:scale-95",
                            getSleepHoursButtonClasses(range.value, isSelected),
                          )}
                        >
                          {range.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            }

            const scaleHint = q.inverted
              ? `1 = ${q.scale[0].label} · 5 = ${q.scale[4].label}`
              : `1 = ${q.scale[0].label} · 5 = ${q.scale[4].label}`;

            return (
              <div key={q.key}>
                <Label className="text-[11px] flex items-center gap-1 mb-0.5">
                  <span className="text-xs">{q.emoji}</span>
                  <span className="flex-1 truncate">{q.label}</span>
                  {currentValue >= 1 && (
                    <span className="text-[10px] text-muted-foreground truncate max-w-[60%] text-right">
                      {q.scale.find(o => o.value === currentValue)?.label}
                    </span>
                  )}
                </Label>
                <p className="text-[9px] text-muted-foreground mb-1 italic">{scaleHint}</p>
                <div className="grid grid-cols-5 gap-0.5">
                  {q.scale.map(opt => {
                    const isSelected = currentValue === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        title={opt.label}
                        onClick={() => {
                          setValues(prev => ({ ...prev, [q.key]: opt.value }));
                          setTouched(prev => new Set(prev).add(q.key));
                        }}
                        className={cn(
                          "h-7 sm:h-8 rounded text-xs sm:text-sm font-bold transition-all duration-150 border active:scale-95",
                          isSelected ? "ring-2 ring-foreground/60 text-white shadow-md scale-105" : "text-foreground/80 hover:scale-105",
                        )}
                        style={{
                          backgroundColor: isSelected ? opt.color : `color-mix(in hsl, ${opt.color} 25%, transparent)`,
                          borderColor: opt.color,
                        }}
                      >
                        {opt.value}
                      </button>
                    );
                  })}
                </div>

              </div>
            );
          })}

          <div className="rounded-xl border bg-surface-sunken/50 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Checkbox checked={hasSpecificPain} onCheckedChange={(v) => {
                setHasSpecificPain(!!v);
                if (!v) { setPainData({}); }
              }} />
              <Label className="text-xs font-semibold">J'ai une douleur spécifique aujourd'hui</Label>
            </div>
            <p className="text-[10px] text-muted-foreground italic mb-2">
              Cliquez sur une zone du corps pour la signaler (cochez la case ci-dessus si applicable).
            </p>
            <BodyPainSelector
              value={painData}
              onChange={(v) => {
                setPainData(v);
                if (v.region && !hasSpecificPain) setHasSpecificPain(true);
              }}
              categoryId={categoryId}
              compact
            />
          </div>


          <div>
            <Label className="text-xs">Notes (optionnel)</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Remarques, sensations..."
              className="mt-1 text-sm"
              rows={2}
            />
          </div>

          {/* HRV morning data (optional) */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox checked={showHrv} onCheckedChange={(v) => {
                setShowHrv(!!v);
                if (!v) { setHrvMs(""); setRestingHr(""); }
              }} />
              <Label className="text-xs flex items-center gap-1.5">
                <Activity className="h-3 w-3" style={{ color: NAV_COLORS.sante.base }} />
                Ajouter mes données HRV (matin)
              </Label>
            </div>

            {showHrv && (
              <div className="grid grid-cols-2 gap-2 pl-6">
                <div className="space-y-1">
                  <Label className="text-[10px]">HRV (ms)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="300"
                    placeholder="Ex: 65"
                    value={hrvMs}
                    onChange={(e) => setHrvMs(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">FC repos (bpm)</Label>
                  <Input
                    type="number"
                    min="30"
                    max="120"
                    placeholder="Ex: 55"
                    value={restingHr}
                    onChange={(e) => setRestingHr(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          <Button
            onClick={() => {
              if (!allFieldsFilled) {
                toast.error("Merci de remplir tous les indicateurs (1 à 5)");
                return;
              }
              submitWellness.mutate();
            }}
            className="w-full h-11"
            style={{ backgroundColor: NAV_COLORS.sante.base }}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Enregistrer mon wellness
          </Button>
        </CardContent>
      )}
    </Card>

    {/* Wellness History Charts */}
    {!hideHistory && <AthleteSpaceWellnessHistory playerId={playerId} categoryId={categoryId} />}
    </>
  );
}
