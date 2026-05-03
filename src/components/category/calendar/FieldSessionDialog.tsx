import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Clock, MapPin, Users, Layers, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getTrainingTypesForSport } from "@/lib/constants/trainingTypes";
import {
  TARGET_INTENSITIES,
  VOLUME_OPTIONS,
  CONTACT_CHARGE_OPTIONS,
} from "@/lib/constants/sessionBlockOptions";

interface FieldSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  categoryId: string;
  sportType?: string;
}

interface BlockDraft {
  id: string;
  theme: string;          // training_type value (e.g. "bowling_spare", "Collectif")
  themeLabel: string;     // display label
  duration_minutes: number;
  intensity: number;      // Planned RPE 1-10 (chosen by staff for this block)
  notes: string;
  bowling_exercise_type?: string;
}

const GENERIC_THEMES = [
  "Collectif",
  "Fitness game",
  "Technique",
  "Tactique",
  "Opposition",
  "Spécifique compétition",
  "Échauffement",
  "Récupération",
];

const BOWLING_PRECISION_EXERCISES = [
  { value: "quille_7", label: "Quille 7" },
  { value: "quille_10", label: "Quille 10" },
  { value: "spares", label: "Spares (général)" },
  { value: "poche", label: "Poche" },
];

const isBowlingSport = (sport?: string) =>
  !!sport && sport.toLowerCase().startsWith("bowling");

export function FieldSessionDialog({ open, onOpenChange, date, categoryId, sportType }: FieldSessionDialogProps) {
  const qc = useQueryClient();

  const [title, setTitle] = useState("Séance terrain");
  const [startTime, setStartTime] = useState("17:00");
  const [endTime, setEndTime] = useState("18:30");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(true);
  const [blocks, setBlocks] = useState<BlockDraft[]>([
    { id: crypto.randomUUID(), theme: "Échauffement", themeLabel: "Échauffement", duration_minutes: 15, intensity: 4, notes: "" },
    { id: crypto.randomUUID(), theme: "Collectif", themeLabel: "Collectif", duration_minutes: 45, intensity: 7, notes: "" },
  ]);

  const isBowling = isBowlingSport(sportType);

  // Theme options (value + label). For bowling, include bowling-specific training types so we can store the exact training_type (e.g. "bowling_spare").
  const themeOptions = useMemo(() => {
    if (isBowling) {
      const sportTypes = getTrainingTypesForSport(sportType);
      const bowlingTypes = sportTypes
        .filter((t) => t.value.startsWith("bowling_"))
        .map((t) => ({ value: t.value, label: t.label }));
      const generics = GENERIC_THEMES.map((t) => ({ value: t, label: t }));
      // Bowling first
      const all = [...bowlingTypes, ...generics];
      const seen = new Set<string>();
      return all.filter((o) => (seen.has(o.value) ? false : (seen.add(o.value), true)));
    }
    const sportLabels = getTrainingTypesForSport(sportType).map((t) => t.label);
    return Array.from(new Set([...GENERIC_THEMES, ...sportLabels])).map((t) => ({ value: t, label: t }));
  }, [sportType, isBowling]);

  const { data: players } = useQuery({
    queryKey: ["players-field-session", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, name, first_name, position")
        .eq("category_id", categoryId)
        .order("name");
      if (error) throw error;
      // Default: all selected
      if (data && selectAll && selectedPlayers.length === 0) {
        setSelectedPlayers(data.map((p) => p.id));
      }
      return data;
    },
    enabled: open,
  });

  const totalDuration = useMemo(
    () => blocks.reduce((sum, b) => sum + (Number(b.duration_minutes) || 0), 0),
    [blocks],
  );

  const addBlock = () => {
    const first = themeOptions[0];
    setBlocks((b) => [
      ...b,
      {
        id: crypto.randomUUID(),
        theme: first?.value || "Collectif",
        themeLabel: first?.label || "Collectif",
        duration_minutes: 30,
        intensity: 6,
        notes: "",
      },
    ]);
  };

  const updateBlock = (id: string, patch: Partial<BlockDraft>) =>
    setBlocks((b) => b.map((bl) => (bl.id === id ? { ...bl, ...patch } : bl)));

  const removeBlock = (id: string) => setBlocks((b) => b.filter((bl) => bl.id !== id));

  const togglePlayer = (id: string) => {
    setSelectedPlayers((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
    setSelectAll(false);
  };

  const toggleAll = () => {
    if (!players) return;
    if (selectedPlayers.length === players.length) {
      setSelectedPlayers([]);
      setSelectAll(false);
    } else {
      setSelectedPlayers(players.map((p) => p.id));
      setSelectAll(true);
    }
  };

  const create = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Veuillez saisir un titre");
      if (blocks.length === 0) throw new Error("Ajoutez au moins un bloc");
      if (blocks.some((b) => !b.theme)) throw new Error("Chaque bloc doit avoir un thème");

      // Compute weighted planned RPE from blocks (for workload "RPE prévu")
      const totalDur = blocks.reduce((s, b) => s + (Number(b.duration_minutes) || 0), 0);
      const weightedSum = blocks.reduce(
        (s, b) => s + (Number(b.duration_minutes) || 0) * (Number(b.intensity) || 0),
        0,
      );
      const plannedIntensity =
        totalDur > 0 && weightedSum > 0 ? Math.round((weightedSum / totalDur) * 10) / 10 : null;

      const { data: session, error: sErr } = await supabase
        .from("training_sessions")
        .insert({
          category_id: categoryId,
          session_date: format(date, "yyyy-MM-dd"),
          session_start_time: startTime || null,
          session_end_time: endTime || null,
          training_type: "terrain",
          location: location || null,
          notes: `${title}${notes ? `\n${notes}` : ""}`,
          intensity: plannedIntensity ? Math.round(plannedIntensity) : 1,
          planned_intensity: plannedIntensity,
        })
        .select("id")
        .single();
      if (sErr) throw sErr;

      // Insert blocks
      const blockRows = blocks.map((b, idx) => ({
        training_session_id: session.id,
        block_order: idx,
        training_type: b.theme,
        theme: b.themeLabel || b.theme,
        duration_minutes: b.duration_minutes,
        intensity: b.intensity && b.intensity >= 1 && b.intensity <= 10 ? b.intensity : null,
        notes: b.notes || null,
        bowling_exercise_type: b.theme === "bowling_spare" ? (b.bowling_exercise_type || null) : null,
      }));
      const { error: bErr } = await supabase.from("training_session_blocks").insert(blockRows);
      if (bErr) throw bErr;

      // Participants
      if (selectedPlayers.length > 0) {
        const { error: pErr } = await supabase.from("event_participants").insert(
          selectedPlayers.map((pid) => ({ training_session_id: session.id, player_id: pid })),
        );
        if (pErr) console.error(pErr);
      }

      return session.id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["training_sessions", categoryId] });
      qc.invalidateQueries({ queryKey: ["sessions", categoryId] });
      qc.invalidateQueries({ queryKey: ["today_sessions", categoryId] });
      toast.success("Séance terrain créée ✅");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message || "Erreur lors de la création"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border/60 px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Layers className="h-5 w-5 text-primary" />
            Nouvelle séance terrain
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{format(date, "EEEE d MMMM yyyy", { locale: fr })}</p>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="fs-title">Titre</Label>
            <Input id="fs-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Clock className="h-3 w-3" /> Début</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Clock className="h-3 w-3" /> Fin</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1"><MapPin className="h-3 w-3" /> Lieu</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Stade, terrain, salle..." />
          </div>

          {/* Blocs */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1"><Layers className="h-3 w-3" /> Blocs / Thématiques</Label>
              <Badge variant="secondary">Total : {totalDuration} min</Badge>
            </div>
            <div className="space-y-2">
              {blocks.map((b, idx) => (
                <Card key={b.id} className="border-l-4 border-l-primary/60">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-muted-foreground">Bloc {idx + 1}</p>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeBlock(b.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_110px_120px] gap-2">
                      <Select
                        value={b.theme}
                        onValueChange={(v) => {
                          const opt = themeOptions.find((o) => o.value === v);
                          updateBlock(b.id, { theme: v, themeLabel: opt?.label || v });
                        }}
                      >
                        <SelectTrigger><SelectValue placeholder="Choisir un thème" /></SelectTrigger>
                        <SelectContent className="max-h-72">
                          {themeOptions.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={1}
                          value={b.duration_minutes}
                          onChange={(e) => updateBlock(b.id, { duration_minutes: parseInt(e.target.value) || 0 })}
                          title="Durée en minutes"
                        />
                        <span className="text-xs text-muted-foreground">min</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={1}
                          max={10}
                          value={b.intensity}
                          onChange={(e) => {
                            const v = parseInt(e.target.value) || 0;
                            updateBlock(b.id, { intensity: Math.max(0, Math.min(10, v)) });
                          }}
                          title="RPE prévu (1-10)"
                        />
                        <span className="text-xs text-muted-foreground">RPE</span>
                      </div>
                    </div>
                    {b.theme === "bowling_spare" && (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          Exercice précision (les athlètes saisiront boules lancées / réussies)
                        </Label>
                        <Select
                          value={b.bowling_exercise_type || ""}
                          onValueChange={(v) => updateBlock(b.id, { bowling_exercise_type: v })}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Sélectionner l'exercice..." />
                          </SelectTrigger>
                          <SelectContent>
                            {BOWLING_PRECISION_EXERCISES.map((ex) => (
                              <SelectItem key={ex.value} value={ex.value}>{ex.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <Textarea
                      rows={2}
                      placeholder="Détail / consignes (optionnel)"
                      value={b.notes}
                      onChange={(e) => updateBlock(b.id, { notes: e.target.value })}
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={addBlock} className="gap-1">
              <Plus className="h-3.5 w-3.5" /> Ajouter un bloc
            </Button>
          </div>

          {/* Participants */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1"><Users className="h-3 w-3" /> Participants ({selectedPlayers.length})</Label>
              <div className="flex items-center gap-2 cursor-pointer" onClick={toggleAll}>
                <Checkbox checked={players ? selectedPlayers.length === players.length : false} className="pointer-events-none" />
                <span className="text-xs">Tous</span>
              </div>
            </div>
            <div className="max-h-[200px] overflow-y-auto rounded-lg border border-border/70 bg-muted/20 p-2 grid grid-cols-2 gap-1">
              {players?.map((p) => {
                const sel = selectedPlayers.includes(p.id);
                return (
                  <div
                    key={p.id}
                    onClick={() => togglePlayer(p.id)}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-md cursor-pointer text-sm",
                      sel ? "bg-primary/10 border border-primary" : "border border-transparent hover:bg-muted",
                    )}
                  >
                    <Checkbox checked={sel} className="pointer-events-none" />
                    <span className="truncate">{p.first_name ? `${p.first_name} ${p.name}` : p.name}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes générales (optionnel)</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
            <span>Chaque athlète saisira son RPE par bloc dans son espace. La charge totale = somme(RPE × durée du bloc).</span>
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t border-border/60 px-6 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? "Création..." : "Créer la séance"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
