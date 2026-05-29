import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Plus, Target, Wrench, Save, Circle, Users, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SimplifiedTacticalBlockEditor } from "./simplified/SimplifiedTacticalBlockEditor";
import { SimplifiedTechnicalBlockEditor } from "./simplified/SimplifiedTechnicalBlockEditor";
import { SimplifiedGamesBlockEditor } from "./simplified/SimplifiedGamesBlockEditor";
import { LockedBlockSummary } from "./simplified/LockedBlockSummary";
import {
  newTacticalBlock,
  newTechnicalBlock,
  newGamesBlock,
  technicalThemeLabel,
  aggregateGamesStats,
  type SimplifiedBlock,
} from "./simplified/types";

interface BowlingSimplifiedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  categoryId: string;
  /** Si défini → mode athlète : pas de sélecteur, la séance est forcément pour ce joueur. */
  athletePlayerId?: string;
  /** Si défini → on édite/remplit une séance existante (créée par le coach). */
  existingSessionId?: string;
}

/**
 * Mode SIMPLIFIÉ de création de séance bowling.
 * Blocs disponibles : Tactique, Technique, Parties.
 * Côté coach : choix des athlètes destinataires.
 * Côté athlète : auto-attribué à soi-même.
 * Si `existingSessionId` est passé, on précharge les blocs déjà attribués au joueur
 * et l'enregistrement remplace les blocs existants pour ce joueur sur cette séance.
 */
export function BowlingSimplifiedDialog({
  open,
  onOpenChange,
  date,
  categoryId,
  athletePlayerId,
  existingSessionId,
}: BowlingSimplifiedDialogProps) {
  const isAthleteMode = !!athletePlayerId;
  const isEditMode = !!existingSessionId;
  const qc = useQueryClient();

  const [blocks, setBlocks] = useState<SimplifiedBlock[]>([]);
  const [lockedIds, setLockedIds] = useState<Set<string>>(new Set());
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);

  // Fetch effectif (coach mode only)
  const { data: players = [] } = useQuery({
    queryKey: ["bowling_simplified_players", categoryId],
    enabled: open && !isAthleteMode,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, name, first_name")
        .eq("category_id", categoryId)
        .order("name");
      if (error) throw error;
      return (data || []) as Array<{ id: string; name: string; first_name: string | null }>;
    },
  });

  const allSelected = players.length > 0 && selectedPlayers.length === players.length;

  const toggleAll = (checked: boolean | "indeterminate") => {
    setSelectedPlayers(checked === true ? players.map((p) => p.id) : []);
  };

  const togglePlayer = (id: string) => {
    setSelectedPlayers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const addTactical = () => setBlocks((prev) => [...prev, newTacticalBlock()]);
  const addTechnical = () => setBlocks((prev) => [...prev, newTechnicalBlock()]);
  const addGames = () => setBlocks((prev) => [...prev, newGamesBlock()]);

  const updateBlock = (id: string, next: SimplifiedBlock) =>
    setBlocks((prev) => prev.map((b) => (b.id === id ? next : b)));

  const removeBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    setLockedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const validateBlock = (b: SimplifiedBlock): string | null => {
    if (b.type === "tactical" || b.type === "technical") {
      if (b.duration_min <= 0) return "La durée doit être supérieure à 0";
    }
    if (b.type === "technical") {
      if (b.theme === "other" && !b.custom_theme?.trim())
        return "Précisez la thématique";
      if (!b.description.trim())
        return "Décrivez ce que vous avez travaillé";
    }
    if (b.type === "games") {
      const saved = b.parties.filter((p) => p.stats !== null).length;
      if (saved === 0)
        return "Enregistrez au moins une partie avant de verrouiller le bloc";
    }
    return null;
  };

  const lockBlock = (id: string) => {
    const b = blocks.find((x) => x.id === id);
    if (!b) return;
    const err = validateBlock(b);
    if (err) {
      toast.error(err);
      return;
    }
    setLockedIds((prev) => new Set(prev).add(id));
    toast.success("Bloc enregistré");
  };

  const unlockBlock = (id: string) =>
    setLockedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

  // ---------- Persistance ----------
  const blockTitle = (b: SimplifiedBlock): string => {
    if (b.type === "technical") return b.title?.trim() || technicalThemeLabel(b);
    if (b.type === "tactical") return b.title?.trim() || "Bloc tactique";
    return b.title?.trim() || "Bloc parties";
  };

  const blockDuration = (b: SimplifiedBlock): number | null => {
    if (b.type === "tactical" || b.type === "technical") return b.duration_min;
    // games : pas de durée explicite, on estime ~10 min / partie sauvegardée
    if (b.type === "games") {
      const saved = b.parties.filter((p) => p.stats !== null).length;
      return saved > 0 ? saved * 10 : null;
    }
    return null;
  };

  const buildConfig = (b: SimplifiedBlock): Record<string, unknown> => {
    // On stocke l'intégralité du bloc en JSON pour réutilisation future
    // + un agrégat pour Games (lecture facile).
    if (b.type === "games") {
      return { ...b, _aggregate: aggregateGamesStats(b) };
    }
    return { ...b };
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const targetPlayers = isAthleteMode
        ? [athletePlayerId!]
        : selectedPlayers;

      if (targetPlayers.length === 0) {
        throw new Error("Sélectionnez au moins un athlète");
      }
      if (blocks.length === 0) {
        throw new Error("Ajoutez au moins un bloc avant d'enregistrer");
      }
      const unlocked = blocks.filter((b) => !lockedIds.has(b.id));
      if (unlocked.length > 0) {
        throw new Error("Enregistrez d'abord chaque bloc avant de valider la séance");
      }

      const sessionDate = format(date, "yyyy-MM-dd");
      const totalDuration = blocks.reduce(
        (s, b) => s + (blockDuration(b) || 0),
        0,
      );

      // 1) Création de la séance
      const { data: session, error: sessErr } = await supabase
        .from("training_sessions")
        .insert({
          category_id: categoryId,
          session_date: sessionDate,
          training_type: "bowling_simplified",
          notes: "Séance bowling — Mode simplifié",
          intensity: null,
          planned_intensity: null,
        })
        .select("id")
        .single();
      if (sessErr) throw sessErr;

      // 2) Participants
      const { error: partErr } = await supabase
        .from("event_participants")
        .insert(
          targetPlayers.map((pid) => ({
            training_session_id: session.id,
            player_id: pid,
          })),
        );
      if (partErr) console.error("[BowlingSimplified] event_participants:", partErr);

      // 3) Blocs par athlète
      const rows = targetPlayers.flatMap((pid) =>
        blocks.map((b, idx) => ({
          session_id: session.id,
          category_id: categoryId,
          athlete_id: pid,
          source: isAthleteMode ? "athlete" : "coach",
          block_type: b.type,
          title: blockTitle(b),
          duration_min: blockDuration(b),
          planned_throws: null,
          priority: null,
          coach_instruction: null,
          internal_note: null,
          objectives: [],
          success_criteria: {},
          pattern_id: null,
          config: buildConfig(b),
          status: "completed",
          order_index: idx,
        })),
      );

      const { error: blocksErr } = await supabase
        .from("bowling_training_blocks")
        .insert(rows as any);
      if (blocksErr) throw blocksErr;

      // Optional: attendance present for each player
      const { error: attErr } = await supabase
        .from("training_attendance")
        .insert(
          targetPlayers.map((pid) => ({
            player_id: pid,
            category_id: categoryId,
            attendance_date: sessionDate,
            training_session_id: session.id,
            status: "present" as const,
          })),
        );
      if (attErr) console.warn("[BowlingSimplified] attendance:", attErr.message);

      return { sessionId: session.id, count: targetPlayers.length, blocks: blocks.length, totalDuration };
    },
    onSuccess: ({ count, blocks: nb }) => {
      toast.success(
        isAthleteMode
          ? `Séance enregistrée (${nb} bloc${nb > 1 ? "s" : ""})`
          : `Séance attribuée à ${count} athlète${count > 1 ? "s" : ""} (${nb} bloc${nb > 1 ? "s" : ""})`,
      );
      qc.invalidateQueries({ queryKey: ["training_sessions", categoryId] });
      qc.invalidateQueries({ queryKey: ["sessions", categoryId] });
      qc.invalidateQueries({ queryKey: ["bowling_training_blocks"] });
      qc.invalidateQueries({ queryKey: ["bowling_training_blocks_stats", categoryId] });
      handleOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message || "Erreur lors de l'enregistrement"),
  });

  const handleSave = () => saveMutation.mutate();

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setBlocks([]);
      setLockedIds(new Set());
      setSelectedPlayers([]);
    }
    onOpenChange(next);
  };

  // Réinitialise quand on ouvre
  useEffect(() => {
    if (open) {
      setBlocks([]);
      setLockedIds(new Set());
      setSelectedPlayers([]);
    }
  }, [open]);

  // Indices typés par bloc pour conserver la numérotation par catégorie
  const tacticalIndexById = new Map<string, number>();
  const technicalIndexById = new Map<string, number>();
  const gamesIndexById = new Map<string, number>();
  let tCount = 0;
  let techCount = 0;
  let gamesCount = 0;
  blocks.forEach((b) => {
    if (b.type === "tactical") tacticalIndexById.set(b.id, tCount++);
    if (b.type === "technical") technicalIndexById.set(b.id, techCount++);
    if (b.type === "games") gamesIndexById.set(b.id, gamesCount++);
  });

  const playerIdForEditors = isAthleteMode
    ? athletePlayerId
    : selectedPlayers.length === 1
      ? selectedPlayers[0]
      : undefined;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl border-border/70 bg-background/95 shadow-2xl backdrop-blur-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-primary" />
            Nouvelle séance bowling — Mode simplifié
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {format(date, "EEEE d MMMM yyyy", { locale: fr })}
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Sélecteur d'athlètes (coach uniquement) */}
          {!isAthleteMode && (
            <div className="rounded-2xl border border-border/60 bg-surface-sunken/40 p-3">
              <div className="flex items-center justify-between mb-2">
                <Label className="flex items-center gap-2 text-sm font-semibold">
                  <Users className="h-4 w-4 text-primary" />
                  Athlètes ({selectedPlayers.length}/{players.length})
                </Label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                  />
                  Tout sélectionner
                </label>
              </div>
              <ScrollArea className="h-32 rounded-lg border border-border/40 bg-background/60">
                <div className="p-2 grid grid-cols-2 gap-1">
                  {players.map((p) => {
                    const checked = selectedPlayers.includes(p.id);
                    return (
                      <label
                        key={p.id}
                        className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-muted/60 cursor-pointer text-sm"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => togglePlayer(p.id)}
                        />
                        <span className="truncate">
                          {[p.first_name, p.name].filter(Boolean).join(" ") || "Athlète"}
                        </span>
                      </label>
                    );
                  })}
                  {players.length === 0 && (
                    <p className="text-xs text-muted-foreground col-span-2 text-center py-3">
                      Aucun athlète dans cette catégorie
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          {blocks.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/60 bg-muted/20 py-10 text-center">
              <div className="rounded-full bg-muted p-4">
                <Sparkles className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold text-foreground">
                Construisez votre séance
              </h3>
              <p className="max-w-sm text-sm text-muted-foreground">
                Ajoutez un bloc pour commencer.
              </p>
            </div>
          )}

          {blocks.map((b, posIdx) => {
            const locked = lockedIds.has(b.id);
            if (locked) {
              return (
                <LockedBlockSummary
                  key={b.id}
                  block={b}
                  index={posIdx}
                  categoryId={categoryId}
                  playerId={playerIdForEditors}
                  onEdit={() => unlockBlock(b.id)}
                  onRemove={() => removeBlock(b.id)}
                />
              );
            }

            const editor =
              b.type === "tactical" ? (
                <SimplifiedTacticalBlockEditor
                  value={b}
                  index={tacticalIndexById.get(b.id) ?? 0}
                  categoryId={categoryId}
                  playerId={playerIdForEditors}
                  onChange={(next) => updateBlock(b.id, next)}
                  onRemove={() => removeBlock(b.id)}
                />
              ) : b.type === "technical" ? (
                <SimplifiedTechnicalBlockEditor
                  value={b}
                  index={technicalIndexById.get(b.id) ?? 0}
                  categoryId={categoryId}
                  playerId={playerIdForEditors}
                  onChange={(next) => updateBlock(b.id, next)}
                  onRemove={() => removeBlock(b.id)}
                />
              ) : (
                <SimplifiedGamesBlockEditor
                  value={b}
                  index={gamesIndexById.get(b.id) ?? 0}
                  categoryId={categoryId}
                  playerId={playerIdForEditors}
                  onChange={(next) => updateBlock(b.id, next)}
                  onRemove={() => removeBlock(b.id)}
                />
              );

            return (
              <div key={b.id} className="space-y-2">
                {editor}
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => lockBlock(b.id)}
                    className="gap-2"
                  >
                    <Save className="h-3.5 w-3.5" />
                    Enregistrer le bloc
                  </Button>
                </div>
              </div>
            );
          })}

          {/* Add block buttons */}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addTactical}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              <Target className="h-3.5 w-3.5 text-blue-500" />
              Ajouter un bloc Tactique
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addTechnical}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              <Wrench className="h-3.5 w-3.5 text-emerald-600" />
              Ajouter un bloc Technique
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addGames}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              <Circle className="h-3.5 w-3.5 text-amber-600" />
              Ajouter un bloc Parties
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enregistrement...</>
            ) : isAthleteMode ? (
              "Enregistrer la séance"
            ) : (
              `Attribuer (${selectedPlayers.length})`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
