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

  const diff = us.points - them.points;
  const statusLabel = !match.is_finalized
    ? "En cours"
    : ourWin ? `Victoire +${diff}` : draw ? "Match nul" : `Défaite ${diff}`;
  const statusTone = !match.is_finalized
    ? "text-muted-foreground"
    : ourWin ? "text-emerald-500" : draw ? "text-muted-foreground" : "text-red-500";

  return (
    <div className="space-y-3">
      {/* SECTION 1 — HEADER SCORE */}
      <Card className="rounded-2xl overflow-hidden border-0 bg-gradient-to-br from-primary/10 via-surface to-surface">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <TeamSide name={homeName} score={home.points} winner={home.points > away.points} align="left" />
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <span className={cn("text-[10px] font-semibold uppercase tracking-widest", statusTone)}>
                {statusLabel}
              </span>
              <span className="text-xl font-light text-muted-foreground/60">vs</span>
              <PeriodToggle value={period} onChange={setPeriod} />
            </div>
            <TeamSide name={awayName} score={away.points} winner={away.points > home.points} align="right" />
          </div>
        </CardContent>
      </Card>

      {/* SECTION 2 — LECTURE DU MATCH (insights) */}
      {insights.length > 0 && (
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
            Lecture du match
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {insights.slice(0, 4).map((i, idx) => <InsightCard key={idx} insight={i} />)}
          </div>
        </div>
      )}

      {/* SECTION 3 — KPIs PRINCIPAUX (compact grid, no bars) */}
      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
          Chiffres clés
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <KpiTile label="Essais" h={home.tries} a={away.tries} homeName={homeName} awayName={awayName} />
          <KpiTile label="Plaquages" h={tackleRatio(home)} a={tackleRatio(away)} suffix="%" homeName={homeName} awayName={awayName} />
          <KpiTile label="Turnovers" h={home.turnovers} a={away.turnovers} homeName={homeName} awayName={awayName} />
          <KpiTile label="Ballons perdus" h={home.ballsLost} a={away.ballsLost} reverse homeName={homeName} awayName={awayName} />
          <KpiTile label="Franchissements" h={home.lineBreaks} a={away.lineBreaks} homeName={homeName} awayName={awayName} />
          <KpiTile
            label="Pénalités"
            h={`${home.penaltiesMade}/${home.penaltiesAttempted}`}
            a={`${away.penaltiesMade}/${away.penaltiesAttempted}`}
            homeName={homeName}
            awayName={awayName}
          />
        </div>
      </div>

      {/* SECTION 4 — DÉTAIL */}
      <Card className="rounded-2xl">
        <CardContent className="p-0">
          <div className="px-4 pt-3 pb-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Détail</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-muted-foreground border-y bg-surface-sunken/50">
                <th className="text-left font-medium px-4 py-1.5">Statistique</th>
                <th className="text-right font-medium px-3 py-1.5 truncate max-w-[120px]">{homeName}</th>
                <th className="text-right font-medium px-4 py-1.5 truncate max-w-[120px]">{awayName}</th>
              </tr>
            </thead>
            <tbody className="[&>tr:nth-child(odd)]:bg-surface-sunken/30">
              <Row label="Plaquages réussis" h={home.tackles} a={away.tackles} />
              <Row label="Plaquages manqués" h={home.missedTackles} a={away.missedTackles} reverse />
              <Row label="Transformations" h={`${home.conversionsMade}/${home.conversionsAttempted}`} a={`${away.conversionsMade}/${away.conversionsAttempted}`} />
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

      {/* SECTION 5 — TIMELINE */}
      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
          Déroulé du match
        </h3>
        <EventTimeline events={filtered} homeLabel={homeName} awayLabel={awayName} />
      </div>
    </div>
  );
}

function KpiTile({
  label, h, a, suffix = "", reverse = false, homeName, awayName,
}: {
  label: string;
  h: number | string;
  a: number | string;
  suffix?: string;
  reverse?: boolean;
  homeName: string;
  awayName: string;
}) {
  const hNum = typeof h === "number" ? h : parseFloat(String(h).split("/")[0]) || 0;
  const aNum = typeof a === "number" ? a : parseFloat(String(a).split("/")[0]) || 0;
  const homeBetter = reverse ? hNum < aNum : hNum > aNum;
  const awayBetter = reverse ? aNum < hNum : aNum > hNum;
  const equal = hNum === aNum;
  return (
    <div className="rounded-xl border bg-surface px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-center mb-1.5">
        {label}
      </p>
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col items-start min-w-0 flex-1">
          <span className="text-[9px] uppercase text-muted-foreground/70 truncate max-w-full">{homeName}</span>
          <span className={cn(
            "text-lg font-bold tabular-nums leading-none",
            !equal && homeBetter ? "text-primary" : "text-foreground/70"
          )}>{h}{suffix}</span>
        </div>
        <span className="text-muted-foreground/40 text-xs">·</span>
        <div className="flex flex-col items-end min-w-0 flex-1">
          <span className="text-[9px] uppercase text-muted-foreground/70 truncate max-w-full">{awayName}</span>
          <span className={cn(
            "text-lg font-bold tabular-nums leading-none",
            !equal && awayBetter ? "text-primary" : "text-foreground/70"
          )}>{a}{suffix}</span>
        </div>
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
