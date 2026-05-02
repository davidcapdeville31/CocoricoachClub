import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Heart, Smile, Apple, Activity, Dumbbell, LayoutDashboard, Brain, BarChart3, AlertTriangle } from "lucide-react";
import { MedicalRecordsTab } from "@/components/health/MedicalRecordsTab";
import { CoachDashboard } from "@/components/health/CoachDashboard";
import { InjuriesTab } from "@/components/injuries/InjuriesTab";
import { ActiveProtocolsDashboard } from "@/components/rehab/ActiveProtocolsDashboard";
import { ConcussionProtocolTab } from "@/components/category/ConcussionProtocolTab";
import { WellnessTab } from "@/components/category/WellnessTab";
import { NutritionTab } from "@/components/category/NutritionTab";
import { useViewerModeContext } from "@/contexts/ViewerModeContext";
import { ColoredSubTabsList, ColoredSubTabsTrigger } from "@/components/ui/colored-subtabs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isRugbyType } from "@/lib/constants/sportTypes";
import React from "react";

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
          <p className="font-bold">Erreur dans le module Santé</p>
          <p className="text-sm">{this.state.error?.message}</p>
          <pre className="text-xs mt-2 overflow-auto max-h-40">{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export function SanteTab({ categoryId }: SanteTabProps) {
  const { isViewer } = useViewerModeContext();

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
      <Tabs defaultValue="dashboard" className="space-y-4">
        <div className="flex justify-center overflow-x-auto -mx-4 px-4 pb-2">
          <ColoredSubTabsList colorKey="sante" className="inline-flex w-max">
            <ColoredSubTabsTrigger
              value="dashboard"
              colorKey="sante"
              icon={<LayoutDashboard className="h-4 w-4" />}
              tooltip="Vue d'ensemble santé : alertes, blessures actives, indicateurs clés"
            >
              Dashboard Coach
            </ColoredSubTabsTrigger>
            <ColoredSubTabsTrigger
              value="wellness-health"
              colorKey="sante"
              icon={<Smile className="h-4 w-4" />}
              tooltip="Wellness quotidien et dossiers médicaux des athlètes"
            >
              Wellness
            </ColoredSubTabsTrigger>
            {!isViewer && (
              <ColoredSubTabsTrigger
                value="nutrition"
                colorKey="sante"
                icon={<Apple className="h-4 w-4" />}
                tooltip="Plans nutritionnels et suivi alimentaire"
              >
                Nutrition
              </ColoredSubTabsTrigger>
            )}
            {!isViewer && (
              <ColoredSubTabsTrigger
                value="injuries"
                colorKey="sante"
                icon={<Activity className="h-4 w-4" />}
                tooltip="Suivi des blessures, historique et bibliothèque"
              >
                Blessures
              </ColoredSubTabsTrigger>
            )}
            {!isViewer && (
              <ColoredSubTabsTrigger
                value="rehab"
                colorKey="sante"
                icon={<Dumbbell className="h-4 w-4" />}
                tooltip="Protocoles de réhabilitation actifs"
              >
                Réhabilitation
              </ColoredSubTabsTrigger>
            )}
            {!isViewer && (
              <ColoredSubTabsTrigger
                value="stats"
                colorKey="sante"
                icon={<BarChart3 className="h-4 w-4" />}
                tooltip="Statistiques détaillées des douleurs et indicateurs wellness"
              >
                Statistiques
              </ColoredSubTabsTrigger>
            )}
            {!isViewer && (
              <ColoredSubTabsTrigger
                value="risk"
                colorKey="sante"
                icon={<AlertTriangle className="h-4 w-4" />}
                tooltip="Évaluation du risque de blessure (EWMA + AWCR + Wellness)"
              >
                Risque blessure
              </ColoredSubTabsTrigger>
            )}
            {!isViewer && hasConcussionProtocol && (
              <ColoredSubTabsTrigger
                value="concussion"
                colorKey="sante"
                icon={<Brain className="h-4 w-4" />}
                tooltip="Protocole commotion cérébrale spécifique à votre sport"
              >
                Protocole Commotion
              </ColoredSubTabsTrigger>
            )}
          </ColoredSubTabsList>
        </div>

        <TabsContent value="dashboard">
          <CoachDashboard categoryId={categoryId} />
        </TabsContent>

        <TabsContent value="wellness-health" className="space-y-6">
          {!isViewer && <WellnessTab categoryId={categoryId} view="tracking" />}
          <MedicalRecordsTab categoryId={categoryId} />
        </TabsContent>

        {!isViewer && (
          <TabsContent value="nutrition">
            <NutritionTab categoryId={categoryId} />
          </TabsContent>
        )}

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
          <TabsContent value="stats">
            <WellnessTab categoryId={categoryId} view="pain-stats" />
          </TabsContent>
        )}

        {!isViewer && (
          <TabsContent value="risk">
            <WellnessTab categoryId={categoryId} view="risk" />
          </TabsContent>
        )}


        {!isViewer && hasConcussionProtocol && (
          <TabsContent value="concussion">
            <ConcussionProtocolTab categoryId={categoryId} />
          </TabsContent>
        )}
      </Tabs>
    </SanteErrorBoundary>
  );
}
