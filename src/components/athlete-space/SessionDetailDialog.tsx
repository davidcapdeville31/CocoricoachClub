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
        .select("id, custom_ball_name, custom_ball_brand, ball_catalog:bowling_ball_catalog(model, brand)")
        .in("id", ballIds as string[]);
      if (error) throw error;
      return data || [];
    },
  });
  const ballName = (id?: string) => {
    if (!id) return null;
    const b: any = (balls || []).find((x: any) => x.id === id);
    if (!b) return null;
    const name = b.custom_ball_name || b.ball_catalog?.model;
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

              {isBowling && (bowlingBlocks?.length || 0) > 0 && (
                <Collapsible>
                  <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-left text-xs font-semibold text-emerald-700 transition hover:bg-emerald-500/10 dark:text-emerald-300">
                    <span>Voir le détail de mes blocs ({bowlingBlocks!.length})</span>
                    <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 space-y-2">
                    {bowlingBlocks!.map((b: any, idx: number) => {
                      const c = b.config || {};
                      const isTech = b.block_type === "technical";
                      const isTact = b.block_type === "tactical";
                      const isGame = b.block_type === "games";
                      const Icon = isTech ? Wrench : isGame ? Gamepad2 : Target;
                      const label = isTech ? "Technique" : isGame ? "Parties" : "Tactique";
                      return (
                        <div
                          key={b.id}
                          className="rounded-md border bg-surface px-3 py-2 text-sm space-y-1.5"
                        >
                          <div className="flex items-center gap-2 font-medium">
                            <Icon className="h-3.5 w-3.5 text-primary" />
                            <span>Bloc {idx + 1} — {label}</span>
                            {c.duration_min ? (
                              <Badge variant="outline" className="ml-auto text-[10px]">
                                {c.duration_min} min
                              </Badge>
                            ) : null}
                          </div>

                          {isTech && (
                            <div className="space-y-1 text-xs text-muted-foreground pl-5">
                              {(c.theme || c.custom_theme) && (
                                <p>
                                  <span className="text-foreground/70">Thème : </span>
                                  {c.custom_theme || c.theme}
                                </p>
                              )}
                              {ballName(c.ball_id) && (
                                <p>
                                  <span className="text-foreground/70">Boule : </span>
                                  {ballName(c.ball_id)}
                                </p>
                              )}
                              {c.oil_pattern?.preset_name && (
                                <p className="flex items-center gap-1">
                                  <Droplet className="h-3 w-3" />
                                  {c.oil_pattern.preset_name}
                                  {c.oil_pattern.length_feet ? ` — ${c.oil_pattern.length_feet} ft` : ""}
                                  {c.oil_pattern.oil_ratio ? ` — ratio ${c.oil_pattern.oil_ratio}` : ""}
                                </p>
                              )}
                              {c.description && (
                                <p className="whitespace-pre-line text-foreground/80">{c.description}</p>
                              )}
                            </div>
                          )}

                          {isTact && Array.isArray(c.items) && c.items.length > 0 && (
                            <div className="space-y-1 text-xs pl-5">
                              {c.items.map((it: any, i: number) => {
                                const target =
                                  it.target_type === "single_pin"
                                    ? `Quille ${it.single_pin}`
                                    : it.target_type === "split"
                                      ? `Split ${it.split_pins || ""}`
                                      : it.target_type || "Cible";
                                const pct =
                                  it.attempts > 0
                                    ? Math.round((Number(it.success || 0) / Number(it.attempts)) * 100)
                                    : 0;
                                return (
                                  <div key={i} className="flex items-center justify-between gap-2">
                                    <span className="text-muted-foreground">{target}</span>
                                    <span className="font-mono">
                                      {it.success}/{it.attempts}
                                      <span className="ml-1 text-muted-foreground">({pct}%)</span>
                                    </span>
                                  </div>
                                );
                              })}
                              {c.notes && (
                                <p className="pt-1 italic text-muted-foreground whitespace-pre-line">
                                  « {c.notes} »
                                </p>
                              )}
                            </div>
                          )}

                          {isGame && Array.isArray(c.parties) && c.parties.length > 0 && (
                            <div className="space-y-1 text-xs pl-5">
                              {c.parties.map((p: any, i: number) => {
                                const s = p.stats || {};
                                return (
                                  <div key={p.id || i} className="rounded border bg-surface-sunken px-2 py-1.5">
                                    <div className="flex items-center justify-between font-medium">
                                      <span>Partie {i + 1}</span>
                                      <span className="font-mono text-foreground">{s.totalScore ?? "—"}</span>
                                    </div>
                                    <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-muted-foreground">
                                      {typeof s.strikes === "number" && (
                                        <span>Strikes : {s.strikes} ({s.strikePercentage ?? 0}%)</span>
                                      )}
                                      {typeof s.spares === "number" && (
                                        <span>Spares : {s.spares} ({s.sparePercentage ?? 0}%)</span>
                                      )}
                                      {typeof s.pocketCount === "number" && (
                                        <span>Pocket : {s.pocketCount} ({s.pocketPercentage ?? 0}%)</span>
                                      )}
                                      {typeof s.splitCount === "number" && (
                                        <span>Splits : {s.splitCount}</span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </CollapsibleContent>
                </Collapsible>
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
