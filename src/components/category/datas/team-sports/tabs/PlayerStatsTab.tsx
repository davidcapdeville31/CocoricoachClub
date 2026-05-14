import { useMemo, useState } from "react";
import { useMatchEventsAnalytics, useCategoryPlayers, type MatchRow, type PlayerLite } from "@/hooks/analytics/useTeamSportsAnalytics";
import { computeMatchAnalytics, tackleRatio } from "@/lib/analytics/team-sports/eventAggregator";
import type { AnalyticsPeriod } from "@/lib/analytics/team-sports/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PeriodToggle } from "../shared/PeriodToggle";
import { KpiCard } from "../shared/KpiCard";
import { PlayerIdentityBadges } from "../shared/PlayerIdentityBadges";
import { Trophy, Shield, AlertTriangle, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  match: MatchRow;
  categoryId: string;
}

const fullName = (p: PlayerLite) => [p.first_name, p.name].filter(Boolean).join(" ").trim() || "Joueur";

export function PlayerStatsTab({ match, categoryId }: Props) {
  const [period, setPeriod] = useState<AnalyticsPeriod>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: events = [] } = useMatchEventsAnalytics(match.id);
  const { data: players = [] } = useCategoryPlayers(categoryId);
  const analytics = useMemo(() => computeMatchAnalytics(events, period), [events, period]);

  // Players who have at least one event in this match
  const involved = useMemo(() => {
    const ids = new Set(events.map(e => e.player_id).filter(Boolean) as string[]);
    return players.filter(p => ids.has(p.id));
  }, [events, players]);

  const current = selectedId ? players.find(p => p.id === selectedId) : involved[0];
  const stats = current ? analytics.players[current.id] : undefined;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-sm">Joueurs ({involved.length})</CardTitle></CardHeader>
        <CardContent className="p-2">
          <ScrollArea className="h-[480px]">
            <div className="space-y-1">
              {involved.length === 0 && (
                <p className="text-xs text-muted-foreground p-3">Aucun joueur n'a d'événement dans ce match.</p>
              )}
              {involved.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={cn(
                    "w-full flex items-center gap-3 p-2 rounded-xl text-left hover:bg-accent/40 transition-colors",
                    (current?.id === p.id) && "bg-accent/60"
                  )}
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={p.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">{(p.name || p.first_name || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{fullName(p)}</p>
                    <div className="flex items-center gap-1 flex-wrap">
                      {p.position && <Badge variant="outline" className="text-[10px]">{p.position}</Badge>}
                      <PlayerIdentityBadges playerId={p.id} compact />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-xl font-semibold">{current ? fullName(current) : "Sélectionnez un joueur"}</h2>
            {current && (
              <div className="flex items-center gap-2 mt-1">
                {current.position && <Badge variant="outline">{current.position}</Badge>}
                <PlayerIdentityBadges playerId={current.id} />
              </div>
            )}
          </div>
          <PeriodToggle value={period} onChange={setPeriod} />
        </div>

        {!stats ? (
          <Card className="rounded-2xl"><CardContent className="p-8 text-center text-muted-foreground">Aucune statistique pour cette période.</CardContent></Card>
        ) : (
          <>
            <Section title="Offensif" icon={<Trophy className="h-4 w-4" />}>
              <KpiCard label="Essais" value={stats.tries} />
              <KpiCard label="Passes" value={stats.passes} />
              <KpiCard label="Offloads" value={stats.offloads} />
              <KpiCard label="Mètres gagnés" value={stats.meters} />
              <KpiCard label="Franchissements" value={stats.lineBreaks} />
              <KpiCard label="Courses" value={stats.carries} />
            </Section>
            <Section title="Défensif" icon={<Shield className="h-4 w-4" />}>
              <KpiCard label="Plaquages réussis" value={stats.tackles} accent="success" />
              <KpiCard label="Plaquages manqués" value={stats.missedTackles} accent="danger" />
              <KpiCard label="Ratio efficacité" value={`${tackleRatio(stats)}%`} />
              <KpiCard label="Turnovers gagnés" value={stats.turnovers} accent="success" />
            </Section>
            <Section title="Discipline" icon={<AlertTriangle className="h-4 w-4" />}>
              <KpiCard label="Pénalités concédées" value={stats.fouls} accent="warning" />
              <KpiCard label="Cartons jaunes" value={stats.yellowCards} accent="warning" />
              <KpiCard label="Cartons rouges" value={stats.redCards} accent="danger" />
            </Section>
            <Section title="Activité" icon={<Activity className="h-4 w-4" />}>
              <KpiCard label="Temps de jeu (est.)" value={`${stats.playTimeMinutes}'`} />
              <KpiCard label="Interventions" value={stats.events} />
            </Section>
          </>
        )}
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">{children}</div>
    </div>
  );
}
