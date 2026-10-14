import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, Trophy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FINAL_RANKING_OPTIONS,
  NOT_SET_LABEL,
  finalRankingLabel,
  isFinalRanking,
  isPodium,
  type FinalRanking,
} from "@/lib/judo/finalRanking";

export const finalRankingKey = (matchId: string, playerId: string) =>
  ["competition-final-ranking", matchId, playerId];

export function useFinalRanking(matchId?: string, playerId?: string) {
  return useQuery({
    queryKey: finalRankingKey(matchId || "", playerId || ""),
    enabled: !!matchId && !!playerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competition_results")
        .select("final_ranking")
        .eq("match_id", matchId!)
        .eq("player_id", playerId!)
        .maybeSingle();
      if (error) throw error;
      return isFinalRanking(data?.final_ranking) ? (data!.final_ranking as FinalRanking) : null;
    },
  });
}

/** Header banner: athlete + competition + saved final ranking. */
export function JudoFinalRankingBanner({
  matchId, playerId, playerName, competitionName,
}: { matchId: string; playerId?: string; playerName?: string; competitionName?: string | null }) {
  const { data: ranking } = useFinalRanking(matchId, playerId);
  const label = finalRankingLabel(ranking);
  return (
    <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border bg-muted/30 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{playerName || "Athlète"}</p>
        {competitionName && <p className="text-xs text-muted-foreground truncate">{competitionName}</p>}
      </div>
      <Badge variant={isPodium(ranking) ? "default" : "secondary"} className="text-sm shrink-0">
        {label || NOT_SET_LABEL}
      </Badge>
    </div>
  );
}

/** "Bilan de compétition": one final ranking per athlete, independent of combats. */
export function JudoFinalRankingPanel({
  matchId, playerId, playerName, competitionName,
}: { matchId: string; playerId?: string; playerName?: string; competitionName?: string | null }) {
  const qc = useQueryClient();
  const { data: ranking, isLoading } = useFinalRanking(matchId, playerId);

  const save = useMutation({
    mutationFn: async (value: FinalRanking | null) => {
      if (!playerId) throw new Error("Athlète introuvable");
      const { error } = await supabase
        .from("competition_results")
        .upsert(
          { match_id: matchId, player_id: playerId, final_ranking: value },
          { onConflict: "match_id,player_id" },
        );
      if (error) throw error;
      return value;
    },
    onSuccess: (value) => {
      qc.setQueryData(finalRankingKey(matchId, playerId!), value);
      qc.invalidateQueries({ queryKey: ["competition-final-rankings"] });
      qc.invalidateQueries({ queryKey: ["judo_analytics_matches"] });
      qc.invalidateQueries({ queryKey: ["history-final-rankings"] });
      toast.success(value ? `Classement enregistré : ${finalRankingLabel(value)}` : "Classement retiré");
    },
    onError: (e: any) => toast.error(e?.message || "Échec de l'enregistrement du classement"),
  });

  if (!playerId) {
    return <p className="text-sm text-muted-foreground">Sélectionnez un athlète pour saisir son classement.</p>;
  }

  return (
    <div className="space-y-3">
      <JudoFinalRankingBanner matchId={matchId} playerId={playerId} playerName={playerName} competitionName={competitionName} />
      <Card className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Mon classement final</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Le classement est saisi une seule fois pour toute la compétition. Il ne dépend ni du nombre, ni de l'ordre, ni du résultat des combats.
        </p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {FINAL_RANKING_OPTIONS.map((opt) => {
            const active = ranking === opt.value;
            return (
              <Button
                key={opt.value}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                data-state={active ? "active" : "inactive"}
                aria-pressed={active}
                onClick={() => { if (!save.isPending) save.mutate(opt.value); }}
              >
                {opt.label}
              </Button>
            );
          })}
        </div>
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground">
            {isLoading ? "Chargement…" : save.isPending ? "Sauvegarde en cours…" : ranking ? (
              <span className="inline-flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5" /> Enregistré</span>
            ) : "Non renseigné"}
          </span>
          {ranking && (
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { if (!save.isPending) save.mutate(null); }}>
              Remettre à « Non renseigné »
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
