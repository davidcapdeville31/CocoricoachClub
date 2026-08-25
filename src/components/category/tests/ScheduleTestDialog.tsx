import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { toast } from "sonner";
import { CalendarPlus } from "lucide-react";
import { useSessionNotifications } from "@/lib/hooks/useSessionNotifications";
import { useSeasonGuard } from "@/hooks/use-season-guard";

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
  const queryClient = useQueryClient();
  const { notify } = useSessionNotifications();
  const guard = useSeasonGuard(categoryId);

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

      const { data, error } = await supabase.from("training_sessions").insert({
        category_id: categoryId,
        session_date: date,
        session_start_time: startTime,
        session_end_time: endTime,
        training_type: "test",
        notes: `${titleLine}\n<!--TESTS:${testMeta}-->`,
      }).select("id").single();
      if (error) throw error;
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
