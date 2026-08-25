import { getLocaleTag } from "@/lib/i18n/dateLocale";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSeasonFilteredPlayerIds, makePlayerIdFilter } from "@/hooks/use-season-filtered-players";
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
import { useTranslation } from "react-i18next";


interface IllnessHistoryCardProps {
  categoryId: string;
}

export function IllnessHistoryCard({ categoryId }: IllnessHistoryCardProps) {
  const { t } = useTranslation();
  const STATUS: Record<string, string> = {
    active: t("health.illnessHistoryCard.status.active"),
    recovering: t("health.illnessHistoryCard.status.recovering"),
    healed: t("health.illnessHistoryCard.status.healed"),
  };
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const qc = useQueryClient();
  const { isViewer } = useViewerModeContext();


  const { allowedIds } = useSeasonFilteredPlayerIds(categoryId);
  const keepPlayer = makePlayerIdFilter(allowedIds);

  const { data: illnessesRaw, isLoading } = useQuery({
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
  const illnesses = useMemo(
    () => (illnessesRaw || []).filter((i: any) => keepPlayer(i.player_id)),
    [illnessesRaw, allowedIds],
  );

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
      toast.success(t("health.illnessHistoryCard.toastStatusUpdated"));
    },
    onError: (e: any) => toast.error(`${t("health.illnessHistoryCard.toastErrorPrefix")}${e?.message || t("health.illnessHistoryCard.toastUpdateError")}`),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("illnesses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["illnesses", categoryId] });
      qc.invalidateQueries({ queryKey: ["illness-stats", categoryId] });
      toast.success(t("health.illnessHistoryCard.toastDeleted"));
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
            {t("health.illnessHistoryCard.title")}
          </CardTitle>
          {!isViewer && (
            <Button onClick={() => setOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              {t("health.illnessHistoryCard.addIllness")}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t("health.illnessHistoryCard.loading")}</p>
        ) : illnesses && illnesses.length > 0 ? (
          <>
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("health.illnessHistoryCard.table.athlete")}</TableHead>
                    <TableHead>{t("health.illnessHistoryCard.table.type")}</TableHead>
                    <TableHead>{t("health.illnessHistoryCard.table.date")}</TableHead>
                    <TableHead>{t("health.illnessHistoryCard.table.severity")}</TableHead>
                    <TableHead>{t("health.illnessHistoryCard.table.status")}</TableHead>
                    <TableHead>{t("health.illnessHistoryCard.table.estimatedReturn")}</TableHead>
                    <TableHead>{t("health.illnessHistoryCard.table.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {illnesses.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">{i.players?.name}</TableCell>
                      <TableCell>{i.illness_type}</TableCell>
                      <TableCell>{new Date(i.illness_date).toLocaleDateString(getLocaleTag())}</TableCell>
                      <TableCell><Badge className={severityColor(i.severity)}>{i.severity}</Badge></TableCell>
                      <TableCell><Badge className={statusColor(i.status)}>{STATUS[i.status as keyof typeof STATUS] || i.status}</Badge></TableCell>
                      <TableCell>{i.estimated_return_date ? new Date(i.estimated_return_date).toLocaleDateString(getLocaleTag()) : "-"}</TableCell>
                      <TableCell>
                        {!isViewer ? (
                          <div className="flex items-center gap-2">
                            <Select value={i.status} onValueChange={(v) => updateStatus.mutate({ id: i.id, status: v })}>
                              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="active">{t("health.illnessHistoryCard.status.active")}</SelectItem>
                                <SelectItem value="recovering">{t("health.illnessHistoryCard.status.recovering")}</SelectItem>
                                <SelectItem value="healed">{t("health.illnessHistoryCard.status.healed")}</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button variant="ghost" size="icon" onClick={() => setEditing(i)} title={t("health.illnessHistoryCard.title")}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <AlertDialog>

                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>{t("health.illnessHistoryCard.deleteDialogTitle")}</AlertDialogTitle>
                                  <AlertDialogDescription>{t("health.illnessHistoryCard.deleteDialogDescription")}</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>{t("health.illnessHistoryCard.cancel")}</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => del.mutate(i.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t("health.illnessHistoryCard.delete")}</AlertDialogAction>
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
                    <div><span className="block uppercase tracking-wide">Date</span><span className="text-foreground">{new Date(i.illness_date).toLocaleDateString(getLocaleTag())}</span></div>
                    <div><span className="block uppercase tracking-wide">Retour estimé</span><span className="text-foreground">{i.estimated_return_date ? new Date(i.estimated_return_date).toLocaleDateString(getLocaleTag()) : "-"}</span></div>
                  </div>
                  {!isViewer && (
                    <div className="flex items-center gap-2 pt-1">
                      <Select value={i.status} onValueChange={(v) => updateStatus.mutate({ id: i.id, status: v })}>
                        <SelectTrigger className="flex-1 h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">{t("health.illnessHistoryCard.status.active")}</SelectItem>
                          <SelectItem value="recovering">{t("health.illnessHistoryCard.status.recovering")}</SelectItem>
                          <SelectItem value="healed">{t("health.illnessHistoryCard.status.healed")}</SelectItem>
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
                            <AlertDialogTitle>{t("health.illnessHistoryCard.deleteDialogTitle")}</AlertDialogTitle>
                            <AlertDialogDescription>{t("health.illnessHistoryCard.deleteDialogDescription")}</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t("health.illnessHistoryCard.cancel")}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => del.mutate(i.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t("health.illnessHistoryCard.delete")}</AlertDialogAction>
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
          <p className="text-center text-muted-foreground py-6">{t("health.illnessHistoryCard.empty")}</p>
        )}
      </CardContent>
      <AddIllnessDialog open={open} onOpenChange={setOpen} categoryId={categoryId} />
      {editing && (
        <EditIllnessDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} illness={editing} />
      )}
    </Card>
  );
}

