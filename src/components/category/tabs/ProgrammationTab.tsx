import { Tabs, TabsContent } from "@/components/ui/tabs";
import { FolderOpen, ClipboardCheck, Library } from "lucide-react";
import { TestsTab } from "@/components/category/TestsTab";
import { ProgramsTab } from "@/components/category/programs/ProgramsTab";
import ExerciseLibraryRemix from "@/components/library/ExerciseLibraryRemix";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ColoredSubTabsList, ColoredSubTabsTrigger } from "@/components/ui/colored-subtabs";

interface ProgrammationTabProps {
  categoryId: string;
}

export function ProgrammationTab({ categoryId }: ProgrammationTabProps) {
  const { data: category } = useQuery({
    queryKey: ["category-sport-type-programmation", categoryId],
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

  return (
    <Tabs defaultValue="programs" className="space-y-4">
      <div className="flex justify-center overflow-x-auto -mx-4 px-4 pb-2">
        <ColoredSubTabsList colorKey="programmation" className="inline-flex w-max">
          <ColoredSubTabsTrigger
            value="programs"
            colorKey="programmation"
            icon={<FolderOpen className="h-4 w-4" />}
            tooltip={t("subnav.programmation.programsTooltip")}
          >
            <span className="hidden sm:inline">{t("subnav.programmation.programs")}</span>
            <span className="sm:hidden">{t("subnav.programmation.programsShort")}</span>
          </ColoredSubTabsTrigger>
          <ColoredSubTabsTrigger
            value="tests"
            colorKey="programmation"
            icon={<ClipboardCheck className="h-4 w-4" />}
            tooltip={t("subnav.programmation.testsTooltip")}
          >
            {t("subnav.programmation.tests")}
          </ColoredSubTabsTrigger>
          <ColoredSubTabsTrigger
            value="exercise-library"
            colorKey="programmation"
            icon={<Library className="h-4 w-4" />}
            tooltip={t("subnav.programmation.exerciseLibraryTooltip")}
          >
            <span className="hidden sm:inline">{t("subnav.programmation.exerciseLibrary")}</span>
            <span className="sm:hidden">{t("subnav.programmation.exerciseLibraryShort")}</span>
          </ColoredSubTabsTrigger>
        </ColoredSubTabsList>
      </div>

      <TabsContent value="programs">
        <ProgramsTab categoryId={categoryId} />
      </TabsContent>

      <TabsContent value="tests">
        <TestsTab categoryId={categoryId} sportType={sportType} />
      </TabsContent>

      <TabsContent value="exercise-library">
        <ExerciseLibraryRemix />
      </TabsContent>
    </Tabs>
  );
}
