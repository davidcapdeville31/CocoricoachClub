import { useMemo, useState } from "react";
import { useMatchEventsAnalytics, type MatchRow } from "@/hooks/analytics/useTeamSportsAnalytics";
import { computeMatchAnalytics, kickRatio, tackleRatio } from "@/lib/analytics/team-sports/eventAggregator";
import type { AnalyticsPeriod } from "@/lib/analytics/team-sports/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PeriodToggle } from "../shared/PeriodToggle";
import { KpiCard } from "../shared/KpiCard";
import { MomentumChart } from "../shared/MomentumChart";
import { EventTimeline } from "../shared/EventTimeline";
import { Trophy, Target, Shield, Activity, AlertTriangle, Hand } from "lucide-react";

interface Props {
  match: MatchRow;
}

export function GeneralTab({ match }: Props) {
  const [period, setPeriod] = useState<AnalyticsPeriod>("all");
  const { data: events = [], isLoading } = useMatchEventsAnalytics(match.id);
  const filtered = useMemo(
    () =>
      period === "all"
        ? events
        : events.filter(e => period === "H1" ? (e.period === "H1" || e.period === "HT") : (e.period === "H2" || e.period === "ET")),
    [events, period]
  );
  const analytics = useMemo(() => computeMatchAnalytics(events, period), [events, period]);
  const { home, away } = analytics;
  const homeLabel = match.is_home ? "Nous" : match.opponent;
  const awayLabel = match.is_home ? match.opponent : "Nous";

  if (isLoading) return <p className="text-sm text-muted-foreground py-8 text-center">Chargement…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <PeriodToggle value={period} onChange={setPeriod} />
        <div className="text-sm text-muted-foreground">
          {analytics.totalEvents} événement{analytics.totalEvents > 1 ? "s" : ""}
        </div>
      </div>

      {/* SCORE */}
      <Card className="rounded-2xl bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="p-6 flex items-center justify-around text-center">
          <div>
            <p className="text-xs uppercase text-muted-foreground">{homeLabel}</p>
            <p className="text-5xl font-bold">{home.points}</p>
          </div>
          <div className="text-3xl text-muted-foreground">—</div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">{awayLabel}</p>
            <p className="text-5xl font-bold">{away.points}</p>
          </div>
        </CardContent>
      </Card>

      {/* SECTIONS */}
      <Section title="Attaque" icon={<Trophy className="h-4 w-4" />}>
        <KpiCard label="Essais" value={`${home.tries} - ${away.tries}`} />
        <KpiCard label="Transformations" value={`${home.conversionsMade}/${home.conversionsAttempted} - ${away.conversionsMade}/${away.conversionsAttempted}`}
          sub={`${kickRatio(home.conversionsMade, home.conversionsAttempted)}% vs ${kickRatio(away.conversionsMade, away.conversionsAttempted)}%`} />
        <KpiCard label="Pénalités" value={`${home.penaltiesMade}/${home.penaltiesAttempted} - ${away.penaltiesMade}/${away.penaltiesAttempted}`} />
        <KpiCard label="Drops" value={`${home.drops} - ${away.drops}`} />
      </Section>

      <Section title="Défense" icon={<Shield className="h-4 w-4" />}>
        <KpiCard label="Plaquages réussis" value={`${home.tackles} - ${away.tackles}`} accent="success" />
        <KpiCard label="Plaquages manqués" value={`${home.missedTackles} - ${away.missedTackles}`} accent="danger" />
        <KpiCard label="Ratio plaquages" value={`${tackleRatio(home)}% - ${tackleRatio(away)}%`} />
      </Section>

      <Section title="Jeu" icon={<Activity className="h-4 w-4" />}>
        <KpiCard label="Turnovers" value={`${home.turnovers} - ${away.turnovers}`} />
        <KpiCard label="Ballons gagnés" value={`${home.ballsWon} - ${away.ballsWon}`} accent="success" />
        <KpiCard label="Ballons perdus" value={`${home.ballsLost} - ${away.ballsLost}`} accent="danger" />
        <KpiCard label="Mètres gagnés" value={`${home.meters} - ${away.meters}`} />
        <KpiCard label="Franchissements" value={`${home.lineBreaks} - ${away.lineBreaks}`} />
      </Section>

      <Section title="Discipline" icon={<AlertTriangle className="h-4 w-4" />}>
        <KpiCard label="Pénalités concédées" value={`${home.fouls} - ${away.fouls}`} accent="warning" />
        <KpiCard label="Cartons jaunes" value={`${home.yellowCards} - ${away.yellowCards}`} accent="warning" />
        <KpiCard label="Cartons rouges" value={`${home.redCards} - ${away.redCards}`} accent="danger" />
      </Section>

      <Section title="Conquête" icon={<Hand className="h-4 w-4" />}>
        <KpiCard label="Touches G/P" value={`${home.lineoutsWon}/${home.lineoutsLost} - ${away.lineoutsWon}/${away.lineoutsLost}`} />
        <KpiCard label="Mêlées G/P" value={`${home.scrumsWon}/${home.scrumsLost} - ${away.scrumsWon}/${away.scrumsLost}`} />
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Target className="h-4 w-4" /> Momentum</CardTitle></CardHeader>
          <CardContent>
            <MomentumChart data={analytics.momentum} homeLabel={homeLabel} awayLabel={awayLabel} />
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-sm">Timeline des événements</CardTitle></CardHeader>
          <CardContent>
            <EventTimeline events={filtered} homeLabel={homeLabel} awayLabel={awayLabel} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="flex items-center gap-2 text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
        {icon} {title}
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">{children}</div>
    </div>
  );
}
