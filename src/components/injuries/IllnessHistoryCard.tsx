import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Thermometer, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { AddIllnessDialog } from "./AddIllnessDialog";
import { EditIllnessDialog } from "./EditIllnessDialog";
import { useViewerModeContext } from "@/contexts/ViewerModeContext";


interface IllnessHistoryCardProps {
  categoryId: string;
}

const STATUS = {
  active: "Active",
  recovering: "En convalescence",
  healed: "Guérie",
};

export function IllnessHistoryCard({ categoryId }: IllnessHistoryCardProps) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { isViewer } = useViewerModeContext();

  const { data: illnesses, isLoading } = useQuery({
    queryKey: ["illnesses", categoryId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("illnesses")
        .select("*, players(name)")
        .eq("category_id", categoryId)
        .order("illness_date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const update: any = { status };
      if (status === "healed") update.actual_return_date = new Date().toISOString().split("T")[0];
      const { error } = await (supabase as any).from("illnesses").update(update).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["illnesses", categoryId] });
      qc.invalidateQueries({ queryKey: ["illness-stats", categoryId] });
      toast.success("Statut mis à jour");
    },
    onError: (e: any) => toast.error(`Erreur: ${e?.message || "mise à jour impossible"}`),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("illnesses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["illnesses", categoryId] });
      qc.invalidateQueries({ queryKey: ["illness-stats", categoryId] });
      toast.success("Maladie supprimée");
    },
  });

  const severityColor = (s: string) => {
    switch (s) {
      case "légère": return "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400";
      case "modérée": return "bg-orange-500/20 text-orange-700 dark:text-orange-400";
      case "grave": return "bg-destructive/20 text-destructive";
      default: return "";
    }
  };
  const statusColor = (s: string) => {
    switch (s) {
      case "active": return "bg-destructive/20 text-destructive";
      case "recovering": return "bg-primary/20 text-primary";
      case "healed": return "bg-green-500/20 text-green-700 dark:text-green-400";
      default: return "";
    }
  };

  return (
    <Card className="bg-gradient-card shadow-md">
      <CardHeader>
        <div className="flex justify-between items-center flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2">
            <Thermometer className="h-5 w-5 text-primary" />
            Historique des maladies
          </CardTitle>
          {!isViewer && (
            <Button onClick={() => setOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Ajouter une maladie
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement...</p>
        ) : illnesses && illnesses.length > 0 ? (
          <>
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Athlète</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Gravité</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Retour estimé</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {illnesses.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">{i.players?.name}</TableCell>
                      <TableCell>{i.illness_type}</TableCell>
                      <TableCell>{new Date(i.illness_date).toLocaleDateString("fr-FR")}</TableCell>
                      <TableCell><Badge className={severityColor(i.severity)}>{i.severity}</Badge></TableCell>
                      <TableCell><Badge className={statusColor(i.status)}>{STATUS[i.status as keyof typeof STATUS] || i.status}</Badge></TableCell>
                      <TableCell>{i.estimated_return_date ? new Date(i.estimated_return_date).toLocaleDateString("fr-FR") : "-"}</TableCell>
                      <TableCell>
                        {!isViewer ? (
                          <div className="flex items-center gap-2">
                            <Select value={i.status} onValueChange={(v) => updateStatus.mutate({ id: i.id, status: v })}>
                              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="recovering">En convalescence</SelectItem>
                                <SelectItem value="healed">Guérie</SelectItem>
                              </SelectContent>
                            </Select>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Supprimer cette maladie ?</AlertDialogTitle>
                                  <AlertDialogDescription>Action irréversible.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => del.mutate(i.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        ) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="md:hidden space-y-3">
              {illnesses.map((i) => (
                <div key={i.id} className="rounded-lg border bg-card p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">{i.players?.name}</p>
                      <p className="text-sm text-muted-foreground truncate">{i.illness_type}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge className={severityColor(i.severity)}>{i.severity}</Badge>
                      <Badge className={statusColor(i.status)}>{STATUS[i.status as keyof typeof STATUS] || i.status}</Badge>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div><span className="block uppercase tracking-wide">Date</span><span className="text-foreground">{new Date(i.illness_date).toLocaleDateString("fr-FR")}</span></div>
                    <div><span className="block uppercase tracking-wide">Retour estimé</span><span className="text-foreground">{i.estimated_return_date ? new Date(i.estimated_return_date).toLocaleDateString("fr-FR") : "-"}</span></div>
                  </div>
                  {!isViewer && (
                    <div className="flex items-center gap-2 pt-1">
                      <Select value={i.status} onValueChange={(v) => updateStatus.mutate({ id: i.id, status: v })}>
                        <SelectTrigger className="flex-1 h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="recovering">En convalescence</SelectItem>
                          <SelectItem value="healed">Guérie</SelectItem>
                        </SelectContent>
                      </Select>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Supprimer cette maladie ?</AlertDialogTitle>
                            <AlertDialogDescription>Action irréversible.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction onClick={() => del.mutate(i.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer</AlertDialogAction>
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
          <p className="text-center text-muted-foreground py-6">Aucune maladie enregistrée</p>
        )}
      </CardContent>
      <AddIllnessDialog open={open} onOpenChange={setOpen} categoryId={categoryId} />
    </Card>
  );
}
