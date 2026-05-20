import { useEffect, useMemo, useState } from "react";
import { useCategoryMatches } from "@/hooks/analytics/useTeamSportsAnalytics";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { ColoredSubTabsList, ColoredSubTabsTrigger } from "@/components/ui/colored-subtabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Users, GitCompare, ChevronDown, Check, FileSpreadsheet, Download } from "lucide-react";
import { MatchEventExportChooser } from "@/components/category/matches/MatchEventExportChooser";
import { useCategoryTeamName } from "@/hooks/analytics/useTeamSportsAnalytics";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { GeneralTab } from "./tabs/GeneralTab";
import { GeneralAggregateTab } from "./tabs/GeneralAggregateTab";
import { PlayerStatsTab } from "./tabs/PlayerStatsTab";
import { CompareTab } from "./tabs/CompareTab";

interface Props {
  categoryId: string;
  sportType?: string;
}

export function TeamSportsAnalytics({ categoryId, sportType }: Props) {
  const { data: matches = [], isLoading } = useCategoryMatches(categoryId);
  const [activeTab, setActiveTab] = useState("general");
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [selectedMatchIds, setSelectedMatchIds] = useState<string[]>([]);
  const [exportFormat, setExportFormat] = useState<"pdf" | "excel" | null>(null);
  const { data: ourTeamName = "Notre équipe" } = useCategoryTeamName(categoryId);

  const playable = useMemo(() => matches.filter(m => m.event_type !== "individual"), [matches]);
  const currentMatch = useMemo(
    () => playable.find(m => m.id === selectedMatchId) || playable[0],
    [playable, selectedMatchId]
  );

  // Initialise la sélection multi-matchs quand la liste arrive
  useEffect(() => {
    if (playable.length > 0 && selectedMatchIds.length === 0) {
      setSelectedMatchIds([playable[0].id]);
    }
  }, [playable, selectedMatchIds.length]);

  const selectedMatches = useMemo(
    () => playable.filter(m => selectedMatchIds.includes(m.id)),
    [playable, selectedMatchIds]
  );

  const toggleMatchId = (id: string) => {
    setSelectedMatchIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

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
            <ColoredSubTabsTrigger value="players" colorKey="competition" icon={<Users className="h-4 w-4" />} tooltip="Statistiques individuelles par joueur (moyenne sur les matchs sélectionnés)">
              Statistiques par joueur
            </ColoredSubTabsTrigger>
            <ColoredSubTabsTrigger value="compare" colorKey="competition" icon={<GitCompare className="h-4 w-4" />} tooltip="Comparer les performances entre joueurs">
              Comparer les stats
            </ColoredSubTabsTrigger>
          </ColoredSubTabsList>
        </div>

        {(activeTab === "general" || activeTab === "players") && (
          <div className="flex flex-col sm:flex-row justify-center items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full max-w-md rounded-2xl justify-between">
                  <span className="truncate text-left">
                    {selectedMatches.length === 0
                      ? "Sélectionnez un ou plusieurs matchs"
                      : selectedMatches.length === 1
                      ? `${format(new Date(selectedMatches[0].match_date), "d MMM yyyy", { locale: fr })} · ${selectedMatches[0].is_home ? "vs" : "@"} ${selectedMatches[0].opponent}`
                      : `${selectedMatches.length} matchs sélectionnés (cumul)`}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    {selectedMatches.length > 1 && (
                      <Badge variant="secondary" className="text-[10px]">
                        {activeTab === "general" ? "cumul" : "moy."}
                      </Badge>
                    )}
                    <ChevronDown className="h-4 w-4 opacity-60" />
                  </div>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[min(92vw,28rem)] p-0" align="center">
                <div className="flex items-center justify-between px-3 py-2 border-b">
                  <span className="text-xs text-muted-foreground">
                    {selectedMatchIds.length} / {playable.length} sélectionné(s)
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setSelectedMatchIds(playable.map(m => m.id))}
                    >
                      Tout
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setSelectedMatchIds(playable[0] ? [playable[0].id] : [])}
                    >
                      Aucun
                    </Button>
                  </div>
                </div>
                <div className="max-h-72 overflow-y-auto py-1">
                  {playable.map((m) => {
                    const checked = selectedMatchIds.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleMatchId(m.id)}
                        className="flex w-full items-center gap-3 px-3 py-2 text-sm hover:bg-accent text-left"
                      >
                        <Checkbox checked={checked} onCheckedChange={() => toggleMatchId(m.id)} />
                        <div className="flex-1 min-w-0">
                          <div className="truncate">
                            {format(new Date(m.match_date), "d MMM yyyy", { locale: fr })} · {m.is_home ? "vs" : "@"} {m.opponent}
                          </div>
                          {m.score_home != null && m.score_away != null && (
                            <div className="text-[11px] text-muted-foreground">
                              Score : {m.score_home}-{m.score_away}
                            </div>
                          )}
                        </div>
                        {checked && <Check className="h-4 w-4 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
            {activeTab === "general" && selectedMatches.length === 1 && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
                  onClick={() => { setExportFormat("excel"); }}
                  title="Export Excel (équipe ou joueurs)"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Excel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-rose-500/40 text-rose-700 dark:text-rose-300 hover:bg-rose-500/10"
                  onClick={() => { setExportFormat("pdf"); }}
                  title="Exporter en PDF (joueur ou équipe)"
                >
                  <Download className="h-4 w-4" />
                  Exporter en PDF
                </Button>
              </div>
            )}
          </div>
        )}

        <TabsContent value="general">
          {currentMatch && <GeneralTab match={currentMatch} categoryId={categoryId} />}
        </TabsContent>
        <TabsContent value="players">
          {selectedMatches.length > 0 && (
            <PlayerStatsTab matches={selectedMatches} categoryId={categoryId} />
          )}
        </TabsContent>
        <TabsContent value="compare">
          <CompareTab categoryId={categoryId} matches={playable} />
        </TabsContent>
      </Tabs>
      {currentMatch && exportFormat && (
        <MatchEventExportChooser
          open={!!exportFormat}
          onOpenChange={(o) => !o && setExportFormat(null)}
          format={exportFormat}
          categoryId={categoryId}
          ourTeamName={ourTeamName}
          match={{
            id: currentMatch.id,
            match_date: currentMatch.match_date,
            opponent: currentMatch.opponent,
            is_home: currentMatch.is_home ?? null,
            location: (currentMatch as any).location ?? null,
            competition: (currentMatch as any).competition ?? null,
            age_category: (currentMatch as any).age_category ?? null,
            score_home: currentMatch.score_home ?? null,
            score_away: currentMatch.score_away ?? null,
          }}
        />
      )}
    </div>
  );
}
