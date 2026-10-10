import { getDateLocale } from "@/lib/i18n/dateLocale";
import { useEffect, useMemo, useState } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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
import { Sparkles, Plus, Target, Wrench, Save, Circle, Users, Loader2, Droplet, ArrowUp, ArrowDown, Copy, ArrowLeft, ArrowRight, CheckCircle2, CalendarDays, X, ChevronDown, ChevronUp, Flag, Repeat, Zap, Eye, Brain } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { BowlingStepper, BowlingSessionRecap } from "./simplified/WizardParts";
import { format } from "date-fns";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { SimplifiedTacticalBlockEditor } from "./simplified/SimplifiedTacticalBlockEditor";
import { SimplifiedTechnicalBlockEditor } from "./simplified/SimplifiedTechnicalBlockEditor";
import { SimplifiedGamesBlockEditor } from "./simplified/SimplifiedGamesBlockEditor";
import { LockedBlockSummary } from "./simplified/LockedBlockSummary";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OFFICIAL_OIL_PATTERNS, getOilCategory } from "@/lib/constants/bowlingOilPatterns";
import {
  newTacticalBlock,
  newTechnicalBlock,
  newGamesBlock,
  technicalThemeLabel,
  aggregateGamesStats,
  type SimplifiedBlock,
  type SimplifiedOilPattern,
} from "./simplified/types";
import { SimplifiedOilPatternPicker } from "./simplified/SimplifiedOilPatternPicker";
import { Input } from "@/components/ui/input";

const EMPTY_OIL: SimplifiedOilPattern = {
  preset_name: null,
  image_url: null,
  length_feet: null,
  buff_distance_feet: null,
  width_boards: null,
  total_volume_ml: null,
  oil_ratio: null,
  profile_type: null,
  forward_oil: true,
  reverse_oil: true,
  outside_friction: null,
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

function createTokenBoundClient(accessToken: string): SupabaseClient<Database> {
  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

async function getAthleteAuthContext() {
  const { data: sessionData } = await supabase.auth.getSession();
  let session = sessionData.session;

  if (!session) {
    const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      throw new Error("Session expirée. Reconnectez-vous puis réessayez.");
    }
    session = refreshedData.session;
  }

  const accessToken = session?.access_token;
  if (!accessToken) {
    throw new Error("Session expirée. Reconnectez-vous puis réessayez.");
  }

  return {
    accessToken,
    client: createTokenBoundClient(accessToken),
  };
}

function buildOilFromPresetName(name: string | null): SimplifiedOilPattern {
  if (!name || name === "none") return { ...EMPTY_OIL };
  const p = OFFICIAL_OIL_PATTERNS.find((x) => x.name === name);
  return {
    preset_name: name,
    image_url: null,
    length_feet: p?.length_feet ?? null,
    buff_distance_feet: p?.buff_distance_feet ?? null,
    width_boards: p?.width_boards ?? null,
    total_volume_ml: p?.total_volume_ml ?? null,
    oil_ratio: p?.oil_ratio ?? null,
    profile_type: p?.profile_type ?? null,
    forward_oil: p?.forward_oil ?? true,
    reverse_oil: p?.reverse_oil ?? true,
    outside_friction: p?.outside_friction ?? null,
  };
}


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
  const [oilPatternName, setOilPatternName] = useState<string>("none");
  /** Huilage personnalisé (champs libres) — utilisé si oilPatternName === "__custom__" */
  const [customOilPattern, setCustomOilPattern] = useState<SimplifiedOilPattern>({ ...EMPTY_OIL });
  const [customOilName, setCustomOilName] = useState<string>("");
  /** "session" : un seul huilage pour toute la séance, appliqué à chaque bloc.
   *  "per_block" : l'utilisateur choisit un huilage différent à l'intérieur de chaque bloc. */
  const [oilScope, setOilScope] = useState<"session" | "per_block">("session");
  /** RPE ressenti de la séance (athlète) — alimente le workload */
  const [athleteRpe, setAthleteRpe] = useState<number>(6);


  // Fetch effectif (coach mode only, et pas en édition)
  const { data: players = [] } = useQuery({
    queryKey: ["bowling_simplified_players", categoryId],
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

  // Fetch des blocs existants si on édite une séance attribuée par le coach
  const { data: existingBlocks } = useQuery({
    queryKey: ["bowling_simplified_existing_blocks", existingSessionId, athletePlayerId],
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

  // Hydrate les blocs depuis la session existante
  useEffect(() => {
    if (!open || !isEditMode || !existingBlocks) return;
    const restored: SimplifiedBlock[] = existingBlocks
      .map((row: any) => row.config as SimplifiedBlock | null)
      .filter((b): b is SimplifiedBlock => !!b && !!b.type && !!b.id);
    setBlocks(restored);
    // Les blocs déjà remplis sont verrouillés par défaut : l'athlète clique
    // "Modifier" sur un bloc précis pour le déverrouiller.
    setLockedIds(new Set(restored.map((b) => b.id)));
  }, [open, isEditMode, existingBlocks]);

  // Préchargement du huilage existant pour le match d'entraînement de la journée
  const { data: existingOilPatternName } = useQuery({
    queryKey: ["bowling_simplified_existing_oil", categoryId, format(date, "yyyy-MM-dd")],
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

  const toggleAll = (checked: boolean | "indeterminate") => {
    setSelectedPlayers(checked === true ? players.map((p) => p.id) : []);
  };

  const togglePlayer = (id: string) => {
    setSelectedPlayers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const sessionOilPreset = useMemo(
    () =>
      oilPatternName === "__custom__"
        ? { ...customOilPattern, preset_name: customOilName || "Personnalisé" }
        : buildOilFromPresetName(oilPatternName),
    [oilPatternName, customOilPattern, customOilName],
  );

  const withSessionOil = <T extends SimplifiedBlock>(b: T): T =>
    oilScope === "session" ? ({ ...b, oil_pattern: sessionOilPreset } as T) : b;

  /** Ajoute un bloc ouvert et replie les autres (les données restent dans le brouillon). */
  const pushBlock = (b: SimplifiedBlock) => {
    setLockedIds(new Set(blocks.map((x) => x.id)));
    setBlocks((prev) => [...prev, withSessionOil(b)]);
  };
  const addTactical = () => pushBlock(newTacticalBlock());
  const addTechnical = () => pushBlock(newTechnicalBlock());
  const addGames = () => pushBlock(newGamesBlock());
  const collapseBlock = (id: string) => setLockedIds((prev) => new Set(prev).add(id));
  const openBlock = (id: string) => setLockedIds(new Set(blocks.filter((x) => x.id !== id).map((x) => x.id)));
  const [athletesOpen, setAthletesOpen] = useState(false);
  const [oilOpen, setOilOpen] = useState(false);
  const [objective, setObjective] = useState<string | null>(null);

  // En mode "session", propage le huilage de séance à tous les blocs existants
  // dès que l'utilisateur change le pattern ou bascule en mode session.
  useEffect(() => {
    if (oilScope !== "session") return;
    setBlocks((prev) =>
      prev.map((b) => ({ ...b, oil_pattern: sessionOilPreset })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oilScope, sessionOilPreset]);


  const updateBlock = (id: string, next: SimplifiedBlock) =>
    setBlocks((prev) => prev.map((b) => (b.id === id ? next : b)));

  const removeBlock = (id: string) => {
    if (!window.confirm("Supprimer ce bloc ? Les données saisies dans ce bloc seront perdues.")) return;
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    setLockedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const moveBlock = (idx: number, dir: -1 | 1) =>
    setBlocks((prev) => {
      const j = idx + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });

  const duplicateBlock = (id: string) =>
    setBlocks((prev) => {
      const i = prev.findIndex((b) => b.id === id);
      if (i < 0) return prev;
      const copy = JSON.parse(JSON.stringify(prev[i])) as SimplifiedBlock;
      copy.id = crypto.randomUUID();
      if (copy.type === "games") copy.parties = copy.parties.map((p) => ({ ...p, id: crypto.randomUUID() }));
      if (copy.type === "tactical") copy.items = copy.items.map((it: any) => ({ ...it, id: crypto.randomUUID() }));
      const next = [...prev];
      next.splice(i + 1, 0, copy);
      return next;
    });

  const [step, setStep] = useState(0);
  const goToStep = (s: number) => {
    if (s > 0 && step === 0 && !isAthleteMode && !isEditMode && selectedPlayers.length === 0) {
      toast.error("Sélectionnez au moins un athlète");
      return;
    }
    if (s === 2) {
      if (blocks.length === 0) {
        toast.error("Ajoutez au moins un bloc à la séance");
        return;
      }
      for (const b of blocks) {
        const err = validateBlock(b);
        if (err) {
          openBlock(b.id);
          setStep(1);
          toast.error(err);
          return;
        }
      }
    }
    setStep(Math.max(0, Math.min(2, s)));
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
        return "Saisissez au moins un score dans le bloc Parties";
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

  // Mappe un item tactique simplifié vers un exercise_type stats spécifiques.
  const mapTacticalExerciseType = (item: any): string => {
    if (item.target_type === "pocket") return "spare_poche";
    if (item.target_type === "single_pin") {
      if (item.single_pin === "7") return "spare_pin_7";
      if (item.single_pin === "10") return "spare_pin_10";
      return "spare_general";
    }
    // strike + composed_spare → catégorie spares générale (visualisée dans Stats Spécifiques)
    return "spare_general";
  };

  /**
   * Pousse les statistiques détaillées (parties + tactique) dans leurs tables
   * dédiées pour qu'elles apparaissent dans :
   * - Stats Globales (volumes via blocs)
   * - Stats Parties (competition_rounds / training match)
   * - Stats Spécifiques (bowling_spare_training)
   */
  const persistDetailedStats = async (
    playerId: string,
    sessionDate: string,
    sessionId: string,
    db: SupabaseClient<Database> = supabase,
  ) => {
    // 1) Nettoie les stats précédentes liées à cette séance pour ce joueur
    await db
      .from("bowling_spare_training")
      .delete()
      .eq("player_id", playerId)
      .eq("training_session_id", sessionId);

    // Match d'entraînement de la journée (catégorie + date)
    const { data: existingMatch } = await db
      .from("matches")
      .select("id")
      .eq("category_id", categoryId)
      .eq("event_type", "training")
      .eq("match_date", sessionDate)
      .limit(1)
      .maybeSingle();

    let matchId: string | null = existingMatch?.id ?? null;

    if (matchId) {
      // Récupère les rounds existants de ce joueur pour les supprimer (stats cascade)
      const { data: oldRounds } = await db
        .from("competition_rounds")
        .select("id")
        .eq("match_id", matchId)
        .eq("player_id", playerId);
      const oldIds = (oldRounds || []).map((r: any) => r.id);
      if (oldIds.length) {
        await db.from("competition_round_stats").delete().in("round_id", oldIds);
        await db.from("competition_rounds").delete().in("id", oldIds);
      }
    }

    // 2) Tactique → bowling_spare_training
    const spareRows: any[] = [];
    for (const b of blocks) {
      if (b.type !== "tactical") continue;
      for (const item of b.items) {
        if (!item.attempts || item.attempts <= 0) continue;
        spareRows.push({
          player_id: playerId,
          category_id: categoryId,
          exercise_type: mapTacticalExerciseType(item),
          attempts: item.attempts,
          successes: Math.min(item.success || 0, item.attempts),
          session_date: sessionDate,
          training_session_id: sessionId,
          ball_arsenal_id: b.ball_id || null,
          notes: b.notes?.trim() ? b.notes.trim() : null,
        });
      }
    }
    if (spareRows.length) {
      const { error } = await db.from("bowling_spare_training").insert(spareRows);
      if (error) console.warn("[BowlingSimplified] spare insert:", error.message);
    }

    // 3) Parties → matches(training) + competition_rounds + competition_round_stats
    const gamesEntries = blocks
      .filter((b): b is Extract<SimplifiedBlock, { type: "games" }> => b.type === "games")
      .flatMap((b) =>
        b.parties
          .filter((p) => p.stats !== null)
          .map((p) => ({ entry: p, block: b })),
      );

    const hasOilToPersist = !!oilPatternName && oilPatternName !== "none";
    if (gamesEntries.length === 0 && !hasOilToPersist) return;

    if (!matchId) {
      const { data: newMatch, error } = await db
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

    // Huilage (pattern) : upsert pour le match d'entraînement
    if (matchId && oilPatternName && oilPatternName !== "none") {
      const isCustom = oilPatternName === "__custom__";
      const preset = isCustom ? null : OFFICIAL_OIL_PATTERNS.find((p) => p.name === oilPatternName);
      const patternName = isCustom ? (customOilName.trim() || "Personnalisé") : oilPatternName;
      const { data: existingPat } = await db
        .from("bowling_oil_patterns")
        .select("id")
        .eq("match_id", matchId)
        .eq("name", patternName)
        .limit(1)
        .maybeSingle();
      const payload: any = {
        category_id: categoryId,
        match_id: matchId,
        name: patternName,
        length_feet: isCustom ? customOilPattern.length_feet : (preset?.length_feet ?? null),
        buff_distance_feet: isCustom ? customOilPattern.buff_distance_feet : (preset?.buff_distance_feet ?? null),
        width_boards: isCustom ? customOilPattern.width_boards : (preset?.width_boards ?? null),
        total_volume_ml: isCustom ? customOilPattern.total_volume_ml : (preset?.total_volume_ml ?? null),
        oil_ratio: isCustom ? customOilPattern.oil_ratio : (preset?.oil_ratio ?? null),
        profile_type: isCustom ? customOilPattern.profile_type : (preset?.profile_type ?? null),
        forward_oil: isCustom ? customOilPattern.forward_oil : (preset?.forward_oil ?? null),
        reverse_oil: isCustom ? customOilPattern.reverse_oil : (preset?.reverse_oil ?? null),
        outside_friction: isCustom ? customOilPattern.outside_friction : (preset?.outside_friction ?? null),
      };
      if (existingPat?.id) {
        await db.from("bowling_oil_patterns").update(payload).eq("id", existingPat.id);
      } else {
        await db.from("bowling_oil_patterns").insert(payload);
      }
    }


    // round_number existants pour ce joueur
    const { count } = await db
      .from("competition_rounds")
      .select("id", { count: "exact", head: true })
      .eq("match_id", matchId!)
      .eq("player_id", playerId);
    let nextRound = (count || 0) + 1;

    for (const { entry, block } of gamesEntries) {
      const s = entry.stats!;
      const ballData = entry.ball_id ? { simpleBallId: entry.ball_id } : null;
      const { data: round, error: rErr } = await db
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
        console.warn("[BowlingSimplified] round insert:", rErr.message);
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
      const { error: sErr } = await db
        .from("competition_round_stats")
        .insert([{ round_id: round.id, stat_data: statData as any }]);
      if (sErr) console.warn("[BowlingSimplified] round stats:", sErr.message);
    }
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
      const athleteAuth = isAthleteMode ? await getAthleteAuthContext() : null;
      const athleteDb = athleteAuth?.client ?? supabase;

      // ============ MODE ÉDITION (athlète remplit une séance attribuée) ============
      if (isEditMode && existingSessionId) {
        // Remplace les blocs existants de CET athlète sur cette séance
        const { error: delErr } = await athleteDb
          .from("bowling_training_blocks")
          .delete()
          .eq("session_id", existingSessionId)
          .eq("athlete_id", athletePlayerId!);
        if (delErr) throw delErr;

        const rows = blocks.map((b, idx) => ({
          session_id: existingSessionId,
          category_id: categoryId,
          athlete_id: athletePlayerId!,
          source: "athlete" as const,
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
        }));

        const { error: insErr } = await athleteDb
          .from("bowling_training_blocks")
          .insert(rows as any);
        if (insErr) throw insErr;

        // Persiste les stats détaillées (parties + tactique)
        await persistDetailedStats(athletePlayerId!, sessionDate, existingSessionId, athleteDb);

        // Marque la présence
        const { error: attErr } = await athleteDb
          .from("training_attendance")
          .upsert(
            [{
              player_id: athletePlayerId!,
              category_id: categoryId,
              attendance_date: sessionDate,
              training_session_id: existingSessionId,
              status: "present" as const,
            }],
            { onConflict: "player_id,training_session_id" },
          );
        if (attErr) console.warn("[BowlingSimplified] attendance:", attErr.message);

        return { sessionId: existingSessionId, count: 1, blocks: blocks.length, totalDuration };
      }

      // ============ MODE CRÉATION ============
      let createdSessionId: string;

      if (isAthleteMode) {
        // L'athlète ne peut pas écrire directement dans training_sessions (RLS).
        // On passe par l'Edge Function dédiée qui crée la séance + le participant.
        const accessToken = athleteAuth?.accessToken;

        if (!athletePlayerId) {
          throw new Error("Impossible d'identifier l'athlète pour cette séance");
        }

        if (!accessToken) {
          throw new Error("Session expirée. Reconnectez-vous puis réessayez.");
        }

        const { data: fnData, error: fnErr } = await supabase.functions.invoke(
          "athlete-create-session",
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            body: {
              category_id: categoryId,
              player_id: athletePlayerId,
              session_date: sessionDate,
              training_type: "bowling_simplified",
              session_start_time: "09:00",
              session_end_time: (() => {
                const total = Math.max(1, totalDuration || 0);
                const mins = 9 * 60 + total;
                const h = String(Math.floor(mins / 60) % 24).padStart(2, "0");
                const m = String(mins % 60).padStart(2, "0");
                return `${h}:${m}`;
              })(),
              intensity: athleteRpe,
              notes: `Séance bowling — Mode simplifié\nDurée : ${totalDuration} min · RPE : ${athleteRpe}/10${objective ? `\nObjectif : ${objective}` : ""}`,
            },
          },
        );
        if (fnErr || !(fnData as any)?.success || !(fnData as any)?.session_id) {
          throw new Error(
            (fnData as any)?.error || fnErr?.message || "Erreur création séance athlète",
          );
        }
        createdSessionId = (fnData as any).session_id as string;
      } else {
        const { data: session, error: sessErr } = await supabase
          .from("training_sessions")
          .insert({
            category_id: categoryId,
            session_date: sessionDate,
            training_type: "bowling_simplified",
            notes: `Séance bowling — Mode simplifié${objective ? `\nObjectif : ${objective}` : ""}`,
            intensity: null,
            planned_intensity: null,
          })
          .select("id")
          .single();
        if (sessErr) throw sessErr;
        createdSessionId = session.id;

        const { error: partErr } = await supabase
          .from("event_participants")
          .insert(
            targetPlayers.map((pid) => ({
              training_session_id: createdSessionId,
              player_id: pid,
            })),
          );
        if (partErr) console.error("[BowlingSimplified] event_participants:", partErr);
      }

      const rows = targetPlayers.flatMap((pid) =>
        blocks.map((b, idx) => ({
          session_id: createdSessionId,
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
          status: isAthleteMode ? "completed" : "planned",
          order_index: idx,
        })),
      );

      const { error: blocksErr } = await athleteDb
        .from("bowling_training_blocks")
        .insert(rows as any);
      if (blocksErr) throw blocksErr;

      // Mode athlète : on persiste tout de suite les stats détaillées du joueur.
      // Mode coach : on ne persiste pas (les parties seront jouées par l'athlète).
      if (isAthleteMode) {
        for (const pid of targetPlayers) {
          await persistDetailedStats(pid, sessionDate, createdSessionId, athleteDb);
        }
        const { error: attErr } = await athleteDb
          .from("training_attendance")
          .insert(
            targetPlayers.map((pid) => ({
              player_id: pid,
              category_id: categoryId,
              attendance_date: sessionDate,
              training_session_id: createdSessionId,
              status: "present" as const,
            })),
          );
        if (attErr) console.warn("[BowlingSimplified] attendance:", attErr.message);
      }

      return { sessionId: createdSessionId, count: targetPlayers.length, blocks: blocks.length, totalDuration };
    },
    onSuccess: ({ count, blocks: nb }) => {
      toast.success(
        isEditMode
          ? `Séance remplie (${nb} bloc${nb > 1 ? "s" : ""})`
          : isAthleteMode
            ? `Séance enregistrée (${nb} bloc${nb > 1 ? "s" : ""})`
            : `Séance attribuée à ${count} athlète${count > 1 ? "s" : ""} (${nb} bloc${nb > 1 ? "s" : ""})`,
      );
      qc.invalidateQueries({ queryKey: ["training_sessions", categoryId] });
      qc.invalidateQueries({ queryKey: ["sessions", categoryId] });
      if (isAthleteMode && athletePlayerId) {
        qc.invalidateQueries({ queryKey: ["athlete-calendar-sessions", categoryId, athletePlayerId] });
        qc.invalidateQueries({ queryKey: ["athlete-space-upcoming-sessions", categoryId, athletePlayerId] });
      }
      qc.invalidateQueries({ queryKey: ["bowling_training_blocks"] });
      qc.invalidateQueries({ queryKey: ["bowling_training_blocks_stats", categoryId] });
      qc.invalidateQueries({ queryKey: ["bowling_simplified_existing_blocks", existingSessionId] });
      qc.invalidateQueries({ queryKey: ["bowling_simplified_existing_oil", categoryId] });
      qc.invalidateQueries({ queryKey: ["bowling_training_oil_patterns", categoryId] });
      handleOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message || "Erreur lors de l'enregistrement"),
  });


  const handleSave = () => {
    for (const b of blocks) {
      const err = validateBlock(b);
      if (err) {
        openBlock(b.id);
        setStep(1);
        toast.error(err);
        return;
      }
    }
    saveMutation.mutate();
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setBlocks([]);
      setLockedIds(new Set());
      setSelectedPlayers([]);
      setOilPatternName("none");
      setOilScope("session");
      setStep(0);
      setObjective(null);
      setAthletesOpen(false);
      setOilOpen(false);
    }
    onOpenChange(next);
  };

  // Réinitialise quand on ouvre (sauf en édition : on attend la requête)
  useEffect(() => {
    if (open) setStep(isEditMode ? 1 : 0);
    if (open && !isEditMode) {
      setBlocks([]);
      setLockedIds(new Set());
      setSelectedPlayers([]);
      setOilPatternName("none");
      setOilScope("session");
    }
  }, [open, isEditMode]);

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

  const goalOptions = [
    { key: "Technique", icon: Wrench, cls: "bg-bowling-accent/10 text-bowling-accent" },
    { key: "Régularité", icon: Repeat, cls: "bg-success/10 text-success" },
    { key: "Spare", icon: Target, cls: "bg-warning/10 text-warning" },
    { key: "Strike", icon: Zap, cls: "bg-destructive/10 text-destructive" },
    { key: "Lecture de piste", icon: Eye, cls: "bg-primary/10 text-primary" },
    { key: "Mental", icon: Brain, cls: "bg-muted text-foreground" },
  ];
  const oilLabel = oilPatternName === "none" ? null : oilPatternName === "__custom__" ? (customOilName || "Personnalisé") : oilPatternName;
  const cardCls = "rounded-[20px] bg-card p-5 shadow-[0_2px_12px_-4px_hsl(var(--foreground)/0.08)]";

  const renderEditor = (b: SimplifiedBlock) =>
    b.type === "tactical" ? (
      <SimplifiedTacticalBlockEditor value={b} index={tacticalIndexById.get(b.id) ?? 0} categoryId={categoryId} playerId={playerIdForEditors} hideOilPicker={oilScope === "session"} onChange={(next) => updateBlock(b.id, next)} onRemove={() => removeBlock(b.id)} />
    ) : b.type === "technical" ? (
      <SimplifiedTechnicalBlockEditor value={b} index={technicalIndexById.get(b.id) ?? 0} categoryId={categoryId} playerId={playerIdForEditors} onChange={(next) => updateBlock(b.id, next)} onRemove={() => removeBlock(b.id)} />
    ) : (
      <SimplifiedGamesBlockEditor value={b} index={gamesIndexById.get(b.id) ?? 0} categoryId={categoryId} playerId={playerIdForEditors} hideOilPicker={oilScope === "session"} onChange={(next) => updateBlock(b.id, next)} onRemove={() => removeBlock(b.id)} />
    );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        hideClose
        className="flex flex-col gap-0 overflow-hidden p-0 sm:p-0 bg-bowling-canvas border-0 fixed inset-0 sm:relative sm:inset-auto w-screen h-[100dvh] max-h-[100dvh] max-w-none rounded-none sm:w-[94vw] sm:h-[92vh] sm:max-h-[92vh] sm:max-w-[1000px] sm:rounded-3xl"
      >
        {/* En-tête fixe */}
        <div className="shrink-0 bg-bowling-canvas px-4 pt-4 sm:px-8 sm:pt-6">
          <div className="flex items-start gap-3">
            <button type="button" onClick={() => (step > 0 ? goToStep(step - 1) : handleOpenChange(false))} className="mt-1 shrink-0 rounded-full p-1.5 text-foreground hover:bg-card" aria-label={step > 0 ? "Retour" : "Fermer"}>
              {step > 0 ? <ArrowLeft className="h-5 w-5" /> : <X className="h-5 w-5" />}
            </button>
            <div className="min-w-0 flex-1"><BowlingStepper step={step} onStep={goToStep} /></div>
            <button type="button" onClick={() => handleOpenChange(false)} className="mt-1.5 shrink-0 text-sm text-muted-foreground hover:text-foreground">Annuler</button>
          </div>
          <DialogHeader className="mt-5 text-left">
            <DialogTitle className="text-2xl sm:text-3xl font-bold tracking-tight text-primary">
              {step === 0 ? (isEditMode ? "Remplir la séance bowling" : "Nouvelle séance bowling") : step === 1 ? "Contenu de la séance" : "Récapitulatif"}
            </DialogTitle>
            <p className="text-sm sm:text-base text-muted-foreground">
              {step === 0 ? "En mode simplifié, ajoute rapidement ta séance en quelques étapes." : step === 1 ? "Ajoute rapidement ce que tu as travaillé." : "Vérifie ta séance puis enregistre-la."}
            </p>
          </DialogHeader>
        </div>

        {/* Contenu — défilement unique */}
        <div key={step} className="flex-1 min-h-0 overflow-y-auto px-4 py-5 sm:px-8">
          {step === 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className={`${cardCls} flex items-center gap-4`}>
                <CalendarDays className="h-6 w-6 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Date de la séance</p>
                  <p className="text-base font-semibold capitalize text-foreground">{format(date, "EEEE d MMMM yyyy", { locale: getDateLocale() })}</p>
                </div>
              </div>

              {!isAthleteMode && !isEditMode ? (
                <Collapsible open={athletesOpen} onOpenChange={setAthletesOpen} className={cardCls}>
                  <CollapsibleTrigger className="flex w-full items-center gap-4 text-left">
                    <Users className="h-6 w-6 text-primary" />
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">Athlètes</p>
                      <p className="text-base font-semibold text-foreground">{selectedPlayers.length === 0 ? "Aucun sélectionné" : `${selectedPlayers.length} sélectionné${selectedPlayers.length > 1 ? "s" : ""}`}</p>
                    </div>
                    <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${athletesOpen ? "rotate-180" : ""}`} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-4">
                    <label className="mb-2 flex cursor-pointer items-center gap-2 text-sm font-medium">
                      <Checkbox checked={allSelected} onCheckedChange={toggleAll} /> Tout sélectionner ({players.length})
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {players.map((p) => {
                        const on = selectedPlayers.includes(p.id);
                        return (
                          <button key={p.id} type="button" onClick={() => togglePlayer(p.id)} className={`rounded-full px-3 py-1.5 text-sm transition-colors ${on ? "bg-primary text-primary-foreground" : "bg-bowling-canvas text-foreground hover:bg-muted"}`}>
                            {[p.first_name, p.name].filter(Boolean).join(" ") || "Athlète"}
                          </button>
                        );
                      })}
                      {players.length === 0 && <p className="text-sm text-muted-foreground">Aucun athlète dans cette catégorie</p>}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ) : <div className="hidden md:block" />}

              <div className={`${cardCls} md:col-span-2`}>
                <p className="mb-3 flex items-center gap-3 text-base font-semibold text-primary"><Flag className="h-5 w-5" />Objectif principal <span className="font-normal text-muted-foreground">(facultatif)</span></p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {goalOptions.map((g) => {
                    const on = objective === g.key;
                    return (
                      <button key={g.key} type="button" onClick={() => setObjective(on ? null : g.key)} className={`flex h-12 items-center gap-2 rounded-xl px-3 text-sm font-medium transition-all ${g.cls} ${on ? "ring-2 ring-bowling-accent ring-offset-2 ring-offset-card" : "opacity-90 hover:opacity-100"}`}>
                        <g.icon className="h-4 w-4" />{g.key}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Collapsible open={oilOpen} onOpenChange={setOilOpen} className={`${cardCls} md:col-span-2`}>
                <CollapsibleTrigger className="flex w-full items-center gap-4 text-left">
                  <Droplet className="h-6 w-6 text-primary" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Huilage (facultatif)</p>
                    <p className="text-base font-semibold text-foreground">{oilLabel ?? "Aucun huilage"}</p>
                  </div>
                  <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${oilOpen ? "rotate-180" : ""}`} />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pt-4">
                  <Select value={oilPatternName} onValueChange={setOilPatternName}>
                    <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Aucun huilage" /></SelectTrigger>
                    <SelectContent className="max-h-72 z-[200]">
                      <SelectItem value="none">Aucun huilage</SelectItem>
                      <SelectItem value="__custom__">Huilage personnalisé…</SelectItem>
                      {OFFICIAL_OIL_PATTERNS.map((p) => {
                        const cat = getOilCategory(p.oil_ratio);
                        return <SelectItem key={p.name} value={p.name}>{p.name}{p.oil_ratio ? ` · ${p.oil_ratio}` : ""}{cat ? ` · ${cat.label}` : ""}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                  {oilPatternName === "__custom__" && (
                    <div className="space-y-2">
                      <Input value={customOilName} onChange={(e) => setCustomOilName(e.target.value)} placeholder="Nom du huilage (ex : Huilage maison du 12 juin)" className="h-12 rounded-xl" />
                      <SimplifiedOilPatternPicker value={customOilPattern} onChange={setCustomOilPattern} categoryId={categoryId} />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    {([["session", "Pour toute la séance"], ["per_block", "Différent par bloc"]] as const).map(([k, l]) => (
                      <button key={k} type="button" onClick={() => setOilScope(k)} className={`h-11 rounded-xl text-sm font-medium transition-colors ${oilScope === k ? "bg-primary text-primary-foreground" : "bg-bowling-canvas text-foreground"}`}>{l}</button>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { key: "tactical", label: "Tactique", hint: "Strike, spares, quilles", icon: Target, color: "text-bowling-accent", onClick: addTactical },
                  { key: "technical", label: "Technique", hint: "Thématique & durée", icon: Wrench, color: "text-success", onClick: addTechnical },
                  { key: "games", label: "Parties", hint: "Scores des parties", icon: Circle, color: "text-warning", onClick: addGames },
                ].map((c) => (
                  <button key={c.key} type="button" onClick={c.onClick} className={`${cardCls} group flex flex-col items-center gap-2 !p-4 text-center transition-all hover:-translate-y-0.5 hover:shadow-md`}>
                    <c.icon className={`h-7 w-7 ${c.color}`} />
                    <span className="flex items-center gap-1 text-sm sm:text-base font-semibold text-primary"><Plus className="h-4 w-4" />{c.label}</span>
                    <span className="hidden sm:block text-xs text-muted-foreground">{c.hint}</span>
                  </button>
                ))}
              </div>

              {blocks.length === 0 && (
                <div className={`${cardCls} py-10 text-center`}>
                  <p className="text-base font-semibold text-primary">Construis ta séance</p>
                  <p className="mt-1 text-sm text-muted-foreground">Choisis un bloc ci-dessus pour commencer.</p>
                </div>
              )}

              {blocks.map((b, posIdx) => {
                const collapsed = lockedIds.has(b.id);
                return (
                  <div key={b.id} className="space-y-1.5">
                    <div className="flex items-center justify-end gap-1">
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Monter le bloc" disabled={posIdx === 0} onClick={() => moveBlock(posIdx, -1)}><ArrowUp className="h-4 w-4" /></Button>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Descendre le bloc" disabled={posIdx === blocks.length - 1} onClick={() => moveBlock(posIdx, 1)}><ArrowDown className="h-4 w-4" /></Button>
                      <Button type="button" variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={() => duplicateBlock(b.id)}><Copy className="h-3.5 w-3.5" />Dupliquer</Button>
                      {!collapsed && (
                        <Button type="button" variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={() => collapseBlock(b.id)}><ChevronUp className="h-3.5 w-3.5" />Replier</Button>
                      )}
                    </div>
                    {collapsed ? (
                      <LockedBlockSummary block={b} index={posIdx} categoryId={categoryId} playerId={playerIdForEditors} onEdit={() => openBlock(b.id)} onRemove={() => removeBlock(b.id)} />
                    ) : renderEditor(b)}
                  </div>
                );
              })}
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
              <div className="md:col-span-2">
                <BowlingSessionRecap
                  date={date}
                  blocks={blocks}
                  totalDuration={blocks.reduce((s, b) => s + (blockDuration(b) || 0), 0)}
                  athleteCount={isAthleteMode ? null : selectedPlayers.length}
                  oilName={oilLabel}
                  objective={objective}
                  onEditStep={goToStep}
                />
              </div>
              {isAthleteMode && !isEditMode && (
                <div className={`${cardCls} md:col-span-2 space-y-3`}>
                  <p className="text-base font-semibold text-primary">RPE ressenti</p>
                  <div className="grid grid-cols-10 gap-1.5">
                    {Array.from({ length: 10 }).map((_, i) => {
                      const v = i + 1;
                      const on = v === athleteRpe;
                      return (
                        <button key={v} type="button" onClick={() => setAthleteRpe(v)} className={`h-11 rounded-xl text-sm font-semibold transition-colors ${on ? "bg-primary text-primary-foreground" : "bg-bowling-canvas text-foreground hover:bg-muted"}`}>{v}</button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">1 = très facile · 10 = effort maximal. Le RPE et la durée alimentent ta charge d'entraînement.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pied fixe opaque */}
        <div className="shrink-0 border-t border-border bg-card px-4 py-3 sm:px-8 sm:py-4" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          {step < 2 ? (
            <Button className="h-14 w-full rounded-2xl text-base font-semibold" onClick={() => goToStep(step + 1)}>
              Suivant <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          ) : (
            <Button className="h-14 w-full rounded-2xl bg-success text-base font-semibold text-success-foreground hover:bg-success/90" onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Enregistrement...</> : <><CheckCircle2 className="h-5 w-5 mr-2" />{isAthleteMode ? "Enregistrer la séance" : `Attribuer la séance (${selectedPlayers.length})`}</>}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
