import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { TeamStats } from "./hooks/useMatchStats";
import type { MatchEvent } from "./types";
import { computePossession } from "@/lib/analytics/team-sports/possession";
import type { AnalyticsPeriod } from "@/lib/analytics/team-sports/types";

const pct = (won: number, lost: number) => {
  const total = won + lost;
  return total > 0 ? Math.round((won / total) * 100) : 0;
};
const pctMade = (made: number, att: number) => (att > 0 ? Math.round((made / att) * 100) : 0);

function Row({ label, h, a, suffix }: { label: string; h: any; a: any; suffix?: string }) {
  return (
    <div className="grid grid-cols-7 items-center text-sm py-1">
      <div className="col-span-2 text-right font-mono font-semibold">{h}{suffix}</div>
      <div className="col-span-3 text-center text-xs text-muted-foreground">{label}</div>
      <div className="col-span-2 text-left font-mono font-semibold">{a}{suffix}</div>
    </div>
  );
}

function PossessionBar({ events, period }: { events: MatchEvent[]; period: AnalyticsPeriod }) {
  const poss = computePossession(events, period);
  if (poss.total === 0) {
    return (
      <div className="mb-3 rounded-lg border border-dashed bg-muted/30 p-3 text-center text-[11px] text-muted-foreground">
        Possession : en attente d'événements…
      </div>
    );
  }
  return (
    <div className="mb-3 rounded-lg border bg-surface p-3">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-mono font-bold text-brand-500 tabular-nums">{poss.homePct}%</span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Possession estimée
        </span>
        <span className="font-mono font-bold text-accent tabular-nums">{poss.awayPct}%</span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-brand-500 transition-all" style={{ width: `${poss.homePct}%` }} />
        <div className="h-full bg-accent transition-all" style={{ width: `${poss.awayPct}%` }} />
      </div>
      <div className="mt-1 text-center text-[10px] text-muted-foreground">
        Calculée à partir de {poss.total} actions ballon
      </div>
    </div>
  );
}

function StatsBlock({ home, away, events, period }: { home: TeamStats; away: TeamStats; events: MatchEvent[]; period: AnalyticsPeriod }) {
  return (
    <div className="space-y-1">
      <PossessionBar events={events} period={period} />
      <Row label="Essais" h={home.tries} a={away.tries} />
      <Row label="Transfo (R/T)" h={`${home.conversionsMade}/${home.conversionsAttempted}`} a={`${away.conversionsMade}/${away.conversionsAttempted}`} />
      <Row label="% transfo réussies" h={pctMade(home.conversionsMade, home.conversionsAttempted)} a={pctMade(away.conversionsMade, away.conversionsAttempted)} suffix="%" />
      <Row label="Pénalités (R/T)" h={`${home.penaltiesMade}/${home.penaltiesAttempted}`} a={`${away.penaltiesMade}/${away.penaltiesAttempted}`} />
      <Row label="% pénalités réussies" h={pctMade(home.penaltiesMade, home.penaltiesAttempted)} a={pctMade(away.penaltiesMade, away.penaltiesAttempted)} suffix="%" />
      <Row label="Drops" h={home.drops} a={away.drops} />
      <div className="border-t my-2" />
      <Row label="Mêlées (G/P)" h={`${home.scrumsWon}/${home.scrumsLost}`} a={`${away.scrumsWon}/${away.scrumsLost}`} />
      <Row label="% mêlées gagnées" h={pct(home.scrumsWon, home.scrumsLost)} a={pct(away.scrumsWon, away.scrumsLost)} suffix="%" />
      <Row label="Touches (G/P)" h={`${home.lineoutsWon}/${home.lineoutsLost}`} a={`${away.lineoutsWon}/${away.lineoutsLost}`} />
      <Row label="% touches gagnées" h={pct(home.lineoutsWon, home.lineoutsLost)} a={pct(away.lineoutsWon, away.lineoutsLost)} suffix="%" />
      <div className="border-t my-2" />
      <Row label="Plaquages (R/M)" h={`${home.tackles}/${home.missedTackles}`} a={`${away.tackles}/${away.missedTackles}`} />
      <Row label="% plaquages réussis" h={pct(home.tackles, home.missedTackles)} a={pct(away.tackles, away.missedTackles)} suffix="%" />
      <Row label="Turnovers" h={home.turnovers} a={away.turnovers} />
      <Row label="En-avants" h={home.knockOns} a={away.knockOns} />
      <div className="border-t my-2" />
      <Row label="Fautes" h={home.fouls} a={away.fouls} />
      <Row label="↳ Les points" h={home.foulsByPlay.kick} a={away.foulsByPlay.kick} />
      <Row label="↳ Pénaltouche" h={home.foulsByPlay.penaltouche} a={away.foulsByPlay.penaltouche} />
      <Row label="↳ Mêlée" h={home.foulsByPlay.scrum} a={away.foulsByPlay.scrum} />
      <Row label="↳ À la main" h={home.foulsByPlay.quick} a={away.foulsByPlay.quick} />
      {(home.foulsByPlay.unknown > 0 || away.foulsByPlay.unknown > 0) && (
        <Row label="↳ Non précisé" h={home.foulsByPlay.unknown} a={away.foulsByPlay.unknown} />
      )}
      <Row label="Cartons jaunes" h={home.yellowCards} a={away.yellowCards} />
      <Row label="Cartons rouges" h={home.redCards} a={away.redCards} />
    </div>
  );
}

interface Props {
  home: TeamStats; away: TeamStats;
  homeH1: TeamStats; awayH1: TeamStats;
  homeH2: TeamStats; awayH2: TeamStats;
  events: MatchEvent[];
}

export function LiveStatsPanel({ home, away, homeH1, awayH1, homeH2, awayH2, events }: Props) {
  return (
    <Card className="p-4">
      <h3 className="text-sm font-bold uppercase tracking-wider mb-2 text-center">Statistiques live</h3>
      <Tabs defaultValue="total">
        <TabsList className="grid grid-cols-3 w-full mb-3">
          <TabsTrigger value="total">Total</TabsTrigger>
          <TabsTrigger value="h1">1ère MT</TabsTrigger>
          <TabsTrigger value="h2">2ème MT</TabsTrigger>
        </TabsList>
        <TabsContent value="total"><StatsBlock home={home} away={away} events={events} period="all" /></TabsContent>
        <TabsContent value="h1"><StatsBlock home={homeH1} away={awayH1} events={events} period="H1" /></TabsContent>
        <TabsContent value="h2"><StatsBlock home={homeH2} away={awayH2} events={events} period="H2" /></TabsContent>
      </Tabs>
    </Card>
  );
}
