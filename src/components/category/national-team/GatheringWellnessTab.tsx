import { getDateLocale } from "@/lib/i18n/dateLocale";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Building2, User, Link2, Eye, ArrowLeftRight } from "lucide-react";
import { format } from "date-fns";
import { AddGatheringWellnessDialog } from "./AddGatheringWellnessDialog";
import { useTranslation } from "react-i18next";
import { GatheringWellnessComparisonDialog } from "./GatheringWellnessComparisonDialog";

interface GatheringWellnessTabProps {
  categoryId: string;
}

const LOAD_COLORS: Record<string, string> = {
  full: "bg-green-500 text-white",
  adapted: "bg-yellow-500 text-black",
  light: "bg-orange-500 text-white",
  rest: "bg-red-500 text-white",
};

export function GatheringWellnessTab({ categoryId }: GatheringWellnessTabProps) {
  const { t } = useTranslation();
  const LOAD_LABELS: Record<string, string> = {
    full: t("health.gatheringWellnessTab.loadLabels.full"),
    adapted: t("health.gatheringWellnessTab.loadLabels.adapted"),
    light: t("health.gatheringWellnessTab.loadLabels.light"),
    rest: t("health.gatheringWellnessTab.loadLabels.rest"),
  };
  const [isAddPreOpen, setIsAddPreOpen] = useState(false);
  const [isAddDayOfOpen, setIsAddDayOfOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string>("all");
  const [comparisonData, setComparisonData] = useState<{
    preAssessment: any;
    dayOfAssessment: any;
  } | null>(null);

  // Fetch events for filter
  const { data: events } = useQuery({
    queryKey: ["national_team_events_wellness", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("national_team_events")
        .select("id, name, start_date")
        .eq("category_id", categoryId)
        .in("event_type", ["stage", "rassemblement"])
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch assessments
  const { data: assessments, isLoading } = useQuery({
    queryKey: ["gathering_wellness", categoryId, selectedEventId],
    queryFn: async () => {
      let query = supabase
        .from("gathering_wellness_assessments")
        .select(`
          *,
          players(id, name),
          national_team_events(id, name, start_date)
        `)
        .eq("category_id", categoryId)
        .order("assessment_date", { ascending: false });

      if (selectedEventId !== "all") {
        query = query.eq("event_id", selectedEventId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const preGatheringAssessments = assessments?.filter(a => a.assessment_type === "pre_gathering") || [];
  const dayOfAssessments = assessments?.filter(a => a.assessment_type === "day_of") || [];

  // Find linked assessments for comparison
  const findLinkedAssessment = (assessment: any) => {
    if (assessment.assessment_type === "day_of" && assessment.linked_assessment_id) {
      return assessments?.find(a => a.id === assessment.linked_assessment_id);
    }
    if (assessment.assessment_type === "pre_gathering") {
      return assessments?.find(a => a.linked_assessment_id === assessment.id);
    }
    return null;
  };

  const getScoreColor = (score: number | null) => {
    if (!score) return "";
    if (score >= 4) return "text-green-600";
    if (score >= 3) return "text-yellow-600";
    return "text-red-600";
  };

  const renderAssessmentTable = (data: any[], type: "pre_gathering" | "day_of") => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("health.gatheringWellnessTab.table.player")}</TableHead>
          <TableHead>{t("health.gatheringWellnessTab.table.date")}</TableHead>
          <TableHead>{t("health.gatheringWellnessTab.table.event")}</TableHead>
          <TableHead className="text-center">{t("health.gatheringWellnessTab.table.fatigue")}</TableHead>
          <TableHead className="text-center">{t("health.gatheringWellnessTab.table.sleep")}</TableHead>
          <TableHead className="text-center">{t("health.gatheringWellnessTab.table.stress")}</TableHead>
          <TableHead className="text-center">{t("health.gatheringWellnessTab.table.motivation")}</TableHead>
          <TableHead>{t("health.gatheringWellnessTab.table.pain")}</TableHead>
          <TableHead>{t("health.gatheringWellnessTab.table.recommendedLoad")}</TableHead>
          <TableHead>{t("health.gatheringWellnessTab.table.link")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.length === 0 ? (
          <TableRow>
            <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
              {t("health.gatheringWellnessTab.empty")}
            </TableCell>
          </TableRow>
        ) : (
          data.map((assessment) => {
            const linkedAssessment = findLinkedAssessment(assessment);
            return (
              <TableRow key={assessment.id}>
                <TableCell className="font-medium">
                  {assessment.players?.name}
                </TableCell>
                <TableCell>
                  {format(new Date(assessment.assessment_date), "dd MMM yyyy", { locale: getDateLocale() })}
                </TableCell>
                <TableCell>
                  {assessment.national_team_events?.name || t("health.gatheringWellnessTab.noEvent")}
                </TableCell>
                <TableCell className={`text-center font-semibold ${getScoreColor(assessment.fatigue_level)}`}>
                  {assessment.fatigue_level}/5
                </TableCell>
                <TableCell className={`text-center font-semibold ${getScoreColor(assessment.sleep_quality)}`}>
                  {assessment.sleep_quality}/5
                </TableCell>
                <TableCell className={`text-center font-semibold ${getScoreColor(assessment.stress_level)}`}>
                  {assessment.stress_level}/5
                </TableCell>
                <TableCell className={`text-center font-semibold ${getScoreColor(assessment.motivation_level)}`}>
                  {assessment.motivation_level}/5
                </TableCell>
                <TableCell>
                  {assessment.has_pain ? (
                    <Badge variant="destructive" className="text-xs">
                      {t("health.gatheringWellnessTab.painYes", { count: assessment.pain_locations?.length || 0 })}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">{t("health.gatheringWellnessTab.painNo")}</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {assessment.recommended_load && (
                    <Badge className={LOAD_COLORS[assessment.recommended_load]}>
                      {LOAD_LABELS[assessment.recommended_load]}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {linkedAssessment ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setComparisonData({
                        preAssessment: type === "pre_gathering" ? assessment : linkedAssessment,
                        dayOfAssessment: type === "day_of" ? assessment : linkedAssessment,
                      })}
                    >
                      <ArrowLeftRight className="h-4 w-4 mr-1" />
                      {t("health.gatheringWellnessTab.compare")}
                    </Button>
                  ) : type === "pre_gathering" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        // Open day of dialog with linked assessment
                        setIsAddDayOfOpen(true);
                      }}
                    >
                      <Link2 className="h-4 w-4 mr-1" />
                      {t("health.gatheringWellnessTab.linkDayOf")}
                    </Button>
                  ) : (
                    <span className="text-muted-foreground text-sm">{t("health.gatheringWellnessTab.noLink")}</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );

  // Stats
  const totalPre = preGatheringAssessments.length;
  const totalDayOf = dayOfAssessments.length;
  const linkedCount = dayOfAssessments.filter(a => a.linked_assessment_id).length;
  const playersWithPain = assessments?.filter(a => a.has_pain).length || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold">{t("health.gatheringWellnessTab.title")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("health.gatheringWellnessTab.subtitle")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setIsAddPreOpen(true)} variant="outline">
            <Building2 className="h-4 w-4 mr-2" />
            {t("health.gatheringWellnessTab.preGatheringButton")}
          </Button>
          <Button onClick={() => setIsAddDayOfOpen(true)}>
            <User className="h-4 w-4 mr-2" />
            {t("health.gatheringWellnessTab.dayOfButton")}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              {t("health.gatheringWellnessTab.stats.preGathering")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPre}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <User className="h-4 w-4" />
              {t("health.gatheringWellnessTab.stats.dayOf")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDayOf}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              {t("health.gatheringWellnessTab.stats.linked")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{linkedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              {t("health.gatheringWellnessTab.stats.playersWithPain")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{playersWithPain}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">{t("health.gatheringWellnessTab.filterByEvent")}</span>
        <Select value={selectedEventId} onValueChange={setSelectedEventId}>
          <SelectTrigger className="w-[300px]">
            <SelectValue placeholder={t("health.gatheringWellnessTab.allEvents")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("health.gatheringWellnessTab.allEvents")}</SelectItem>
            {events?.map((event) => (
              <SelectItem key={event.id} value={event.id}>
                {event.name} - {format(new Date(event.start_date), "dd/MM/yyyy")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tables */}
      <Tabs defaultValue="pre_gathering" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pre_gathering" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            {t("health.gatheringWellnessTab.tabs.preGathering", { count: totalPre })}
          </TabsTrigger>
          <TabsTrigger value="day_of" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            {t("health.gatheringWellnessTab.tabs.dayOf", { count: totalDayOf })}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pre_gathering">
          <Card>
            <CardContent className="pt-6">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">{t("health.gatheringWellnessTab.loading")}</div>
              ) : (
                renderAssessmentTable(preGatheringAssessments, "pre_gathering")
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="day_of">
          <Card>
            <CardContent className="pt-6">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">{t("health.gatheringWellnessTab.loading")}</div>
              ) : (
                renderAssessmentTable(dayOfAssessments, "day_of")
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <AddGatheringWellnessDialog
        open={isAddPreOpen}
        onOpenChange={setIsAddPreOpen}
        categoryId={categoryId}
        assessmentType="pre_gathering"
      />

      <AddGatheringWellnessDialog
        open={isAddDayOfOpen}
        onOpenChange={setIsAddDayOfOpen}
        categoryId={categoryId}
        assessmentType="day_of"
      />

      {comparisonData && (
        <GatheringWellnessComparisonDialog
          open={!!comparisonData}
          onOpenChange={() => setComparisonData(null)}
          preAssessment={comparisonData.preAssessment}
          dayOfAssessment={comparisonData.dayOfAssessment}
        />
      )}
    </div>
  );
}
