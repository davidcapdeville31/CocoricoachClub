import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Settings2,
  Plus,
  Target,
  Wrench,
  Save,
  Circle,
  Flame,
  Users,
  Loader2,
  Droplet,
  Trash2,
  Pencil,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OFFICIAL_OIL_PATTERNS, getOilCategory } from "@/lib/constants/bowlingOilPatterns";
import { SimplifiedGamesBlockEditor } from "./simplified/SimplifiedGamesBlockEditor";
import {
  newGamesBlock,
  aggregateGamesStats,
  type SimplifiedGamesBlock,
} from "./simplified/types";
import {
  BowlingTechnicalBuilder,
  BowlingTacticalBuilder,
  BowlingWarmupBuilder,
} from "./blocks/builders";
import { BowlingBlockPreview, buildAutoTitle } from "./blocks/BowlingBlockPreview";
import {
  EMPTY_BLOCK,
  type BowlingBlockDraft,
  type BowlingBlockType,
} from "./blocks/types";
import { BowlingBlockRunner } from "./athlete/BowlingBlockRunner";
import { ListChecks } from "lucide-react";

interface AdvancedBlockDraft {
  kind: "draft";
  id: string;
  draft: BowlingBlockDraft;
}
interface AdvancedBlockGames {
  kind: "games";
  id: string;
  block: SimplifiedGamesBlock;
}
type AdvancedBlock = AdvancedBlockDraft | AdvancedBlockGames;

const newDraft = (type: Exclude<BowlingBlockType, "games">): AdvancedBlockDraft => {
  const id = crypto.randomUUID();
  return {
    kind: "draft",
    id,
    draft: { ...EMPTY_BLOCK, block_type: type },
  };
};

const newGames = (): AdvancedBlockGames => {
  const b = newGamesBlock();
  return { kind: "games", id: b.id, block: b };
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  categoryId: string;
  athletePlayerId?: string;
  existingSessionId?: string;
}

/**
 * Mode AVANCÉ de création de séance bowling.
 * Même coque visuelle que `BowlingSimplifiedDialog` :
 * sélecteur d'athlètes, huilage de séance, blocs Tactique/Technique/Parties/Échauffement.
 * Seuls les éditeurs internes (tactique/technique/échauffement) sont enrichis :
 * paramètres techniques multi-sélection, zones + lancers/zone, objectifs détaillés, etc.
 */
export function BowlingAdvancedDialog({
  open,
  onOpenChange,
  date,
  categoryId,
  athletePlayerId,
  existingSessionId,
}: Props) {
  const isAthleteMode = !!athletePlayerId;
  const isEditMode = !!existingSessionId;
  const qc = useQueryClient();

  const [blocks, setBlocks] = useState<AdvancedBlock[]>([]);
  const [lockedIds, setLockedIds] = useState<Set<string>>(new Set());
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [runnerBlockId, setRunnerBlockId] = useState<string | null>(null);
  const [oilPatternName, setOilPatternName] = useState<string>("none");

  // Effectif
  const { data: players = [] } = useQuery({
    queryKey: ["bowling_advanced_players", categoryId],
    enabled: open && !isAthleteMode && !isEditMode,
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

  // Pré-chargement édition
  const { data: existingBlocks } = useQuery({
    queryKey: ["bowling_advanced_existing_blocks", existingSessionId, athletePlayerId],
    enabled: open && !!existingSessionId && !!athletePlayerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bowling_training_blocks")
        .select("id, config, order_index, block_type")
        .eq("session_id", existingSessionId!)
        .eq("athlete_id", athletePlayerId!)
        .order("order_index");
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (!open || !isEditMode || !existingBlocks) return;
    const restored: AdvancedBlock[] = existingBlocks
      .map((row: any) => {
        const cfg = row.config as any;
        if (cfg?.__bowling_block__) {
          const draft = cfg.__bowling_block__ as BowlingBlockDraft;
          return { kind: "draft", id: row.id, draft } as AdvancedBlockDraft;
        }
        if (cfg?.type === "games") {
          return { kind: "games", id: row.id, block: cfg as SimplifiedGamesBlock } as AdvancedBlockGames;
        }
        return null;
      })
      .filter(Boolean) as AdvancedBlock[];
    setBlocks(restored);
    setLockedIds(new Set(restored.map((b) => b.id)));
  }, [open, isEditMode, existingBlocks]);

  // Huilage existant (match d'entraînement de la date)
  const { data: existingOilPatternName } = useQuery({
    queryKey: ["bowling_advanced_existing_oil", categoryId, format(date, "yyyy-MM-dd")],
    enabled: open,
    queryFn: async () => {
      const sessionDate = format(date, "yyyy-MM-dd");
      const { data: match } = await supabase
        .from("matches")
        .select("id")
        .eq("category_id", categoryId)
        .eq("event_type", "training")
        .eq("match_date", sessionDate)
        .limit(1)
        .maybeSingle();
      if (!match?.id) return null;
      const { data: pat } = await supabase
        .from("bowling_oil_patterns")
        .select("name")
        .eq("match_id", match.id)
        .limit(1)
        .maybeSingle();
      return pat?.name || null;
    },
  });

  useEffect(() => {
    if (existingOilPatternName) setOilPatternName(existingOilPatternName);
  }, [existingOilPatternName]);

  const allSelected = players.length > 0 && selectedPlayers.length === players.length;
  const toggleAll = (checked: boolean | "indeterminate") =>
    setSelectedPlayers(checked === true ? players.map((p) => p.id) : []);
  const togglePlayer = (id: string) =>
    setSelectedPlayers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const addBlock = (b: AdvancedBlock) => setBlocks((prev) => [...prev, b]);
  const updateDraft = (id: string, next: BowlingBlockDraft) =>
    setBlocks((prev) =>
      prev.map((b) => (b.id === id && b.kind === "draft" ? { ...b, draft: next } : b)),
    );
  const updateGames = (id: string, next: SimplifiedGamesBlock) =>
    setBlocks((prev) =>
      prev.map((b) => (b.id === id && b.kind === "games" ? { ...b, block: next } : b)),
    );

  const removeBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    setLockedIds((prev) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
  };

  const validateBlock = (b: AdvancedBlock): string | null => {
    if (b.kind === "draft") {
      if (b.draft.duration_min <= 0) return "La durée doit être supérieure à 0";
      return null;
    }
    const saved = b.block.parties.filter((p) => p.stats !== null).length;
    if (saved === 0)
      return "Enregistrez au moins une partie avant de verrouiller le bloc";
    return null;
  };

  const lockBlock = (id: string) => {
    const b = blocks.find((x) => x.id === id);
    if (!b) return;
    const err = validateBlock(b);
    if (err) return toast.error(err);
    setLockedIds((prev) => new Set(prev).add(id));
    toast.success("Bloc enregistré");
  };

  const unlockBlock = (id: string) =>
    setLockedIds((prev) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });

  // ---------- Persistance ----------
  const blockTitle = (b: AdvancedBlock): string =>
    b.kind === "draft"
      ? b.draft.title.trim() || buildAutoTitle(b.draft)
      : b.block.title?.trim() || "Bloc parties";

  const blockDuration = (b: AdvancedBlock): number | null => {
    if (b.kind === "draft") return b.draft.duration_min || null;
    const saved = b.block.parties.filter((p) => p.stats !== null).length;
    return saved > 0 ? saved * 10 : null;
  };

  const buildConfig = (b: AdvancedBlock): Record<string, unknown> => {
    if (b.kind === "draft") {
      return {
        __bowling_block__: { ...b.draft, title: blockTitle(b) },
      };
    }
    return { ...b.block, _aggregate: aggregateGamesStats(b.block) };
  };

  const persistGamesAndOil = async (playerId: string, sessionDate: string, sessionId: string) => {
    const { data: existingMatch } = await supabase
      .from("matches")
      .select("id")
      .eq("category_id", categoryId)
      .eq("event_type", "training")
      .eq("match_date", sessionDate)
      .limit(1)
      .maybeSingle();

    let matchId: string | null = existingMatch?.id ?? null;

    if (matchId) {
      const { data: oldRounds } = await supabase
        .from("competition_rounds")
        .select("id")
        .eq("match_id", matchId)
        .eq("player_id", playerId);
      const oldIds = (oldRounds || []).map((r: any) => r.id);
      if (oldIds.length) {
        await supabase.from("competition_round_stats").delete().in("round_id", oldIds);
        await supabase.from("competition_rounds").delete().in("id", oldIds);
      }
    }

    const gamesEntries = blocks
      .filter((b): b is AdvancedBlockGames => b.kind === "games")
      .flatMap((b) =>
        b.block.parties
          .filter((p) => p.stats !== null)
          .map((p) => ({ entry: p, block: b.block })),
      );

    const hasOil = !!oilPatternName && oilPatternName !== "none";
    if (gamesEntries.length === 0 && !hasOil) return;

    if (!matchId) {
      const { data: newMatch, error } = await supabase
        .from("matches")
        .insert({
          category_id: categoryId,
          opponent: `Entraînement ${sessionDate}`,
          match_date: sessionDate,
          event_type: "training",
          is_home: true,
        })
        .select("id")
        .single();
      if (error) throw error;
      matchId = newMatch.id;
    }

    if (matchId && hasOil) {
      const preset = OFFICIAL_OIL_PATTERNS.find((p) => p.name === oilPatternName);
      const { data: existingPat } = await supabase
        .from("bowling_oil_patterns")
        .select("id")
        .eq("match_id", matchId)
        .eq("name", oilPatternName)
        .limit(1)
        .maybeSingle();
      const payload: any = {
        category_id: categoryId,
        match_id: matchId,
        name: oilPatternName,
        length_feet: preset?.length_feet ?? null,
        buff_distance_feet: preset?.buff_distance_feet ?? null,
        width_boards: preset?.width_boards ?? null,
        total_volume_ml: preset?.total_volume_ml ?? null,
        oil_ratio: preset?.oil_ratio ?? null,
        profile_type: preset?.profile_type ?? null,
        forward_oil: preset?.forward_oil ?? null,
        reverse_oil: preset?.reverse_oil ?? null,
        outside_friction: preset?.outside_friction ?? null,
      };
      if (existingPat?.id) {
        await supabase.from("bowling_oil_patterns").update(payload).eq("id", existingPat.id);
      } else {
        await supabase.from("bowling_oil_patterns").insert(payload);
      }
    }

    const { count } = await supabase
      .from("competition_rounds")
      .select("id", { count: "exact", head: true })
      .eq("match_id", matchId!)
      .eq("player_id", playerId);
    let nextRound = (count || 0) + 1;

    for (const { entry, block } of gamesEntries) {
      const s = entry.stats!;
      const ballData = entry.ball_id ? { simpleBallId: entry.ball_id } : null;
      const { data: round, error: rErr } = await supabase
        .from("competition_rounds")
        .insert({
          match_id: matchId!,
          player_id: playerId,
          round_number: nextRound++,
          result: String(s.totalScore ?? 0),
          notes: ballData ? JSON.stringify(ballData) : null,
        })
        .select("id")
        .single();
      if (rErr) {
        console.warn("[BowlingAdvanced] round insert:", rErr.message);
        continue;
      }
      const statData = {
        frames: entry.frames,
        totalScore: s.totalScore,
        strikes: s.strikes,
        spares: s.spares,
        splitCount: s.splitCount,
        splitConverted: s.splitConverted,
        singlePinCount: s.singlePinCount,
        singlePinConverted: s.singlePinConverted,
        pocketCount: s.pocketCount,
        openFrames: s.openFrames,
        strikePercentage: s.strikePercentage,
        sparePercentage: s.sparePercentage,
        splitPercentage: s.splitPercentage,
        singlePinConversionRate: s.singlePinConversionRate,
        pocketPercentage: s.pocketPercentage,
        totalThrows: s.totalThrows,
        totalFrames: s.totalFrames,
        trackPockets: block.track_pockets,
        ballData,
      };
      await supabase
        .from("competition_round_stats")
        .insert([{ round_id: round.id, stat_data: statData as any }]);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const targets = isAthleteMode ? [athletePlayerId!] : selectedPlayers;
      if (targets.length === 0) throw new Error("Sélectionnez au moins un athlète");
      if (blocks.length === 0)
        throw new Error("Ajoutez au moins un bloc avant d'enregistrer");
      const unlocked = blocks.filter((b) => !lockedIds.has(b.id));
      if (unlocked.length > 0)
        throw new Error("Enregistrez d'abord chaque bloc avant de valider la séance");

      const sessionDate = format(date, "yyyy-MM-dd");
      const totalDuration = blocks.reduce((s, b) => s + (blockDuration(b) || 0), 0);

      const buildRow = (b: AdvancedBlock, idx: number, sessionId: string, playerId: string) => {
        const draftSrc = b.kind === "draft" ? b.draft : null;
        return {
          session_id: sessionId,
          category_id: categoryId,
          athlete_id: playerId,
          source: (isAthleteMode ? "athlete" : "coach") as "athlete" | "coach",
          block_type: b.kind === "draft" ? b.draft.block_type : ("games" as const),
          title: blockTitle(b),
          duration_min: blockDuration(b),
          planned_throws: draftSrc?.planned_throws ?? null,
          priority: draftSrc?.priority ?? null,
          coach_instruction: draftSrc?.coach_instruction ?? null,
          internal_note: draftSrc?.internal_note ?? null,
          objectives: draftSrc?.objectives ?? [],
          success_criteria: draftSrc?.success_criteria ?? {},
          pattern_id: draftSrc?.pattern_id ?? null,
          config: buildConfig(b),
          status: isAthleteMode ? "completed" : "planned",
          order_index: idx,
        };
      };

      if (isEditMode && existingSessionId) {
        await supabase
          .from("bowling_training_blocks")
          .delete()
          .eq("session_id", existingSessionId)
          .eq("athlete_id", athletePlayerId!);
        const rows = blocks.map((b, idx) => buildRow(b, idx, existingSessionId, athletePlayerId!));
        const { error } = await supabase
          .from("bowling_training_blocks")
          .insert(rows as any);
        if (error) throw error;
        await persistGamesAndOil(athletePlayerId!, sessionDate, existingSessionId);
        try {
          await supabase
            .from("training_attendance")
            .upsert(
              [
                {
                  player_id: athletePlayerId!,
                  category_id: categoryId,
                  attendance_date: sessionDate,
                  training_session_id: existingSessionId,
                  status: "present" as const,
                },
              ],
              { onConflict: "player_id,training_session_id" },
            );
        } catch {}
        return;
      }

      // Création : une seule session partagée pour tous les athlètes ciblés
      const { data: session, error: sessErr } = await supabase
        .from("training_sessions")
        .insert({
          category_id: categoryId,
          session_date: sessionDate,
          training_type: "bowling_advanced",
          notes: "Séance bowling — Mode avancé",
          intensity: null,
          planned_intensity: null,
        })
        .select("id")
        .single();
      if (sessErr) throw sessErr;
      const sessionId = session.id;

      try {
        await supabase.from("event_participants").insert(
          targets.map((pid) => ({
            training_session_id: sessionId,
            player_id: pid,
          })),
        );
      } catch (e) {
        console.warn("[BowlingAdvanced] event_participants:", e);
      }

      const rows = targets.flatMap((pid) =>
        blocks.map((b, idx) => buildRow(b, idx, sessionId, pid)),
      );
      const { error: blocksErr } = await supabase
        .from("bowling_training_blocks")
        .insert(rows as any);
      if (blocksErr) throw blocksErr;

      if (isAthleteMode) {
        for (const pid of targets) {
          await persistGamesAndOil(pid, sessionDate, sessionId);
        }
        try {
          await supabase.from("training_attendance").insert(
            targets.map((pid) => ({
              player_id: pid,
              category_id: categoryId,
              attendance_date: sessionDate,
              training_session_id: sessionId,
              status: "present" as const,
            })),
          );
        } catch {}
      }
    },
    onSuccess: () => {
      toast.success(
        isEditMode ? "Séance enregistrée" : "Séance(s) avancée(s) créée(s)",
      );
      qc.invalidateQueries({ queryKey: ["bowling_training_blocks"] });
      qc.invalidateQueries({ queryKey: ["training_sessions"] });
      qc.invalidateQueries({ queryKey: ["bowling_advanced_existing_blocks"] });
      qc.invalidateQueries({ queryKey: ["bowling_advanced_existing_oil"] });
      qc.invalidateQueries({ queryKey: ["bowling_training_oil_patterns"] });
      handleOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message || "Erreur lors de l'enregistrement"),
  });

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setBlocks([]);
      setLockedIds(new Set());
      setSelectedPlayers([]);
      setOilPatternName("none");
    }
    onOpenChange(next);
  };

  useEffect(() => {
    if (open && !isEditMode) {
      setBlocks([]);
      setLockedIds(new Set());
      setSelectedPlayers([]);
      setOilPatternName("none");
    }
  }, [open, isEditMode]);

  // Index Games pour réutiliser l'éditeur simplifié
  let gamesIdx = 0;
  const gamesIndexById = new Map<string, number>();
  blocks.forEach((b) => {
    if (b.kind === "games") gamesIndexById.set(b.id, gamesIdx++);
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
            <Settings2 className="h-5 w-5 text-primary" />
            {isEditMode ? "Remplir la séance bowling" : "Nouvelle séance bowling — Mode avancé"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {format(date, "EEEE d MMMM yyyy", { locale: fr })}
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!isAthleteMode && (
            <div className="rounded-2xl border border-border/60 bg-surface-sunken/40 p-3">
              <div className="flex items-center justify-between mb-2">
                <Label className="flex items-center gap-2 text-sm font-semibold">
                  <Users className="h-4 w-4 text-primary" />
                  Athlètes ({selectedPlayers.length}/{players.length})
                </Label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
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

          {/* Huilage de séance */}
          <div className="rounded-2xl border border-border/60 bg-surface-sunken/40 p-3 space-y-2">
            <Label className="flex items-center gap-2 text-sm font-semibold">
              <Droplet className="h-4 w-4 text-primary" />
              Huilage de la séance (optionnel)
            </Label>
            <Select value={oilPatternName} onValueChange={setOilPatternName}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Aucun huilage" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="none">Aucun huilage</SelectItem>
                {OFFICIAL_OIL_PATTERNS.map((p) => {
                  const cat = getOilCategory(p.oil_ratio);
                  return (
                    <SelectItem key={p.name} value={p.name}>
                      {p.name}
                      {p.oil_ratio ? ` · ${p.oil_ratio}` : ""}
                      {cat ? ` · ${cat.label}` : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Le huilage choisi s'applique à toute la séance et permet de filtrer les Stats Parties.
            </p>
          </div>

          {blocks.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/60 bg-muted/20 py-10 text-center">
              <div className="rounded-full bg-muted p-4">
                <Settings2 className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold text-foreground">
                Construisez votre séance avancée
              </h3>
              <p className="max-w-sm text-sm text-muted-foreground">
                Ajoutez un bloc pour commencer.
              </p>
            </div>
          )}

          {blocks.map((b) => {
            const locked = lockedIds.has(b.id);

            if (locked) {
              const title =
                b.kind === "draft" ? buildAutoTitle(b.draft) : b.block.title || "Bloc parties";
              const subtitle =
                b.kind === "draft"
                  ? `${b.draft.duration_min} min · ${b.draft.planned_throws} lancers`
                  : `${b.block.parties.filter((p) => p.stats !== null).length} partie(s) enregistrée(s)`;
              return (
                <Card
                  key={b.id}
                  className="rounded-2xl border-border/60 bg-surface p-3 flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{title}</p>
                    <p className="text-xs text-muted-foreground">{subtitle}</p>
                  </div>
                  {isEditMode &&
                    isAthleteMode &&
                    b.kind === "draft" &&
                    (b.draft.block_type === "technical" || b.draft.block_type === "tactical") && (
                      <Button
                        size="sm"
                        onClick={() => setRunnerBlockId(b.id)}
                        className="gap-1"
                      >
                        <ListChecks className="h-3.5 w-3.5" /> Saisir les lancers
                      </Button>
                    )}
                  <Button size="sm" variant="outline" onClick={() => unlockBlock(b.id)} className="gap-1">
                    <Pencil className="h-3.5 w-3.5" /> Modifier
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeBlock(b.id)}
                    aria-label="Supprimer"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </Card>
              );
            }


            const editor =
              b.kind === "draft" ? (
                b.draft.block_type === "technical" ? (
                  <BowlingTechnicalBuilder
                    value={b.draft}
                    onChange={(d) => updateDraft(b.id, d)}
                    categoryId={categoryId}
                  />
                ) : b.draft.block_type === "tactical" ? (
                  <BowlingTacticalBuilder
                    value={b.draft}
                    onChange={(d) => updateDraft(b.id, d)}
                    categoryId={categoryId}
                  />
                ) : (
                  <BowlingWarmupBuilder
                    value={b.draft}
                    onChange={(d) => updateDraft(b.id, d)}
                    categoryId={categoryId}
                  />
                )
              ) : (
                <SimplifiedGamesBlockEditor
                  value={b.block}
                  index={gamesIndexById.get(b.id) ?? 0}
                  categoryId={categoryId}
                  playerId={playerIdForEditors}
                  onChange={(next) => updateGames(b.id, next)}
                  onRemove={() => removeBlock(b.id)}
                />
              );

            return (
              <div key={b.id} className="space-y-2">
                {editor}
                {b.kind === "draft" && <BowlingBlockPreview block={b.draft} />}
                <div className="flex justify-between">
                  {b.kind === "draft" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => removeBlock(b.id)}
                      className="gap-1 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Supprimer
                    </Button>
                  ) : (
                    <span />
                  )}
                  <Button type="button" size="sm" onClick={() => lockBlock(b.id)} className="gap-2">
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
              onClick={() => addBlock(newDraft("tactical"))}
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
              onClick={() => addBlock(newDraft("technical"))}
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
              onClick={() => addBlock(newGames())}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              <Circle className="h-3.5 w-3.5 text-amber-600" />
              Ajouter un bloc Parties
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addBlock(newDraft("warmup"))}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              <Flame className="h-3.5 w-3.5 text-violet-500" />
              Ajouter un bloc Échauffement
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enregistrement...
              </>
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
