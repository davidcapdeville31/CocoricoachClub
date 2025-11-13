import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

interface SpeedTestsTableProps {
  categoryId: string;
  testType: "40m_sprint" | "1600m_run";
}

export function SpeedTestsTable({ categoryId, testType }: SpeedTestsTableProps) {
  const queryClient = useQueryClient();

  const { data: tests, isLoading } = useQuery({
    queryKey: ["speed_tests", categoryId, testType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("speed_tests")
        .select("*, players(name)")
        .eq("category_id", categoryId)
        .eq("test_type", testType)
        .order("test_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const deleteTest = useMutation({
    mutationFn: async (testId: string) => {
      const { error } = await supabase.from("speed_tests").delete().eq("id", testId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["speed_tests", categoryId, testType] });
      toast.success("Test supprimé avec succès");
    },
    onError: () => {
      toast.error("Erreur lors de la suppression du test");
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement...</p>;

  if (!tests || tests.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucun test enregistré</p>;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Joueur</TableHead>
            <TableHead>Date</TableHead>
            {testType === "40m_sprint" ? (
              <>
                <TableHead>Temps (s)</TableHead>
                <TableHead>m/s</TableHead>
                <TableHead>km/h</TableHead>
              </>
            ) : (
              <>
                <TableHead>Temps</TableHead>
                <TableHead>VMA (km/h)</TableHead>
              </>
            )}
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tests.map((test) => (
            <TableRow key={test.id} className="animate-fade-in">
              <TableCell className="font-medium">{test.players?.name}</TableCell>
              <TableCell>{new Date(test.test_date).toLocaleDateString("fr-FR")}</TableCell>
              {testType === "40m_sprint" ? (
                <>
                  <TableCell>{test.time_40m_seconds?.toFixed(2)}</TableCell>
                  <TableCell className="font-semibold text-primary">
                    {test.speed_ms?.toFixed(2)}
                  </TableCell>
                  <TableCell className="font-semibold text-accent">
                    {test.speed_kmh?.toFixed(2)}
                  </TableCell>
                </>
              ) : (
                <>
                  <TableCell>
                    {test.time_1600m_minutes}:{test.time_1600m_seconds?.toString().padStart(2, "0")}
                  </TableCell>
                  <TableCell className="font-semibold text-primary">
                    {test.vma_kmh?.toFixed(2)}
                  </TableCell>
                </>
              )}
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (confirm("Êtes-vous sûr de vouloir supprimer ce test ?")) {
                      deleteTest.mutate(test.id);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
