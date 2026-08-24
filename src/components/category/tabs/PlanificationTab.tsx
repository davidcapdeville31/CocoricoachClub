import { Tabs, TabsContent } from "@/components/ui/tabs";
import { CalendarDays, BarChart3, Medal } from "lucide-react";
import { CalendarTab } from "@/components/category/CalendarTab";
import { FisRankingTab } from "@/components/category/fis/FisRankingTab";
import { AthleticsRecordsTab } from "@/components/category/athletics/AthleticsRecordsTab";
import { getMainSportFromType, isAthletismeCategory } from "@/lib/constants/sportTypes";
import { ColoredSubTabsList, ColoredSubTabsTrigger } from "@/components/ui/colored-subtabs";



interface PlanificationTabProps {
  categoryId: string;
  sportType?: string;
}

export function PlanificationTab({ categoryId, sportType }: PlanificationTabProps) {
  const isSkiSport = sportType ? getMainSportFromType(sportType) === "ski" : false;
  const isAthletics = sportType ? isAthletismeCategory(sportType) : false;

  if (!isSkiSport && !isAthletics) {
    return <CalendarTab categoryId={categoryId} />;
  }

  return (
    <Tabs defaultValue="calendar" className="space-y-4">


      <div className="flex justify-center overflow-x-auto -mx-4 px-4 pb-2">
        <ColoredSubTabsList colorKey="planification" className="inline-flex w-max">
          <ColoredSubTabsTrigger
            value="calendar"
            colorKey="planification"
            icon={<CalendarDays className="h-4 w-4" />}
            tooltip={t("subnav.planification.calendarTooltip")}
          >
            {t("subnav.planification.calendar")}
          </ColoredSubTabsTrigger>
          {isSkiSport && (
            <ColoredSubTabsTrigger
              value="fis-ranking"
              colorKey="planification"
              icon={<BarChart3 className="h-4 w-4" />}
              tooltip={t("subnav.planification.fisWsplTooltip")}
            >
              <span className="hidden sm:inline">{t("subnav.planification.fisWspl")}</span>
              <span className="sm:hidden">{t("subnav.planification.fisWsplShort")}</span>
            </ColoredSubTabsTrigger>
          )}
          {isAthletics && (
            <ColoredSubTabsTrigger
              value="minimas"
              colorKey="planification"
              icon={<Medal className="h-4 w-4" />}
              tooltip={t("subnav.planification.minimasTooltip")}
            >
              <span className="hidden sm:inline">{t("subnav.planification.minimas")}</span>
              <span className="sm:hidden">{t("subnav.planification.minimasShort")}</span>
            </ColoredSubTabsTrigger>
          )}
        </ColoredSubTabsList>
      </div>

      <TabsContent value="calendar">
        <CalendarTab categoryId={categoryId} />
      </TabsContent>
      {isSkiSport && (
        <TabsContent value="fis-ranking">
          <FisRankingTab categoryId={categoryId} />
        </TabsContent>
      )}
      {isAthletics && (
        <TabsContent value="minimas">
          <AthleticsRecordsTab categoryId={categoryId} />
        </TabsContent>
      )}
    </Tabs>
  );
}
