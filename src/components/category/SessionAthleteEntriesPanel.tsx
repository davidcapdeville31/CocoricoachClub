import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, Users, Activity, Trophy, ChevronDown, ChevronRight, Dumbbell, Clock, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { DetailedBlockView } from "@/components/bowling/simplified/DetailedBlockView";
import type { SimplifiedBlock } from "@/components/bowling/simplified/types";
import { parseNotesStatus, isMusculationType } from "@/components/athlete-space/AthleteWeightLogInput";

interface Props {
  sessionId: string;
  categoryId: string;
  trainingType?: string | null;
  attendance?: any[] | null;
  eventParticipants?: any[] | null;
}

/**
 * Affiche, pour le staff, le statut de saisie de chaque athlète pour la séance :
 *  - RPE saisi (session_block_athlete_rpe)
 *  - Pour les séances bowling : nombre de blocs/parties saisis + détail (config JSON)
 */
export function SessionAthleteEntriesPanel({
  sessionId,
  categoryId,
  trainingType,
  attendance,
  eventParticipants,
}: Props) {
  const tt = (trainingType || "").toLowerCase();
  const isBowling = tt.startsWith("bowling");
  const isMuscu = isMusculationType(trainingType);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: sessionMeta } = useQuery({
    queryKey: ["session-meta-for-entries", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_sessions")
        .select("session_date")
        .eq("id", sessionId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!sessionId && isMuscu,
  });

  const { data: exerciseLogs } = useQuery({
    queryKey: ["session-athlete-exercise-logs", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("athlete_exercise_logs")
        .select("player_id, exercise_name, exercise_category, prescribed_sets, prescribed_reps, actual_weight_kg, actual_sets, actual_reps, tonnage, notes")
        .eq("training_session_id", sessionId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!sessionId && isMuscu,
  });

  const { data: awcr } = useQuery({
    queryKey: ["session-awcr-tracking", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("awcr_tracking")
        .select("player_id, rpe, duration_minutes")
        .eq("training_session_id", sessionId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!sessionId && isMuscu,
  });

  const { data: wellness } = useQuery({
    queryKey: ["session-wellness-tracking", sessionId, sessionMeta?.session_date],
    queryFn: async () => {
      if (!sessionMeta?.session_date) return [];
      const { data, error } = await supabase
        .from("wellness_tracking")
        .select("player_id, general_fatigue, notes")
        .eq("tracking_date", sessionMeta.session_date);
      if (error) throw error;
      return data || [];
    },
    enabled: !!sessionId && isMuscu && !!sessionMeta?.session_date,
  });

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const { data: categoryPlayers } = useQuery({
    queryKey: ["session-athlete-entries-roster", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, name, first_name, avatar_url")
        .eq("category_id", categoryId)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!categoryId,
  });

  const { data: rpes } = useQuery({
    queryKey: ["session-block-athlete-rpe", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("session_block_athlete_rpe")
        .select("player_id, rpe, block_id")
        .eq("training_session_id", sessionId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!sessionId,
  });

  const { data: bowlingBlocks } = useQuery({
    queryKey: ["session-bowling-blocks-by-athlete", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bowling_training_blocks")
        .select("id, athlete_id, block_type, title, duration_min, config, order_index")
        .eq("session_id", sessionId)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!sessionId && isBowling,
  });

  const players = useMemo(() => {
    const map = new Map<string, { id: string; name: string; first_name: string | null; avatar_url: string | null }>();

    (attendance || []).forEach((a: any) => {
      if (!a?.player_id) return;
      const p = a.player || {};
      map.set(a.player_id, {
        id: a.player_id,
        name: p.name || "",
        first_name: p.first_name ?? null,
        avatar_url: p.avatar_url ?? null,
      });
    });
    (eventParticipants || []).forEach((ep: any) => {
      if (!ep?.player_id) return;
      const p = ep.players || {};
      if (!map.has(ep.player_id)) {
        map.set(ep.player_id, {
          id: ep.player_id,
          name: p.name || "",
          first_name: p.first_name ?? null,
          avatar_url: p.avatar_url ?? null,
        });
      }
    });

    (categoryPlayers || []).forEach((cp: any) => {
      const existing = map.get(cp.id);
      if (existing) {
        if (!existing.name) existing.name = cp.name;
        if (existing.first_name == null) existing.first_name = cp.first_name;
        if (existing.avatar_url == null) existing.avatar_url = cp.avatar_url;
      }
    });

    const extraIds = new Set<string>();
    (rpes || []).forEach((r: any) => extraIds.add(r.player_id));
    (bowlingBlocks || []).forEach((b: any) => b.athlete_id && extraIds.add(b.athlete_id));
    extraIds.forEach((pid) => {
      if (!map.has(pid)) {
        const cp = (categoryPlayers || []).find((p: any) => p.id === pid);
        if (cp) {
          map.set(pid, {
            id: pid,
            name: cp.name,
            first_name: cp.first_name,
            avatar_url: cp.avatar_url,
          });
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      const na = `${a.first_name || ""} ${a.name}`.trim().toLowerCase();
      const nb = `${b.first_name || ""} ${b.name}`.trim().toLowerCase();
      return na.localeCompare(nb);
    });
  }, [attendance, eventParticipants, categoryPlayers, rpes, bowlingBlocks]);

  if (players.length === 0) return null;

  const rpeByPlayer = new Map<string, number[]>();
  (rpes || []).forEach((r: any) => {
    const arr = rpeByPlayer.get(r.player_id) || [];
    arr.push(r.rpe);
    rpeByPlayer.set(r.player_id, arr);
  });

  const bowlingByPlayer = new Map<string, { games: number; technical: number; tactical: number; total: number }>();
  const bowlingBlocksByPlayer = new Map<string, any[]>();
  (bowlingBlocks || []).forEach((b: any) => {
    if (!b.athlete_id) return;
    const cur = bowlingByPlayer.get(b.athlete_id) || { games: 0, technical: 0, tactical: 0, total: 0 };
    cur.total += 1;
    if (b.block_type === "games") cur.games += 1;
    else if (b.block_type === "technical") cur.technical += 1;
    else if (b.block_type === "tactical") cur.tactical += 1;
    bowlingByPlayer.set(b.athlete_id, cur);
    const list = bowlingBlocksByPlayer.get(b.athlete_id) || [];
    list.push(b);
    bowlingBlocksByPlayer.set(b.athlete_id, list);
  });

  const filledCount = players.filter((p) => {
    const hasRpe = (rpeByPlayer.get(p.id)?.length || 0) > 0;
    const hasBowling = (bowlingByPlayer.get(p.id)?.total || 0) > 0;
    return hasRpe || hasBowling;
  }).length;

  return (
    <div className="mb-4 rounded-xl border bg-muted/30 p-3">
      <div className="flex items-center gap-2 mb-3">
        <Users className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-semibold">Saisies des athlètes</h4>
        <Badge variant={filledCount === players.length ? "default" : "secondary"} className="ml-auto text-xs">
          {filledCount}/{players.length} renseigné{filledCount > 1 ? "s" : ""}
        </Badge>
      </div>

      <div className="grid gap-1.5">
        {players.map((p) => {
          const rpeList = rpeByPlayer.get(p.id) || [];
          const bowl = bowlingByPlayer.get(p.id);
          const playerBlocks = bowlingBlocksByPlayer.get(p.id) || [];
          const hasAnyData = rpeList.length > 0 || (bowl?.total || 0) > 0;
          const avgRpe =
            rpeList.length > 0
              ? rpeList.reduce((a, b) => a + b, 0) / rpeList.length
              : null;
          const displayName = p.first_name ? `${p.first_name} ${p.name}` : p.name || "Athlète";
          const initials = (p.first_name || p.name || "A").slice(0, 2).toUpperCase();
          const canExpand = isBowling && playerBlocks.length > 0;
          const isOpen = expanded.has(p.id);

          return (
            <div
              key={p.id}
              className={cn(
                "rounded-lg border bg-background text-sm overflow-hidden",
                hasAnyData ? "border-emerald-300/60 dark:border-emerald-700/40" : "border-dashed opacity-80",
              )}
            >
              <div
                className={cn("flex items-center gap-2 p-2", canExpand && "cursor-pointer hover:bg-muted/40")}
                onClick={() => canExpand && toggle(p.id)}
              >
                {canExpand ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={(e) => { e.stopPropagation(); toggle(p.id); }}
                    aria-label={isOpen ? "Réduire" : "Voir le détail"}
                  >
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Button>
                ) : (
                  <span className="w-6 shrink-0" />
                )}
                <Avatar className="h-7 w-7">
                  <AvatarImage src={p.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
                <span className="truncate flex-1 min-w-0">{displayName}</span>
                <div className="flex items-center gap-1 shrink-0">
                  {avgRpe !== null && (
                    <Badge variant="outline" className="gap-1 text-xs">
                      <Activity className="h-3 w-3" />
                      RPE {avgRpe.toFixed(1)}
                    </Badge>
                  )}
                  {isBowling && bowl && bowl.total > 0 && (
                    <Badge variant="outline" className="gap-1 text-xs">
                      <Trophy className="h-3 w-3" />
                      {bowl.total} bloc{bowl.total > 1 ? "s" : ""}
                    </Badge>
                  )}
                  {hasAnyData ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground/50" />
                  )}
                </div>
              </div>

              {canExpand && isOpen && (
                <div className="border-t bg-muted/20 p-3 space-y-2">
                  {playerBlocks.map((b: any, idx: number) => {
                    const cfg = (b.config || {}) as any;
                    // Reconstitue un SimplifiedBlock à partir de la config persistée
                    const block: SimplifiedBlock = {
                      ...cfg,
                      id: cfg.id || b.id,
                      type: cfg.type || b.block_type,
                      title: cfg.title ?? b.title ?? "",
                      duration_min: cfg.duration_min ?? b.duration_min ?? 0,
                    } as SimplifiedBlock;
                    return (
                      <DetailedBlockView
                        key={b.id}
                        block={block}
                        index={idx}
                        categoryId={categoryId}
                        playerId={p.id}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filledCount < players.length && (
        <p className="text-[11px] text-muted-foreground mt-2">
          Les athlètes non cochés n'ont pas encore saisi leurs données pour cette séance.
        </p>
      )}
    </div>
  );
}
