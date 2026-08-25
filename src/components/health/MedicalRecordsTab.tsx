import { getDateLocale } from "@/lib/i18n/dateLocale";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSeasonFilteredPlayerIds, makePlayerIdFilter } from "@/hooks/use-season-filtered-players";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Syringe, FileText, AlertTriangle, Calendar, Clock } from "lucide-react";
import { format, differenceInDays, addDays } from "date-fns";

interface MedicalRecordsTabProps {
  categoryId: string;
}

const RECORD_TYPE_VALUES = [
  { value: "vaccination", key: "vaccination", icon: Syringe },
  { value: "medical_exam", key: "medicalExam", icon: FileText },
  { value: "certificate", key: "certificate", icon: FileText },
  { value: "blood_test", key: "bloodTest", icon: FileText },
  { value: "imaging", key: "imaging", icon: FileText },
  { value: "other", key: "other", icon: FileText },
] as const;

export function MedicalRecordsTab({ categoryId }: MedicalRecordsTabProps) {
  const { t } = useTranslation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterPlayer, setFilterPlayer] = useState<string>("all");
  const queryClient = useQueryClient();

  // Form state
  const [playerId, setPlayerId] = useState("");
  const [recordType, setRecordType] = useState<string>("vaccination");
  const [name, setName] = useState("");
  const [recordDate, setRecordDate] = useState(new Date().toISOString().split("T")[0]);
  const [expiryDate, setExpiryDate] = useState("");
  const [nextDueDate, setNextDueDate] = useState("");
  const [provider, setProvider] = useState("");
  const [result, setResult] = useState("");
  const [notes, setNotes] = useState("");
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderDays, setReminderDays] = useState(30);

  const { allowedIds } = useSeasonFilteredPlayerIds(categoryId);
  const keepPlayer = makePlayerIdFilter(allowedIds);

  const RECORD_TYPES = RECORD_TYPE_VALUES.map((rt) => ({
    ...rt,
    label: t(`health:medicalRecords.recordTypes.${rt.key}`),
  }));

  const COMMON_VACCINATIONS = [
    t("health.medicalRecords.vaccinations.tetanus"),
    t("health.medicalRecords.vaccinations.diphtheria"),
    t("health.medicalRecords.vaccinations.poliomyelitis"),
    t("health.medicalRecords.vaccinations.pertussis"),
    t("health.medicalRecords.vaccinations.hepatitisB"),
    t("health.medicalRecords.vaccinations.flu"),
    t("health.medicalRecords.vaccinations.covid19"),
  ];

  const COMMON_EXAMS = [
    t("health.medicalRecords.exams.fitnessCheckup"),
    t("health.medicalRecords.exams.noContraindicationCertificate"),
    t("health.medicalRecords.exams.ecg"),
    t("health.medicalRecords.exams.stressTest"),
    t("health.medicalRecords.exams.annualBloodPanel"),
    t("health.medicalRecords.exams.dentalExam"),
    t("health.medicalRecords.exams.eyeExam"),
  ];

  // Fetch players
  const { data: playersRaw } = useQuery({
    queryKey: ["players", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, name")
        .eq("category_id", categoryId)
        .order("name");
      if (error) throw error;
      return data;
    },
  });
  const players = useMemo(
    () => (playersRaw || []).filter((p: any) => keepPlayer(p.id)),
    [playersRaw, allowedIds],
  );

  // Fetch records
  const { data: recordsRaw, isLoading } = useQuery({
    queryKey: ["medical_records", categoryId, filterType, filterPlayer],
    queryFn: async () => {
      let query = supabase
        .from("medical_records")
        .select("*, players(name)")
        .eq("category_id", categoryId)
        .order("next_due_date", { ascending: true, nullsFirst: false });

      if (filterType !== "all") {
        query = query.eq("record_type", filterType);
      }
      if (filterPlayer !== "all") {
        query = query.eq("player_id", filterPlayer);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
  const records = useMemo(
    () => (recordsRaw || []).filter((r: any) => keepPlayer(r.player_id)),
    [recordsRaw, allowedIds],
  );

  const resetForm = () => {
    setPlayerId("");
    setRecordType("vaccination");
    setName("");
    setRecordDate(new Date().toISOString().split("T")[0]);
    setExpiryDate("");
    setNextDueDate("");
    setProvider("");
    setResult("");
    setNotes("");
    setReminderEnabled(true);
    setReminderDays(30);
  };

  const addRecord = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("medical_records").insert({
        category_id: categoryId,
        player_id: playerId,
        record_type: recordType,
        name,
        record_date: recordDate,
        expiry_date: expiryDate || null,
        next_due_date: nextDueDate || null,
        provider: provider || null,
        result: result || null,
        notes: notes || null,
        reminder_enabled: reminderEnabled,
        reminder_days_before: reminderDays,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medical_records"] });
      toast.success(t("health.medicalRecords.toastSuccess"));
      resetForm();
      setIsDialogOpen(false);
    },
    onError: () => {
      toast.error(t("health.medicalRecords.toastError"));
    },
  });

  const getTypeLabel = (type: string) => {
    return RECORD_TYPES.find((t) => t.value === type)?.label || type;
  };

  const getDaysUntilDue = (dueDate: string | null) => {
    if (!dueDate) return null;
    return differenceInDays(new Date(dueDate), new Date());
  };

  const getDueBadge = (dueDate: string | null) => {
    const days = getDaysUntilDue(dueDate);
    if (days === null) return null;
    
    if (days < 0) {
      return <Badge variant="destructive">{t("health.medicalRecords.badges.expiredSince", { days: Math.abs(days) })}</Badge>;
    }
    if (days <= 7) {
      return <Badge variant="destructive">{t("health.medicalRecords.badges.inDays", { days })}</Badge>;
    }
    if (days <= 30) {
      return <Badge className="bg-orange-500">{t("health.medicalRecords.badges.inDays", { days })}</Badge>;
    }
    if (days <= 90) {
      return <Badge className="bg-yellow-500 text-black">{t("health.medicalRecords.badges.inDays", { days })}</Badge>;
    }
    return <Badge variant="outline">{t("health.medicalRecords.badges.daysShort", { days })}</Badge>;
  };

  // Stats
  const expiredCount = records?.filter((r) => {
    const days = getDaysUntilDue(r.next_due_date);
    return days !== null && days < 0;
  }).length || 0;

  const dueSoonCount = records?.filter((r) => {
    const days = getDaysUntilDue(r.next_due_date);
    return days !== null && days >= 0 && days <= 30;
  }).length || 0;

  return (
    <div className="space-y-6">
      {/* Alert for expired/due soon */}
      {(expiredCount > 0 || dueSoonCount > 0) && (
        <Card className="border-orange-500 bg-orange-500/10">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <div>
                {expiredCount > 0 && (
                  <span className="text-destructive font-medium">
                    {t("health.medicalRecords.expiredCount", { count: expiredCount })}
                  </span>
                )}
                {expiredCount > 0 && dueSoonCount > 0 && " • "}
                {dueSoonCount > 0 && (
                  <span className="text-orange-600 font-medium">
                    {t("health.medicalRecords.dueSoonCount", { count: dueSoonCount })}
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Syringe className="h-4 w-4" />
              {t("health.medicalRecords.stats.vaccinations")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {records?.filter((r) => r.record_type === "vaccination").length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {t("health.medicalRecords.stats.exams")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {records?.filter((r) => r.record_type === "medical_exam").length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {t("health.medicalRecords.stats.dueSoon")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{dueSoonCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {t("health.medicalRecords.stats.expired")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{expiredCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and actions */}
      <div className="flex flex-wrap gap-4 items-center">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={t("health.medicalRecords.filters.typePlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("health.medicalRecords.filters.allTypes")}</SelectItem>
            {RECORD_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterPlayer} onValueChange={setFilterPlayer}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={t("health.medicalRecords.filters.playerPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("health.medicalRecords.filters.allPlayers")}</SelectItem>
            {players?.map((player) => (
              <SelectItem key={player.id} value={player.id}>
                {player.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex-1" />

        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t("health.medicalRecords.addDocument")}
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">{t("health.medicalRecords.loading")}</div>
          ) : records && records.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("health.medicalRecords.table.player")}</TableHead>
                  <TableHead>{t("health.medicalRecords.table.type")}</TableHead>
                  <TableHead>{t("health.medicalRecords.table.document")}</TableHead>
                  <TableHead>{t("health.medicalRecords.table.date")}</TableHead>
                  <TableHead>{t("health.medicalRecords.table.nextDue")}</TableHead>
                  <TableHead>{t("health.medicalRecords.table.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">{record.players?.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{getTypeLabel(record.record_type)}</Badge>
                    </TableCell>
                    <TableCell>{record.name}</TableCell>
                    <TableCell>
                      {format(new Date(record.record_date), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell>
                      {record.next_due_date
                        ? format(new Date(record.next_due_date), "dd/MM/yyyy")
                        : "-"}
                    </TableCell>
                    <TableCell>{getDueBadge(record.next_due_date)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {t("health.medicalRecords.empty")}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("health.medicalRecords.dialog.title")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pb-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("health.medicalRecords.dialog.player")}</Label>
                <Select value={playerId} onValueChange={setPlayerId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("health.medicalRecords.dialog.selectPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {players?.map((player) => (
                      <SelectItem key={player.id} value={player.id}>
                        {player.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("health.medicalRecords.dialog.type")}</Label>
                <Select value={recordType} onValueChange={setRecordType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RECORD_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("health.medicalRecords.dialog.documentName")}</Label>
              <Select value={name} onValueChange={setName}>
                <SelectTrigger>
                  <SelectValue placeholder={t("health.medicalRecords.dialog.documentNamePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {(recordType === "vaccination" ? COMMON_VACCINATIONS : COMMON_EXAMS).map(
                    (item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("health.medicalRecords.dialog.documentNameManualPlaceholder")}
                className="mt-2"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("health.medicalRecords.dialog.documentDate")}</Label>
                <Input
                  type="date"
                  value={recordDate}
                  onChange={(e) => setRecordDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("health.medicalRecords.dialog.nextDue")}</Label>
                <Input
                  type="date"
                  value={nextDueDate}
                  onChange={(e) => setNextDueDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("health.medicalRecords.dialog.provider")}</Label>
              <Input
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                placeholder={t("health.medicalRecords.dialog.providerPlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("health.medicalRecords.dialog.result")}</Label>
              <Input
                value={result}
                onChange={(e) => setResult(e.target.value)}
                placeholder={t("health.medicalRecords.dialog.resultPlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("health.medicalRecords.dialog.notes")}</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("health.medicalRecords.dialog.notesPlaceholder")}
              />
            </div>

            <div className="flex items-center justify-between border rounded-lg p-3">
              <div>
                <p className="font-medium">{t("health.medicalRecords.dialog.autoReminder")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("health.medicalRecords.dialog.reminderNotice", { days: reminderDays })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={reminderDays}
                  onChange={(e) => setReminderDays(Number(e.target.value))}
                  className="w-20"
                  disabled={!reminderEnabled}
                />
                <Switch checked={reminderEnabled} onCheckedChange={setReminderEnabled} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              {t("health.medicalRecords.dialog.cancel")}
            </Button>
            <Button
              onClick={() => addRecord.mutate()}
              disabled={!playerId || !name || addRecord.isPending}
            >
              {addRecord.isPending ? t("health.medicalRecords.dialog.adding") : t("health.medicalRecords.dialog.add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
