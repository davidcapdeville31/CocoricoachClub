import { useState } from "react";
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
import { CheckCircle2, Heart, ChevronDown, ChevronUp, Activity } from "lucide-react";
import { toast } from "sonner";
import { NAV_COLORS } from "@/components/ui/colored-nav-tabs";
import { cn } from "@/lib/utils";
import { PAIN_ZONES } from "@/lib/constants/pain-locations";
import { sleepHoursToScore } from "@/lib/sleepConversion";
import { getWellnessButtonClasses } from "@/lib/wellnessColors";

interface Props {
  playerId: string;
  categoryId: string;
  hideHistory?: boolean;
}

const SLEEP_HOURS = [4, 5, 6, 7, 8, 9, 10, 11, 12];

const WELLNESS_FIELDS = [
  {
    key: "sleep_quality",
    label: "Qualité du sommeil",
    emoji: "😴",
    options: [
      { value: 1, label: "Très mal dormi" },
      { value: 2, label: "Mal dormi" },
      { value: 3, label: "Moyennement dormi" },
      { value: 4, label: "Bien dormi" },
      { value: 5, label: "Très bien dormi" },
    ],
  },
  { key: "sleep_duration", label: "Heures de sommeil", emoji: "🛏️", isNumber: true },
  {
    key: "general_fatigue",
    label: "Fatigue générale",
    emoji: "🔋",
    inverted: true,
    options: [
      { value: 1, label: "Très en forme" },
      { value: 2, label: "En forme" },
      { value: 3, label: "Fatigué" },
      { value: 4, label: "Très fatigué" },
      { value: 5, label: "Épuisé" },
    ],
  },
  {
    key: "soreness_upper_body",
    label: "Douleurs haut du corps",
    emoji: "💪",
    inverted: true,
    options: [
      { value: 1, label: "Aucune douleur" },
      { value: 2, label: "Légère gêne" },
      { value: 3, label: "Douleur modérée" },
      { value: 4, label: "Douleur forte" },
      { value: 5, label: "Douleur intense" },
    ],
  },
  {
    key: "soreness_lower_body",
    label: "Douleurs bas du corps",
    emoji: "🦵",
    inverted: true,
    options: [
      { value: 1, label: "Aucune douleur" },
      { value: 2, label: "Légère gêne" },
      { value: 3, label: "Douleur modérée" },
      { value: 4, label: "Douleur forte" },
      { value: 5, label: "Douleur intense" },
    ],
  },
  {
    key: "stress_level",
    label: "Stress",
    emoji: "🧠",
    inverted: true,
    options: [
      { value: 1, label: "Très détendu" },
      { value: 2, label: "Détendu" },
      { value: 3, label: "Un peu stressé" },
      { value: 4, label: "Stressé" },
      { value: 5, label: "Très stressé" },
    ],
  },
] as const;

export function AthleteSpaceWellness({ playerId, categoryId, hideHistory }: Props) {
  const queryClient = useQueryClient();
  const today = new Date().toISOString().split("T")[0];
  const [expanded, setExpanded] = useState(false);

  const { data: existingWellness, isLoading } = useQuery({
    queryKey: ["athlete-space-wellness", playerId, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wellness_tracking")
        .select("*")
        .eq("player_id", playerId)
        .eq("tracking_date", today)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [values, setValues] = useState({
    sleep_quality: 0,
    sleep_duration: 0,
    general_fatigue: 0,
    soreness_upper_body: 0,
    soreness_lower_body: 0,
    stress_level: 0,
  });
  const [hasSpecificPain, setHasSpecificPain] = useState(false);
  const [painZone, setPainZone] = useState("");
  const [painLocation, setPainLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [showHrv, setShowHrv] = useState(false);
  const [hrvMs, setHrvMs] = useState("");
  const [restingHr, setRestingHr] = useState("");

  const allFieldsFilled = values.sleep_quality > 0 && values.sleep_duration > 0 &&
    values.general_fatigue > 0 && values.soreness_upper_body > 0 &&
    values.soreness_lower_body > 0 && values.stress_level > 0;

  const selectedZoneLocations = PAIN_ZONES.find(z => z.zone === painZone)?.locations || [];

  const submitWellness = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("wellness_tracking").insert({
        player_id: playerId,
        category_id: categoryId,
        tracking_date: today,
        sleep_quality: values.sleep_quality,
        sleep_duration: sleepHoursToScore(values.sleep_duration),
        general_fatigue: values.general_fatigue,
        soreness_upper_body: values.soreness_upper_body,
        soreness_lower_body: values.soreness_lower_body,
        stress_level: values.stress_level,
        has_specific_pain: hasSpecificPain,
        pain_zone: hasSpecificPain ? painZone : null,
        pain_location: hasSpecificPain ? painLocation : null,
        notes: notes || null,
      });
      if (error) throw error;

      // Insert HRV morning data if provided
      if (showHrv && (hrvMs || restingHr)) {
        const { error: hrvError } = await supabase.from("hrv_records").insert({
          player_id: playerId,
          category_id: categoryId,
          record_date: today,
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
      toast.success("Wellness enregistré !");
      queryClient.invalidateQueries({ queryKey: ["athlete-space-wellness"] });
      queryClient.invalidateQueries({ queryKey: ["athlete-space-wellness-today"] });
      if (showHrv) {
        queryClient.invalidateQueries({ queryKey: ["hrv_records"] });
      }
      setExpanded(false);
    },
    onError: () => toast.error("Erreur lors de l'enregistrement"),
  });

  if (isLoading) return null;

  // Already filled
  if (existingWellness) {
    const score = Math.round(
      ((existingWellness.sleep_quality || 3) +
        (6 - (existingWellness.general_fatigue || 3)) +
        (6 - (existingWellness.soreness_lower_body || 3)) +
        (6 - (existingWellness.soreness_upper_body || 3)) +
        (6 - (existingWellness.stress_level || 3))) / 5 * 20
    );

    return (
      <>
      <Card className="bg-gradient-card shadow-md">
        <CardContent className="py-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${NAV_COLORS.sante.base}20` }}>
              <CheckCircle2 className="h-5 w-5 text-status-optimal" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">Wellness du jour enregistré</p>
              <p className="text-xs text-muted-foreground">Score global : <span className="font-bold text-foreground">{score}%</span></p>
            </div>
            <CheckCircle2 className="h-5 w-5 text-status-optimal" />
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-4">
            {WELLNESS_FIELDS.map(f => {
              const raw = (existingWellness as any)[f.key];
              const display = f.key === "sleep_duration" ? `${(9.5 - Number(raw)).toFixed(1)}h` : raw;
              return (
                <div key={f.key} className="text-center p-2 rounded-lg" style={{ backgroundColor: `${NAV_COLORS.sante.base}08` }}>
                  <p className="text-lg font-bold" style={{ color: NAV_COLORS.sante.base }}>{display}</p>
                  <p className="text-[9px] text-muted-foreground leading-tight">{f.label}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      {!hideHistory && <AthleteSpaceWellnessHistory playerId={playerId} categoryId={categoryId} />}
      </>
    );
  }

  // Not filled yet
  return (
    <>
    <Card className="shadow-md border-2" style={{ borderColor: `${NAV_COLORS.sante.base}40`, backgroundColor: `${NAV_COLORS.sante.base}06` }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left"
      >
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${NAV_COLORS.sante.base}20` }}>
                <Heart className="h-4 w-4" style={{ color: NAV_COLORS.sante.base }} />
              </div>
              <span style={{ color: NAV_COLORS.sante.base }}>Wellness du jour à remplir</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs" style={{ borderColor: NAV_COLORS.sante.base, color: NAV_COLORS.sante.base }}>À remplir</Badge>
              {expanded ? (
                <ChevronUp className="h-4 w-4" style={{ color: NAV_COLORS.sante.base }} />
              ) : (
                <ChevronDown className="h-4 w-4" style={{ color: NAV_COLORS.sante.base }} />
              )}
            </div>
          </CardTitle>
        </CardHeader>
      </button>

      {expanded && (
        <CardContent className="space-y-1.5 pt-0 pb-3 px-2 sm:px-4">
          {WELLNESS_FIELDS.map(field => {
            const currentValue = (values as any)[field.key];

            if ('isNumber' in field && field.isNumber) {
              return (
                <div key={field.key}>
                  <Label className="text-[11px] flex items-center gap-1 mb-1">
                    <span className="text-xs">{field.emoji}</span>
                    {field.label}
                    {currentValue > 0 && (
                      <Badge variant="secondary" className="ml-auto text-[10px] font-bold px-1 py-0 leading-tight">{currentValue}h</Badge>
                    )}
                  </Label>
                  <div className="grid grid-cols-9 gap-0.5">
                    {SLEEP_HOURS.map(hour => {
                      const score = sleepHoursToScore(hour);
                      const isSelected = currentValue === hour;
                      return (
                        <button
                          key={hour}
                          type="button"
                          onClick={() => setValues(prev => ({ ...prev, [field.key]: hour }))}
                          className={cn(
                            "h-6 sm:h-7 rounded text-[10px] sm:text-xs font-semibold transition-all duration-150",
                            "border active:scale-95",
                            getWellnessButtonClasses(score, true, isSelected),
                          )}
                        >
                          {hour}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            }

            const fieldOptions = 'options' in field ? field.options : [];

            const isInverted = 'inverted' in field && field.inverted;
            const scaleHint = isInverted
              ? "1 = très bon · 5 = très mauvais"
              : "1 = très mauvais · 5 = très bon";

            return (
              <div key={field.key}>
                <Label className="text-[11px] flex items-center gap-1 mb-0.5">
                  <span className="text-xs">{field.emoji}</span>
                  <span className="flex-1 truncate">{field.label}</span>
                  {currentValue > 0 && (
                    <span className="text-[10px] text-muted-foreground truncate max-w-[60%] text-right">
                      {fieldOptions.find(o => o.value === currentValue)?.label}
                    </span>
                  )}
                </Label>
                <p className="text-[9px] text-muted-foreground mb-1 italic">{scaleHint}</p>
                <div className="grid grid-cols-5 gap-0.5">
                  {fieldOptions.map(opt => {
                    const isSelected = currentValue === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        title={opt.label}
                        onClick={() => setValues(prev => ({ ...prev, [field.key]: opt.value }))}
                        className={cn(
                          "h-7 sm:h-8 rounded text-xs sm:text-sm font-bold transition-all duration-150",
                          "border active:scale-95",
                          getWellnessButtonClasses(opt.value, isInverted, isSelected),
                        )}
                      >
                        {opt.value}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="flex items-center gap-2 pt-1">
            <Checkbox checked={hasSpecificPain} onCheckedChange={(v) => {
              setHasSpecificPain(!!v);
              if (!v) { setPainZone(""); setPainLocation(""); }
            }} />
            <Label className="text-xs">J'ai une douleur spécifique</Label>
          </div>

          {hasSpecificPain && (
            <div className="space-y-2">
              <div>
                <Label className="text-xs mb-1 block">Zone du corps</Label>
                <Select value={painZone} onValueChange={(v) => { setPainZone(v); setPainLocation(""); }}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Sélectionner une zone" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAIN_ZONES.map(z => (
                      <SelectItem key={z.zone} value={z.zone}>{z.zone}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {painZone && (
                <div>
                  <Label className="text-xs mb-1 block">Localisation</Label>
                  <Select value={painLocation} onValueChange={setPainLocation}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Sélectionner la localisation" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedZoneLocations.map(loc => (
                        <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

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
