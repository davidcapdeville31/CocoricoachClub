import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Droplet, Plus, Save, Trash2 } from "lucide-react";
import {
  ALL_PATTERN_NAMES,
  FRICTION_LEVELS,
  PROFILE_TYPES,
  getOilCategory,
  getPatternPreset,
} from "@/lib/constants/bowlingOilPatterns";
import {
  BowlingBlockManager,
  BOWLING_COMPETITION_CATEGORIES,
  BOWLING_PHASES,
  type BowlingBlock,
  type Round,
} from "@/components/bowling/BowlingBlockManager";
import type { BowlingStats, FrameData } from "@/components/athlete-portal/BowlingScoreSheet";

interface AthleteBowlingCompetitionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matchId: string;
  categoryId: string;
  playerId: string;
  competitionLabel?: string;
}

interface OilPatternDraft {
  clientKey: string;
  id?: string;
  name: string;
  gender: string;
  length_feet: string;
  buff_distance_feet: string;
  width_boards: string;
  total_volume_ml: string;
  oil_ratio: string;
  profile_type: string;
  forward_oil: boolean;
  reverse_oil: boolean;
  outside_friction: string;
  notes: string;
  assigned: boolean;
  image_url: string | null;
}

const createEmptyPattern = (): OilPatternDraft => ({
  clientKey: crypto.randomUUID(),
  name: "",
  gender: "",
  length_feet: "",
  buff_distance_feet: "",
  width_boards: "",
  total_volume_ml: "",
  oil_ratio: "",
  profile_type: "",
  forward_oil: true,
  reverse_oil: true,
  outside_friction: "",
  notes: "",
  assigned: false,
  image_url: null,
});

const toNullableNumber = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const mapPatternToDraft = (pattern: any, assignedIds: Set<string>): OilPatternDraft => ({
  clientKey: pattern.id,
  id: pattern.id,
  name: pattern.name || "",
  gender: pattern.gender || "",
  length_feet: pattern.length_feet != null ? String(pattern.length_feet) : "",
  buff_distance_feet: pattern.buff_distance_feet != null ? String(pattern.buff_distance_feet) : "",
  width_boards: pattern.width_boards != null ? String(pattern.width_boards) : "",
  total_volume_ml: pattern.total_volume_ml != null ? String(pattern.total_volume_ml) : "",
  oil_ratio: pattern.oil_ratio || "",
  profile_type: pattern.profile_type || "",
  forward_oil: pattern.forward_oil ?? true,
  reverse_oil: pattern.reverse_oil ?? true,
  outside_friction: pattern.outside_friction || "",
  notes: pattern.notes || "",
  assigned: assignedIds.has(pattern.id),
});

const buildRoundsState = (
  rows: any[],
  matchDate?: string | null,
): { rounds: Round[]; blocks: BowlingBlock[] } => {
  const blockMap = new Map<string, BowlingBlock>();

  const rounds = (rows || []).map((row: any) => {
    const statData = row.competition_round_stats?.[0]?.stat_data || {};
    const bowlingFrames = statData.bowlingFrames || statData.frames;
    const bowlingCategory = statData.bowlingCategory as string | undefined;
    const roundDate = statData.roundDate as string | undefined;
    const blockId = statData.blockId as string | undefined;
    const ballData = statData.ballData as any | undefined;
    const effectiveBlockId =
      blockId ||
      `legacy_${roundDate || matchDate || "date"}_${bowlingCategory || "category"}_${row.phase || "phase"}`;

    if (!blockMap.has(effectiveBlockId)) {
      blockMap.set(effectiveBlockId, {
        id: effectiveBlockId,
        roundDate: roundDate || matchDate || new Date().toISOString().slice(0, 10),
        bowlingCategory: bowlingCategory || "",
        phase: row.phase || "",
        opponent_name: row.opponent_name || "",
        notes: "",
        debriefing: statData.blockDebriefing || "",
        isCollapsed: false,
        trackPockets: statData.trackPockets !== false,
      });
    }

    const {
      bowlingFrames: _frames,
      frames: _legacyFrames,
      bowlingCategory: _category,
      roundDate: _roundDate,
      blockId: _blockId,
      ballData: _ballData,
      blockDebriefing: _blockDebriefing,
      trackPockets: _trackPockets,
      ...cleanStats
    } = statData;

    return {
      id: row.id,
      round_number: row.round_number,
      opponent_name: row.opponent_name || "",
      result: row.result || "",
      notes: row.notes || "",
      stats: cleanStats,
      phase: row.phase || "",
      lane: row.lane || undefined,
      current_conditions: row.current_conditions || undefined,
      temperature_celsius: row.temperature_celsius || undefined,
      bowlingCategory,
      bowlingFrames,
      roundDate,
      blockId: effectiveBlockId,
      ballData,
      isLocked: true,
    } as Round;
  });

  return {
    rounds,
    blocks: Array.from(blockMap.values()),
  };
};

export function AthleteBowlingCompetitionDialog({
  open,
  onOpenChange,
  matchId,
  categoryId,
  playerId,
  competitionLabel,
}: AthleteBowlingCompetitionDialogProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"oil" | "rounds">("oil");
  const [patterns, setPatterns] = useState<OilPatternDraft[]>([]);
  const [deletedPatternIds, setDeletedPatternIds] = useState<string[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [blocks, setBlocks] = useState<BowlingBlock[]>([]);

  const competitionQuery = useQuery({
    queryKey: ["athlete-bowling-competition", matchId, playerId],
    enabled: open && !!matchId,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("athlete-bowling-competition", {
        body: {
          action: "load",
          match_id: matchId,
          category_id: categoryId,
          player_id: playerId,
        },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Impossible de charger la compétition");
      return data;
    },
  });

  useEffect(() => {
    if (!open || !competitionQuery.data) return;

    const assignedIds = new Set<string>(competitionQuery.data.assigned_pattern_ids || []);
    const nextPatterns = (competitionQuery.data.oil_patterns || []).map((pattern: any) =>
      mapPatternToDraft(pattern, assignedIds),
    );
    const { rounds: nextRounds, blocks: nextBlocks } = buildRoundsState(
      competitionQuery.data.rounds || [],
      competitionQuery.data.match?.match_date,
    );

    setPatterns(nextPatterns);
    setDeletedPatternIds([]);
    setRounds(nextRounds);
    setBlocks(nextBlocks);
    setActiveTab(nextPatterns.length > 0 ? "rounds" : "oil");
  }, [open, competitionQuery.data]);

  const canDeleteExistingPatterns = !!competitionQuery.data?.can_delete_existing_patterns;
  const matchInfo = competitionQuery.data?.match;
  const dialogTitle = competitionLabel || matchInfo?.competition || matchInfo?.opponent || "Compétition Bowling";

  const assignedCount = useMemo(
    () => patterns.filter((pattern) => pattern.assigned).length,
    [patterns],
  );

  const handlePatternChange = (clientKey: string, updates: Partial<OilPatternDraft>) => {
    setPatterns((prev) => prev.map((pattern) => (pattern.clientKey === clientKey ? { ...pattern, ...updates } : pattern)));
  };

  const handlePresetSelect = (clientKey: string, presetName: string) => {
    const preset = getPatternPreset(presetName);
    handlePatternChange(clientKey, {
      name: presetName,
      length_feet: preset?.length_feet != null ? String(preset.length_feet) : "",
      buff_distance_feet: preset?.buff_distance_feet != null ? String(preset.buff_distance_feet) : "",
      width_boards: preset?.width_boards != null ? String(preset.width_boards) : "",
      total_volume_ml: preset?.total_volume_ml != null ? String(preset.total_volume_ml) : "",
      oil_ratio: preset?.oil_ratio || "",
      profile_type: preset?.profile_type || "",
      forward_oil: preset?.forward_oil ?? true,
      reverse_oil: preset?.reverse_oil ?? true,
      outside_friction: preset?.outside_friction || "",
    });
  };

  const removePattern = (pattern: OilPatternDraft) => {
    if (pattern.id && !canDeleteExistingPatterns) {
      toast.error("Seuls les huilages personnels peuvent être supprimés ici");
      return;
    }

    setPatterns((prev) => prev.filter((item) => item.clientKey !== pattern.clientKey));
    if (pattern.id) {
      setDeletedPatternIds((prev) => Array.from(new Set([...prev, pattern.id!])));
    }
  };

  const lockRound = (roundNumber: number) => {
    setRounds((prev) => prev.map((round) => (round.round_number === roundNumber ? { ...round, isLocked: true } : round)));
  };

  const unlockRound = (roundNumber: number) => {
    setRounds((prev) => prev.map((round) => (round.round_number === roundNumber ? { ...round, isLocked: false } : round)));
    toast.info(`Partie ${roundNumber} déverrouillée`);
  };

  const saveRoundMutation = useMutation({
    mutationFn: async (round: Round) => {
      const payload = {
        action: "save_round",
        match_id: matchId,
        category_id: categoryId,
        player_id: playerId,
        round: {
          round_number: round.round_number,
          opponent_name: round.opponent_name || null,
          result: round.result || null,
          notes: round.notes || null,
          phase: round.phase || null,
          lane: round.lane ?? null,
          current_conditions: round.current_conditions ?? null,
          temperature_celsius: round.temperature_celsius ?? null,
          bowlingCategory: round.bowlingCategory || null,
          roundDate: round.roundDate || null,
          blockId: round.blockId || null,
          bowlingFrames: round.bowlingFrames || null,
          ballData: round.ballData || null,
          stats: round.stats || {},
        },
      };
      const { data, error } = await supabase.functions.invoke("athlete-bowling-competition", { body: payload });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Impossible d'enregistrer la partie");
      return data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["athlete-bowling-competition", matchId, playerId] }),
        queryClient.invalidateQueries({ queryKey: ["competition_rounds", matchId] }),
        queryClient.invalidateQueries({ queryKey: ["competition_rounds_count", matchId] }),
        queryClient.invalidateQueries({ queryKey: ["competition_rounds_phases", matchId] }),
      ]);
      toast.success("Partie enregistrée");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Erreur lors de l'enregistrement de la partie");
    },
  });

  const handleScoreSave = (
    roundNumber: number,
    sheetStats: BowlingStats,
    frames: FrameData[],
    ballData?: { mode: string; ballId?: string | null; frameBalls?: (string | null)[] },
  ) => {
    let updatedRound: Round | undefined;
    setRounds((prev) => {
      const next = prev.map((round) => {
        if (round.round_number !== roundNumber) return round;
        const newRound = {
          ...round,
          bowlingFrames: frames,
          isLocked: true,
          ballData: ballData || round.ballData,
          stats: {
            ...round.stats,
            gameScore: sheetStats.totalScore,
            strikes: sheetStats.strikes,
            strikePercentage: sheetStats.strikePercentage,
            spares: sheetStats.spares,
            sparePercentage: sheetStats.sparePercentage,
            openFrames: sheetStats.openFrames,
            splitCount: sheetStats.splitCount,
            splitConverted: sheetStats.splitConverted,
            splitOnLastThrow: sheetStats.splitOnLastThrow,
            splitConversionRate: sheetStats.splitPercentage,
            spareOpportunities: Math.max(0, 10 - sheetStats.strikes),
            pocketCount: sheetStats.pocketCount,
            pocketPercentage: sheetStats.pocketPercentage,
            singlePinCount: sheetStats.singlePinCount,
            singlePinConverted: sheetStats.singlePinConverted,
            singlePinConversionRate: sheetStats.singlePinConversionRate,
          },
        } as Round;
        updatedRound = newRound;
        return newRound;
      });
      return next;
    });
    if (updatedRound) {
      saveRoundMutation.mutate(updatedRound);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        action: "save",
        match_id: matchId,
        category_id: categoryId,
        player_id: playerId,
        deleted_pattern_ids: deletedPatternIds,
        oil_patterns: patterns.map((pattern) => ({
          client_key: pattern.clientKey,
          id: pattern.id,
          name: pattern.name || null,
          gender: pattern.gender || null,
          length_feet: toNullableNumber(pattern.length_feet),
          buff_distance_feet: toNullableNumber(pattern.buff_distance_feet),
          width_boards: toNullableNumber(pattern.width_boards),
          total_volume_ml: toNullableNumber(pattern.total_volume_ml),
          oil_ratio: pattern.oil_ratio.trim() || null,
          profile_type: pattern.profile_type || null,
          forward_oil: pattern.forward_oil,
          reverse_oil: pattern.reverse_oil,
          outside_friction: pattern.outside_friction || null,
          notes: pattern.notes.trim() || null,
          assigned: pattern.assigned,
        })),
        blocks: blocks.map((block) => ({
          id: block.id,
          roundDate: block.roundDate,
          bowlingCategory: block.bowlingCategory,
          phase: block.phase,
          opponent_name: block.opponent_name,
          debriefing: block.debriefing,
          trackPockets: block.trackPockets !== false,
        })),
        rounds: rounds.map((round) => ({
          round_number: round.round_number,
          opponent_name: round.opponent_name || null,
          result: round.result || null,
          notes: round.notes || null,
          phase: round.phase || null,
          lane: round.lane ?? null,
          current_conditions: round.current_conditions ?? null,
          temperature_celsius: round.temperature_celsius ?? null,
          bowlingCategory: round.bowlingCategory || null,
          roundDate: round.roundDate || null,
          blockId: round.blockId || null,
          bowlingFrames: round.bowlingFrames || null,
          ballData: round.ballData || null,
          stats: round.stats || {},
        })),
      };

      const { data, error } = await supabase.functions.invoke("athlete-bowling-competition", {
        body: payload,
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Impossible d'enregistrer la compétition");
      return data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["athlete-calendar-matches", categoryId, playerId] }),
        queryClient.invalidateQueries({ queryKey: ["athlete-bowling-competition", matchId, playerId] }),
        queryClient.invalidateQueries({ queryKey: ["competition_rounds", matchId] }),
        queryClient.invalidateQueries({ queryKey: ["competition_rounds_count", matchId] }),
        queryClient.invalidateQueries({ queryKey: ["competition_rounds_phases", matchId] }),
        queryClient.invalidateQueries({ queryKey: ["bowling_oil_patterns", matchId] }),
      ]);
      toast.success("Données Bowling enregistrées");
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error?.message || "Erreur lors de l'enregistrement");
    },
  });

  const savePatternMutation = useMutation({
    mutationFn: async (pattern: OilPatternDraft) => {
      const payload = {
        action: "save_pattern",
        match_id: matchId,
        category_id: categoryId,
        player_id: playerId,
        pattern: {
          id: pattern.id,
          name: pattern.name || null,
          gender: pattern.gender || null,
          length_feet: toNullableNumber(pattern.length_feet),
          buff_distance_feet: toNullableNumber(pattern.buff_distance_feet),
          width_boards: toNullableNumber(pattern.width_boards),
          total_volume_ml: toNullableNumber(pattern.total_volume_ml),
          oil_ratio: pattern.oil_ratio.trim() || null,
          profile_type: pattern.profile_type || null,
          forward_oil: pattern.forward_oil,
          reverse_oil: pattern.reverse_oil,
          outside_friction: pattern.outside_friction || null,
          notes: pattern.notes.trim() || null,
          assigned: pattern.assigned !== false ? true : false,
        },
      };
      const { data, error } = await supabase.functions.invoke("athlete-bowling-competition", { body: payload });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Impossible d'enregistrer le huilage");
      return { clientKey: pattern.clientKey, id: data.pattern_id as string };
    },
    onSuccess: async ({ clientKey, id }) => {
      setPatterns((prev) =>
        prev.map((p) => (p.clientKey === clientKey ? { ...p, id, assigned: true } : p)),
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["athlete-bowling-competition", matchId, playerId] }),
        queryClient.invalidateQueries({ queryKey: ["bowling_oil_patterns", matchId] }),
      ]);
      toast.success("Huilage enregistré");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Erreur lors de l'enregistrement du huilage");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          {matchInfo?.match_date && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{matchInfo.match_date}</span>
              {matchInfo?.location && <span>• {matchInfo.location}</span>}
              {assignedCount > 0 && <span>• {assignedCount} huilage{assignedCount > 1 ? "s" : ""} attribué{assignedCount > 1 ? "s" : ""}</span>}
            </div>
          )}
        </DialogHeader>

        {competitionQuery.isLoading ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Chargement…</div>
        ) : competitionQuery.isError ? (
          <div className="flex-1 flex items-center justify-center text-sm text-destructive px-4 text-center">
            {(competitionQuery.error as Error)?.message || "Impossible de charger la compétition"}
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "oil" | "rounds")} className="flex-1 min-h-0 flex flex-col">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="oil">Huilage</TabsTrigger>
              <TabsTrigger value="rounds">Parties</TabsTrigger>
            </TabsList>

            <TabsContent value="oil" className="flex-1 min-h-0 overflow-y-auto pr-2 mt-4 space-y-4">
              {patterns.length === 0 && (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground space-y-2">
                    <Droplet className="h-10 w-10 mx-auto opacity-50" />
                    <p>Aucun huilage enregistré.</p>
                  </CardContent>
                </Card>
              )}

              {patterns.map((pattern, index) => {
                const oilCategory = getOilCategory(pattern.oil_ratio || null);
                const canEditPattern = canDeleteExistingPatterns || !pattern.id || pattern.assigned;
                return (
                  <Card key={pattern.clientKey}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between gap-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Droplet className="h-4 w-4" />
                          {pattern.name || `Huilage ${index + 1}`}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-2 rounded-md border px-2 py-1">
                            <Checkbox
                              id={`assign-${pattern.clientKey}`}
                              checked={pattern.assigned}
                              onCheckedChange={(checked) => handlePatternChange(pattern.clientKey, { assigned: checked === true })}
                            />
                            <Label htmlFor={`assign-${pattern.clientKey}`} className="text-xs cursor-pointer">
                              Mon huilage
                            </Label>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={!!pattern.id && !canDeleteExistingPatterns}
                            onClick={() => removePattern(pattern)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      {oilCategory && (
                        <Badge variant="outline" className={oilCategory.color}>
                          {oilCategory.label} · {oilCategory.detail}
                        </Badge>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div className="space-y-2 xl:col-span-2">
                          <Label>Preset</Label>
                          <Select onValueChange={(value) => handlePresetSelect(pattern.clientKey, value)}>
                            <SelectTrigger disabled={!canEditPattern}>
                              <SelectValue placeholder="Charger un huilage connu" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[260px]">
                              {ALL_PATTERN_NAMES.map((name) => (
                                <SelectItem key={name} value={name}>
                                  {name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2 xl:col-span-2">
                          <Label>Nom du huilage</Label>
                          <Input
                            value={pattern.name}
                            onChange={(event) => handlePatternChange(pattern.clientKey, { name: event.target.value })}
                            placeholder="Ex : PBA Chameleon"
                            disabled={!canEditPattern}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Genre</Label>
                          <Select
                            value={pattern.gender || "none"}
                            onValueChange={(value) => handlePatternChange(pattern.clientKey, { gender: value === "none" ? "" : value })}
                          >
                            <SelectTrigger disabled={!canEditPattern}>
                              <SelectValue placeholder="Tous" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Tous</SelectItem>
                              <SelectItem value="male">Garçons</SelectItem>
                              <SelectItem value="female">Filles</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Longueur (ft)</Label>
                          <Input
                            value={pattern.length_feet}
                            onChange={(event) => handlePatternChange(pattern.clientKey, { length_feet: event.target.value })}
                            inputMode="decimal"
                            disabled={!canEditPattern}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Buff (ft)</Label>
                          <Input
                            value={pattern.buff_distance_feet}
                            onChange={(event) => handlePatternChange(pattern.clientKey, { buff_distance_feet: event.target.value })}
                            inputMode="decimal"
                            disabled={!canEditPattern}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Largeur (boards)</Label>
                          <Input
                            value={pattern.width_boards}
                            onChange={(event) => handlePatternChange(pattern.clientKey, { width_boards: event.target.value })}
                            inputMode="numeric"
                            disabled={!canEditPattern}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Volume (ml)</Label>
                          <Input
                            value={pattern.total_volume_ml}
                            onChange={(event) => handlePatternChange(pattern.clientKey, { total_volume_ml: event.target.value })}
                            inputMode="decimal"
                            disabled={!canEditPattern}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Ratio</Label>
                          <Input
                            value={pattern.oil_ratio}
                            onChange={(event) => handlePatternChange(pattern.clientKey, { oil_ratio: event.target.value })}
                            placeholder="Ex : 3:1"
                            disabled={!canEditPattern}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Profil</Label>
                          <Select
                            value={pattern.profile_type || "none"}
                            onValueChange={(value) => handlePatternChange(pattern.clientKey, { profile_type: value === "none" ? "" : value })}
                          >
                            <SelectTrigger disabled={!canEditPattern}>
                              <SelectValue placeholder="Choisir" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Non défini</SelectItem>
                              {PROFILE_TYPES.map((profile) => (
                                <SelectItem key={profile.value} value={profile.value}>
                                  {profile.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Friction extérieure</Label>
                          <Select
                            value={pattern.outside_friction || "none"}
                            onValueChange={(value) => handlePatternChange(pattern.clientKey, { outside_friction: value === "none" ? "" : value })}
                          >
                            <SelectTrigger disabled={!canEditPattern}>
                              <SelectValue placeholder="Choisir" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Non défini</SelectItem>
                              {FRICTION_LEVELS.map((level) => (
                                <SelectItem key={level.value} value={level.value}>
                                  {level.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-4">
                        <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                          <Checkbox
                            id={`forward-${pattern.clientKey}`}
                            checked={pattern.forward_oil}
                            onCheckedChange={(checked) => handlePatternChange(pattern.clientKey, { forward_oil: checked === true })}
                            disabled={!canEditPattern}
                          />
                          <Label htmlFor={`forward-${pattern.clientKey}`} className="cursor-pointer text-sm">
                            Forward oil
                          </Label>
                        </div>
                        <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                          <Checkbox
                            id={`reverse-${pattern.clientKey}`}
                            checked={pattern.reverse_oil}
                            onCheckedChange={(checked) => handlePatternChange(pattern.clientKey, { reverse_oil: checked === true })}
                            disabled={!canEditPattern}
                          />
                          <Label htmlFor={`reverse-${pattern.clientKey}`} className="cursor-pointer text-sm">
                            Reverse oil
                          </Label>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Notes</Label>
                        <Textarea
                          value={pattern.notes}
                          onChange={(event) => handlePatternChange(pattern.clientKey, { notes: event.target.value })}
                          rows={3}
                          placeholder="Observations sur le huilage"
                          disabled={!canEditPattern}
                        />
                      </div>

                      <div className="flex justify-end">
                        <Button
                          type="button"
                          size="sm"
                          className="gap-2"
                          onClick={() => savePatternMutation.mutate(pattern)}
                          disabled={savePatternMutation.isPending || !canEditPattern}
                        >
                          <Save className="h-4 w-4" />
                          Enregistrer ce huilage
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              <Button type="button" variant="outline" className="w-full gap-2 border-dashed" onClick={() => setPatterns((prev) => [...prev, createEmptyPattern()])}>
                <Plus className="h-4 w-4" />
                Ajouter un huilage
              </Button>
            </TabsContent>

            <TabsContent value="rounds" className="flex-1 min-h-0 overflow-y-auto pr-2 mt-4">
              <BowlingBlockManager
                playerId={playerId}
                categoryId={categoryId}
                matchId={matchId}
                rounds={rounds}
                blocks={blocks}
                matchDate={matchInfo?.match_date}
                onBlocksChange={setBlocks}
                onRoundsChange={setRounds}
                onScoreSave={handleScoreSave}
                onLock={lockRound}
                onUnlock={unlockRound}
              />

              {rounds.length > 0 && (
                <div className="mt-4 rounded-lg border border-border/60 p-3 bg-muted/20">
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {blocks.map((block, index) => (
                      <Badge key={block.id} variant="outline" className="text-[11px]">
                        Bloc {index + 1}
                        {block.bowlingCategory
                          ? ` · ${BOWLING_COMPETITION_CATEGORIES.find((item) => item.value === block.bowlingCategory)?.label || block.bowlingCategory}`
                          : ""}
                        {block.phase
                          ? ` · ${BOWLING_PHASES.find((item) => item.value === block.phase)?.label || block.phase}`
                          : ""}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter className="pt-4 border-t">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saveMutation.isPending}>
            Fermer
          </Button>
          <Button type="button" className="gap-2" onClick={() => saveMutation.mutate()} disabled={competitionQuery.isLoading || saveMutation.isPending}>
            <Save className="h-4 w-4" />
            {saveMutation.isPending ? "Enregistrement..." : "Enregistrer la compétition"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}