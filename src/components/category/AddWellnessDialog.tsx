import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { HrvInputSection, emptyHrvData, type HrvData } from "./hrv/HrvInputSection";
import { getWellnessButtonClasses, getSleepScoreButtonClasses } from "@/lib/wellnessColors";
import { sleepHoursToScore } from "@/lib/sleepConversion";
import { cn } from "@/lib/utils";
import { useWellnessQuestions } from "@/lib/wellness/questionConfig";
import { BodyPainSelector, type BodyPainEntry } from "@/components/wellness/BodyPainSelector";
import { useSeasonGuard } from "@/hooks/use-season-guard";

interface AddWellnessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
}

// Plages horaires de sommeil
const SLEEP_RANGES: { label: string; value: number }[] = [
  { label: "<6h", value: 5 },
  { label: "6-7h", value: 6.5 },
  { label: "7-8h", value: 7.5 },
  { label: "8-9h", value: 8.5 },
  { label: "9-10h", value: 9.5 },
  { label: ">10h", value: 11 },
];

export function AddWellnessDialog({ open, onOpenChange, categoryId }: AddWellnessDialogProps) {
  const queryClient = useQueryClient();
  const guard = useSeasonGuard(categoryId);
  const [playerId, setPlayerId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [hasSpecificPain, setHasSpecificPain] = useState(false);
  const [painEntries, setPainEntries] = useState<BodyPainEntry[]>([]);
  const [hrvData, setHrvData] = useState<HrvData>(emptyHrvData);

  const { data: wellnessQuestions } = useWellnessQuestions(categoryId);
  const activeQuestions = wellnessQuestions?.filter(q => q.enabled) ?? [];

  // Dynamic state for all wellness values
  const [values, setValues] = useState<Record<string, number>>({});

  // Reset values when dialog opens or questions change.
  // IMPORTANT: depend on wellnessQuestions (stable ref) not activeQuestions
  // (new array each render), otherwise values get reset on every render
  // and button clicks never "stick".
  useEffect(() => {
    if (!open) return;
    const initial: Record<string, number> = {};
    for (const q of (wellnessQuestions ?? []).filter(q => q.enabled)) {
      initial[q.key] = q.is_sleep_duration ? 7.5 : 3;
    }
    setValues(initial);
  }, [wellnessQuestions, open]);

  const { data: players } = useQuery({
    queryKey: ["players", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("*")
        .eq("category_id", categoryId)
        .order("first_name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch existing wellness entries for the selected date
  const { data: existingWellness } = useQuery({
    queryKey: ["wellness_existing", categoryId, date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wellness_tracking")
        .select("player_id")
        .eq("category_id", categoryId)
        .eq("tracking_date", date);
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const filledPlayerIds = new Set(existingWellness?.map(w => w.player_id) || []);
  const availablePlayers = players?.filter(p => !filledPlayerIds.has(p.id));

  const resetForm = () => {
    setPlayerId("");
    setDate(new Date().toISOString().split("T")[0]);
    setNotes("");
    setHasSpecificPain(false);
    setPainEntries([]);
    setHrvData(emptyHrvData);
    const initial: Record<string, number> = {};
    for (const q of activeQuestions) {
      initial[q.key] = q.is_sleep_duration ? 7.5 : 3;
    }
    setValues(initial);
  };

  const addWellness = useMutation({
    mutationFn: async () => {
      if (!guard.assertPlayer(playerId)) throw new Error("guard:player");
      if (!guard.assertDate(date)) throw new Error("guard:date");
      const playerName = players?.find(p => p.id === playerId)?.name || "Athlète";

      const activePainEntries = hasSpecificPain ? painEntries : [];
      const firstPain = activePainEntries[0];
      const insertData: any = {
        player_id: playerId,
        category_id: categoryId,
        tracking_date: date,
        has_specific_pain: hasSpecificPain && activePainEntries.length > 0,
        pain_entries: activePainEntries,
        pain_zone: firstPain?.zone ?? null,
        pain_location: firstPain?.region ?? null,
        pain_nature: firstPain?.nature ?? null,
        pain_intensity: firstPain?.intensity ?? null,
        notes: notes.trim() || null,
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

      const { error } = await supabase.from("wellness_tracking").insert(insertData);
      if (error) throw error;

      // Save HRV data if any provided
      const hasHrvData = Object.values(hrvData).some((v) => v !== "");
      if (hasHrvData) {
        const { error: hrvError } = await supabase.from("hrv_records").insert({
          player_id: playerId,
          category_id: categoryId,
          record_date: date,
          record_type: "morning",
          hrv_ms: hrvData.hrv_ms ? parseFloat(hrvData.hrv_ms) : null,
          resting_hr_bpm: hrvData.resting_hr_bpm ? parseFloat(hrvData.resting_hr_bpm) : null,
          avg_hr_bpm: hrvData.avg_hr_bpm ? parseFloat(hrvData.avg_hr_bpm) : null,
          max_hr_bpm: hrvData.max_hr_bpm ? parseFloat(hrvData.max_hr_bpm) : null,
          zone1_minutes: hrvData.zone1_minutes ? parseFloat(hrvData.zone1_minutes) : null,
          zone2_minutes: hrvData.zone2_minutes ? parseFloat(hrvData.zone2_minutes) : null,
          zone3_minutes: hrvData.zone3_minutes ? parseFloat(hrvData.zone3_minutes) : null,
          zone4_minutes: hrvData.zone4_minutes ? parseFloat(hrvData.zone4_minutes) : null,
          zone5_minutes: hrvData.zone5_minutes ? parseFloat(hrvData.zone5_minutes) : null,
        });
        if (hrvError) console.error("HRV save error:", hrvError);
      }

      return playerName;
    },
    onSuccess: (playerName) => {
      queryClient.invalidateQueries({ queryKey: ["wellness_tracking", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["wellness_decision", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["wellness_existing", categoryId, date] });
      toast.success(`Wellness enregistré pour ${playerName}`);
      const currentDate = date;
      resetForm();
      setDate(currentDate);
    },
    onError: (error: any) => {
      if (typeof error?.message === "string" && error.message.startsWith("guard:")) return;
      if (error.code === "23505") {
        toast.error("Une entrée existe déjà pour ce joueur à cette date");
      } else {
        toast.error("Erreur lors de l'enregistrement");
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerId) {
      toast.error("Veuillez sélectionner un athlète");
      return;
    }
    addWellness.mutate();
  };

  const ScoreButton = ({
    label,
    emoji,
    value,
    onChange,
    options,
    inverted = true,
    isSleep = false,
  }: {
    label: string;
    emoji: string;
    value: number;
    onChange: (v: number) => void;
    options: { value: number; label: string }[];
    inverted?: boolean;
    isSleep?: boolean;
  }) => (
    <div className="space-y-3">
      <Label className="flex items-center gap-1.5">
        <span className="text-base">{emoji}</span>
        {label}
      </Label>
      {isSleep ? (
        <div className="flex gap-2 flex-wrap">
          {SLEEP_RANGES.map((range) => {
            const isSelected = value === range.value;
            return (
              <button
                key={range.label}
                type="button"
                onClick={() => onChange(range.value)}
                className={cn(
                  "flex-1 min-w-0 rounded-md border text-xs font-medium py-2 px-1 transition-all",
                  "active:scale-95 whitespace-normal h-auto",
                  getSleepScoreButtonClasses(range.value, isSelected),
                )}
              >
                <span className="text-center line-clamp-2 block">{range.label}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground italic">
            {`${options[0]?.value ?? 1} = ${options[0]?.label ?? ""} · ${options[options.length - 1]?.value ?? 5} = ${options[options.length - 1]?.label ?? ""}`}
          </p>

          <div className="flex gap-2 flex-wrap">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange(opt.value)}
                className={cn(
                  "flex-1 min-w-0 rounded-md border text-xs font-medium py-2 px-1 transition-all",
                  "active:scale-95 whitespace-normal h-auto",
                  getWellnessButtonClasses(opt.value, inverted, value === opt.value),
                )}
              >
                <span className="text-center line-clamp-2 block">{opt.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouvelle entrée Wellness & Soreness</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Joueur</Label>
              <Select value={playerId} onValueChange={setPlayerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                {availablePlayers?.map((player) => (
                    <SelectItem key={player.id} value={player.id}>
                      {player.first_name ? `${player.first_name} ${player.name}` : player.name}
                    </SelectItem>
                  ))}
                  {availablePlayers?.length === 0 && (
                    <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                      Tous les athlètes ont déjà rempli leur wellness
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium">Wellness</h4>

            {activeQuestions.map(q => {
              if (q.is_sleep_duration) {
                return (
                  <ScoreButton
                    key={q.key}
                    label={q.label}
                    emoji={q.emoji}
                    value={values[q.key] ?? 7.5}
                    onChange={(v) => setValues(prev => ({ ...prev, [q.key]: v }))}
                    options={SLEEP_RANGES.map(r => ({ value: r.value, label: r.label }))}
                    isSleep
                  />
                );
              }
              const defaultVal = q.scale[0]?.value ?? 1;
              return (
                <ScoreButton
                  key={q.key}
                  label={q.label}
                  emoji={q.emoji}
                  value={values[q.key] ?? defaultVal}
                  onChange={(v) => setValues(prev => ({ ...prev, [q.key]: v }))}
                  options={q.scale.map(s => ({ value: s.value, label: s.label }))}
                  inverted={q.inverted}
                />
              );

            })}
          </div>

          <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between">
              <Label htmlFor="specific-pain">Douleur(s) spécifique(s) / aiguë(s) ?</Label>
              <Switch
                id="specific-pain"
                checked={hasSpecificPain}
                onCheckedChange={(v) => {
                  setHasSpecificPain(v);
                  if (!v) setPainEntries([]);
                }}
              />
            </div>
            <BodyPainSelector
              entries={painEntries}
              onChange={setPainEntries}
              categoryId={categoryId}
              disabled={!hasSpecificPain}
            />
          </div>

          {/* HRV Section (optional) */}
          <HrvInputSection data={hrvData} onChange={setHrvData} />

          {/* Notes / Commentaires section */}
          <div className="space-y-2">
            <Label htmlFor="wellness-notes">Notes / Commentaires du coach</Label>
            <Textarea
              id="wellness-notes"
              placeholder="Ex: Mauvaise nuit suite à un voyage, stress lié à un examen, fatigue post-compétition..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[80px]"
            />
            <p className="text-xs text-muted-foreground">
              Notez les raisons des scores élevés ou tout contexte important
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={addWellness.isPending}>
              Enregistrer
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
