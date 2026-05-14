import { useMemo, useState } from "react";
import { useCategoryMatches } from "@/hooks/analytics/useTeamSportsAnalytics";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { ColoredSubTabsList, ColoredSubTabsTrigger } from "@/components/ui/colored-subtabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, Users, GitCompare } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { GeneralTab } from "./tabs/GeneralTab";
import { PlayerStatsTab } from "./tabs/PlayerStatsTab";
import { CompareTab } from "./tabs/CompareTab";

interface Props {
  categoryId: string;
  sportType?: string;
}

export function TeamSportsAnalytics({ categoryId }: Props) {
  const { data: matches = [], isLoading } = useCategoryMatches(categoryId);
  const [activeTab, setActiveTab] = useState("general");
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);

  const playable = useMemo(() => matches.filter(m => m.event_type !== "individual"), [matches]);
  const currentMatch = useMemo(
    () => playable.find(m => m.id === selectedMatchId) || playable[0],
    [playable, selectedMatchId]
  );


  if (isLoading) return <p className="text-sm text-muted-foreground py-8 text-center">Chargement…</p>;

  if (playable.length === 0) {
    return (
      <div className="rounded-2xl border bg-surface p-12 text-center">
        <BarChart3 className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
        <p className="font-medium">Aucune compétition enregistrée</p>
        <p className="text-sm text-muted-foreground mt-1">
          Les statistiques apparaîtront ici dès que vous lancerez un match via Compétition → Démarrer.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex justify-center overflow-x-auto -mx-4 px-4 pb-2">
          <ColoredSubTabsList colorKey="competition" className="inline-flex w-max">
            <ColoredSubTabsTrigger value="general" colorKey="competition" icon={<BarChart3 className="h-4 w-4" />} tooltip="Vue d'ensemble du match sélectionné">
              Général
            </ColoredSubTabsTrigger>
            <ColoredSubTabsTrigger value="players" colorKey="competition" icon={<Users className="h-4 w-4" />} tooltip="Statistiques individuelles par joueur">
              Statistiques par joueur
            </ColoredSubTabsTrigger>
            <ColoredSubTabsTrigger value="compare" colorKey="competition" icon={<GitCompare className="h-4 w-4" />} tooltip="Comparer les performances entre joueurs">
              Comparer les stats
            </ColoredSubTabsTrigger>
          </ColoredSubTabsList>
        </div>

        {(activeTab === "general" || activeTab === "players") && (
          <div className="flex justify-center">
            <Select value={currentMatch?.id || ""} onValueChange={setSelectedMatchId}>
              <SelectTrigger className="w-full max-w-md rounded-2xl">
                <SelectValue placeholder="Sélectionnez un match" />
              </SelectTrigger>
              <SelectContent>
                {playable.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {format(new Date(m.match_date), "d MMM yyyy", { locale: fr })} · {m.is_home ? "vs" : "@"} {m.opponent}
                    {m.score_home != null && m.score_away != null ? ` (${m.score_home}-${m.score_away})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <TabsContent value="general">
          {currentMatch && <GeneralTab match={currentMatch} categoryId={categoryId} />}
        </TabsContent>
        <TabsContent value="players">
          {currentMatch && <PlayerStatsTab match={currentMatch} categoryId={categoryId} />}
        </TabsContent>
        <TabsContent value="compare">
          <CompareTab categoryId={categoryId} matches={playable} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
