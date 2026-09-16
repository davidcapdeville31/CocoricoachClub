import { useState } from "react";
import { PlayersTab } from "@/components/category/PlayersTab";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Users } from "lucide-react";
import { PlayerGroupsManagerDialog } from "@/components/category/players/PlayerGroupsManagerDialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getMainSportFromType } from "@/lib/constants/sportTypes";
import { FisImportDialog } from "@/components/category/fis/FisImportDialog";
import { SeasonRosterFilterToggle } from "@/components/category/SeasonRosterFilterToggle";

interface EffectifTabProps {
  categoryId: string;
}

export function EffectifTab({ categoryId }: EffectifTabProps) {
  const [fisImportOpen, setFisImportOpen] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState(false);

  const { data: category } = useQuery({
    queryKey: ["category-sport-effectif", categoryId],
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

  const isSkiSport = category?.rugby_type
    ? getMainSportFromType(category.rugby_type) === "ski"
    : false;

  return (
    <div className="space-y-4">
      <div className="flex justify-end flex-wrap gap-2">
        <SeasonRosterFilterToggle />
        <Button variant="outline" size="sm" onClick={() => setGroupsOpen(true)}>
          <Users className="h-4 w-4 mr-2" />
          Groupes
        </Button>
        <PlayerGroupsManagerDialog
          open={groupsOpen}
          onOpenChange={setGroupsOpen}
          categoryId={categoryId}
        />
        {isSkiSport && (
          <>
            <Button variant="outline" size="sm" onClick={() => setFisImportOpen(true)}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Import classement FIS + WSPL
            </Button>
            <FisImportDialog
              open={fisImportOpen}
              onOpenChange={setFisImportOpen}
              categoryId={categoryId}
            />
          </>
        )}
      </div>
      <PlayersTab categoryId={categoryId} />
    </div>
  );
}
