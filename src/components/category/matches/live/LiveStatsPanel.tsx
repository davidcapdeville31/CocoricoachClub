import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { TeamStats } from "./hooks/useMatchStats";

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

function StatsBlock({ home, away }: { home: TeamStats; away: TeamStats }) {
  return (
    <div className="space-y-1">
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
      <Row label="↳ Au pied" h={home.foulsByPlay.kick} a={away.foulsByPlay.kick} />
      <Row label="↳ Les points" h={home.foulsByPlay.points} a={away.foulsByPlay.points} />
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
}

export function LiveStatsPanel({ home, away, homeH1, awayH1, homeH2, awayH2 }: Props) {
  return (
    <Card className="p-4">
      <h3 className="text-sm font-bold uppercase tracking-wider mb-2 text-center">Statistiques live</h3>
      <Tabs defaultValue="total">
        <TabsList className="grid grid-cols-3 w-full mb-3">
          <TabsTrigger value="total">Total</TabsTrigger>
          <TabsTrigger value="h1">1ère MT</TabsTrigger>
          <TabsTrigger value="h2">2ème MT</TabsTrigger>
        </TabsList>
        <TabsContent value="total"><StatsBlock home={home} away={away} /></TabsContent>
        <TabsContent value="h1"><StatsBlock home={homeH1} away={awayH1} /></TabsContent>
        <TabsContent value="h2"><StatsBlock home={homeH2} away={awayH2} /></TabsContent>
      </Tabs>
    </Card>
  );
}
