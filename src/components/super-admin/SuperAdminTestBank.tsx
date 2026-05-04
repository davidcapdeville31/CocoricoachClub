import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  ClipboardList,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SuperAdminSystemTestDialog } from "./SuperAdminSystemTestDialog";

export function SuperAdminTestBank() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: tests, isLoading } = useQuery({
    queryKey: ["system-tests-bank"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_tests")
        .select(
          "id, name, test_category, unit, unit_kind, is_time, description, objectives, scoring_scale, max_points, image_url, video_url, formula_config, bilateral",
        )
        .eq("is_system", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("custom_tests").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Test système supprimé");
      qc.invalidateQueries({ queryKey: ["system-tests-bank"] });
      setDeleteId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = (tests || []).filter((t: any) =>
    !search ||
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.test_category?.toLowerCase().includes(search.toLowerCase()),
  );

  const editingTest =
    editId !== null ? (tests || []).find((t: any) => t.id === editId) : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                Banque de tests système
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Tests partagés entre tous les comptes. Les modifications ici
                impactent tous les utilisateurs. Les coachs qui modifient un
                test système créent automatiquement une copie locale.
              </p>
            </div>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Nouveau test système
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un test..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <span className="text-xs text-muted-foreground ml-auto">
              {filtered.length} test{filtered.length > 1 ? "s" : ""}
            </span>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {search ? "Aucun test trouvé" : "Aucun test système pour l'instant"}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((t: any) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setEditId(t.id)}
                  className="group text-left rounded-2xl border bg-card hover:border-primary hover:shadow-md transition-all p-3 flex gap-3"
                >
                  {t.image_url ? (
                    <img
                      src={t.image_url}
                      alt=""
                      className="h-16 w-16 rounded-xl object-cover border shrink-0"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-xl bg-muted border flex items-center justify-center shrink-0">
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium text-sm truncate">{t.name}</div>
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">
                        {t.test_category}
                      </Badge>
                      {t.unit && (
                        <Badge variant="secondary" className="text-[10px]">
                          {t.unit}
                        </Badge>
                      )}
                      {t.bilateral && (
                        <Badge variant="secondary" className="text-[10px]">
                          Bilatéral
                        </Badge>
                      )}
                    </div>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteId(t.id);
                      }}
                      className="inline-flex items-center gap-1 mt-2 text-[11px] text-destructive hover:underline"
                    >
                      <Trash2 className="h-3 w-3" /> Supprimer
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / edit dialog */}
      <SuperAdminSystemTestDialog
        open={createOpen || !!editingTest}
        onOpenChange={(o) => {
          if (!o) {
            setCreateOpen(false);
            setEditId(null);
          }
        }}
        test={editingTest as any}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce test système ?</AlertDialogTitle>
            <AlertDialogDescription>
              Tous les comptes ne verront plus ce test dans leur banque (les
              copies déjà personnalisées par les coachs restent inchangées).
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && del.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
