import { useMemo, useState } from "react";
import { useMatchEventsAnalytics, useCategoryTeamName, type MatchRow } from "@/hooks/analytics/useTeamSportsAnalytics";
import { computeMatchAnalytics, kickRatio, tackleRatio } from "@/lib/analytics/team-sports/eventAggregator";
import { generateInsights, type Insight } from "@/lib/analytics/team-sports/insights";
import type { AnalyticsPeriod } from "@/lib/analytics/team-sports/types";
import { PeriodToggle } from "../shared/PeriodToggle";
import { EventTimeline } from "../shared/EventTimeline";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, AlertTriangle, Minus, MapPin, Trophy } from "lucide-react";
import { MatchEventPositionsDialog, type PositionStatKind } from "../MatchEventPositionsDialog";

interface Props {
  match: MatchRow;
  categoryId?: string;
}

/**
 * Renvoie une tonalité analytique en fonction d'un % (réussite ou possession).
 * - >=75% → success (vert)
 * - 60-74 → neutral
 * - 40-59 → warning (ambre)
 * - <40   → danger (rose)
 */
function ratioTone(pct: number | null, reverse = false): "success" | "warning" | "danger" | "neutral" {
  if (pct === null || isNaN(pct)) return "neutral";
  const v = reverse ? 100 - pct : pct;
  if (v >= 75) return "success";
  if (v >= 60) return "neutral";
  if (v >= 40) return "warning";
  return "danger";
}

const TONE_TEXT: Record<"success" | "warning" | "danger" | "neutral", string> = {
  success: "text-emerald-500",
  warning: "text-amber-500",
  danger: "text-rose-500",
  neutral: "text-foreground/80",
};

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

  const homeName = match.is_home ? ourName : match.opponent;
  const awayName = match.is_home ? match.opponent : ourName;

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
    : ourWin ? "text-emerald-400" : draw ? "text-muted-foreground" : "text-rose-400";

  return (
    <div className="space-y-4">
      {/* SECTION 1 — HEADER SCORE (plus impactant) */}
      <Card className="rounded-2xl overflow-hidden border-0 bg-gradient-to-br from-primary/15 via-surface to-surface shadow-lg ring-1 ring-primary/10">
        <CardContent className="p-5 sm:p-6 relative">
          {/* halo subtil sur le côté gagnant */}
          <div className={cn(
            "pointer-events-none absolute inset-y-0 w-1/2 opacity-40 blur-3xl",
            ourWin && match.is_home ? "left-0 bg-emerald-500/20" :
            ourWin && !match.is_home ? "right-0 bg-emerald-500/20" : "hidden"
          )} />
          <div className="relative flex items-center justify-between gap-3">
            <TeamSide name={homeName} score={home.points} winner={home.points > away.points} align="left" />
            <div className="flex flex-col items-center gap-2 shrink-0">
              <span className={cn(
                "text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full",
                ourWin ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30" :
                draw ? "bg-muted text-muted-foreground" :
                !match.is_finalized ? "bg-muted text-muted-foreground" :
                "bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/30",
              )}>
                {statusLabel}
              </span>
              <span className="text-base font-light text-muted-foreground/50">vs</span>
              <PeriodToggle value={period} onChange={setPeriod} />
            </div>
            <TeamSide name={awayName} score={away.points} winner={away.points > home.points} align="right" />
          </div>
        </CardContent>
      </Card>

      {/* SECTION 2 — LECTURE DU MATCH (insights) — bien plus visibles */}
      {insights.length > 0 && (
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2.5 px-1 flex items-center gap-2">
            <span className="h-3 w-1 rounded-full bg-primary" />
            Lecture du match
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {insights.slice(0, 4).map((i, idx) => <InsightCard key={idx} insight={i} />)}
          </div>
        </div>
      )}

      {/* SECTION 3 — KPIs PRINCIPAUX */}
      <div>
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2.5 px-1 flex items-center gap-2">
          <span className="h-3 w-1 rounded-full bg-primary" />
          Chiffres clés
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <KpiTile label="Essais" h={home.tries} a={away.tries} homeName={homeName} awayName={awayName} onShowPositions={() => setPosKind("try")} />
          <KpiTile label="Plaquages" h={tackleRatio(home)} a={tackleRatio(away)} suffix="%" homeName={homeName} awayName={awayName} ratioColored />
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

      {/* SECTION 4 — DÉTAIL */}
      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardContent className="p-3 sm:p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <span className="h-3 w-1 rounded-full bg-primary" />
              Détail
            </h3>
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
            <StatBar
              label="Plaquages"
              h={home.tackles} a={away.tackles}
              hTotal={home.tackles + home.missedTackles}
              aTotal={away.tackles + away.missedTackles}
              kind="ratio"
            />
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
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2.5 px-1 flex items-center gap-2">
          <span className="h-3 w-1 rounded-full bg-primary" />
          Déroulé du match
        </h3>
        <EventTimeline events={filtered} homeLabel={homeName} awayLabel={awayName} />
      </div>

      {posKind && (
        <MatchEventPositionsDialog
          open={!!posKind}
          onOpenChange={(o) => !o && setPosKind(null)}
          kind={posKind}
          events={events}
          homeName={homeName}
          awayName={awayName}
        />
      )}
    </div>
  );
}

function KpiTile({
  label, h, a, suffix = "", reverse = false, homeName, awayName, onShowPositions, ratioColored = false,
}: {
  label: string;
  h: number | string;
  a: number | string;
  suffix?: string;
  reverse?: boolean;
  homeName: string;
  awayName: string;
  onShowPositions?: () => void;
  /** Si true, on colore selon la qualité du % (vert/ambre/rouge) plutôt que selon la dominance */
  ratioColored?: boolean;
}) {
  const hNum = typeof h === "number" ? h : parseFloat(String(h).split("/")[0]) || 0;
  const aNum = typeof a === "number" ? a : parseFloat(String(a).split("/")[0]) || 0;
  const homeBetter = reverse ? hNum < aNum : hNum > aNum;
  const awayBetter = reverse ? aNum < hNum : aNum > hNum;
  const equal = hNum === aNum;
  const dominantSide: "h" | "a" | null = equal ? null : homeBetter ? "h" : "a";

  const hToneClass = ratioColored
    ? TONE_TEXT[ratioTone(hNum, reverse)]
    : !equal && homeBetter ? "text-primary" : "text-foreground/60";
  const aToneClass = ratioColored
    ? TONE_TEXT[ratioTone(aNum, reverse)]
    : !equal && awayBetter ? "text-primary" : "text-foreground/60";

  return (
    <div className={cn(
      "rounded-xl border bg-surface px-3 py-3 relative transition-all",
      "hover:border-primary/40 hover:shadow-md",
      dominantSide && "shadow-sm",
    )}>
      {/* Glow latéral discret côté dominant */}
      {dominantSide && (
        <div className={cn(
          "pointer-events-none absolute top-0 bottom-0 w-1 rounded-l-xl",
          dominantSide === "h" ? "left-0 bg-gradient-to-b from-primary/0 via-primary to-primary/0" : "right-0 bg-gradient-to-b from-primary/0 via-primary to-primary/0",
        )} />
      )}

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
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-center mb-2">
        {label}
      </p>
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col items-start min-w-0 flex-1">
          <span className="text-[9px] uppercase text-muted-foreground/70 truncate max-w-full font-medium">{homeName}</span>
          <span className={cn("text-2xl font-extrabold tabular-nums leading-none mt-0.5", hToneClass)}>
            {h}{suffix}
          </span>
        </div>
        <span className="text-muted-foreground/30 text-xs">·</span>
        <div className="flex flex-col items-end min-w-0 flex-1">
          <span className="text-[9px] uppercase text-muted-foreground/70 truncate max-w-full font-medium">{awayName}</span>
          <span className={cn("text-2xl font-extrabold tabular-nums leading-none mt-0.5", aToneClass)}>
            {a}{suffix}
          </span>
        </div>
      </div>
    </div>
  );
}

function TeamSide({ name, score, winner, align }: { name: string; score: number; winner: boolean; align: "left" | "right" }) {
  return (
    <div className={cn("flex-1 min-w-0", align === "right" && "text-right")}>
      <p className={cn(
        "text-xs font-semibold uppercase tracking-wider truncate flex items-center gap-1.5",
        align === "right" && "justify-end",
        winner ? "text-foreground" : "text-muted-foreground"
      )}>
        {winner && <Trophy className="h-3 w-3 text-emerald-400" />}
        {name}
      </p>
      <p className={cn(
        "text-6xl sm:text-7xl font-black tabular-nums leading-none mt-1 transition-all",
        winner ? "text-foreground drop-shadow-[0_0_18px_hsl(var(--primary)/0.45)]" : "text-foreground/30",
      )}>
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
  kind?: "count" | "ratio";
  reverse?: boolean;
  suffix?: string;
  onShowPositions?: () => void;
}) {
  const isRatio = kind === "ratio";
  const centerPct = isRatio
    ? (((hTotal || 0) + (aTotal || 0)) > 0
        ? ((h + a) / ((hTotal || 0) + (aTotal || 0))) * 100
        : null)
    : (h + a > 0 ? (h / (h + a)) * 100 : null);

  const homeBetter = reverse ? h < a : h > a;
  const awayBetter = reverse ? a < h : a > h;
  const equal = h === a;

  const hLabel = isRatio ? `${h}/${hTotal ?? 0}` : `${h}${suffix}`;
  const aLabel = isRatio ? `${a}/${aTotal ?? 0}` : `${a}${suffix}`;

  const hHasData = isRatio ? (hTotal ?? 0) > 0 : (h !== 0 || a !== 0);
  const aHasData = isRatio ? (aTotal ?? 0) > 0 : (h !== 0 || a !== 0);

  // Tonalité analytique du % (uniquement quand kind === "ratio" — c'est un % de réussite)
  const pctTone: "success" | "warning" | "danger" | "neutral" =
    !isRatio || centerPct === null
      ? "neutral"
      : centerPct >= 75 ? "success"
      : centerPct >= 60 ? "neutral"
      : centerPct >= 40 ? "warning"
      : "danger";

  const PCT_TONE: Record<typeof pctTone, { text: string; bg: string; ring: string; glow: string }> = {
    success: { text: "text-emerald-500", bg: "bg-emerald-500/10", ring: "ring-emerald-500/30", glow: "drop-shadow-[0_0_8px_hsl(160_84%_45%/0.55)]" },
    warning: { text: "text-amber-500",   bg: "bg-amber-500/10",   ring: "ring-amber-500/30",   glow: "drop-shadow-[0_0_8px_hsl(38_92%_55%/0.5)]" },
    danger:  { text: "text-rose-500",    bg: "bg-rose-500/10",    ring: "ring-rose-500/30",    glow: "drop-shadow-[0_0_8px_hsl(350_84%_55%/0.5)]" },
    neutral: { text: "text-muted-foreground", bg: "bg-muted/40", ring: "ring-border", glow: "" },
  };
  const pt = PCT_TONE[pctTone];
  const hasPct = centerPct !== null;
  const interactive = !!onShowPositions;

  const rowContent = (
    <>
      {/* En-tête : label + chip "Terrain" si interactif */}
      <div className="flex items-center justify-center gap-1.5 mb-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-center whitespace-nowrap">
          {label}
        </span>
        {interactive && (
          <span
            className={cn(
              "inline-flex items-center gap-1 px-1.5 h-[18px] rounded-md text-[9px] font-bold uppercase tracking-wider",
              "bg-primary/10 text-primary ring-1 ring-primary/30",
              "group-hover:bg-primary group-hover:text-primary-foreground group-hover:ring-primary",
              "transition-colors",
            )}
          >
            <MapPin className="h-2.5 w-2.5" />
            Terrain
          </span>
        )}
      </div>

      {/* Valeurs : home — % central proéminent — away */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <span className={cn(
          "text-base font-extrabold tabular-nums leading-none text-left",
          !equal && homeBetter ? "text-primary" : hHasData ? "text-foreground/70" : "text-foreground/30",
        )}>{hLabel}</span>

        {/* % central : grand, lumineux, codé couleur quand kind=ratio */}
        {hasPct ? (
          <span className={cn(
            "inline-flex items-center justify-center min-w-[44px] px-1.5 py-0.5 rounded-md tabular-nums font-extrabold leading-none ring-1 transition-transform",
            isRatio ? "text-base" : "text-xs",
            pt.text, pt.bg, pt.ring,
            isRatio && pctTone !== "neutral" && pt.glow,
          )}>
            {Math.round(centerPct)}%
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/60 text-center font-bold">—</span>
        )}

        <span className={cn(
          "text-base font-extrabold tabular-nums leading-none text-right",
          !equal && awayBetter ? "text-primary" : aHasData ? "text-foreground/70" : "text-foreground/30",
        )}>{aLabel}</span>
      </div>
    </>
  );

  const baseClass = cn(
    "group rounded-lg px-2.5 py-2 border transition-all",
    interactive
      ? "bg-surface-sunken/60 border-border/50 hover:bg-surface-elevated hover:border-primary/50 hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.25),0_4px_16px_-6px_hsl(var(--primary)/0.35)] cursor-pointer"
      : "bg-surface-sunken/50 border-border/40 hover:border-border/80",
  );

  if (interactive) {
    return (
      <button
        type="button"
        onClick={onShowPositions}
        className={cn(baseClass, "w-full text-left")}
        title="Voir les positions sur le terrain"
      >
        {rowContent}
      </button>
    );
  }
  return <div className={baseClass}>{rowContent}</div>;
}

const BLOCK_ACCENTS: Record<string, { dot: string; text: string; bar: string; bg: string; hover: string }> = {
  emerald: { dot: "bg-emerald-500", text: "text-emerald-500", bar: "bg-emerald-500", bg: "from-emerald-500/[0.07]", hover: "hover:from-emerald-500/[0.12]" },
  sky:     { dot: "bg-sky-500",     text: "text-sky-500",     bar: "bg-sky-500",     bg: "from-sky-500/[0.07]",     hover: "hover:from-sky-500/[0.12]" },
  amber:   { dot: "bg-amber-500",   text: "text-amber-500",   bar: "bg-amber-500",   bg: "from-amber-500/[0.07]",   hover: "hover:from-amber-500/[0.12]" },
  rose:    { dot: "bg-rose-500",    text: "text-rose-500",    bar: "bg-rose-500",    bg: "from-rose-500/[0.07]",    hover: "hover:from-rose-500/[0.12]" },
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
    <div className={cn(
      "relative rounded-xl border border-border/60 bg-gradient-to-br to-surface-elevated/40 p-2.5 overflow-hidden transition-colors",
      tone.bg, tone.hover,
    )}>
      <div className={cn("absolute left-0 top-0 bottom-0 w-0.5 shadow-[0_0_8px_currentColor]", tone.bar, tone.text)} />
      <div className="flex items-center gap-1.5 mb-2 px-1">
        <span className={cn("h-2 w-2 rounded-full shadow-[0_0_8px_currentColor]", tone.dot, tone.text)} />
        <h4 className={cn("text-[11px] font-bold uppercase tracking-wider", tone.text)}>
          {title}
        </h4>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {children}
      </div>
    </div>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const TONE: Record<Insight["tone"], { bg: string; border: string; ring: string; icon: JSX.Element; text: string; iconBg: string }> = {
    positive: {
      bg: "bg-gradient-to-br from-emerald-500/10 to-emerald-500/5",
      border: "border-emerald-500/40",
      ring: "shadow-[0_0_24px_-8px_hsl(160_84%_45%/0.5)]",
      icon: <TrendingUp className="h-4 w-4" />,
      text: "text-emerald-500 dark:text-emerald-400",
      iconBg: "bg-emerald-500/15",
    },
    negative: {
      bg: "bg-gradient-to-br from-rose-500/10 to-rose-500/5",
      border: "border-rose-500/40",
      ring: "shadow-[0_0_24px_-8px_hsl(350_84%_55%/0.5)]",
      icon: <TrendingDown className="h-4 w-4" />,
      text: "text-rose-500 dark:text-rose-400",
      iconBg: "bg-rose-500/15",
    },
    warning: {
      bg: "bg-gradient-to-br from-amber-500/10 to-amber-500/5",
      border: "border-amber-500/40",
      ring: "shadow-[0_0_24px_-8px_hsl(38_92%_55%/0.5)]",
      icon: <AlertTriangle className="h-4 w-4" />,
      text: "text-amber-500 dark:text-amber-400",
      iconBg: "bg-amber-500/15",
    },
    neutral: {
      bg: "bg-surface-sunken",
      border: "border-border",
      ring: "",
      icon: <Minus className="h-4 w-4" />,
      text: "text-muted-foreground",
      iconBg: "bg-muted",
    },
  };
  const t = TONE[insight.tone];
  return (
    <div className={cn(
      "rounded-xl border-2 px-3.5 py-3 flex items-start gap-3 transition-all hover:scale-[1.01]",
      t.bg, t.border, t.ring,
    )}>
      <span className={cn("shrink-0 h-8 w-8 rounded-lg flex items-center justify-center", t.iconBg, t.text)}>
        {t.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-bold leading-tight", t.text)}>{insight.title}</p>
        {insight.detail && <p className="text-xs text-muted-foreground mt-1 leading-snug">{insight.detail}</p>}
      </div>
    </div>
  );
}
