import { useMemo, useState } from "react";
import { useCategoryMatches, useMultiMatchEvents, type MatchRow } from "@/hooks/analytics/useTeamSportsAnalytics";
import { computeMatchAnalytics } from "@/lib/analytics/team-sports/eventAggregator";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, MapPin, Calendar, Trophy, BarChart3, Users, GitCompare } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Props {
  matches: MatchRow[];
  onOpen: (matchId: string, target: "general" | "players" | "compare") => void;
}

type ResultFilter = "all" | "win" | "draw" | "loss";
type LocationFilter = "all" | "home" | "away";

function getResult(m: MatchRow): "win" | "draw" | "loss" | null {
  if (m.score_home == null || m.score_away == null) return null;
  const our = m.is_home ? m.score_home : m.score_away;
  const their = m.is_home ? m.score_away : m.score_home;
  if (our > their) return "win";
  if (our < their) return "loss";
  return "draw";
}

export function HistoryTab({ matches, onOpen }: Props) {
  const [search, setSearch] = useState("");
  const [resultF, setResultF] = useState<ResultFilter>("all");
  const [locF, setLocF] = useState<LocationFilter>("all");
  const [compF, setCompF] = useState<string>("all");

  const competitions = useMemo(() => {
    const set = new Set(matches.map(m => m.competition).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [matches]);

  const filtered = useMemo(() => {
    return matches.filter((m) => {
      if (locF === "home" && !m.is_home) return false;
      if (locF === "away" && m.is_home) return false;
      if (compF !== "all" && m.competition !== compF) return false;
      if (resultF !== "all" && getResult(m) !== resultF) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${m.opponent} ${m.competition || ""} ${m.score_home || ""} ${m.score_away || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [matches, search, resultF, locF, compF]);

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl">
        <CardContent className="p-4 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Adversaire, compétition, score…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={locF} onValueChange={(v: LocationFilter) => setLocF(v)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous lieux</SelectItem>
              <SelectItem value="home">Domicile</SelectItem>
              <SelectItem value="away">Extérieur</SelectItem>
            </SelectContent>
          </Select>
          <Select value={resultF} onValueChange={(v: ResultFilter) => setResultF(v)}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous résultats</SelectItem>
              <SelectItem value="win">Victoires</SelectItem>
              <SelectItem value="draw">Nuls</SelectItem>
              <SelectItem value="loss">Défaites</SelectItem>
            </SelectContent>
          </Select>
          <Select value={compF} onValueChange={setCompF}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes compét.</SelectItem>
              {competitions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Aucun match ne correspond aux filtres.</p>
        )}
        {filtered.map((m) => <MatchHistoryCard key={m.id} match={m} onOpen={onOpen} />)}
      </div>
    </div>
  );
}

function MatchHistoryCard({ match, onOpen }: { match: MatchRow; onOpen: Props["onOpen"] }) {
  const result = getResult(match);
  const our = match.is_home ? match.score_home : match.score_away;
  const their = match.is_home ? match.score_away : match.score_home;
  return (
    <Card className="rounded-2xl hover:border-primary transition-colors">
      <CardContent className="p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 min-w-[120px]">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            {format(new Date(match.match_date), "d MMM yyyy", { locale: fr })}
          </span>
        </div>
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">{match.opponent}</span>
            <Badge variant="outline" className="text-xs">
              <MapPin className="h-3 w-3 mr-0.5" />{match.is_home ? "Domicile" : "Extérieur"}
            </Badge>
            {match.competition && <Badge variant="secondary" className="text-xs"><Trophy className="h-3 w-3 mr-0.5" />{match.competition}</Badge>}
            {result && (
              <Badge className={
                result === "win" ? "bg-emerald-500" :
                result === "loss" ? "bg-red-500" : "bg-amber-500"
              }>
                {result === "win" ? "V" : result === "loss" ? "D" : "N"}
              </Badge>
            )}
          </div>
        </div>
        {our != null && their != null && (
          <div className="text-2xl font-bold tabular-nums">{our} - {their}</div>
        )}
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={() => onOpen(match.id, "general")}>
            <BarChart3 className="h-3.5 w-3.5 mr-1" />Général
          </Button>
          <Button size="sm" variant="outline" onClick={() => onOpen(match.id, "players")}>
            <Users className="h-3.5 w-3.5 mr-1" />Joueurs
          </Button>
          <Button size="sm" variant="outline" onClick={() => onOpen(match.id, "compare")}>
            <GitCompare className="h-3.5 w-3.5 mr-1" />Comparer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
