import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { CalendarPlus, Repeat, Search } from "lucide-react";
import { addDays, addMonths, addWeeks, format } from "date-fns";
import { fr } from "date-fns/locale";
import { useSessionNotifications } from "@/lib/hooks/useSessionNotifications";

type RecurrenceMode = "once" | "weekly" | "biweekly" | "monthly" | "quarterly" | "custom_weeks";

interface AvailableTest {
  category: string;
  categoryLabel: string;
  type: string;       // "custom:<id>" or builtin key
  typeLabel: string;
  unit: string;
}

interface PlanTestsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
  /** Pre-built list of selectable tests (from the parent's filtered categories) */
  availableTests: AvailableTest[];
  /** Optional: pre-select tests matching this category */
  defaultCategoryFilter?: string;
}

const RECURRENCE_OPTIONS: { value: RecurrenceMode; label: string; hint: string }[] = [
  { value: "once",        label: "Une seule fois",          hint: "Test ponctuel à la date choisie" },
  { value: "weekly",      label: "Toutes les semaines",     hint: "Répété chaque semaine" },
  { value: "biweekly",    label: "Toutes les 2 semaines",   hint: "Répété toutes les 2 semaines" },
  { value: "monthly",     label: "Tous les mois",           hint: "Répété chaque mois à cette date" },
  { value: "quarterly",   label: "Tous les 3 mois",         hint: "Répété tous les trimestres" },
  { value: "custom_weeks",label: "Toutes les X semaines…",  hint: "Définir un intervalle personnalisé" },
];

export function PlanTestsDialog({
  open,
  onOpenChange,
  categoryId,
  availableTests,
  defaultCategoryFilter,
}: PlanTestsDialogProps) {
  const today = new Date().toISOString().split("T")[0];
  const [selectedTestKeys, setSelectedTestKeys] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [date, setDate] = useState(today);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [recurrence, setRecurrence] = useState<RecurrenceMode>("once");
  const [customWeeks, setCustomWeeks] = useState(4);
  const [occurrences, setOccurrences] = useState(6);

  const queryClient = useQueryClient();
  const { notify } = useSessionNotifications();

  const filteredTests = useMemo(() => {
    const q = search.trim().toLowerCase();
    return availableTests.filter((t) => {
      if (defaultCategoryFilter && defaultCategoryFilter !== "all" && t.category !== defaultCategoryFilter) {
        // still allow if it matches search; otherwise hide
        if (!q) return false;
      }
      if (!q) return true;
      return (
        t.typeLabel.toLowerCase().includes(q) ||
        t.categoryLabel.toLowerCase().includes(q)
      );
    });
  }, [availableTests, search, defaultCategoryFilter]);

  // Group by category for readability
  const groupedTests = useMemo(() => {
    const map = new Map<string, AvailableTest[]>();
    filteredTests.forEach((t) => {
      const arr = map.get(t.categoryLabel) || [];
      arr.push(t);
      map.set(t.categoryLabel, arr);
    });
    return Array.from(map.entries());
  }, [filteredTests]);

  const computeDates = (): string[] => {
    const start = new Date(date);
    if (recurrence === "once") return [date];

    const stepDays = (() => {
      switch (recurrence) {
        case "weekly":      return { weeks: 1 };
        case "biweekly":    return { weeks: 2 };
        case "monthly":     return { months: 1 };
        case "quarterly":   return { months: 3 };
        case "custom_weeks":return { weeks: Math.max(1, customWeeks) };
        default:            return { weeks: 1 };
      }
    })();

    const dates: string[] = [];
    let cursor = start;
    const cap = Math.min(Math.max(occurrences, 1), 24);
    for (let i = 0; i < cap; i++) {
      dates.push(cursor.toISOString().split("T")[0]);
      cursor = "months" in stepDays
        ? addMonths(cursor, stepDays.months as number)
        : addWeeks(cursor, stepDays.weeks as number);
    }
    return dates;
  };

  const previewDates = useMemo(() => computeDates().slice(0, 4), [date, recurrence, customWeeks, occurrences]);
  const totalSessions = useMemo(() => computeDates().length, [date, recurrence, customWeeks, occurrences]);

  const toggleTest = (key: string) => {
    setSelectedTestKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const selectedTests = useMemo(
    () => availableTests.filter((t) => selectedTestKeys.includes(`${t.category}::${t.type}`)),
    [availableTests, selectedTestKeys]
  );

  const planTests = useMutation({
    mutationFn: async () => {
      if (selectedTests.length === 0) throw new Error("NO_TEST");
      if (!date) throw new Error("NO_DATE");

      const dates = computeDates();
      const testMeta = JSON.stringify(
        selectedTests.map((t) => ({
          test_category: t.category,
          test_type: t.type,
          result_unit: t.unit,
        }))
      );
      const recurrenceLabel = RECURRENCE_OPTIONS.find((o) => o.value === recurrence)?.label || "";
      const baseNote = notes.trim();
      const fullNote =
        `${baseNote ? baseNote + "\n\n" : ""}` +
        `📋 ${selectedTests.length} test(s) planifié(s)${recurrence !== "once" ? ` — ${recurrenceLabel}` : ""}` +
        `\n<!--TESTS:${testMeta}-->`;

      const rows = dates.map((d) => ({
        category_id: categoryId,
        session_date: d,
        session_start_time: startTime || null,
        session_end_time: endTime || null,
        training_type: "test",
        location: location || null,
        notes: fullNote,
      }));

      const { data, error } = await supabase
        .from("training_sessions")
        .insert(rows)
        .select("id, session_date, session_start_time");
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["training_sessions", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["today_sessions", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["planning_sessions"] });
      const count = data?.length || 0;
      toast.success(
        count === 1
          ? `Test planifié au calendrier`
          : `${count} séances de tests planifiées au calendrier`
      );
      // Notify athletes for each created session
      data?.forEach((s: any) => {
        notify({
          action: "created",
          sessionId: s.id,
          categoryId,
          sessionDate: s.session_date,
          sessionStartTime: s.session_start_time || null,
          sessionType: "test",
        });
      });
      // Reset & close
      setSelectedTestKeys([]);
      setNotes("");
      onOpenChange(false);
    },
    onError: (e: any) => {
      if (e?.message === "NO_TEST") return toast.error("Sélectionnez au moins un test");
      if (e?.message === "NO_DATE") return toast.error("Choisissez une date de départ");
      toast.error("Erreur lors de la planification");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <CalendarPlus className="h-5 w-5 text-primary" />
            Planifier des tests dans le calendrier
          </DialogTitle>
          <DialogDescription>
            Choisissez les tests, la date de départ et la récurrence. Les séances seront ajoutées
            au calendrier global et au calendrier des athlètes.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-6">
            {/* === TESTS SELECTION === */}
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Label className="text-base font-semibold">
                  Tests à planifier
                  {selectedTests.length > 0 && (
                    <Badge variant="default" className="ml-2">
                      {selectedTests.length} sélectionné{selectedTests.length > 1 ? "s" : ""}
                    </Badge>
                  )}
                </Label>
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher un test…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 h-9"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-border bg-[hsl(var(--surface-sunken))] max-h-72 overflow-y-auto p-3 space-y-4">
                {groupedTests.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Aucun test disponible. Créez d'abord un test personnalisé.
                  </p>
                ) : (
                  groupedTests.map(([catLabel, tests]) => (
                    <div key={catLabel} className="space-y-1.5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {catLabel}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {tests.map((t) => {
                          const key = `${t.category}::${t.type}`;
                          const checked = selectedTestKeys.includes(key);
                          return (
                            <label
                              key={key}
                              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-all ${
                                checked
                                  ? "border-primary bg-primary/10 shadow-sm"
                                  : "border-border bg-surface hover:border-border-strong hover:bg-secondary/40"
                              }`}
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={() => toggleTest(key)}
                              />
                              <span className="flex-1 min-w-0 truncate">
                                <span className="font-medium">{t.typeLabel}</span>
                                {t.unit && (
                                  <span className="text-muted-foreground ml-1">({t.unit})</span>
                                )}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* === DATE & TIME === */}
            <section className="space-y-3">
              <Label className="text-base font-semibold">Date & horaires</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Date de départ</Label>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Heure de début</Label>
                  <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Heure de fin</Label>
                  <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Lieu (optionnel)</Label>
                <Input
                  placeholder="ex. Salle de musculation, Stade…"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
            </section>

            {/* === RECURRENCE === */}
            <section className="space-y-3">
              <Label className="text-base font-semibold flex items-center gap-2">
                <Repeat className="h-4 w-4 text-primary" />
                Récurrence
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {RECURRENCE_OPTIONS.map((opt) => (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => setRecurrence(opt.value)}
                    className={`text-left rounded-xl border px-3 py-2 transition-all ${
                      recurrence === opt.value
                        ? "border-primary bg-primary/10 shadow-sm"
                        : "border-border bg-surface hover:border-border-strong"
                    }`}
                  >
                    <p className="text-sm font-semibold">{opt.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{opt.hint}</p>
                  </button>
                ))}
              </div>

              {recurrence !== "once" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl bg-[hsl(var(--surface-sunken))] border border-border p-3">
                  {recurrence === "custom_weeks" && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Toutes les … semaines</Label>
                      <Input
                        type="number"
                        min={1}
                        max={52}
                        value={customWeeks}
                        onChange={(e) => setCustomWeeks(parseInt(e.target.value) || 1)}
                      />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nombre de séances à générer</Label>
                    <Select
                      value={String(occurrences)}
                      onValueChange={(v) => setOccurrences(parseInt(v))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[3, 4, 6, 8, 10, 12, 18, 24].map((n) => (
                          <SelectItem key={n} value={String(n)}>{n} séances</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* PREVIEW */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
                <p className="text-xs font-semibold text-primary mb-1.5">
                  📅 Aperçu — {totalSessions} séance{totalSessions > 1 ? "s" : ""} sera{totalSessions > 1 ? "ont" : ""} créée{totalSessions > 1 ? "s" : ""}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {previewDates.map((d) => (
                    <Badge key={d} variant="outline" className="bg-surface">
                      {format(new Date(d), "EEE d MMM yyyy", { locale: fr })}
                    </Badge>
                  ))}
                  {totalSessions > previewDates.length && (
                    <Badge variant="secondary">+ {totalSessions - previewDates.length} autres</Badge>
                  )}
                </div>
              </div>
            </section>

            {/* === NOTES === */}
            <section className="space-y-2">
              <Label className="text-base font-semibold">Notes (optionnel)</Label>
              <Textarea
                placeholder="Consignes, matériel à prévoir, objectif de la séance…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </section>
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t bg-[hsl(var(--surface-sunken))]">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            variant="premium"
            onClick={() => planTests.mutate()}
            disabled={planTests.isPending}
          >
            <CalendarPlus className="h-4 w-4" />
            {planTests.isPending
              ? "Planification…"
              : `Planifier ${totalSessions > 1 ? `${totalSessions} séances` : "la séance"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
