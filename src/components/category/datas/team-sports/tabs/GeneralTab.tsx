import { useMemo, useState } from "react";
import { useMatchEventsAnalytics, useCategoryTeamName, type MatchRow } from "@/hooks/analytics/useTeamSportsAnalytics";
import { computeMatchAnalytics, kickRatio, tackleRatio } from "@/lib/analytics/team-sports/eventAggregator";
import { generateInsights, type Insight } from "@/lib/analytics/team-sports/insights";
import type { AnalyticsPeriod } from "@/lib/analytics/team-sports/types";
import { PeriodToggle } from "../shared/PeriodToggle";
import { EventTimeline } from "../shared/EventTimeline";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, AlertTriangle, Minus, MapPin } from "lucide-react";
import { MatchEventPositionsDialog, type PositionStatKind } from "../MatchEventPositionsDialog";

interface Props {
  match: MatchRow;
  categoryId?: string;
}

export function GeneralTab({ match, categoryId }: Props) {
  const [period, setPeriod] = useState<AnalyticsPeriod>("all");
  const [posKind, setPosKind] = useState<PositionStatKind | null>(null);
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
          <KpiTile label="Essais" h={home.tries} a={away.tries} homeName={homeName} awayName={awayName} onShowPositions={() => setPosKind("try")} />
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
            onShowPositions={() => setPosKind("penalty_kick")}
          />
        </div>
      </div>

      {/* SECTION 4 — DÉTAIL par thème */}
      <Card className="rounded-2xl">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Détail</h3>
            <div className="hidden sm:flex items-center gap-4 text-[10px] uppercase tracking-wider text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary inline-block" />{homeName}</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-foreground/30 inline-block" />{awayName}</span>
            </div>
          </div>

          <StatBlock title="Attaque" accent="emerald">
            <StatBar label="Transformations" h={home.conversionsMade} a={away.conversionsMade} hTotal={home.conversionsAttempted} aTotal={away.conversionsAttempted} kind="ratio" onShowPositions={() => setPosKind("conversion")} />
            <StatBar label="Pénalités (tirs)" h={home.penaltiesMade} a={away.penaltiesMade} hTotal={home.penaltiesAttempted} aTotal={away.penaltiesAttempted} kind="ratio" onShowPositions={() => setPosKind("penalty_kick")} />
            <StatBar label="Drops" h={home.drops} a={away.drops} onShowPositions={() => setPosKind("drop")} />
            <StatBar label="Mètres gagnés" h={home.meters} a={away.meters} suffix="m" />
          </StatBlock>

          <StatBlock title="Défense" accent="sky">
            <StatBar label="Plaquages réussis" h={home.tackles} a={away.tackles} />
            <StatBar label="Plaquages manqués" h={home.missedTackles} a={away.missedTackles} reverse />
          </StatBlock>

          <StatBlock title="Conquête" accent="amber">
            <StatBar label="Touches gagnées" h={home.lineoutsWon} a={away.lineoutsWon} hTotal={home.lineoutsWon + home.lineoutsLost} aTotal={away.lineoutsWon + away.lineoutsLost} kind="ratio" onShowPositions={() => setPosKind("lineout")} />
            <StatBar label="Mêlées gagnées" h={home.scrumsWon} a={away.scrumsWon} hTotal={home.scrumsWon + home.scrumsLost} aTotal={away.scrumsWon + away.scrumsLost} kind="ratio" onShowPositions={() => setPosKind("scrum")} />
          </StatBlock>

          <StatBlock title="Discipline" accent="rose">
            <StatBar label="Pénalités concédées" h={home.fouls} a={away.fouls} reverse />
            <StatBar label="Cartons jaunes" h={home.yellowCards} a={away.yellowCards} reverse />
            <StatBar label="Cartons rouges" h={home.redCards} a={away.redCards} reverse />
          </StatBlock>
        </CardContent>
      </Card>

      {/* SECTION 5 — TIMELINE */}
      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
          Déroulé du match
        </h3>
        <EventTimeline events={filtered} homeLabel={homeName} awayLabel={awayName} />
      </div>

      {posKind && (
        <MatchEventPositionsDialog
          open={!!posKind}
          onOpenChange={(o) => !o && setPosKind(null)}
          kind={posKind}
          events={filtered}
          homeName={homeName}
          awayName={awayName}
        />
      )}
    </div>
  );
}

function KpiTile({
  label, h, a, suffix = "", reverse = false, homeName, awayName, onShowPositions,
}: {
  label: string;
  h: number | string;
  a: number | string;
  suffix?: string;
  reverse?: boolean;
  homeName: string;
  awayName: string;
  onShowPositions?: () => void;
}) {
  const hNum = typeof h === "number" ? h : parseFloat(String(h).split("/")[0]) || 0;
  const aNum = typeof a === "number" ? a : parseFloat(String(a).split("/")[0]) || 0;
  const homeBetter = reverse ? hNum < aNum : hNum > aNum;
  const awayBetter = reverse ? aNum < hNum : aNum > hNum;
  const equal = hNum === aNum;
  return (
    <div className="rounded-xl border bg-surface px-3 py-2.5 relative">
      {onShowPositions && (
        <button
          type="button"
          onClick={onShowPositions}
          className="absolute top-1.5 right-1.5 p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
          title="Voir les positions sur le terrain"
        >
          <MapPin className="h-3 w-3" />
        </button>
      )}
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

function StatBar({
  label, h, a, hTotal, aTotal, kind = "count", reverse = false, suffix = "", onShowPositions,
}: {
  label: string;
  h: number;
  a: number;
  hTotal?: number;
  aTotal?: number;
  /** "count" => % part de chaque équipe sur le total ; "ratio" => % de réussite */
  kind?: "count" | "ratio";
  reverse?: boolean;
  suffix?: string;
  onShowPositions?: () => void;
}) {
  const isRatio = kind === "ratio";
  const hPct = isRatio
    ? (hTotal && hTotal > 0 ? (h / hTotal) * 100 : 0)
    : (h + a > 0 ? (h / (h + a)) * 100 : 50);
  const aPct = isRatio
    ? (aTotal && aTotal > 0 ? (a / aTotal) * 100 : 0)
    : 100 - hPct;
  const homeBetter = reverse ? h < a : h > a;
  const awayBetter = reverse ? a < h : a > h;
  const equal = h === a;

  const hLabel = isRatio ? `${h}/${hTotal ?? 0}` : `${h}${suffix}`;
  const aLabel = isRatio ? `${a}/${aTotal ?? 0}` : `${a}${suffix}`;

  return (
    <div className="rounded-xl bg-surface-sunken/40 px-3 py-2">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        {/* Home value */}
        <div className="flex flex-col items-end">
          <span className={cn(
            "text-base font-bold tabular-nums leading-none",
            !equal && homeBetter ? "text-primary" : "text-foreground/80"
          )}>{hLabel}</span>
          <span className="text-[10px] tabular-nums text-muted-foreground mt-0.5">
            {Math.round(hPct)}%
          </span>
        </div>
        {/* Label */}
        <div className="flex items-center justify-center gap-1">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground text-center whitespace-nowrap">
            {label}
          </span>
          {onShowPositions && (
            <button
              type="button"
              onClick={onShowPositions}
              className="p-0.5 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              title="Voir les positions sur le terrain"
            >
              <MapPin className="h-3 w-3" />
            </button>
          )}
        </div>
        {/* Away value */}
        <div className="flex flex-col items-start">
          <span className={cn(
            "text-base font-bold tabular-nums leading-none",
            !equal && awayBetter ? "text-primary" : "text-foreground/80"
          )}>{aLabel}</span>
          <span className="text-[10px] tabular-nums text-muted-foreground mt-0.5">
            {Math.round(aPct)}%
          </span>
        </div>
      </div>
      {/* Bar */}
      <div className="mt-2 flex items-center gap-1 h-1.5">
        <div className="flex-1 flex justify-end">
          <div
            className={cn("h-full rounded-l-full transition-all", !equal && homeBetter ? "bg-primary" : "bg-foreground/40")}
            style={{ width: `${isRatio ? hPct : hPct}%` }}
          />
        </div>
        <div className="flex-1">
          <div
            className={cn("h-full rounded-r-full transition-all", !equal && awayBetter ? "bg-primary" : "bg-foreground/40")}
            style={{ width: `${isRatio ? aPct : aPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

const BLOCK_ACCENTS: Record<string, { dot: string; text: string }> = {
  emerald: { dot: "bg-emerald-500", text: "text-emerald-500" },
  sky: { dot: "bg-sky-500", text: "text-sky-500" },
  amber: { dot: "bg-amber-500", text: "text-amber-500" },
  rose: { dot: "bg-rose-500", text: "text-rose-500" },
};

function StatBlock({
  title,
  accent,
  children,
}: {
  title: string;
  accent: keyof typeof BLOCK_ACCENTS;
  children: React.ReactNode;
}) {
  const tone = BLOCK_ACCENTS[accent];
  return (
    <div className="rounded-xl border border-border/60 bg-surface-elevated/40 p-3">
      <div className="flex items-center gap-2 mb-2.5 px-1">
        <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} />
        <h4 className={cn("text-[11px] font-semibold uppercase tracking-wider", tone.text)}>
          {title}
        </h4>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {children}
      </div>
    </div>
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
