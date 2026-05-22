import { useMemo } from "react";
import { useMultiMatchEvents, useCategoryTeamName, type MatchRow } from "@/hooks/analytics/useTeamSportsAnalytics";
import { computeMatchAnalytics, tackleRatio } from "@/lib/analytics/team-sports/eventAggregator";
import { generateInsights } from "@/lib/analytics/team-sports/insights";
import { emptyTeamStats, type TeamStats } from "@/lib/analytics/team-sports/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { KpiTile, StatBar, StatBlock, InsightCard } from "./GeneralTab";

interface Props {
  matches: MatchRow[];
  categoryId?: string;
}

/** Accumule b dans a (mutation) */
function addStats(a: TeamStats, b: TeamStats) {
  a.points += b.points;
  a.tries += b.tries;
  a.conversionsMade += b.conversionsMade;
  a.conversionsAttempted += b.conversionsAttempted;
  a.penaltiesMade += b.penaltiesMade;
  a.penaltiesAttempted += b.penaltiesAttempted;
  a.drops += b.drops;
  a.dropsAttempted += b.dropsAttempted;
  a.tackles += b.tackles;
  a.missedTackles += b.missedTackles;
  a.turnovers += b.turnovers;
  a.ballsWon += b.ballsWon;
  a.ballsLost += b.ballsLost;
  a.meters += b.meters;
  a.lineBreaks += b.lineBreaks;
  a.offloads += b.offloads;
  a.passes += b.passes;
  a.passesMissed += b.passesMissed;
  a.carries += b.carries;
  a.kicks += b.kicks;
  a.kicksMissed += b.kicksMissed;
  a.fouls += b.fouls;
  a.yellowCards += b.yellowCards;
  a.redCards += b.redCards;
  a.knockOns += b.knockOns;
  a.foulsByPlay.kick += b.foulsByPlay.kick;
  a.foulsByPlay.points += b.foulsByPlay.points;
  a.foulsByPlay.penaltouche += b.foulsByPlay.penaltouche;
  a.foulsByPlay.scrum += b.foulsByPlay.scrum;
  a.foulsByPlay.quick += b.foulsByPlay.quick;
  a.foulsByPlay.unknown += b.foulsByPlay.unknown;
  a.lineoutsWon += b.lineoutsWon;
  a.lineoutsLost += b.lineoutsLost;
  a.scrumsWon += b.scrumsWon;
  a.scrumsLost += b.scrumsLost;
}

export function GeneralAggregateTab({ matches, categoryId }: Props) {
  const matchIds = useMemo(() => matches.map(m => m.id), [matches]);
  const { data: allEvents = [], isLoading } = useMultiMatchEvents(matchIds);
  const { data: ourName = "Notre équipe" } = useCategoryTeamName(categoryId || "");

  const { us, them, wins, draws, losses } = useMemo(() => {
    const us = emptyTeamStats();
    const them = emptyTeamStats();
    let wins = 0, draws = 0, losses = 0;
    for (const m of matches) {
      const ev = allEvents.filter(e => (e as any).match_id === m.id);
      const { home, away } = computeMatchAnalytics(ev, "all");
      const myStats = m.is_home ? home : away;
      const oppStats = m.is_home ? away : home;
      addStats(us, myStats);
      addStats(them, oppStats);
      if (m.is_finalized) {
        if (myStats.points > oppStats.points) wins += 1;
        else if (myStats.points === oppStats.points) draws += 1;
        else losses += 1;
      }
    }
    return { us, them, wins, draws, losses };
  }, [allEvents, matches]);

  const opponentLabel = matches.length === 1 ? matches[0].opponent : "Adversaires";
  const insights = useMemo(() => generateInsights(us, them, ourName, opponentLabel), [us, them, ourName, opponentLabel]);

  if (isLoading) return <p className="text-sm text-muted-foreground py-8 text-center">Chargement…</p>;

  if (allEvents.length === 0) {
    return (
      <div className="rounded-2xl border bg-surface p-8 text-center">
        <BarChart3 className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Aucun événement enregistré sur les matchs sélectionnés.</p>
      </div>
    );
  }

  const homeName = ourName;
  const awayName = opponentLabel;
  const usWin = us.points > them.points;
  const diff = us.points - them.points;

  return (
    <div className="space-y-4">
      {/* HEADER CUMUL */}
      <Card className="rounded-2xl overflow-hidden border-0 bg-gradient-to-br from-primary/15 via-surface to-surface shadow-lg ring-1 ring-primary/10">
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider truncate flex items-center gap-1.5 text-foreground">
                {usWin && <Trophy className="h-3 w-3 text-emerald-400" />}
                {homeName}
              </p>
              <p className="text-5xl sm:text-6xl font-black tabular-nums leading-none mt-1">{us.points}</p>
            </div>
            <div className="flex flex-col items-center gap-2 shrink-0">
              <Badge variant="secondary" className="text-[10px] uppercase tracking-widest">
                Cumul · {matches.length} matchs
              </Badge>
              <span className="text-base font-light text-muted-foreground/50">vs</span>
              <div className="flex gap-1.5 text-[10px] font-bold uppercase tracking-wider">
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 ring-1 ring-emerald-500/30">{wins}V</span>
                <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{draws}N</span>
                <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-500 ring-1 ring-rose-500/30">{losses}D</span>
              </div>
              <span className={cn(
                "text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full",
                diff > 0 ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30" :
                diff < 0 ? "bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/30" :
                "bg-muted text-muted-foreground",
              )}>
                {diff > 0 ? `+${diff}` : diff}
              </span>
            </div>
            <div className="flex-1 min-w-0 text-right">
              <p className="text-xs font-semibold uppercase tracking-wider truncate flex items-center gap-1.5 justify-end text-foreground">
                {awayName}
                {!usWin && diff !== 0 && <Trophy className="h-3 w-3 text-emerald-400" />}
              </p>
              <p className="text-5xl sm:text-6xl font-black tabular-nums leading-none mt-1">{them.points}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {insights.length > 0 && (
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2.5 px-1 flex items-center gap-2">
            <span className="h-3 w-1 rounded-full bg-primary" />
            Lecture des matchs sélectionnés
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {insights.slice(0, 4).map((i, idx) => <InsightCard key={idx} insight={i} />)}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2.5 px-1 flex items-center gap-2">
          <span className="h-3 w-1 rounded-full bg-primary" />
          Chiffres clés (cumul)
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <KpiTile label="Essais" h={us.tries} a={them.tries} homeName={homeName} awayName={awayName} />
          <KpiTile label="Plaquages" h={tackleRatio(us)} a={tackleRatio(them)} suffix="%" homeName={homeName} awayName={awayName} ratioColored />
          <KpiTile label="Turnovers" h={us.turnovers} a={them.turnovers} homeName={homeName} awayName={awayName} />
          <KpiTile label="Ballons perdus" h={us.ballsLost} a={them.ballsLost} reverse homeName={homeName} awayName={awayName} />
          <KpiTile label="Franchissements" h={us.lineBreaks} a={them.lineBreaks} homeName={homeName} awayName={awayName} />
          <KpiTile
            label="Pénalités"
            h={`${us.penaltiesMade}/${us.penaltiesAttempted}`}
            a={`${them.penaltiesMade}/${them.penaltiesAttempted}`}
            homeName={homeName}
            awayName={awayName}
          />
        </div>
      </div>

      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardContent className="p-3 sm:p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <span className="h-3 w-1 rounded-full bg-primary" />
              Détail (cumul)
            </h3>
          </div>

          <StatBlock title="Attaque" accent="emerald">
            <StatBar homeName={homeName} awayName={awayName} label="Transformations" h={us.conversionsMade} a={them.conversionsMade} hTotal={us.conversionsAttempted} aTotal={them.conversionsAttempted} kind="ratio" />
            <StatBar homeName={homeName} awayName={awayName} label="Pénalités (tirs)" h={us.penaltiesMade} a={them.penaltiesMade} hTotal={us.penaltiesAttempted} aTotal={them.penaltiesAttempted} kind="ratio" />
            <StatBar homeName={homeName} awayName={awayName} label="Drops" h={us.drops} a={them.drops} />
            <StatBar homeName={homeName} awayName={awayName} label="Mètres gagnés" h={us.meters} a={them.meters} suffix="m" />
          </StatBlock>

          <StatBlock title="Défense" accent="sky">
            <StatBar
              homeName={homeName} awayName={awayName}
              label="Plaquages"
              h={us.tackles} a={them.tackles}
              hTotal={us.tackles + us.missedTackles}
              aTotal={them.tackles + them.missedTackles}
              kind="ratio"
            />
          </StatBlock>

          <StatBlock title="Conquête" accent="amber">
            <StatBar homeName={homeName} awayName={awayName} label="Touches gagnées" h={us.lineoutsWon} a={them.lineoutsWon} hTotal={us.lineoutsWon + us.lineoutsLost} aTotal={them.lineoutsWon + them.lineoutsLost} kind="ratio" />
            <StatBar homeName={homeName} awayName={awayName} label="Mêlées gagnées" h={us.scrumsWon} a={them.scrumsWon} hTotal={us.scrumsWon + us.scrumsLost} aTotal={them.scrumsWon + them.scrumsLost} kind="ratio" />
          </StatBlock>

          <StatBlock title="Discipline" accent="rose">
            <StatBar homeName={homeName} awayName={awayName} label="Fautes commises" h={us.fouls} a={them.fouls} reverse />
            <StatBar homeName={homeName} awayName={awayName} label="Cartons jaunes" h={us.yellowCards} a={them.yellowCards} reverse />
            <StatBar homeName={homeName} awayName={awayName} label="Cartons rouges" h={us.redCards} a={them.redCards} reverse />

            <div className="mt-3 pt-3 border-t">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
                Comment chaque équipe a joué les fautes adverses
              </p>
              {/* Inversion h/a : sous la colonne d'une équipe, on montre comment ELLE a joué les fautes commises par l'adversaire. */}
              <StatBar homeName={homeName} awayName={awayName} label="↳ Tapées aux points" h={them.foulsByPlay.kick + them.foulsByPlay.points} a={us.foulsByPlay.kick + us.foulsByPlay.points} />
              <StatBar homeName={homeName} awayName={awayName} label="↳ Pénaltouche" h={them.foulsByPlay.penaltouche} a={us.foulsByPlay.penaltouche} />
              <StatBar homeName={homeName} awayName={awayName} label="↳ Jouées en mêlée" h={them.foulsByPlay.scrum} a={us.foulsByPlay.scrum} />
              <StatBar homeName={homeName} awayName={awayName} label="↳ Jouées à la main" h={them.foulsByPlay.quick} a={us.foulsByPlay.quick} />
              {(us.foulsByPlay.unknown > 0 || them.foulsByPlay.unknown > 0) && (
                <StatBar homeName={homeName} awayName={awayName} label="↳ Autre / non précisé" h={them.foulsByPlay.unknown} a={us.foulsByPlay.unknown} />
              )}
            </div>
          </StatBlock>
        </CardContent>
      </Card>
    </div>
  );
}
