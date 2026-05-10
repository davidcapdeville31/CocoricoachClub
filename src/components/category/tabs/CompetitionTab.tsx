import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Trophy, Swords, Flag, Award, Mountain, BarChart3, Users, LineChart } from "lucide-react";
import { JudoOpponentsTab } from "@/components/category/judo/JudoOpponentsTab";
import { JudoCompetitionAnalyticsTab } from "@/components/category/judo/JudoCompetitionAnalyticsTab";
import { MatchesTab } from "@/components/category/MatchesTab";
import { TournamentsTab } from "@/components/category/TournamentsTab";
import { NationalTeamTab } from "@/components/category/national-team/NationalTeamTab";
import { isIndividualSport, getMainSportFromType } from "@/lib/constants/sportTypes";
import { ColoredSubTabsList, ColoredSubTabsTrigger } from "@/components/ui/colored-subtabs";
import { FisCompetitionsTab } from "@/components/category/fis/FisCompetitionsTab";
import { FisRankingTab } from "@/components/category/fis/FisRankingTab";


interface CompetitionTabProps {
  categoryId: string;
  isRugby7: boolean;
  isNationalTeam: boolean;
  sportType?: string;
}

export function CompetitionTab({ categoryId, isRugby7, isNationalTeam, sportType }: CompetitionTabProps) {
  const isIndividual = isIndividualSport(sportType || "");
  const isSkiSport = sportType ? getMainSportFromType(sportType) === "ski" : false;
  // (athletics: minimas/records moved to Planification only)
  const isJudo = (sportType || "").toLowerCase().includes("judo");
  
  const matchLabel = "Compétitions";
  const MatchIcon = isIndividual ? Award : Swords;

  // Si "Compétitions" est seul (pas d'autres sous-onglets), on masque la barre d'onglets : c'est inutile
  const hasOtherSubtabs = isSkiSport || isRugby7 || isNationalTeam || isJudo;

  return (
    <Tabs defaultValue="matches" className="space-y-4">
      {hasOtherSubtabs && (
        <div className="flex justify-center overflow-x-auto -mx-4 px-4 pb-2">
          <ColoredSubTabsList colorKey="competition" className="inline-flex w-max">
            <ColoredSubTabsTrigger 
              value="matches" 
              colorKey="competition"
              icon={isSkiSport ? <Mountain className="h-4 w-4" /> : <MatchIcon className="h-4 w-4" />}
              tooltip={isSkiSport 
                ? "Compétitions FIS : création, résultats, calcul automatique des points"
                : "Liste des matchs et compétitions : création, résultats, statistiques et gestion des rencontres"
              }
            >
              {matchLabel}
            </ColoredSubTabsTrigger>
            {isSkiSport && (
              <ColoredSubTabsTrigger 
                value="fis-ranking" 
                colorKey="competition"
                icon={<BarChart3 className="h-4 w-4" />}
                tooltip="Classement FIS par athlète : points, objectifs, simulation et projections"
              >
                <span className="hidden sm:inline">Classement FIS</span>
                <span className="sm:hidden">Classmt</span>
              </ColoredSubTabsTrigger>
            )}
            {isRugby7 && (
              <ColoredSubTabsTrigger 
                value="tournaments" 
                colorKey="competition"
                icon={<Trophy className="h-4 w-4" />}
                tooltip="Gestion des tournois : phases de poules, classements et résultats consolidés"
              >
                Tournois
              </ColoredSubTabsTrigger>
            )}
            {isNationalTeam && (
              <ColoredSubTabsTrigger 
                value="national-team" 
                colorKey="competition"
                icon={<Flag className="h-4 w-4" />}
                tooltip="Suivi des sélections en équipe nationale : convocations, performances et historique"
              >
                <span className="hidden sm:inline">Équipe Nationale</span>
                <span className="sm:hidden">National</span>
              </ColoredSubTabsTrigger>
            )}
            {isJudo && (
              <ColoredSubTabsTrigger
                value="opponents"
                colorKey="competition"
                icon={<Users className="h-4 w-4" />}
                tooltip="Profils adversaires : enregistrer les judokas rencontrés en compétition pour analyser les forces/faiblesses"
              >
                <span className="hidden sm:inline">Profils adversaires</span>
                <span className="sm:hidden">Adversaires</span>
              </ColoredSubTabsTrigger>
            )}
            {isJudo && (
              <ColoredSubTabsTrigger
                value="judo-analytics"
                colorKey="competition"
                icon={<LineChart className="h-4 w-4" />}
                tooltip="Bilan compétitions : nombre de tournois locaux/nationaux/internationaux, meilleures performances et statistiques par adversaire"
              >
                <span className="hidden sm:inline">Bilan compétitions</span>
                <span className="sm:hidden">Bilan</span>
              </ColoredSubTabsTrigger>
            )}
          </ColoredSubTabsList>
        </div>
      )}

      <TabsContent value="matches">
        {isSkiSport ? (
          <FisCompetitionsTab categoryId={categoryId} />
        ) : (
          <MatchesTab categoryId={categoryId} sportType={sportType} />
        )}
      </TabsContent>

      {isSkiSport && (
        <TabsContent value="fis-ranking">
          <FisRankingTab categoryId={categoryId} />
        </TabsContent>
      )}

      {isRugby7 && (
        <TabsContent value="tournaments">
          <TournamentsTab categoryId={categoryId} />
        </TabsContent>
      )}

      {isNationalTeam && (
        <TabsContent value="national-team">
          <NationalTeamTab categoryId={categoryId} />
        </TabsContent>
      )}

      {isJudo && (
        <TabsContent value="opponents">
          <JudoOpponentsTab categoryId={categoryId} />
        </TabsContent>
      )}
    </Tabs>
  );
}
