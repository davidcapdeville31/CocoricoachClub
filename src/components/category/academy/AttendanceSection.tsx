import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ClipboardCheck, Users } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

interface AttendanceSectionProps {
  categoryId: string;
  players: { id: string; name: string }[] | undefined;
}

const ATTENDANCE_STATUS = [
  { value: "present", label: "Présent", color: "bg-green-500" },
  { value: "absent", label: "Absent", color: "bg-red-500" },
  { value: "excused", label: "Excusé", color: "bg-amber-500" },
  { value: "late", label: "Retard", color: "bg-orange-500" },
];

export function AttendanceSection({ categoryId, players }: AttendanceSectionProps) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split("T")[0]);
  const [status, setStatus] = useState("present");
  const [absenceReason, setAbsenceReason] = useState("");
  const [bulkAttendance, setBulkAttendance] = useState<Record<string, string>>({});

  const { data: attendance } = useQuery({
    queryKey: ["training_attendance", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_attendance")
        .select("*, players(name)")
        .eq("category_id", categoryId)
        .order("attendance_date", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  // Calculate attendance stats per player
  const { data: attendanceStats } = useQuery({
    queryKey: ["training_attendance_stats", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_attendance")
        .select("player_id, status, players(name)")
        .eq("category_id", categoryId);
      if (error) throw error;

      const stats: Record<string, { name: string; present: number; absent: number; excused: number; late: number; total: number }> = {};
      data?.forEach((entry) => {
        if (!stats[entry.player_id]) {
          stats[entry.player_id] = { name: entry.players?.name || "", present: 0, absent: 0, excused: 0, late: 0, total: 0 };
        }
        stats[entry.player_id][entry.status as keyof typeof stats[string]]++;
        stats[entry.player_id].total++;
      });
      return Object.values(stats);
    },
  });

  const addAttendance = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("training_attendance").insert({
        player_id: selectedPlayer,
        category_id: categoryId,
        attendance_date: attendanceDate,
        status: status,
        absence_reason: status !== "present" ? absenceReason : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training_attendance", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["training_attendance_stats", categoryId] });
      toast.success("Présence enregistrée");
      resetForm();
      setDialogOpen(false);
    },
    onError: () => toast.error("Erreur lors de l'enregistrement"),
  });

  const addBulkAttendance = useMutation({
    mutationFn: async () => {
      const entries = Object.entries(bulkAttendance)
        .filter(([_, status]) => status)
        .map(([playerId, status]) => ({
          player_id: playerId,
          category_id: categoryId,
          attendance_date: attendanceDate,
          status: status,
        }));
      
      if (entries.length === 0) throw new Error("Aucune présence sélectionnée");
      
      const { error } = await supabase.from("training_attendance").insert(entries);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training_attendance", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["training_attendance_stats", categoryId] });
      toast.success("Présences enregistrées");
      setBulkAttendance({});
      setBulkDialogOpen(false);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Erreur lors de l'enregistrement"),
  });

  const resetForm = () => {
    setSelectedPlayer("");
    setStatus("present");
    setAbsenceReason("");
  };

  const initBulkAttendance = () => {
    const initial: Record<string, string> = {};
    players?.forEach((p) => {
      initial[p.id] = "present";
    });
    setBulkAttendance(initial);
    setBulkDialogOpen(true);
  };

  const getStatusBadge = (statusValue: string) => {
    const statusInfo = ATTENDANCE_STATUS.find((s) => s.value === statusValue);
    return <Badge className={`${statusInfo?.color || "bg-gray-500"} text-white`}>{statusInfo?.label || statusValue}</Badge>;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5" />
                Suivi des Présences
              </CardTitle>
              <CardDescription>Présences aux entraînements et statistiques de participation</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={initBulkAttendance}>
                <Users className="h-4 w-4 mr-2" />
                Appel groupé
              </Button>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Présence individuelle
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Stats summary */}
          {attendanceStats && attendanceStats.length > 0 && (
            <div>
              <h4 className="font-medium mb-3">Statistiques de présence</h4>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Joueur</TableHead>
                      <TableHead className="text-center">Présent</TableHead>
                      <TableHead className="text-center">Absent</TableHead>
                      <TableHead className="text-center">Excusé</TableHead>
                      <TableHead className="text-center">Retard</TableHead>
                      <TableHead className="text-center">% Présence</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendanceStats.map((stat, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{stat.name}</TableCell>
                        <TableCell className="text-center text-green-600">{stat.present}</TableCell>
                        <TableCell className="text-center text-red-600">{stat.absent}</TableCell>
                        <TableCell className="text-center text-amber-600">{stat.excused}</TableCell>
                        <TableCell className="text-center text-orange-600">{stat.late}</TableCell>
                        <TableCell className="text-center font-medium">
                          {stat.total > 0 ? Math.round(((stat.present + stat.late) / stat.total) * 100) : 0}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Recent attendance */}
          <div>
            <h4 className="font-medium mb-3">Historique récent</h4>
            {!attendance || attendance.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Aucune présence enregistrée.</p>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Joueur</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Raison</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendance.slice(0, 20).map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{format(new Date(entry.attendance_date), "dd MMM yyyy", { locale: fr })}</TableCell>
                        <TableCell className="font-medium">{entry.players?.name}</TableCell>
                        <TableCell>{getStatusBadge(entry.status)}</TableCell>
                        <TableCell className="max-w-40 truncate">{entry.absence_reason || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Individual Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enregistrer une présence</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Joueur</Label>
              <Select value={selectedPlayer} onValueChange={setSelectedPlayer}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un joueur" /></SelectTrigger>
                <SelectContent>
                  {players?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={attendanceDate} onChange={(e) => setAttendanceDate(e.target.value)} />
            </div>
            <div>
              <Label>Statut</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ATTENDANCE_STATUS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {status !== "present" && (
              <div>
                <Label>Raison</Label>
                <Input value={absenceReason} onChange={(e) => setAbsenceReason(e.target.value)} placeholder="Blessure, compétition..." />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={() => addAttendance.mutate()} disabled={!selectedPlayer}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Appel groupé - {format(new Date(attendanceDate), "dd MMMM yyyy", { locale: fr })}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Date de l'entraînement</Label>
              <Input type="date" value={attendanceDate} onChange={(e) => setAttendanceDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              {players?.map((player) => (
                <div key={player.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="font-medium">{player.name}</span>
                  <Select value={bulkAttendance[player.id] || "present"} onValueChange={(val) => setBulkAttendance({ ...bulkAttendance, [player.id]: val })}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ATTENDANCE_STATUS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>Annuler</Button>
            <Button onClick={() => addBulkAttendance.mutate()}>Enregistrer tout</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}