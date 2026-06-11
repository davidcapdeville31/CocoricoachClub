import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Users, Activity, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

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
 *  - Pour les séances bowling : nombre de blocs/parties saisis (bowling_training_blocks)
 *
 * Permet de voir d'un coup d'œil qui a rempli ses données.
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

  // Liste d'athlètes attendus : union attendance + event_participants
  // fallback : tous les joueurs de la catégorie si rien de spécifique
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

  // RPE individuels saisis
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

  // Blocs bowling saisis par athlète (bowling_simplified / bowling_advanced)
  const { data: bowlingBlocks } = useQuery({
    queryKey: ["session-bowling-blocks-by-athlete", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bowling_training_blocks")
        .select("id, athlete_id, block_type")
        .eq("session_id", sessionId);
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

    // Enrichit avec la catégorie (avatars / first_name manquants)
    (categoryPlayers || []).forEach((cp: any) => {
      const existing = map.get(cp.id);
      if (existing) {
        if (!existing.name) existing.name = cp.name;
        if (existing.first_name == null) existing.first_name = cp.first_name;
        if (existing.avatar_url == null) existing.avatar_url = cp.avatar_url;
      }
    });

    // Ajoute aussi les athlètes ayant saisi des données mais pas listés comme participants
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
  (bowlingBlocks || []).forEach((b: any) => {
    if (!b.athlete_id) return;
    const cur = bowlingByPlayer.get(b.athlete_id) || { games: 0, technical: 0, tactical: 0, total: 0 };
    cur.total += 1;
    if (b.block_type === "games") cur.games += 1;
    else if (b.block_type === "technical") cur.technical += 1;
    else if (b.block_type === "tactical") cur.tactical += 1;
    bowlingByPlayer.set(b.athlete_id, cur);
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

      <div className="grid gap-1.5 sm:grid-cols-2">
        {players.map((p) => {
          const rpeList = rpeByPlayer.get(p.id) || [];
          const bowl = bowlingByPlayer.get(p.id);
          const hasAnyData = rpeList.length > 0 || (bowl?.total || 0) > 0;
          const avgRpe =
            rpeList.length > 0
              ? rpeList.reduce((a, b) => a + b, 0) / rpeList.length
              : null;
          const displayName = p.first_name ? `${p.first_name} ${p.name}` : p.name || "Athlète";
          const initials = (p.first_name || p.name || "A").slice(0, 2).toUpperCase();

          return (
            <div
              key={p.id}
              className={cn(
                "flex items-center gap-2 rounded-lg border bg-background p-2 text-sm",
                hasAnyData ? "border-emerald-300/60 dark:border-emerald-700/40" : "border-dashed opacity-80",
              )}
            >
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
