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
import { AthleticsCompetitionAnalyticsTab } from "@/components/category/athletics/AthleticsCompetitionAnalyticsTab";


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
  const isAthletics = (sportType || "").toLowerCase().includes("athle");

  const matchLabel = "Compétitions";
  const MatchIcon = isIndividual ? Award : Swords;

  // Si "Compétitions" est seul (pas d'autres sous-onglets), on masque la barre d'onglets : c'est inutile
  const hasOtherSubtabs = isSkiSport || isRugby7 || isNationalTeam || isJudo || isAthletics;

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
                ? t("subnav.competition.matchesSkiTooltip")
                : t("subnav.competition.matchesTooltip")
              }
            >
              {matchLabel}
            </ColoredSubTabsTrigger>
            {isSkiSport && (
              <ColoredSubTabsTrigger 
                value="fis-ranking" 
                colorKey="competition"
                icon={<BarChart3 className="h-4 w-4" />}
                tooltip={t("subnav.competition.fisRankingTooltip")}
              >
                <span className="hidden sm:inline">{t("subnav.competition.fisRanking")}</span>
                <span className="sm:hidden">{t("subnav.competition.fisRankingShort")}</span>
              </ColoredSubTabsTrigger>
            )}
            {isRugby7 && (
              <ColoredSubTabsTrigger 
                value="tournaments" 
                colorKey="competition"
                icon={<Trophy className="h-4 w-4" />}
                tooltip={t("subnav.competition.tournamentsTooltip")}
              >
                {t("subnav.competition.tournaments")}
              </ColoredSubTabsTrigger>
            )}
            {isNationalTeam && (
              <ColoredSubTabsTrigger 
                value="national-team" 
                colorKey="competition"
                icon={<Flag className="h-4 w-4" />}
                tooltip={t("subnav.competition.nationalTeamTooltip")}
              >
                <span className="hidden sm:inline">{t("subnav.competition.nationalTeam")}</span>
                <span className="sm:hidden">{t("subnav.competition.nationalTeamShort")}</span>
              </ColoredSubTabsTrigger>
            )}
            {isJudo && (
              <ColoredSubTabsTrigger
                value="opponents"
                colorKey="competition"
                icon={<Users className="h-4 w-4" />}
                tooltip={t("subnav.competition.opponentsTooltip")}
              >
                <span className="hidden sm:inline">{t("subnav.competition.opponents")}</span>
                <span className="sm:hidden">{t("subnav.competition.opponentsShort")}</span>
              </ColoredSubTabsTrigger>
            )}
            {isJudo && (
              <ColoredSubTabsTrigger
                value="judo-analytics"
                colorKey="competition"
                icon={<LineChart className="h-4 w-4" />}
                tooltip={t("subnav.competition.judoReviewTooltip")}
              >
                <span className="hidden sm:inline">Bilan compétitions</span>
                <span className="sm:hidden">Bilan</span>
              </ColoredSubTabsTrigger>
            )}
            {isAthletics && (
              <ColoredSubTabsTrigger
                value="athle-analytics"
                colorKey="competition"
                icon={<LineChart className="h-4 w-4" />}
                tooltip={t("subnav.competition.athleReviewTooltip")}
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

      {isJudo && (
        <TabsContent value="judo-analytics">
          <JudoCompetitionAnalyticsTab categoryId={categoryId} />
        </TabsContent>
      )}

      {isAthletics && (
        <TabsContent value="athle-analytics">
          <AthleticsCompetitionAnalyticsTab categoryId={categoryId} />
        </TabsContent>
      )}
    </Tabs>
  );
}
