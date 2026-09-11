import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { CalendarPlus, Users } from "lucide-react";
import { useSessionNotifications } from "@/lib/hooks/useSessionNotifications";
import { useSeasonGuard } from "@/hooks/use-season-guard";
import { buildTestWindowMeta } from "@/lib/utils/sessionNotes";

export interface ScheduleTestTarget {
  testCategory: string;
  testType: string;
  testCategoryLabel: string;
  testTypeLabel: string;
  testUnit: string;
}

interface ScheduleTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
  testCategoryLabel: string;
  testTypeLabel: string;
  testCategory: string;
  testType: string;
  testUnit: string;
  /** Optional multi-test selection: schedules all of them in a single session */
  tests?: ScheduleTestTarget[];
}

export function ScheduleTestDialog({
  open,
  onOpenChange,
  categoryId,
  testCategoryLabel,
  testTypeLabel,
  testCategory,
  testType,
  testUnit,
  tests,
}: ScheduleTestDialogProps) {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("09:30");
  const [windowStart, setWindowStart] = useState("");
  const [windowEnd, setWindowEnd] = useState("");
  const [allAthletes, setAllAthletes] = useState(true);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);

  const queryClient = useQueryClient();
  const { notify } = useSessionNotifications();
  const guard = useSeasonGuard(categoryId);

  const { data: players = [] } = useQuery({
    queryKey: ["schedule-test-players", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, name, first_name")
        .eq("category_id", categoryId)
        .order("name");
      if (error) throw error;
      return (data || []).map((p: any) => ({
        id: p.id as string,
        label: [String(p.name || "").toUpperCase(), p.first_name || ""]
          .filter(Boolean)
          .join(" "),
      }));
    },
    enabled: open && !!categoryId,
  });

  const togglePlayer = (id: string) => {
    setAllAthletes(false);
    setSelectedPlayerIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  const targets: ScheduleTestTarget[] =
    tests && tests.length > 0
      ? tests
      : [{ testCategory, testType, testCategoryLabel, testTypeLabel, testUnit }];

  const scheduleTest = useMutation({
    mutationFn: async () => {
      if (!guard.assertDate(date)) throw new Error("guard:date");
      const testMeta = JSON.stringify(
        targets.map((t) => ({
          test_category: t.testCategory,
          test_type: t.testType,
          result_unit: t.testUnit,
        })),
      );

      const titleLine = `📋 ${targets.map((t) => t.testTypeLabel).join(" • ")}`;

      if (windowStart && windowEnd && windowEnd < windowStart) {
        toast.error("La fin de la fenêtre de passage doit être après le début");
        throw new Error("guard:window");
      }

      const targetPlayerIds = allAthletes
        ? players.map((p) => p.id)
        : selectedPlayerIds;
      if (targetPlayerIds.length === 0) {
        toast.error("Sélectionne au moins un athlète (ou coche « Tous les athlètes »)");
        throw new Error("guard:players");
      }

      const { data, error } = await supabase.from("training_sessions").insert({
        category_id: categoryId,
        session_date: date,
        session_start_time: startTime,
        session_end_time: endTime,
        training_type: "test",
        notes: `${titleLine}\n<!--TESTS:${testMeta}-->${buildTestWindowMeta(windowStart, windowEnd)}`,
      }).select("id").single();
      if (error) throw error;

      const { error: participantsError } = await supabase
        .from("event_participants")
        .insert(
          targetPlayerIds.map((pid) => ({
            training_session_id: data.id,
            player_id: pid,
          })),
        );
      if (participantsError) throw participantsError;

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["training_sessions", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["today_sessions", categoryId] });
      toast.success(
        targets.length > 1
          ? `${targets.length} tests planifiés au calendrier`
          : `Test "${targets[0]?.testTypeLabel}" planifié au calendrier`,
      );

      // 🔔 Notify all category athletes about the scheduled test
      if (data?.id) {
        notify({
          action: "created",
          sessionId: data.id,
          categoryId,
          sessionDate: date,
          sessionStartTime: startTime || null,
          sessionType: "test",
        });
      }

      onOpenChange(false);
    },
    onError: (err: any) => {
      if (typeof err?.message === "string" && err.message.startsWith("guard:")) return;
      toast.error("Erreur lors de la planification");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5" />
            {targets.length > 1 ? `Planifier ${targets.length} tests` : "Planifier un test"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-muted/50 space-y-1 max-h-40 overflow-y-auto">
            {targets.map((t, i) => (
              <div key={`${t.testCategory}-${t.testType}-${i}`}>
                <p className="text-sm font-medium">{t.testTypeLabel}</p>
                <p className="text-xs text-muted-foreground">
                  {t.testCategoryLabel}
                  {t.testUnit ? ` · ${t.testUnit}` : ""}
                </p>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label>Date</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Heure de début</Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Heure de fin</Label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-border p-3">
            <Label className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4" />
              Athlètes concernés
            </Label>
            <label className="flex items-center gap-2 cursor-pointer py-1">
              <Checkbox
                checked={allAthletes}
                onCheckedChange={(c) => setAllAthletes(Boolean(c))}
              />
              <span className="text-sm font-medium">Tous les athlètes de la catégorie</span>
            </label>
            {!allAthletes && (
              <div className="max-h-40 overflow-y-auto rounded-xl border border-border bg-surface-sunken p-2 space-y-1">
                {players.map((p) => (
                  <label
                    key={p.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/60"
                  >
                    <Checkbox
                      checked={selectedPlayerIds.includes(p.id)}
                      onCheckedChange={() => togglePlayer(p.id)}
                    />
                    <span className="text-sm">{p.label}</span>
                  </label>
                ))}
                {players.length === 0 && (
                  <p className="px-2 py-1 text-xs text-muted-foreground">
                    Aucun athlète dans cette catégorie
                  </p>
                )}
              </div>
            )}
            {!allAthletes && selectedPlayerIds.length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                {selectedPlayerIds.length} athlète(s) sélectionné(s)
              </p>
            )}
          </div>

          <div className="space-y-2 rounded-lg border border-border p-3">
            <Label className="text-sm">Fenêtre de passage (optionnel)</Label>
            <p className="text-[11px] text-muted-foreground">
              Si tu planifies le même test sur plusieurs séances, définis une période : chaque
              athlète ne pourra saisir son résultat qu'une seule fois dans cette fenêtre.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Du</Label>
                <Input
                  type="date"
                  value={windowStart}
                  onChange={(e) => setWindowStart(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Au</Label>
                <Input
                  type="date"
                  value={windowEnd}
                  onChange={(e) => setWindowEnd(e.target.value)}
                />
              </div>
            </div>
          </div>

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={() => scheduleTest.mutate()}
            disabled={!date || scheduleTest.isPending}
          >
            {scheduleTest.isPending ? "Planification..." : "Planifier"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
