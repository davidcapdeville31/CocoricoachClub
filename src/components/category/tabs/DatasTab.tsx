import { useTranslation } from "react-i18next";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Trophy, Target, Timer, Flame } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { ColoredSubTabsList, ColoredSubTabsTrigger } from "@/components/ui/colored-subtabs";
import { PlayerCumulativeStats } from "@/components/category/matches/PlayerCumulativeStats";
import { BowlingCumulativeStats } from "@/components/bowling/BowlingCumulativeStats";
import { BowlingTrainingStats } from "@/components/bowling/BowlingTrainingStats";
import { TennisTrainingStats } from "@/components/tennis/TennisTrainingStats";
import { PrecisionTrainingStats } from "@/components/training/PrecisionTrainingStats";
import { PrecisionFieldTracker } from "@/components/rugby/PrecisionFieldTracker";
import { AthleticsThrowingStats } from "@/components/athletics/AthleticsThrowingStats";
import { AthleticsSprintStats } from "@/components/athletics/AthleticsSprintStats";
import { BasketballPrecisionTracker } from "@/components/basketball/BasketballPrecisionTracker";
import { isBasketballPrecisionSport } from "@/lib/constants/basketballPrecisionExercises";
import { isRugbyType, isAthletismeCategory } from "@/lib/constants/sportTypes";
import { TeamSportsAnalytics } from "@/components/category/datas/team-sports/TeamSportsAnalytics";
import { JudoCompetitionStats } from "@/components/category/datas/judo/JudoCompetitionStats";
import { getAthleteGroups, type AthleticsGroup } from "@/lib/athletics/athleteDisciplines";
import { SeasonRosterFilterToggle } from "@/components/category/SeasonRosterFilterToggle";

interface DatasTabProps {
  categoryId: string;
  sportType?: string;
}

function AthleticsTrainingStats({ categoryId }: { categoryId: string }) {
  const { t: translate } = useTranslation();
  // Détecte les familles d'épreuves réellement pratiquées dans la catégorie
  const { data: players = [] } = useQuery({
    queryKey: ["athletics-category-disciplines", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("discipline, specialty, disciplines, specialties")
        .eq("category_id", categoryId);
      if (error) throw error;
      return data || [];
    },
  });

  const presentGroups = useMemo(() => {
    const set = new Set<AthleticsGroup>();
    (players as any[]).forEach((p) => {
      getAthleteGroups(p).forEach((g) => set.add(g));
    });
    return set;
  }, [players]);

  const showLancers = presentGroups.has("lancers") || presentGroups.size === 0;
  const showCourse =
    presentGroups.has("sprints") ||
    presentGroups.has("haies") ||
    presentGroups.has("demi_fond") ||
    presentGroups.has("fond") ||
    presentGroups.has("marche") ||
    presentGroups.has("combines") ||
    presentGroups.size === 0;

  const tabs: { value: string; label: string; icon: React.ReactNode; render: () => React.ReactNode }[] = [];
  if (showCourse) {
    tabs.push({
      value: "course",
      label: "Course / Sprint / Haies / Fond",
      icon: <Timer className="h-4 w-4" />,
      render: () => (
        <AthleticsSprintStats
          categoryId={categoryId}
          groups={["sprints", "haies", "demi_fond", "fond", "marche", "combines"]}
          title="Stats entraînement — Course / Sprint / Haies / Fond"
        />
      ),
    });
  }
  if (showLancers) {
    tabs.push({
      value: "lancers",
      label: "Lancers",
      icon: <Flame className="h-4 w-4" />,
      render: () => <AthleticsThrowingStats categoryId={categoryId} />,
    });
  }

  const [active, setActive] = useState<string>(tabs[0]?.value || "course");

  if (tabs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Aucun athlète n'a encore d'épreuve déclarée. Renseignez les disciplines dans la fiche de chaque athlète pour activer les modules d'entraînement correspondants.
      </p>
    );
  }

  if (tabs.length === 1) return <>{tabs[0].render()}</>;

  return (
    <Tabs value={active} onValueChange={setActive} className="space-y-4">
      <div className="flex justify-center overflow-x-auto -mx-4 px-4 pb-2">
        <ColoredSubTabsList colorKey="performance" className="inline-flex w-max">
          {tabs.map((t) => (
            <ColoredSubTabsTrigger
              key={t.value}
              value={t.value}
              colorKey="performance"
              icon={t.icon}
              tooltip={translate("subnav.stats.trainingDataTooltip", { label: t.label })}
            >
              {t.label}
            </ColoredSubTabsTrigger>
          ))}
        </ColoredSubTabsList>
      </div>
      {tabs.map((t) => (
        <TabsContent key={t.value} value={t.value}>
          {t.render()}
        </TabsContent>
      ))}
    </Tabs>
  );
}

export function DatasTab({ categoryId, sportType }: DatasTabProps) {
  const { t } = useTranslation();
  const isBowling = (sportType || "").toLowerCase().includes("bowling");
  const isTennis = (sportType || "").toLowerCase().includes("tennis");
  const isBasket = isBasketballPrecisionSport(sportType);
  const isRugby = isRugbyType(sportType || "");
  const isAthletics = isAthletismeCategory(sportType || "");
  const isJudo = (sportType || "").toLowerCase().includes("judo");

  return (
    <Tabs defaultValue="competition" className="space-y-4">
      <div className="flex justify-end">
        <SeasonRosterFilterToggle />
      </div>
      <div className="flex justify-center overflow-x-auto -mx-4 px-4 pb-2">
        <ColoredSubTabsList colorKey="competition" className="inline-flex w-max">
          <ColoredSubTabsTrigger
            value="competition"
            colorKey="competition"
            icon={<Trophy className="h-4 w-4" />}
            tooltip={t("subnav.stats.competitionTooltip")}
          >
            <span className="hidden sm:inline">{t("subnav.stats.competition")}</span>
            <span className="sm:hidden">{t("subnav.stats.competitionShort")}</span>
          </ColoredSubTabsTrigger>
          <ColoredSubTabsTrigger
            value="training"
            colorKey="competition"
            icon={<Target className="h-4 w-4" />}
            tooltip={t("subnav.stats.trainingTooltip")}
          >
            <span className="hidden sm:inline">{t("subnav.stats.training")}</span>
            <span className="sm:hidden">{t("subnav.stats.trainingShort")}</span>
          </ColoredSubTabsTrigger>
        </ColoredSubTabsList>
      </div>

      <TabsContent value="competition">
        {isBowling ? (
          <BowlingCumulativeStats categoryId={categoryId} />
        ) : isJudo ? (
          <JudoCompetitionStats categoryId={categoryId} />
        ) : isRugby ? (
          <TeamSportsAnalytics categoryId={categoryId} sportType={sportType} />
        ) : (
          <PlayerCumulativeStats categoryId={categoryId} sportType={sportType} />
        )}
      </TabsContent>

      <TabsContent value="training">
        {isBowling ? (
          <BowlingTrainingStats categoryId={categoryId} />
        ) : isTennis ? (
          <TennisTrainingStats categoryId={categoryId} />
        ) : isBasket ? (
          <BasketballPrecisionTracker categoryId={categoryId} />
        ) : isAthletics ? (
          <AthleticsTrainingStats categoryId={categoryId} />
        ) : isRugby ? (
          <PrecisionFieldTracker categoryId={categoryId} />
        ) : (
          <PrecisionTrainingStats categoryId={categoryId} />
        )}
      </TabsContent>
    </Tabs>
  );
}
