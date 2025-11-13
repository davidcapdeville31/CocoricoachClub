import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Add40mSprintDialog } from "./Add40mSprintDialog";
import { Add1600mRunDialog } from "./Add1600mRunDialog";
import { SpeedTestsTable } from "./SpeedTestsTable";

interface SpeedTestsSectionProps {
  categoryId: string;
}

export function SpeedTestsSection({ categoryId }: SpeedTestsSectionProps) {
  const [is40mDialogOpen, setIs40mDialogOpen] = useState(false);
  const [is1600mDialogOpen, setIs1600mDialogOpen] = useState(false);

  const { data: players } = useQuery({
    queryKey: ["players", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("*")
        .eq("category_id", categoryId)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Test 40m Sprint</CardTitle>
            <Button onClick={() => setIs40mDialogOpen(true)} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Ajouter un test
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Entrez le temps en secondes pour calculer automatiquement la vitesse
          </p>
          <SpeedTestsTable categoryId={categoryId} testType="40m_sprint" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Test 1600m Run</CardTitle>
            <Button onClick={() => setIs1600mDialogOpen(true)} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Ajouter un test
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Entrez le temps pour calculer automatiquement la VMA
          </p>
          <SpeedTestsTable categoryId={categoryId} testType="1600m_run" />
        </CardContent>
      </Card>

      {players && (
        <>
          <Add40mSprintDialog
            open={is40mDialogOpen}
            onOpenChange={setIs40mDialogOpen}
            categoryId={categoryId}
            players={players}
          />
          <Add1600mRunDialog
            open={is1600mDialogOpen}
            onOpenChange={setIs1600mDialogOpen}
            categoryId={categoryId}
            players={players}
          />
        </>
      )}
    </div>
  );
}
