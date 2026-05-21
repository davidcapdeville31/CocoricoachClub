import { useMemo } from "react";
import type { TeamStats } from "../live/hooks/useMatchStats";
import type { MatchEvent } from "../live/types";
import { computePossession } from "@/lib/analytics/team-sports/possession";
import { StatKpiCard } from "./StatKpiCard";
import {
  Trophy,
  Target,
  Crosshair,
  Shield,
  Swords,
  Hand,
  Activity,
  AlertTriangle,
  Square,
  ChevronsRight,
  PieChart,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  home: TeamStats;
  away: TeamStats;
  homeName: string;
  awayName: string;
  clubSide: "home" | "away";
  events?: MatchEvent[];
}

const pct = (a: number, b: number) => {
  const t = a + b;
  return t > 0 ? Math.round((a / t) * 100) : 0;
};
const pctMade = (m: number, a: number) => (a > 0 ? Math.round((m / a) * 100) : 0);

function CompareBar({
  label,
  hValue,
  aValue,
  hDisplay,
  aDisplay,
  highlight,
}: {
  label: string;
  hValue: number;
  aValue: number;
  hDisplay?: string;
  aDisplay?: string;
  highlight?: "home" | "away" | null;
}) {
  const total = Math.max(hValue + aValue, 1);
  const hPct = (hValue / total) * 100;
  const aPct = (aValue / total) * 100;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span
          className={cn(
            "font-mono font-bold tabular-nums",
            highlight === "home" ? "text-brand-500" : "text-foreground",
          )}
        >
          {hDisplay ?? hValue}
        </span>
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span
          className={cn(
            "font-mono font-bold tabular-nums",
            highlight === "away" ? "text-brand-500" : "text-foreground",
          )}
        >
          {aDisplay ?? aValue}
        </span>
      </div>
      <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-l-full transition-all",
            highlight === "home" ? "bg-brand-500" : "bg-brand-500/60",
          )}
          style={{ width: `${hPct}%` }}
        />
        <div
          className={cn(
            "h-full rounded-r-full transition-all",
            highlight === "away" ? "bg-accent" : "bg-accent/60",
          )}
          style={{ width: `${aPct}%` }}
        />
      </div>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: any;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
          {title}
        </h3>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

export function MatchTeamStatsView({ home, away, homeName, awayName, clubSide, events }: Props) {
  const club = clubSide === "home" ? home : away;
  const opp = clubSide === "home" ? away : home;
  const clubName = clubSide === "home" ? homeName : awayName;
  const oppName = clubSide === "home" ? awayName : homeName;
  const possession = useMemo(() => (events ? computePossession(events, "all") : null), [events]);
  const clubPossPct = possession ? (clubSide === "home" ? possession.homePct : possession.awayPct) : null;
  const oppPossPct = possession ? (clubSide === "home" ? possession.awayPct : possession.homePct) : null;

  const kpis = useMemo(
    () => {
      const base: any[] = [
        { label: "Points", value: club.points, hint: `vs ${opp.points}`, icon: Trophy, accent: "brand" as const },
        { label: "Essais", value: club.tries, hint: `vs ${opp.tries}`, icon: Target, accent: "success" as const },
      ];
      if (clubPossPct != null && oppPossPct != null) {
        base.push({
          label: "Possession",
          value: `${clubPossPct}%`,
          hint: `vs ${oppPossPct}%`,
          icon: PieChart,
          accent: "brand" as const,
        });
      }
      base.push(
        {
          label: "% Tirs au but",
          value: `${pctMade(club.penaltiesMade + club.conversionsMade, club.penaltiesAttempted + club.conversionsAttempted)}%`,
          hint: `${club.penaltiesMade + club.conversionsMade}/${club.penaltiesAttempted + club.conversionsAttempted} réussis`,
          icon: Crosshair,
          accent: "brand" as const,
        },
        {
          label: "% Plaquages",
          value: `${pct(club.tackles, club.missedTackles)}%`,
          hint: `${club.tackles} réussis · ${club.missedTackles} manqués`,
          icon: Shield,
          accent: "success" as const,
        },
        {
          label: "Turnovers",
          value: club.turnovers,
          hint: `vs ${opp.turnovers}`,
          icon: Swords,
          accent: "warning" as const,
        },
        {
          label: "En-avants",
          value: club.knockOns,
          hint: `vs ${opp.knockOns}`,
          icon: Hand,
          accent: "danger" as const,
        },
      );
      return base;
    },
    [club, opp, clubPossPct, oppPossPct],
  );

  return (
    <div className="space-y-4">
      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => (
          <StatKpiCard key={k.label} {...k} />
        ))}
      </div>

      {/* Head-to-head comparison */}
      <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm font-semibold text-foreground">{homeName}</div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Comparatif
          </div>
          <div className="text-sm font-semibold text-foreground">{awayName}</div>
        </div>
        {possession && possession.total > 0 && (
          <div className="mb-3">
            <CompareBar
              label="Possession estimée"
              hValue={possession.homePct}
              aValue={possession.awayPct}
              hDisplay={`${possession.homePct}%`}
              aDisplay={`${possession.awayPct}%`}
              highlight={possession.homePct > possession.awayPct ? "home" : possession.awayPct > possession.homePct ? "away" : null}
            />
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-3">
            <CompareBar label="Points" hValue={home.points} aValue={away.points} highlight={home.points > away.points ? "home" : away.points > home.points ? "away" : null} />
            <CompareBar label="Essais" hValue={home.tries} aValue={away.tries} />
            <CompareBar
              label="Transformations"
              hValue={home.conversionsMade}
              aValue={away.conversionsMade}
              hDisplay={`${home.conversionsMade}/${home.conversionsAttempted}`}
              aDisplay={`${away.conversionsMade}/${away.conversionsAttempted}`}
            />
            <CompareBar
              label="Pénalités"
              hValue={home.penaltiesMade}
              aValue={away.penaltiesMade}
              hDisplay={`${home.penaltiesMade}/${home.penaltiesAttempted}`}
              aDisplay={`${away.penaltiesMade}/${away.penaltiesAttempted}`}
            />
            <CompareBar label="Drops" hValue={home.drops} aValue={away.drops} />
          </div>
          <div className="space-y-3">
            <CompareBar
              label="Mêlées gagnées"
              hValue={home.scrumsWon}
              aValue={away.scrumsWon}
              hDisplay={`${home.scrumsWon}/${home.scrumsWon + home.scrumsLost}`}
              aDisplay={`${away.scrumsWon}/${away.scrumsWon + away.scrumsLost}`}
            />
            <CompareBar
              label="Touches gagnées"
              hValue={home.lineoutsWon}
              aValue={away.lineoutsWon}
              hDisplay={`${home.lineoutsWon}/${home.lineoutsWon + home.lineoutsLost}`}
              aDisplay={`${away.lineoutsWon}/${away.lineoutsWon + away.lineoutsLost}`}
            />
            <CompareBar
              label="Plaquages"
              hValue={home.tackles}
              aValue={away.tackles}
              hDisplay={`${home.tackles} (${pct(home.tackles, home.missedTackles)}%)`}
              aDisplay={`${away.tackles} (${pct(away.tackles, away.missedTackles)}%)`}
            />
            <CompareBar label="Turnovers" hValue={home.turnovers} aValue={away.turnovers} />
            <CompareBar label="En-avants" hValue={home.knockOns} aValue={away.knockOns} />
          </div>
        </div>
      </div>

      {/* Sectional analysis */}
      <div className="grid gap-3 md:grid-cols-3">
        <Section title="Conquête" icon={ChevronsRight}>
          <CompareBar
            label="% Mêlées gagnées"
            hValue={pct(home.scrumsWon, home.scrumsLost)}
            aValue={pct(away.scrumsWon, away.scrumsLost)}
            hDisplay={`${pct(home.scrumsWon, home.scrumsLost)}%`}
            aDisplay={`${pct(away.scrumsWon, away.scrumsLost)}%`}
          />
          <CompareBar
            label="% Touches gagnées"
            hValue={pct(home.lineoutsWon, home.lineoutsLost)}
            aValue={pct(away.lineoutsWon, away.lineoutsLost)}
            hDisplay={`${pct(home.lineoutsWon, home.lineoutsLost)}%`}
            aDisplay={`${pct(away.lineoutsWon, away.lineoutsLost)}%`}
          />
        </Section>
        <Section title="Défense" icon={Shield}>
          <CompareBar
            label="% Plaquages réussis"
            hValue={pct(home.tackles, home.missedTackles)}
            aValue={pct(away.tackles, away.missedTackles)}
            hDisplay={`${pct(home.tackles, home.missedTackles)}%`}
            aDisplay={`${pct(away.tackles, away.missedTackles)}%`}
          />
          <CompareBar label="Plaquages manqués" hValue={home.missedTackles} aValue={away.missedTackles} />
        </Section>
        <Section title="Discipline" icon={AlertTriangle}>
          <CompareBar label="Fautes" hValue={home.fouls} aValue={away.fouls} />
          <div className="flex items-center justify-between rounded-xl bg-surface-sunken/50 px-3 py-2">
            <div className="flex items-center gap-2 text-xs">
              <Square className="h-3 w-3 fill-amber-400 text-amber-400" />
              <span className="text-muted-foreground">Cartons jaunes</span>
            </div>
            <span className="font-mono text-xs font-bold tabular-nums">
              {home.yellowCards} <span className="text-muted-foreground">·</span> {away.yellowCards}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-surface-sunken/50 px-3 py-2">
            <div className="flex items-center gap-2 text-xs">
              <Square className="h-3 w-3 fill-rose-500 text-rose-500" />
              <span className="text-muted-foreground">Cartons rouges</span>
            </div>
            <span className="font-mono text-xs font-bold tabular-nums">
              {home.redCards} <span className="text-muted-foreground">·</span> {away.redCards}
            </span>
          </div>
        </Section>
      </div>
    </div>
  );
}
