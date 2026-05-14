import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalendarPlus, Plus, X, Users, Repeat } from "lucide-react";
import { toast } from "sonner";
import { format, addWeeks, isBefore, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { useSessionNotifications } from "@/lib/hooks/useSessionNotifications";

function generateSessionDates(
  startDate: string,
  frequencyWeeks: number,
  endDate?: string | null,
): string[] {
  const dates: string[] = [];
  const start = new Date(startDate);
  const hardCap = addWeeks(start, 104);
  const limit = endDate ? new Date(endDate) : addWeeks(startOfDay(new Date()), 26);
  const maxDate = isBefore(limit, hardCap) ? limit : hardCap;
  let current = start;
  while (!isBefore(maxDate, current)) {
    dates.push(format(current, "yyyy-MM-dd"));
    current = addWeeks(current, frequencyWeeks);
  }
  return dates;
}

interface ScheduleBatteryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batteryId: string;
  batteryName: string;
  categoryId: string;
}

interface DateSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
}

const newSlot = (): DateSlot => ({
  id: crypto.randomUUID(),
  date: new Date().toISOString().split("T")[0],
  startTime: "09:00",
  endTime: "10:30",
});

export function ScheduleBatteryDialog({
  open,
  onOpenChange,
  batteryId,
  batteryName,
  categoryId,
}: ScheduleBatteryDialogProps) {
  const queryClient = useQueryClient();
  const { notify } = useSessionNotifications();

  const [slots, setSlots] = useState<DateSlot[]>([newSlot()]);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(true);

  useEffect(() => {
    if (!open) {
      setSlots([newSlot()]);
      setSelectAll(true);
      setSelectedPlayers([]);
    }
  }, [open]);

  // Load battery items (to build TESTS metadata)
  const { data: battery } = useQuery({
    queryKey: ["battery-items-schedule", batteryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_batteries")
        .select("name, items:test_battery_items(test_name, test_category, unit)")
        .eq("id", batteryId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: open && !!batteryId,
  });

  // Load players in category
  const { data: players } = useQuery({
    queryKey: ["players-schedule-battery", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players_safe")
        .select("id, name, first_name")
        .eq("category_id", categoryId)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  useEffect(() => {
    if (open && players && selectAll) {
      setSelectedPlayers(players.map((p) => p.id));
    }
  }, [open, players, selectAll]);

  const addSlot = () => setSlots((s) => [...s, newSlot()]);
  const removeSlot = (id: string) =>
    setSlots((s) => (s.length > 1 ? s.filter((x) => x.id !== id) : s));
  const updateSlot = (id: string, patch: Partial<DateSlot>) =>
    setSlots((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const togglePlayer = (id: string) => {
    setSelectAll(false);
    setSelectedPlayers((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  const handleSelectAll = (checked: boolean | string) => {
    const isChecked = Boolean(checked);
    setSelectAll(isChecked);
    if (isChecked && players) setSelectedPlayers(players.map((p) => p.id));
    else setSelectedPlayers([]);
  };

  const schedule = useMutation({
    mutationFn: async () => {
      if (!battery) throw new Error("Batterie introuvable");
      if (slots.length === 0) throw new Error("Ajoutez au moins une date");
      if (slots.some((s) => !s.date)) throw new Error("Toutes les dates doivent être renseignées");
      if (selectedPlayers.length === 0) throw new Error("Sélectionnez au moins un athlète");

      const testsMeta = (battery.items || []).map((it: any) => ({
        test_category: it.test_category,
        test_type: it.test_name,
        result_unit: it.unit || "",
      }));
      const title = `Batterie : ${battery.name}`;
      const fullNotes = `${title}\n<!--TESTS:${JSON.stringify(testsMeta)}-->`;

      const created: Array<{ id: string; date: string; startTime: string }> = [];

      for (const slot of slots) {
        const { data: session, error } = await supabase
          .from("training_sessions")
          .insert({
            category_id: categoryId,
            session_date: slot.date,
            session_start_time: slot.startTime,
            session_end_time: slot.endTime,
            training_type: "test",
            notes: fullNotes,
            intensity: 1,
          })
          .select("id")
          .single();
        if (error) throw error;

        if (session?.id) {
          await supabase.from("event_participants").insert(
            selectedPlayers.map((pid) => ({
              training_session_id: session.id,
              player_id: pid,
            })),
          );
          created.push({ id: session.id, date: slot.date, startTime: slot.startTime });
        }
      }
      return created;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["training_sessions", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["sessions", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["today_sessions", categoryId] });
      toast.success(
        created.length === 1
          ? "Batterie planifiée au calendrier"
          : `Batterie planifiée à ${created.length} dates`,
      );
      created.forEach((c) => {
        notify({
          action: "created",
          sessionId: c.id,
          categoryId,
          sessionDate: c.date,
          sessionStartTime: c.startTime || null,
          sessionType: "test",
        });
      });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message || "Erreur lors de la planification"),
  });

  const itemsCount = battery?.items?.length || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border/60 px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <CalendarPlus className="h-5 w-5 text-primary" />
            Planifier la batterie
          </DialogTitle>
          <DialogDescription>
            Assignez <span className="font-medium text-foreground">{batteryName}</span> à une ou plusieurs dates.
            Les sessions seront créées dans le calendrier — vous pourrez saisir les résultats le jour J.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 py-4 space-y-6">
            {itemsCount > 0 && (
              <div className="text-xs text-muted-foreground">
                <Badge variant="secondary">{itemsCount} tests</Badge>{" "}
                seront évalués lors de chaque session planifiée.
              </div>
            )}

            {/* Dates list */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Dates planifiées</Label>
                <Button type="button" size="sm" variant="outline" onClick={addSlot} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Ajouter une date
                </Button>
              </div>

              <div className="space-y-2">
                {slots.map((slot, idx) => (
                  <div
                    key={slot.id}
                    className="rounded-2xl border bg-muted/30 p-3 grid grid-cols-1 md:grid-cols-[auto_1fr_auto_auto_auto] gap-2 items-end"
                  >
                    <div className="hidden md:flex h-9 items-center justify-center rounded-md bg-primary/10 text-primary text-xs font-semibold w-8">
                      #{idx + 1}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Date</Label>
                      <Input
                        type="date"
                        value={slot.date}
                        onChange={(e) => updateSlot(slot.id, { date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Début</Label>
                      <Input
                        type="time"
                        value={slot.startTime}
                        onChange={(e) => updateSlot(slot.id, { startTime: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Fin</Label>
                      <Input
                        type="time"
                        value={slot.endTime}
                        onChange={(e) => updateSlot(slot.id, { endTime: e.target.value })}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      disabled={slots.length === 1}
                      onClick={() => removeSlot(slot.id)}
                      aria-label="Supprimer cette date"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Athletes */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2 text-sm font-semibold">
                  <Users className="h-4 w-4" /> Athlètes concernés
                </Label>
                <span className="text-xs text-muted-foreground">
                  {selectedPlayers.length}/{players?.length || 0} sélectionnés
                </span>
              </div>

              <label className="flex items-center gap-2 px-3 py-2 rounded-xl border bg-muted/30 cursor-pointer">
                <Checkbox checked={selectAll} onCheckedChange={handleSelectAll} />
                <span className="text-sm font-medium">Tous les athlètes de la catégorie</span>
              </label>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto rounded-xl border p-2 bg-background">
                {(players || []).map((p: any) => (
                  <label
                    key={p.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent/50 cursor-pointer text-sm"
                  >
                    <Checkbox
                      checked={selectedPlayers.includes(p.id)}
                      onCheckedChange={() => togglePlayer(p.id)}
                    />
                    <span className="truncate">
                      {p.first_name ? `${p.first_name} ${p.name}` : p.name}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Recap */}
            {slots.length > 0 && (
              <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Récapitulatif :</span>{" "}
                {slots.length} session{slots.length > 1 ? "s" : ""} planifiée{slots.length > 1 ? "s" : ""} ·{" "}
                {selectedPlayers.length} athlète{selectedPlayers.length > 1 ? "s" : ""} ·{" "}
                {slots
                  .filter((s) => s.date)
                  .map((s) => format(new Date(s.date), "d MMM", { locale: fr }))
                  .join(", ")}
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="shrink-0 border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={() => schedule.mutate()} disabled={schedule.isPending}>
            {schedule.isPending ? "Planification..." : `Planifier ${slots.length > 1 ? `(${slots.length} dates)` : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
