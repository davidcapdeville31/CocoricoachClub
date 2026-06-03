import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Plus, Activity, TrendingUp, Library, Trash2, Pencil } from "lucide-react";
import { EditInjuryDialog } from "./EditInjuryDialog";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AddInjuryDialog } from "./AddInjuryDialog";
import { InjuryStatsPanel } from "./InjuryStatsPanel";
import { IllnessHistoryCard } from "./IllnessHistoryCard";
import { InjuryLibraryDialog } from "@/components/category/programs/InjuryLibraryDialog";
import { toast } from "sonner";
import { INJURY_STATUS, INJURY_STATUS_LABELS } from "@/lib/constants/injury";
import { useViewerModeContext } from "@/contexts/ViewerModeContext";

interface InjuriesTabProps {
  categoryId: string;
}

export function InjuriesTab({ categoryId }: InjuriesTabProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [editingInjury, setEditingInjury] = useState<any>(null);
  const queryClient = useQueryClient();
  const { isViewer } = useViewerModeContext();


  const { data: injuries, isLoading } = useQuery({
    queryKey: ["injuries", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("injuries")
        .select("*, players(name)")
        .eq("category_id", categoryId)
        .order("injury_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateInjuryStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updateData: any = { status };
      if (status === INJURY_STATUS.HEALED) {
        updateData.actual_return_date = new Date().toISOString().split("T")[0];
      }
      
      const { data, error } = await supabase
        .from("injuries")
        .update(updateData)
        .eq("id", id)
        .select();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["injuries", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["recovering-injuries-no-protocol", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["active-rehab-protocols", categoryId] });
      toast.success("Statut mis à jour");
    },
    onError: (error: any) => {
      console.error("Erreur mutation complète:", error);
      const errorMessage = error?.message || "Erreur inconnue";
      toast.error(`Erreur: ${errorMessage}`);
    },
  });

  const deleteInjury = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("injuries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["injuries", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["recovering-injuries-no-protocol", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["active-rehab-protocols", categoryId] });
      toast.success("Blessure supprimée");
    },
    onError: (error: any) => {
      toast.error(`Erreur: ${error?.message || "suppression impossible"}`);
    },
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "légère":
        return "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400";
      case "modérée":
        return "bg-orange-500/20 text-orange-700 dark:text-orange-400";
      case "grave":
        return "bg-destructive/20 text-destructive";
      default:
        return "";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case INJURY_STATUS.ACTIVE:
        return "bg-destructive/20 text-destructive";
      case INJURY_STATUS.REHABILITATION:
        return "bg-primary/20 text-primary";
      case INJURY_STATUS.HEALED:
        return "bg-green-500/20 text-green-700 dark:text-green-400";
      default:
        return "";
    }
  };

  const getStatusLabel = (status: string) => {
    return INJURY_STATUS_LABELS[status as keyof typeof INJURY_STATUS_LABELS] || status;
  };

  // Statistics
  const activeInjuries = injuries?.filter((i) => i.status === INJURY_STATUS.ACTIVE).length || 0;
  const inRehabInjuries =
    injuries?.filter((i) => i.status === INJURY_STATUS.REHABILITATION).length || 0;
  const recoveredInjuries = injuries?.filter((i) => i.status === INJURY_STATUS.HEALED).length || 0;

  if (isLoading) {
    return <div className="text-muted-foreground">Chargement...</div>;
  }

  return (
    <div className="space-y-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-card shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Blessures Actives</CardTitle>
            <Activity className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{activeInjuries}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">En Réathlétisation</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{inRehabInjuries}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Guérisons</CardTitle>
            <Activity className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{recoveredInjuries}</div>
          </CardContent>
        </Card>
      </div>

      {/* Statistiques détaillées */}
      <InjuryStatsPanel categoryId={categoryId} />

      {/* Injuries Table */}
      <Card className="bg-gradient-card shadow-md">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Historique des Blessures</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Suivi médical et réathlétisation
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={() => setShowLibrary(true)}>
                <Library className="h-4 w-4 mr-2" />
                Bibliothèque blessures
              </Button>
              {!isViewer && (
                <Button onClick={() => setIsDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter une blessure
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {injuries && injuries.length > 0 ? (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Joueur</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Gravité</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Retour estimé</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {injuries.map((injury) => (
                      <TableRow key={injury.id}>
                        <TableCell className="font-medium">
                          {injury.players?.name}
                        </TableCell>
                        <TableCell>{injury.injury_type}</TableCell>
                        <TableCell>
                          {new Date(injury.injury_date).toLocaleDateString("fr-FR")}
                        </TableCell>
                        <TableCell>
                          <Badge className={getSeverityColor(injury.severity)}>
                            {injury.severity}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(injury.status)}>
                            {getStatusLabel(injury.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {injury.estimated_return_date
                            ? new Date(injury.estimated_return_date).toLocaleDateString("fr-FR")
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {!isViewer ? (
                            <div className="flex items-center gap-2">
                              <Select
                                value={injury.status}
                                onValueChange={(value) => {
                                  updateInjuryStatus.mutate({ id: injury.id, status: value });
                                }}
                                disabled={updateInjuryStatus.isPending}
                              >
                                <SelectTrigger className="w-[160px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={INJURY_STATUS.ACTIVE}>{INJURY_STATUS_LABELS[INJURY_STATUS.ACTIVE]}</SelectItem>
                                  <SelectItem value={INJURY_STATUS.REHABILITATION}>{INJURY_STATUS_LABELS[INJURY_STATUS.REHABILITATION]}</SelectItem>
                                  <SelectItem value={INJURY_STATUS.HEALED}>{INJURY_STATUS_LABELS[INJURY_STATUS.HEALED]}</SelectItem>
                                </SelectContent>
                              </Select>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                    title="Supprimer la blessure"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Supprimer cette blessure ?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Cette action est irréversible. La blessure « {injury.injury_type} » du{" "}
                                      {new Date(injury.injury_date).toLocaleDateString("fr-FR")} sera
                                      définitivement supprimée, ainsi que les données de réhabilitation associées.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteInjury.mutate(injury.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Supprimer
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {injuries.map((injury) => (
                  <div
                    key={injury.id}
                    className="rounded-lg border bg-card p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold truncate">{injury.players?.name}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {injury.injury_type}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Badge className={getSeverityColor(injury.severity)}>
                          {injury.severity}
                        </Badge>
                        <Badge className={getStatusColor(injury.status)}>
                          {getStatusLabel(injury.status)}
                        </Badge>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div>
                        <span className="block uppercase tracking-wide">Date</span>
                        <span className="text-foreground">
                          {new Date(injury.injury_date).toLocaleDateString("fr-FR")}
                        </span>
                      </div>
                      <div>
                        <span className="block uppercase tracking-wide">Retour estimé</span>
                        <span className="text-foreground">
                          {injury.estimated_return_date
                            ? new Date(injury.estimated_return_date).toLocaleDateString("fr-FR")
                            : "-"}
                        </span>
                      </div>
                    </div>
                    {!isViewer && (
                      <div className="flex items-center gap-2 pt-1">
                        <Select
                          value={injury.status}
                          onValueChange={(value) => {
                            updateInjuryStatus.mutate({ id: injury.id, status: value });
                          }}
                          disabled={updateInjuryStatus.isPending}
                        >
                          <SelectTrigger className="flex-1 h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={INJURY_STATUS.ACTIVE}>{INJURY_STATUS_LABELS[INJURY_STATUS.ACTIVE]}</SelectItem>
                            <SelectItem value={INJURY_STATUS.REHABILITATION}>{INJURY_STATUS_LABELS[INJURY_STATUS.REHABILITATION]}</SelectItem>
                            <SelectItem value={INJURY_STATUS.HEALED}>{INJURY_STATUS_LABELS[INJURY_STATUS.HEALED]}</SelectItem>
                          </SelectContent>
                        </Select>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-9 w-9 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                              title="Supprimer la blessure"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Supprimer cette blessure ?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Cette action est irréversible. La blessure « {injury.injury_type} » du{" "}
                                {new Date(injury.injury_date).toLocaleDateString("fr-FR")} sera
                                définitivement supprimée, ainsi que les données de réhabilitation associées.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteInjury.mutate(injury.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Supprimer
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>

          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Aucune blessure enregistrée</p>
              {!isViewer && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setIsDialogOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter la première blessure
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Historique maladies */}
      <IllnessHistoryCard categoryId={categoryId} />



      <AddInjuryDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        categoryId={categoryId}
      />
      <InjuryLibraryDialog
        open={showLibrary}
        onOpenChange={setShowLibrary}
        categoryId={categoryId}
      />
    </div>
  );
}
