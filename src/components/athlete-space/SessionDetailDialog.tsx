import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Activity, Clock, Calendar as CalendarIcon, CheckCircle2, Trophy, Target, ChevronDown, Wrench, Gamepad2, Droplet } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { GroupedExerciseList } from "@/components/category/GroupedExerciseList";
import { getTrainingTypeLabel } from "@/lib/constants/trainingTypes";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: any | null;
  exercises: any[];
  playerId?: string;
}

export function SessionDetailDialog({ open, onOpenChange, session, exercises, playerId }: Props) {
  const sessionId = session?.id;
  const trainingType = String(session?.training_type || "").toLowerCase();
  const isBowling = trainingType.startsWith("bowling");

  // RPE personnels saisis pour cette séance
  const { data: rpes } = useQuery({
    queryKey: ["athlete-session-rpe", sessionId, playerId],
    enabled: open && !!sessionId && !!playerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("session_block_athlete_rpe")
        .select("rpe, duration_minutes, block_id")
        .eq("training_session_id", sessionId)
        .eq("player_id", playerId!);
      if (error) throw error;
      return data || [];
    },
  });

  // Blocs bowling saisis par l'athlète (bowling_simplified / bowling_advanced)
  const { data: bowlingBlocks } = useQuery({
    queryKey: ["athlete-session-bowling-blocks", sessionId, playerId],
    enabled: open && !!sessionId && !!playerId && isBowling,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bowling_training_blocks")
        .select("id, block_type, config, order_index")
        .eq("session_id", sessionId)
        .eq("athlete_id", playerId!)
        .order("order_index");
      if (error) throw error;
      return data || [];
    },
  });

  // Noms des boules utilisées
  const ballIds = Array.from(
    new Set(
      (bowlingBlocks || [])
        .map((b: any) => b.config?.ball_id)
        .filter(Boolean),
    ),
  );
  const { data: balls } = useQuery({
    queryKey: ["athlete-session-balls", ballIds],
    enabled: ballIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_bowling_arsenal")
        .select("id, custom_ball_name, custom_ball_brand, ball_catalog:bowling_ball_catalog(name, brand)")
        .in("id", ballIds as string[]);
      if (error) throw error;
      return data || [];
    },
  });
  const ballName = (id?: string) => {
    if (!id) return null;
    const b: any = (balls || []).find((x: any) => x.id === id);
    if (!b) return null;
    const name = b.custom_ball_name || b.ball_catalog?.name;
    const brand = b.custom_ball_brand || b.ball_catalog?.brand;
    return name ? `${brand ? brand + " " : ""}${name}` : null;
  };

  if (!session) return null;

  const rawNotes = String(session.notes || "").replace(/<!--[\s\S]*?-->/g, "").trim();
  const dateLabel = session.session_date
    ? format(parseISO(session.session_date), "EEEE d MMMM yyyy", { locale: fr })
    : "";

  const avgRpe =
    rpes && rpes.length > 0
      ? rpes.reduce((acc, r: any) => acc + (r.rpe || 0), 0) / rpes.length
      : null;
  const totalDuration =
    rpes && rpes.length > 0
      ? rpes.reduce((acc, r: any) => acc + (r.duration_minutes || 0), 0)
      : 0;

  const bowlingByType = (bowlingBlocks || []).reduce(
    (acc, b: any) => {
      acc[b.block_type] = (acc[b.block_type] || 0) + 1;
      acc._total += 1;
      return acc;
    },
    { _total: 0 } as Record<string, number>,
  );

  const hasAthleteData = (rpes?.length || 0) > 0 || (bowlingBlocks?.length || 0) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Activity className="h-5 w-5 text-primary" />
            {getTrainingTypeLabel(session.training_type)}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-3 pt-1">
            <span className="inline-flex items-center gap-1">
              <CalendarIcon className="h-3.5 w-3.5" />
              {dateLabel}
            </span>
            {session.session_start_time && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {String(session.session_start_time).slice(0, 5)}
                {session.session_end_time && ` - ${String(session.session_end_time).slice(0, 5)}`}
              </span>
            )}
            <Badge variant="outline">{getTrainingTypeLabel(session.training_type)}</Badge>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {rawNotes && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <p className="text-xs uppercase tracking-wide font-semibold text-primary mb-1.5">
                Consignes du coach
              </p>
              <p className="text-sm whitespace-pre-line text-foreground/90">{rawNotes}</p>
            </div>
          )}

          {/* Données personnelles saisies par l'athlète */}
          {hasAthleteData ? (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <p className="text-xs uppercase tracking-wide font-semibold text-emerald-700 dark:text-emerald-400">
                  Mes données saisies
                </p>
              </div>

              {avgRpe !== null && (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="gap-1">
                    <Activity className="h-3 w-3" />
                    RPE moyen {avgRpe.toFixed(1)}/10
                  </Badge>
                  {totalDuration > 0 && (
                    <Badge variant="outline">{totalDuration} min</Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    sur {rpes!.length} bloc{rpes!.length > 1 ? "s" : ""}
                  </span>
                </div>
              )}

              {isBowling && bowlingByType._total > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="gap-1">
                    <Trophy className="h-3 w-3" />
                    {bowlingByType._total} bloc{bowlingByType._total > 1 ? "s" : ""} bowling
                  </Badge>
                  {bowlingByType.games > 0 && (
                    <Badge variant="outline">{bowlingByType.games} partie(s)</Badge>
                  )}
                  {bowlingByType.technical > 0 && (
                    <Badge variant="outline">{bowlingByType.technical} technique</Badge>
                  )}
                  {bowlingByType.tactical > 0 && (
                    <Badge variant="outline" className="gap-1">
                      <Target className="h-3 w-3" />
                      {bowlingByType.tactical} tactique
                    </Badge>
                  )}
                </div>
              )}

              <p className="text-[11px] text-muted-foreground">
                Cliquez sur « Remplir les données » pour modifier votre saisie.
              </p>
            </div>
          ) : playerId ? (
            <div className="rounded-lg border border-dashed bg-muted/30 p-3 text-center">
              <p className="text-xs text-muted-foreground">
                Vous n'avez pas encore saisi vos données pour cette séance.
              </p>
            </div>
          ) : null}

          {exercises.length > 0 ? (
            <div>
              <p className="text-xs uppercase tracking-wide font-semibold text-muted-foreground mb-2">
                Contenu de la séance ({exercises.length} exercice{exercises.length > 1 ? "s" : ""})
              </p>
              <GroupedExerciseList exercises={exercises} maxHeight="60vh" />
            </div>
          ) : !rawNotes && !hasAthleteData ? (
            <p className="text-sm text-muted-foreground italic text-center py-6">
              Aucun détail fourni par le coach pour cette séance.
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
