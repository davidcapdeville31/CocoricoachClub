import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Clock, MapPin, Users, Layers, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getTrainingTypesForSport, getTrainingTypesGrouped } from "@/lib/constants/trainingTypes";
import {
  TARGET_INTENSITIES,
  VOLUME_OPTIONS,
  CONTACT_CHARGE_OPTIONS,
} from "@/lib/constants/sessionBlockOptions";
import { getThemeColorTokens } from "@/lib/constants/themeColors";
import { isRugbyType } from "@/lib/constants/sportTypes";
import { BowlingSessionContent } from "@/components/bowling/BowlingSessionContent";
import { BasketballPrecisionTracker } from "@/components/basketball/BasketballPrecisionTracker";
import {
  IMPLEMENT_LABELS,
  type ImplementType,
  getWeightOptions,
  isThrowingBlock,
} from "@/lib/constants/athleticsImplements";

const BASKET_PRECISION_THEMES = new Set(["basketball_lf", "basketball_paint", "basketball_3pts"]);

interface FieldSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  categoryId: string;
  sportType?: string;
  editSession?: any | null;
}

interface BlockDraft {
  id: string;
  theme: string;          // training_type value (e.g. "bowling_spare", "Collectif")
  themeLabel: string;     // display label
  duration_minutes: number;
  intensity: number;      // Planned RPE 1-10 (chosen by staff for this block)
  notes: string;
  bowling_exercise_type?: string;
  target_intensity?: string; // faible / moderee / elevee / tres_elevee
  volume?: string;           // court / moyen / long
  contact_charge?: string;   // aucun / faible / modere / eleve
  throwing_implement?: string;
  implement_weight_g?: number | null;
}

const GENERIC_THEMES = [
  "Collectif",
  "Fitness game",
  "Technique",
  "Tactique",
  "Opposition",
  "Spécifique compétition",
  "Échauffement",
];

// Thématiques retirées du menu (à la demande coach) — restent supportées en BDD si déjà saisies
const EXCLUDED_THEME_VALUES = new Set<string>([
  "physique",
  "musculation",
  "vitesse_general",
  "endurance_general",
  "souplesse_mobilite",
  "repos",
  "test",
  "reunion",
  "medical",
  "recuperation",
  "video_analyse",
  "video",
]);
const EXCLUDED_THEME_LABELS = new Set<string>([
  "Physique",
  "Musculation",
  "Endurance",
  "Vitesse / Explosivité",
  "Souplesse / Mobilité",
  "Repos",
  "Test",
  "Tests",
  "Réunion",
  "Rendez-vous Médical",
  "Récupération",
  "Récupération Active",
  "Analyse Vidéo",
]);

const customThemesStorageKey = (categoryId: string) => `cc:custom-themes:${categoryId}`;
const loadCustomThemes = (categoryId: string): string[] => {
  try {
    const raw = localStorage.getItem(customThemesStorageKey(categoryId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};
const saveCustomThemes = (categoryId: string, themes: string[]) => {
  try {
    localStorage.setItem(customThemesStorageKey(categoryId), JSON.stringify(themes));
  } catch {
    /* noop */
  }
};

const BOWLING_PRECISION_EXERCISES = [
  { value: "quille_7", label: "Quille 7" },
  { value: "quille_10", label: "Quille 10" },
  { value: "spares", label: "Spares (général)" },
  { value: "poche", label: "Poche" },
];

const isBowlingSport = (sport?: string) =>
  !!sport && sport.toLowerCase().startsWith("bowling");

export function FieldSessionDialog({ open, onOpenChange, date, categoryId, sportType, editSession }: FieldSessionDialogProps) {
  const qc = useQueryClient();
  const isEdit = !!editSession?.id;

  const [title, setTitle] = useState("Séance terrain");
  const [startTime, setStartTime] = useState("17:00");
  const [endTime, setEndTime] = useState("18:30");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(true);
  const [blocks, setBlocks] = useState<BlockDraft[]>([
    { id: crypto.randomUUID(), theme: "Échauffement", themeLabel: "Échauffement", duration_minutes: 15, intensity: 4, notes: "", target_intensity: "faible", volume: "court", contact_charge: "aucun" },
    { id: crypto.randomUUID(), theme: "Collectif", themeLabel: "Collectif", duration_minutes: 45, intensity: 7, notes: "", target_intensity: "elevee", volume: "moyen", contact_charge: "modere" },
  ]);

  const isBowling = isBowlingSport(sportType);
  const isRugby = isRugbyType(sportType || "");

  const [customThemes, setCustomThemes] = useState<string[]>(() => loadCustomThemes(categoryId));
  const [newCustomTheme, setNewCustomTheme] = useState("");

  // Theme options (value + label). For bowling, include bowling-specific training types.
  const themeOptions = useMemo(() => {
    const filterOut = (o: { value: string; label: string }) =>
      !EXCLUDED_THEME_VALUES.has(o.value) && !EXCLUDED_THEME_LABELS.has(o.label);

    if (isBowling) {
      const sportTypes = getTrainingTypesForSport(sportType);
      const bowlingTypes = sportTypes
        .filter((t) => t.value.startsWith("bowling_"))
        .map((t) => ({ value: t.value, label: t.label }));
      const generics = GENERIC_THEMES.map((t) => ({ value: t, label: t }));
      const customs = customThemes.map((t) => ({ value: t, label: t }));
      const all = [...bowlingTypes, ...generics, ...customs].filter(filterOut);
      const seen = new Set<string>();
      return all.filter((o) => (seen.has(o.value) ? false : (seen.add(o.value), true)));
    }
    const sportLabels = getTrainingTypesForSport(sportType)
      .filter((t) => filterOut({ value: t.value, label: t.label }))
      .map((t) => t.label);
    return Array.from(new Set([...GENERIC_THEMES, ...sportLabels, ...customThemes])).map((t) => ({
      value: t,
      label: t,
    }));
  }, [sportType, isBowling, customThemes]);

  // Grouped options by discipline category (sprint, lancers, ...) + generics + customs
  const themeGroups = useMemo(() => {
    const filterOut = (o: { value: string; label: string }) =>
      !EXCLUDED_THEME_VALUES.has(o.value) && !EXCLUDED_THEME_LABELS.has(o.label);
    const grouped = getTrainingTypesGrouped(sportType);
    const seen = new Set<string>();
    const groups: { label: string; options: { value: string; label: string }[] }[] = [];
    // Sport-specific groups (skip "common" -> we replace with our curated generics)
    grouped
      .filter((g) => g.category.key !== "common")
      .forEach((g) => {
        const opts = g.types
          .map((t) => ({ value: t.value, label: t.label }))
          .filter(filterOut)
          .filter((o) => (seen.has(o.value) ? false : (seen.add(o.value), true)));
        if (opts.length) groups.push({ label: g.category.label, options: opts });
      });
    // Generics
    const generics = GENERIC_THEMES.map((t) => ({ value: t, label: t }))
      .filter(filterOut)
      .filter((o) => (seen.has(o.value) ? false : (seen.add(o.value), true)));
    if (generics.length) groups.push({ label: "Génériques", options: generics });
    // Customs
    const customs = customThemes
      .map((t) => ({ value: t, label: t }))
      .filter(filterOut)
      .filter((o) => (seen.has(o.value) ? false : (seen.add(o.value), true)));
    if (customs.length) groups.push({ label: "Personnalisées", options: customs });
    return groups;
  }, [sportType, customThemes]);

  const addCustomTheme = () => {
    const v = newCustomTheme.trim();
    if (!v) return;
    if (customThemes.includes(v) || GENERIC_THEMES.includes(v)) {
      setNewCustomTheme("");
      return;
    }
    const next = [...customThemes, v];
    setCustomThemes(next);
    saveCustomThemes(categoryId, next);
    setNewCustomTheme("");
    toast.success(`Thématique « ${v} » ajoutée`);
  };

  const removeCustomTheme = (t: string) => {
    const next = customThemes.filter((x) => x !== t);
    setCustomThemes(next);
    saveCustomThemes(categoryId, next);
  };


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

  // Load existing session data when in edit mode
  useEffect(() => {
    if (!open || !isEdit || !editSession) return;
    let cancelled = false;
    (async () => {
      try {
        // Title is stored as first line of notes; rest of notes is the general note
        const rawNotes: string = editSession.notes || "";
        const lines = rawNotes.split("\n");
        setTitle(lines[0] || "Séance terrain");
        setNotes(lines.slice(1).join("\n"));
        setStartTime(editSession.session_start_time?.slice(0, 5) || "17:00");
        setEndTime(editSession.session_end_time?.slice(0, 5) || "18:30");
        setLocation(editSession.location || "");

        const { data: blockRows } = await supabase
          .from("training_session_blocks")
          .select("*")
          .eq("training_session_id", editSession.id)
          .order("block_order");
        if (cancelled) return;
        if (blockRows && blockRows.length > 0) {
          setBlocks(
            blockRows.map((br: any) => ({
              id: br.id || crypto.randomUUID(),
              theme: br.training_type || br.theme || "Collectif",
              themeLabel: br.theme || br.training_type || "Collectif",
              duration_minutes: br.duration_minutes ?? 30,
              intensity: br.intensity ?? 5,
              notes: br.notes || "",
              bowling_exercise_type: br.bowling_exercise_type || undefined,
              target_intensity: br.target_intensity || undefined,
              volume: br.volume || undefined,
              contact_charge: br.contact_charge || undefined,
              throwing_implement: br.throwing_implement || undefined,
              implement_weight_g: br.implement_weight_g ?? null,
            })),
          );
        }

        const { data: parts } = await supabase
          .from("event_participants")
          .select("player_id")
          .eq("training_session_id", editSession.id);
        if (cancelled) return;
        if (parts) {
          setSelectedPlayers(parts.map((p: any) => p.player_id));
          setSelectAll(false);
        }
      } catch (e) {
        console.error(e);
      }
    })();
    return () => { cancelled = true; };
  }, [open, isEdit, editSession]);

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
        target_intensity: "moderee",
        volume: "moyen",
        contact_charge: "aucun",
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
        totalDur > 0 && weightedSum > 0 ? Math.round(weightedSum / totalDur) : null;

      const sessionPayload = {
        category_id: categoryId,
        session_date: format(date, "yyyy-MM-dd"),
        session_start_time: startTime || null,
        session_end_time: endTime || null,
        training_type: "terrain",
        location: location || null,
        notes: `${title}${notes ? `\n${notes}` : ""}`,
        intensity: plannedIntensity ?? 1,
        planned_intensity: plannedIntensity,
      };

      let sessionId: string;
      if (isEdit) {
        const { error: uErr } = await supabase
          .from("training_sessions")
          .update(sessionPayload)
          .eq("id", editSession.id);
        if (uErr) throw uErr;
        sessionId = editSession.id;
        // Replace blocks
        await supabase
          .from("training_session_blocks")
          .delete()
          .eq("training_session_id", sessionId);
        // Replace participants
        await supabase
          .from("event_participants")
          .delete()
          .eq("training_session_id", sessionId);
      } else {
        const { data: session, error: sErr } = await supabase
          .from("training_sessions")
          .insert(sessionPayload)
          .select("id")
          .single();
        if (sErr) throw sErr;
        sessionId = session.id;
      }

      // Insert blocks
      const blockRows = blocks.map((b, idx) => ({
        training_session_id: sessionId,
        block_order: idx,
        training_type: b.theme,
        theme: b.themeLabel || b.theme,
        duration_minutes: b.duration_minutes,
        intensity: b.intensity && b.intensity >= 1 && b.intensity <= 10 ? b.intensity : null,
        notes: b.notes || null,
        bowling_exercise_type: b.theme === "bowling_spare" ? (b.bowling_exercise_type || null) : null,
        target_intensity: b.target_intensity || null,
        volume: b.volume || null,
        contact_charge: b.contact_charge || null,
        throwing_implement: isThrowingBlock(b.theme) ? (b.throwing_implement || null) : null,
        implement_weight_g: isThrowingBlock(b.theme) ? (b.implement_weight_g ?? null) : null,
      }));
      const { error: bErr } = await supabase.from("training_session_blocks").insert(blockRows);
      if (bErr) throw bErr;

      // Participants
      if (selectedPlayers.length > 0) {
        const { error: pErr } = await supabase.from("event_participants").insert(
          selectedPlayers.map((pid) => ({ training_session_id: sessionId, player_id: pid })),
        );
        if (pErr) console.error(pErr);
      }

      return sessionId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["training_sessions", categoryId] });
      qc.invalidateQueries({ queryKey: ["sessions", categoryId] });
      qc.invalidateQueries({ queryKey: ["today_sessions", categoryId] });
      toast.success(isEdit ? "Séance terrain mise à jour ✅" : "Séance terrain créée ✅");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message || "Erreur lors de l'enregistrement"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border/60 px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Layers className="h-5 w-5 text-primary" />
            {isEdit ? "Modifier la séance terrain" : "Nouvelle séance terrain"}
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

            {/* Thématiques personnalisées */}
            <div className="rounded-md border border-dashed border-border/60 p-2 space-y-2 bg-muted/30">
              <Label className="text-[11px] text-muted-foreground">Thématiques personnalisées</Label>
              <div className="flex gap-2">
                <Input
                  value={newCustomTheme}
                  onChange={(e) => setNewCustomTheme(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomTheme(); } }}
                  placeholder="Ex : Skills handling, Set-piece, Travail blocs..."
                  className="h-8 text-xs"
                />
                <Button type="button" size="sm" variant="outline" onClick={addCustomTheme} className="h-8">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter
                </Button>
              </div>
              {customThemes.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {customThemes.map((t) => (
                    <Badge key={t} variant="secondary" className="text-[10px] gap-1">
                      {t}
                      <button
                        type="button"
                        className="ml-1 opacity-60 hover:opacity-100"
                        onClick={() => removeCustomTheme(t)}
                        aria-label={`Retirer ${t}`}
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">

              {blocks.map((b, idx) => {
                const colors = getThemeColorTokens(b.themeLabel || b.theme);
                return (
                <Card key={b.id} className={cn("border-l-4 transition-colors", colors.border, colors.bg)}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={cn("inline-block h-2.5 w-2.5 rounded-full")} style={{ backgroundColor: colors.hex }} />
                        <p className={cn("text-xs font-semibold", colors.text)}>Bloc {idx + 1}</p>
                        {b.themeLabel && (
                          <Badge variant="outline" className={cn("text-[10px] py-0", colors.badge)}>
                            {b.themeLabel}
                          </Badge>
                        )}
                      </div>
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
                          {themeGroups.map((g) => (
                            <SelectGroup key={g.label}>
                              <SelectLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                {g.label}
                              </SelectLabel>
                              {g.options.map((t) => (
                                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                              ))}
                            </SelectGroup>
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
                          title="RPE prévu (1-10) — alimente le sous-menu RPE prévu/réel"
                        />
                        <span className="text-xs text-muted-foreground">RPE</span>
                      </div>
                    </div>
                    {/* Intensité / Volume (tous sports sauf bowling) + Charge contact (rugby uniquement) — alimente Workload → Répartition */}
                    {!isBowling && (
                    <div className={cn("grid grid-cols-1 gap-2", isRugby ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Intensité</Label>
                        <Select
                          value={b.target_intensity || ""}
                          onValueChange={(v) => updateBlock(b.id, { target_intensity: v })}
                        >
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Intensité" /></SelectTrigger>
                          <SelectContent>
                            {TARGET_INTENSITIES.map((o) => (
                              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Volume</Label>
                        <Select
                          value={b.volume || ""}
                          onValueChange={(v) => updateBlock(b.id, { volume: v })}
                        >
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Volume" /></SelectTrigger>
                          <SelectContent>
                            {VOLUME_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {isRugby && (
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">Charge contact</Label>
                          <Select
                            value={b.contact_charge || ""}
                            onValueChange={(v) => updateBlock(b.id, { contact_charge: v })}
                          >
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Contact" /></SelectTrigger>
                            <SelectContent>
                              {CONTACT_CHARGE_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                    )}
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
                    {/* Saisie inline des feuilles de score / précision (en mode édition uniquement) */}
                    {isEdit && (b.theme === "bowling_game" || b.theme === "bowling_spare") && (
                      <div className="rounded-lg border border-dashed border-border/70 bg-muted/30 p-3">
                        <BowlingSessionContent
                          sessionId={editSession.id}
                          categoryId={categoryId}
                          blockType={b.theme as "bowling_game" | "bowling_spare"}
                          sessionDate={format(date, "yyyy-MM-dd")}
                        />
                      </div>
                    )}
                    {isEdit && BASKET_PRECISION_THEMES.has(b.theme) && (
                      <div className="rounded-lg border border-dashed border-border/70 bg-muted/30 p-3">
                        <BasketballPrecisionTracker
                          categoryId={categoryId}
                          trainingSessionId={editSession.id}
                          sessionDate={format(date, "yyyy-MM-dd")}
                        />
                      </div>
                    )}
                    {!isEdit && BASKET_PRECISION_THEMES.has(b.theme) && (
                      <p className="text-[11px] text-muted-foreground italic">
                        Enregistrez la séance puis rouvrez-la pour saisir les statistiques de tir (cartographie cliquable).
                      </p>
                    )}
                    <Textarea
                      rows={2}
                      placeholder="Détail / consignes (optionnel)"
                      value={b.notes}
                      onChange={(e) => updateBlock(b.id, { notes: e.target.value })}
                    />
                  </CardContent>
                </Card>
                );
              })}
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
            {create.isPending ? (isEdit ? "Mise à jour..." : "Création...") : (isEdit ? "Enregistrer" : "Créer la séance")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
