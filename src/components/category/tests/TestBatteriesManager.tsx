import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Play, ClipboardList, FileDown } from "lucide-react";
import { CreateTestBatteryDialog } from "./CreateTestBatteryDialog";
import { RunBatteryDialog } from "./RunBatteryDialog";
import { BatteryResultsList } from "./BatteryResultsList";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { exportBatteryReportPdf } from "@/lib/pdf/batteryReportPdf";

interface TestBatteriesManagerProps {
  categoryId: string;
  externalCreateOpen?: boolean;
  onExternalCreateOpenChange?: (open: boolean) => void;
  hideCreateButton?: boolean;
}

export function TestBatteriesManager({
  categoryId,
  externalCreateOpen,
  onExternalCreateOpenChange,
  hideCreateButton,
}: TestBatteriesManagerProps) {
  const qc = useQueryClient();
  const [internalCreateOpen, setInternalCreateOpen] = useState(false);
  const createOpen = externalCreateOpen ?? internalCreateOpen;
  const setCreateOpen = (v: boolean) => {
    if (onExternalCreateOpenChange) onExternalCreateOpenChange(v);
    else setInternalCreateOpen(v);
  };
  const [editId, setEditId] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: clubData } = useQuery({
    queryKey: ["category-club", categoryId],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("club_id, name").eq("id", categoryId).single();
      return data;
    },
  });

  const { data: batteries } = useQuery({
    queryKey: ["test-batteries", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_batteries")
        .select("*, items:test_battery_items(id, max_points)")
        .or(`category_id.eq.${categoryId},category_id.is.null`)
        .eq("club_id", clubData?.club_id || "")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!clubData?.club_id,
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("test_batteries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Batterie supprimée");
      qc.invalidateQueries({ queryKey: ["test-batteries", categoryId] });
      setDeleteId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openCreate = () => { setEditId(null); setCreateOpen(true); };
  const openEdit = (id: string) => { setEditId(id); setCreateOpen(true); };

  return (
    <Card className="bg-gradient-card shadow-md">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Batteries de Tests
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Regroupez plusieurs tests barémés en une journée d'évaluation avec score global.
          </p>
        </div>
        {!hideCreateButton && (
          <Button onClick={openCreate} className="gap-1.5">
            <Plus className="h-4 w-4" /> Nouvelle batterie
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {(batteries?.length ?? 0) === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground border-2 border-dashed rounded-2xl">
            <ClipboardList className="h-10 w-10 mx-auto mb-2 opacity-40" />
            Aucune batterie de tests. Créez-en une pour évaluer vos athlètes sur plusieurs tests d'un coup.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(batteries || []).map((b: any) => {
              const totalMax = (b.items || []).reduce((s: number, it: any) => s + (Number(it.max_points) || 0), 0);
              return (
                <div key={b.id} className="rounded-2xl border bg-muted/30 p-4 space-y-3 hover:shadow-md transition-shadow">
                  <div>
                    <div className="font-semibold">{b.name}</div>
                    {b.description && <div className="text-xs text-muted-foreground mt-0.5">{b.description}</div>}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary">{b.items?.length || 0} tests</Badge>
                    <Badge>{totalMax} pts max</Badge>
                  </div>

                  <BatteryResultsList
                    categoryId={categoryId}
                    batteryName={b.name}
                    batteryLevels={(b.levels as any) || undefined}
                    totalMax={totalMax}
                  />

                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Button size="sm" className="flex-1 gap-1.5" onClick={() => setRunId(b.id)}>
                      <Play className="h-3.5 w-3.5" /> Lancer / Saisir des résultats
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      title="Exporter le rapport complet en PDF"
                      onClick={async () => {
                        const t = toast.loading("Génération du PDF...");
                        try {
                          const { data: full, error: fullErr } = await supabase
                            .from("test_batteries")
                            .select("name, description, levels, items:test_battery_items(test_name, max_points, test_category)")
                            .eq("id", b.id)
                            .single();
                          if (fullErr) throw fullErr;
                          const { data: rows, error: rowsErr } = await supabase
                            .from("generic_tests")
                            .select("id, player_id, test_date, result_value, result_unit, notes, test_type, players(id, name, first_name)")
                            .eq("category_id", categoryId)
                            .ilike("notes", `[Batterie: ${b.name}]%`)
                            .order("test_date", { ascending: false });
                          if (rowsErr) throw rowsErr;
                          if (!rows || rows.length === 0) {
                            toast.dismiss(t);
                            toast.error("Aucun résultat à exporter");
                            return;
                          }
                          await exportBatteryReportPdf({
                            batteryName: full.name,
                            batteryDescription: full.description,
                            levels: (full.levels as any) || undefined,
                            items: (full.items as any) || [],
                            rows: rows as any,
                          });
                          toast.dismiss(t);
                          toast.success("PDF généré");
                        } catch (e: any) {
                          toast.dismiss(t);
                          toast.error(e.message || "Erreur lors de l'export");
                        }
                      }}
                    >
                      <FileDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openEdit(b.id)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" className="text-destructive" onClick={() => setDeleteId(b.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {clubData?.club_id && (
        <CreateTestBatteryDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          categoryId={categoryId}
          clubId={clubData.club_id}
          batteryId={editId}
        />
      )}

      {runId && (
        <RunBatteryDialog
          open={!!runId}
          onOpenChange={(v) => !v && setRunId(null)}
          batteryId={runId}
          categoryId={categoryId}
        />
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette batterie ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les tests personnalisés associés ne seront pas supprimés, seule la batterie le sera.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && del.mutate(deleteId)}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
