import { useMemo, useState } from "react";
import { useMatchEventsAnalytics, useCategoryTeamName, type MatchRow } from "@/hooks/analytics/useTeamSportsAnalytics";
import { computeMatchAnalytics, kickRatio, tackleRatio } from "@/lib/analytics/team-sports/eventAggregator";
import { generateInsights, type Insight } from "@/lib/analytics/team-sports/insights";
import type { AnalyticsPeriod } from "@/lib/analytics/team-sports/types";
import { PeriodToggle } from "../shared/PeriodToggle";
import { EventTimeline } from "../shared/EventTimeline";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, AlertTriangle, Minus } from "lucide-react";

interface Props {
  match: MatchRow;
  categoryId?: string;
}

export function GeneralTab({ match, categoryId }: Props) {
  const [period, setPeriod] = useState<AnalyticsPeriod>("all");
  const { data: events = [], isLoading } = useMatchEventsAnalytics(match.id);
  const { data: ourName = "Notre équipe" } = useCategoryTeamName(categoryId || "");

  const filtered = useMemo(
    () =>
      period === "all"
        ? events
        : events.filter(e => period === "H1" ? (e.period === "H1" || e.period === "HT") : (e.period === "H2" || e.period === "ET")),
    [events, period]
  );
  const analytics = useMemo(() => computeMatchAnalytics(events, period), [events, period]);
  const { home, away } = analytics;

  // Map team names: home/away on the field
  const homeName = match.is_home ? ourName : match.opponent;
  const awayName = match.is_home ? match.opponent : ourName;

  // Insights are generated for "us" — flip if we are away
  const us = match.is_home ? home : away;
  const them = match.is_home ? away : home;
  const insights = useMemo(() => generateInsights(us, them, ourName, match.opponent), [us, them, ourName, match.opponent]);

  if (isLoading) return <p className="text-sm text-muted-foreground py-8 text-center">Chargement…</p>;

  const ourWin = us.points > them.points;
  const draw = us.points === them.points;

  return (
    <div className="space-y-4">
      {/* HEADER — Score */}
      <Card className="rounded-2xl overflow-hidden border-0 bg-gradient-to-br from-primary/10 via-surface to-surface">
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-4">
            <TeamSide name={homeName} score={home.points} winner={home.points > away.points} align="left" />
            <div className="flex flex-col items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {match.is_finalized ? "Terminé" : "En cours"}
              </span>
              <span className="text-2xl font-light text-muted-foreground">—</span>
              <PeriodToggle value={period} onChange={setPeriod} />
            </div>
            <TeamSide name={awayName} score={away.points} winner={away.points > home.points} align="right" />
          </div>
        </CardContent>
      </Card>

      {/* MAIN KPIs — versus row */}
      <Card className="rounded-2xl">
        <CardContent className="p-4 space-y-3">
          <VsRow label="Essais" home={home.tries} away={away.tries} highlightHome={match.is_home} />
          <VsRow label="Ratio plaquages" home={tackleRatio(home)} away={tackleRatio(away)} suffix="%" highlightHome={match.is_home} />
          <VsRow label="Turnovers" home={home.turnovers} away={away.turnovers} highlightHome={match.is_home} />
          <VsRow label="Ballons perdus" home={home.ballsLost} away={away.ballsLost} reverse highlightHome={match.is_home} />
          <VsRow label="Franchissements" home={home.lineBreaks} away={away.lineBreaks} highlightHome={match.is_home} />
          <VsRow
            label="Pénalités tentées"
            home={`${home.penaltiesMade}/${home.penaltiesAttempted}`}
            away={`${away.penaltiesMade}/${away.penaltiesAttempted}`}
            highlightHome={match.is_home}
          />
        </CardContent>
      </Card>

      {/* INSIGHTS */}
      {insights.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
            Lecture du match — {ourName}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {insights.map((i, idx) => <InsightCard key={idx} insight={i} />)}
          </div>
        </div>
      )}

      {/* DETAILS TABLE */}
      <Card className="rounded-2xl">
        <CardContent className="p-0">
          <div className="px-4 pt-3 pb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Détail</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-muted-foreground border-y bg-surface-sunken/50">
                <th className="text-left font-medium px-4 py-1.5">Statistique</th>
                <th className="text-right font-medium px-3 py-1.5 truncate max-w-[120px]">{homeName}</th>
                <th className="text-right font-medium px-4 py-1.5 truncate max-w-[120px]">{awayName}</th>
              </tr>
            </thead>
            <tbody className="[&>tr:nth-child(odd)]:bg-surface-sunken/30">
              <Row label="Plaquages réussis" h={home.tackles} a={away.tackles} />
              <Row label="Plaquages manqués" h={home.missedTackles} a={away.missedTackles} reverse />
              <Row label="Transformations" h={`${home.conversionsMade}/${home.conversionsAttempted}`} a={`${away.conversionsMade}/${away.conversionsAttempted}`} sub={`${kickRatio(home.conversionsMade, home.conversionsAttempted)}% / ${kickRatio(away.conversionsMade, away.conversionsAttempted)}%`} />
              <Row label="Drops" h={home.drops} a={away.drops} />
              <Row label="Mètres gagnés" h={home.meters} a={away.meters} />
              <Row label="Touches G/P" h={`${home.lineoutsWon}/${home.lineoutsLost}`} a={`${away.lineoutsWon}/${away.lineoutsLost}`} />
              <Row label="Mêlées G/P" h={`${home.scrumsWon}/${home.scrumsLost}`} a={`${away.scrumsWon}/${away.scrumsLost}`} />
              <Row label="Pénalités concédées" h={home.fouls} a={away.fouls} reverse />
              <Row label="Cartons jaunes" h={home.yellowCards} a={away.yellowCards} reverse />
              <Row label="Cartons rouges" h={home.redCards} a={away.redCards} reverse />
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* TIMELINE */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
          Déroulé du match
        </h3>
        <EventTimeline events={filtered} homeLabel={homeName} awayLabel={awayName} />
      </div>
    </div>
  );
}

function TeamSide({ name, score, winner, align }: { name: string; score: number; winner: boolean; align: "left" | "right" }) {
  return (
    <div className={cn("flex-1 min-w-0", align === "right" && "text-right")}>
      <p className="text-xs font-medium text-muted-foreground truncate">{name}</p>
      <p className={cn("text-5xl font-bold tabular-nums leading-tight", winner ? "text-primary" : "text-foreground/80")}>
        {score}
      </p>
    </div>
  );
}

function VsRow({
  label, home, away, suffix = "", reverse = false, highlightHome,
}: {
  label: string;
  home: number | string;
  away: number | string;
  suffix?: string;
  /** if true, lower is better */
  reverse?: boolean;
  highlightHome: boolean | null;
}) {
  const hNum = typeof home === "number" ? home : parseFloat(String(home).split("/")[0]) || 0;
  const aNum = typeof away === "number" ? away : parseFloat(String(away).split("/")[0]) || 0;
  const homeBetter = reverse ? hNum < aNum : hNum > aNum;
  const awayBetter = reverse ? aNum < hNum : aNum > hNum;
  const total = Math.max(1, hNum + aNum);
  const homePct = (hNum / total) * 100;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className={cn("font-semibold tabular-nums w-14 text-left", homeBetter && "text-primary")}>
          {home}{suffix}
        </span>
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className={cn("font-semibold tabular-nums w-14 text-right", awayBetter && "text-primary")}>
          {away}{suffix}
        </span>
      </div>
      <div className="flex h-1 rounded-full overflow-hidden bg-surface-sunken">
        <div className="bg-primary/70" style={{ width: `${homePct}%` }} />
        <div className="bg-destructive/50 flex-1" />
      </div>
    </div>
  );
}

function Row({ label, h, a, sub, reverse = false }: { label: string; h: number | string; a: number | string; sub?: string; reverse?: boolean }) {
  const hNum = typeof h === "number" ? h : parseFloat(String(h).split("/")[0]) || 0;
  const aNum = typeof a === "number" ? a : parseFloat(String(a).split("/")[0]) || 0;
  const homeBetter = reverse ? hNum < aNum : hNum > aNum;
  const awayBetter = reverse ? aNum < hNum : aNum > hNum;
  return (
    <tr className="border-b last:border-0">
      <td className="px-4 py-1.5 text-muted-foreground">{label}</td>
      <td className={cn("px-3 py-1.5 text-right tabular-nums font-medium", homeBetter && "text-primary")}>{h}</td>
      <td className={cn("px-4 py-1.5 text-right tabular-nums font-medium", awayBetter && "text-primary")}>{a}</td>
    </tr>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const TONE: Record<Insight["tone"], { bg: string; border: string; icon: JSX.Element; text: string }> = {
    positive: { bg: "bg-emerald-500/5", border: "border-emerald-500/30", icon: <TrendingUp className="h-4 w-4" />, text: "text-emerald-600 dark:text-emerald-400" },
    negative: { bg: "bg-red-500/5", border: "border-red-500/30", icon: <TrendingDown className="h-4 w-4" />, text: "text-red-600 dark:text-red-400" },
    warning: { bg: "bg-amber-500/5", border: "border-amber-500/30", icon: <AlertTriangle className="h-4 w-4" />, text: "text-amber-600 dark:text-amber-400" },
    neutral: { bg: "bg-surface-sunken", border: "border-border", icon: <Minus className="h-4 w-4" />, text: "text-muted-foreground" },
  };
  const t = TONE[insight.tone];
  return (
    <div className={cn("rounded-xl border px-3 py-2.5 flex items-start gap-2.5", t.bg, t.border)}>
      <span className={cn("mt-0.5", t.text)}>{t.icon}</span>
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-tight">{insight.title}</p>
        {insight.detail && <p className="text-xs text-muted-foreground mt-0.5">{insight.detail}</p>}
      </div>
    </div>
  );
}
