import { useTranslation } from "react-i18next";
import i18n from "i18next";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Heart, Smile, Apple, Activity, Dumbbell, LayoutDashboard, Brain, AlertTriangle } from "lucide-react";
import { MedicalRecordsTab } from "@/components/health/MedicalRecordsTab";
import { CoachDashboard } from "@/components/health/CoachDashboard";
import { InjuriesTab } from "@/components/injuries/InjuriesTab";
import { ActiveProtocolsDashboard } from "@/components/rehab/ActiveProtocolsDashboard";
import { ConcussionProtocolTab } from "@/components/category/ConcussionProtocolTab";
import { WellnessTab } from "@/components/category/WellnessTab";
import { NutritionTab } from "@/components/category/NutritionTab";
import { useViewerModeContext } from "@/contexts/ViewerModeContext";
import { ColoredSubTabsList, ColoredSubTabsTrigger } from "@/components/ui/colored-subtabs";
import { SeasonRosterFilterToggle } from "@/components/category/SeasonRosterFilterToggle";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUnreadWellnessNotificationsCount } from "@/lib/hooks/useUnreadWellnessNotificationsCount";
import { toast } from "sonner";
import { isRugbyType } from "@/lib/constants/sportTypes";
import React from "react";
import { useSearchParams } from "react-router-dom";

interface SanteTabProps {
  categoryId: string;
}

class SanteErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  state = { hasError: false, error: undefined as Error | undefined };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("SanteTab error:", error.message, error.stack, errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 text-destructive">
          <p className="font-bold">{i18n.t("health.errorBoundary.title")}</p>
          <p className="text-sm">{this.state.error?.message}</p>
          <pre className="text-xs mt-2 overflow-auto max-h-40">{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export function SanteTab({ categoryId }: SanteTabProps) {
  const { t } = useTranslation();
  const { isViewer } = useViewerModeContext();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const unreadWellnessCount = useUnreadWellnessNotificationsCount(categoryId);
  const [searchParams] = useSearchParams();
  const urlSubTab = searchParams.get("subtab");
  const [subTab, setSubTab] = React.useState(urlSubTab || "dashboard");

  React.useEffect(() => {
    if (urlSubTab) setSubTab(urlSubTab);
  }, [urlSubTab]);

  React.useEffect(() => {
    if (subTab !== "wellness-health" || isViewer || !user?.id) return;
    const userId = user.id;
    const openedAt = new Date().toISOString();
    const markWellnessAsRead = async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", userId)
        .eq("category_id", categoryId)
        .eq("notification_type", "wellness_submitted")
        .eq("is_read", false)
        .lte("created_at", openedAt);
      if (error) {
        toast.error("Impossible de marquer les notifications wellness comme lues.");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["unread-wellness-notifications-count", categoryId, userId] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    };
    void markWellnessAsRead();
  }, [subTab, isViewer, user?.id, categoryId, queryClient]);

  const { data: category } = useQuery({
    queryKey: ["category-sport-type-sante", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("rugby_type")
        .eq("id", categoryId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const sportType = category?.rugby_type || "";
  const isRugby = isRugbyType(sportType);
  const hasConcussionProtocol = isRugby || ["judo", "ski", "snowboard"].includes(sportType);

  return (
    <SanteErrorBoundary>
      <Tabs value={subTab} onValueChange={setSubTab} className="space-y-4">
        <div className="flex justify-end">
          <SeasonRosterFilterToggle />
        </div>
        <div className="flex justify-center overflow-x-auto -mx-4 px-4 pb-2">
          <ColoredSubTabsList colorKey="sante" className="inline-flex w-max">
            <ColoredSubTabsTrigger
              value="dashboard"
              colorKey="sante"
              icon={<LayoutDashboard className="h-4 w-4" />}
              tooltip={t("subnav.sante.dashboardTooltip")}
            >
              {t("subnav.sante.dashboard")}
            </ColoredSubTabsTrigger>
            <ColoredSubTabsTrigger
              value="wellness-health"
              colorKey="sante"
              icon={<Smile className="h-4 w-4" />}
              tooltip={t("subnav.sante.wellnessTooltip")}
            >
              {t("subnav.sante.wellness")}
              {!isViewer && unreadWellnessCount > 0 && (
                <span className="inline-flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                  {unreadWellnessCount > 9 ? "9+" : unreadWellnessCount}
                </span>
              )}
            </ColoredSubTabsTrigger>
            {/* Nutrition masquée pour toutes les disciplines (non pertinent pour le moment) */}
            {!isViewer && (
              <ColoredSubTabsTrigger
                value="injuries"
                colorKey="sante"
                icon={<Activity className="h-4 w-4" />}
                tooltip={t("subnav.sante.injuriesTooltip")}
              >
                {t("subnav.sante.injuries")}
              </ColoredSubTabsTrigger>
            )}
            {!isViewer && (
              <ColoredSubTabsTrigger
                value="rehab"
                colorKey="sante"
                icon={<Dumbbell className="h-4 w-4" />}
                tooltip={t("subnav.sante.rehabTooltip")}
              >
                {t("subnav.sante.rehab")}
              </ColoredSubTabsTrigger>
            )}
            {!isViewer && (
              <ColoredSubTabsTrigger
                value="risk"
                colorKey="sante"
                icon={<AlertTriangle className="h-4 w-4" />}
                tooltip={t("subnav.sante.riskTooltip")}
              >
                {t("subnav.sante.risk")}
              </ColoredSubTabsTrigger>
            )}
            {!isViewer && hasConcussionProtocol && (
              <ColoredSubTabsTrigger
                value="concussion"
                colorKey="sante"
                icon={<Brain className="h-4 w-4" />}
                tooltip={t("subnav.sante.concussionTooltip")}
              >
                {t("subnav.sante.concussion")}
              </ColoredSubTabsTrigger>
            )}
          </ColoredSubTabsList>
        </div>

        <TabsContent value="dashboard">
          <CoachDashboard categoryId={categoryId} />
        </TabsContent>

        <TabsContent value="wellness-health" className="space-y-6">
          {!isViewer && <WellnessTab categoryId={categoryId} view="tracking" />}
          {!isViewer && <WellnessTab categoryId={categoryId} view="pain-stats" />}
          <MedicalRecordsTab categoryId={categoryId} />
        </TabsContent>

        {/* Nutrition masquée */}

        {!isViewer && (
          <TabsContent value="injuries">
            <InjuriesTab categoryId={categoryId} />
          </TabsContent>
        )}

        {!isViewer && (
          <TabsContent value="rehab">
            <ActiveProtocolsDashboard categoryId={categoryId} />
          </TabsContent>
        )}


        {!isViewer && (
          <TabsContent value="risk">
            <WellnessTab categoryId={categoryId} view="risk" />
          </TabsContent>
        )}


        {!isViewer && hasConcussionProtocol && (
          <TabsContent value="concussion">
            <ConcussionProtocolTab categoryId={categoryId} sportType={sportType || "XV"} />
          </TabsContent>
        )}
      </Tabs>
    </SanteErrorBoundary>
  );
}
