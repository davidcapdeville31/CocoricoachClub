import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Archive, RotateCcw, Trash2, Download, Building2, Users, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SnapshotRow {
  snapshot_id: string;
  entity_type: string;
  entity_id: string;
  entity_name: string;
  club_id: string | null;
  club_name: string | null;
  version: number;
  notes: string | null;
  created_at: string;
  created_by: string | null;
  creator_email: string | null;
  is_archived: boolean;
}

function SnapshotsList() {
  const { data: snapshots, isLoading, error } = useQuery({
    queryKey: ["club-snapshots"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_club_snapshots" as any);
      if (error) throw error;
      return (data || []) as SnapshotRow[];
    },
    staleTime: 0,
    refetchOnMount: "always",
    retry: false,
  });

  const downloadSnapshot = async (id: string, name: string, version: number) => {
    const { data, error } = await supabase
      .from("archived_snapshots")
      .select("snapshot, entity_name, version, created_at, notes")
      .eq("id", id)
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `enregistrement_${name}_v${version}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return <div className="text-center py-8 text-destructive text-sm">Erreur : {(error as Error).message}</div>;
  }

  if (!snapshots || snapshots.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">Aucun enregistrement pour l'instant.</div>;
  }

  return (
    <div className="space-y-3">
      {snapshots.map((row) => (
        <div
          key={row.snapshot_id}
          className="flex flex-wrap items-center gap-3 rounded-2xl border bg-surface p-4"
        >
          <div className="flex items-center gap-2">
            <Save className="h-5 w-5 text-primary" />
            <Badge variant="outline">v{row.version}</Badge>
            {row.is_archived && <Badge variant="secondary">Archivé</Badge>}
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="font-semibold">{row.entity_name}</div>
            <div className="text-xs text-muted-foreground">
              Enregistré le {new Date(row.created_at).toLocaleString("fr-FR")}
              {row.creator_email && <> par {row.creator_email}</>}
            </div>
            {row.notes && <div className="text-xs text-muted-foreground mt-1 italic">« {row.notes} »</div>}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadSnapshot(row.snapshot_id, row.entity_name, row.version)}
          >
            <Download className="h-4 w-4 mr-1" /> Exporter JSON
          </Button>
        </div>
      ))}
    </div>
  );
}


interface ArchivedRow {
  entity_type: "club" | "category";
  entity_id: string;
  entity_name: string;
  club_id: string | null;
  club_name: string | null;
  archived_at: string;
  archived_by: string | null;
  archiver_email: string | null;
  snapshot_count: number;
  latest_snapshot_id: string | null;
}

export function SuperAdminArchives() {
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState<ArchivedRow | null>(null);

  const { data: archives, isLoading } = useQuery({
    queryKey: ["super-admin-archives"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_archived_entities");
      if (error) throw error;
      return (data || []) as ArchivedRow[];
    },
    staleTime: 0,
    refetchOnMount: "always",
  });

  const restore = useMutation({
    mutationFn: async (row: ArchivedRow) => {
      const fn = row.entity_type === "club" ? "restore_club" : "restore_category";
      const arg = row.entity_type === "club" ? { _club_id: row.entity_id } : { _category_id: row.entity_id };
      const { data, error } = await supabase.rpc(fn as any, arg as any);
      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (!result?.success) throw new Error(result?.error || "Échec de la restauration");
    },
    onSuccess: () => {
      toast.success("Élément restauré");
      queryClient.invalidateQueries({ queryKey: ["super-admin-archives"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const permanentDelete = useMutation({
    mutationFn: async (row: ArchivedRow) => {
      const fn = row.entity_type === "club" ? "delete_archived_club" : "delete_archived_category";
      const arg = row.entity_type === "club" ? { _club_id: row.entity_id } : { _category_id: row.entity_id };
      const { data, error } = await supabase.rpc(fn as any, arg as any);
      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (!result?.success) throw new Error(result?.error || "Échec de la suppression");
    },
    onSuccess: () => {
      toast.success("Suppression définitive effectuée");
      setConfirmDelete(null);
      queryClient.invalidateQueries({ queryKey: ["super-admin-archives"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const downloadSnapshot = async (row: ArchivedRow) => {
    if (!row.latest_snapshot_id) {
      toast.error("Aucun instantané disponible");
      return;
    }
    const { data, error } = await supabase
      .from("archived_snapshots")
      .select("snapshot, entity_name, version, created_at")
      .eq("id", row.latest_snapshot_id)
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `archive_${row.entity_type}_${row.entity_name}_v${(data as any).version}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Archive className="h-5 w-5" />
          Archives &amp; Enregistrements
        </CardTitle>
        <CardDescription>
          Consulter les enregistrements créés par les clubs et les éléments archivés.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="snapshots">
          <TabsList>
            <TabsTrigger value="snapshots">Enregistrements</TabsTrigger>
            <TabsTrigger value="archived">Archivés</TabsTrigger>
          </TabsList>
          <TabsContent value="snapshots" className="mt-4">
            <SnapshotsList />
          </TabsContent>
          <TabsContent value="archived" className="mt-4 space-y-3">
            {(!archives || archives.length === 0) ? (
              <div className="text-center py-8 text-muted-foreground">Aucune archive pour l'instant.</div>
            ) : (
              archives.map((row) => (
                <div
                  key={`${row.entity_type}-${row.entity_id}`}
                  className="flex flex-wrap items-center gap-3 rounded-2xl border bg-surface p-4"
                >
                  <div className="flex items-center gap-2">
                    {row.entity_type === "club" ? (
                      <Building2 className="h-5 w-5 text-primary" />
                    ) : (
                      <Users className="h-5 w-5 text-accent" />
                    )}
                    <Badge variant="outline" className="capitalize">{row.entity_type === "club" ? "Club" : "Catégorie"}</Badge>
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <div className="font-semibold">{row.entity_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {row.entity_type === "category" && row.club_name && <span>Club : {row.club_name} • </span>}
                      Archivé le {new Date(row.archived_at).toLocaleString("fr-FR")}
                      {row.archiver_email && <> par {row.archiver_email}</>}
                      {" • "}{row.snapshot_count} version{row.snapshot_count > 1 ? "s" : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => downloadSnapshot(row)}>
                      <Download className="h-4 w-4 mr-1" /> Exporter
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => restore.mutate(row)}
                      disabled={restore.isPending}
                    >
                      <RotateCcw className="h-4 w-4 mr-1" /> Restaurer
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(row)}>
                      <Trash2 className="h-4 w-4 mr-1" /> Supprimer
                    </Button>
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suppression définitive</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action supprime <strong>définitivement</strong> {confirmDelete?.entity_type === "club" ? "le club" : "la catégorie"}{" "}
              <strong>{confirmDelete?.entity_name}</strong> et toutes ses données associées. L'instantané d'archive est conservé.
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDelete && permanentDelete.mutate(confirmDelete)}
            >
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
