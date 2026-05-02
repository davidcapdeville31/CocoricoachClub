import { useState, useMemo, useEffect } from "react";
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
import { CalendarPlus, Repeat, Search, Users, ChevronDown, Star } from "lucide-react";
import { addMonths, addWeeks, format } from "date-fns";
import { fr } from "date-fns/locale";
import { useSessionNotifications } from "@/lib/hooks/useSessionNotifications";

type RecurrenceMode = "once" | "weekly" | "biweekly" | "monthly" | "quarterly" | "custom_weeks";

interface AvailableTest {
  category: string;
  categoryLabel: string;
  type: string;
  typeLabel: string;
  unit: string;
}

interface PlanTestsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
  availableTests: AvailableTest[];
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
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  // Favorite categories (shared with GenericTestsSection via localStorage)
  const favStorageKey = `tests-fav-categories:${categoryId}`;
  const [favoriteCategories, setFavoriteCategories] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(favStorageKey);
      if (raw) return new Set(JSON.parse(raw) as string[]);
    } catch {}
    return new Set();
  });
  useEffect(() => {
    const reload = () => {
      try {
        const raw = localStorage.getItem(favStorageKey);
        setFavoriteCategories(raw ? new Set(JSON.parse(raw) as string[]) : new Set());
      } catch {}
    };
    const handleCustom = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || detail.key === favStorageKey) reload();
    };
    window.addEventListener("tests-fav-categories-changed", handleCustom);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener("tests-fav-categories-changed", handleCustom);
      window.removeEventListener("storage", reload);
    };
  }, [favStorageKey]);

  const toggleFavoriteCategory = (catValue: string) => {
    setFavoriteCategories((prev) => {
      const next = new Set(prev);
      if (next.has(catValue)) next.delete(catValue);
      else next.add(catValue);
      try {
        localStorage.setItem(favStorageKey, JSON.stringify(Array.from(next)));
        window.dispatchEvent(
          new CustomEvent("tests-fav-categories-changed", { detail: { key: favStorageKey } })
        );
      } catch {}
      return next;
    });
  };

  // Athletes selection
  const [audience, setAudience] = useState<"all" | "selection">("selection");
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [playerSearch, setPlayerSearch] = useState("");

  const queryClient = useQueryClient();
  const { notify } = useSessionNotifications();

  const { data: players = [] } = useQuery({
    queryKey: ["players_safe_plan_tests", categoryId],
    enabled: open && !!categoryId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players_safe")
        .select("id, name, first_name, position, avatar_url")
        .eq("category_id", categoryId)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const filteredPlayers = useMemo(() => {
    const q = playerSearch.trim().toLowerCase();
    if (!q) return players;
    return players.filter((p: any) =>
      `${p.first_name || ""} ${p.name || ""}`.toLowerCase().includes(q)
    );
  }, [players, playerSearch]);

  const filteredTests = useMemo(() => {
    const q = search.trim().toLowerCase();
    return availableTests.filter((t) => {
      if (defaultCategoryFilter && defaultCategoryFilter !== "all" && t.category !== defaultCategoryFilter) {
        if (!q) return false;
      }
      if (!q) return true;
      return (
        t.typeLabel.toLowerCase().includes(q) ||
        t.categoryLabel.toLowerCase().includes(q)
      );
    });
  }, [availableTests, search, defaultCategoryFilter]);

  // Group by category for accordion
  const groupedTests = useMemo(() => {
    const map = new Map<string, AvailableTest[]>();
    filteredTests.forEach((t) => {
      const arr = map.get(t.categoryLabel) || [];
      arr.push(t);
      map.set(t.categoryLabel, arr);
    });
    return Array.from(map.entries());
  }, [filteredTests]);

  // Auto-select first category when categories change or on open
  useEffect(() => {
    if (groupedTests.length > 0 && !groupedTests.find(([l]) => l === selectedCategory)) {
      setSelectedCategory(groupedTests[0][0]);
    }
  }, [groupedTests, selectedCategory]);

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

  const togglePlayer = (id: string) => {
    setSelectedPlayerIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const togglePlayersAll = () => {
    if (selectedPlayerIds.length === filteredPlayers.length) {
      setSelectedPlayerIds([]);
    } else {
      setSelectedPlayerIds(filteredPlayers.map((p: any) => p.id));
    }
  };

  const selectedTests = useMemo(
    () => availableTests.filter((t) => selectedTestKeys.includes(`${t.category}::${t.type}`)),
    [availableTests, selectedTestKeys]
  );

  // Per-category selected count for accordion badges
  const selectedCountByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    selectedTests.forEach((t) => {
      map[t.categoryLabel] = (map[t.categoryLabel] || 0) + 1;
    });
    return map;
  }, [selectedTests]);

  const planTests = useMutation({
    mutationFn: async () => {
      if (selectedTests.length === 0) throw new Error("NO_TEST");
      if (!date) throw new Error("NO_DATE");
      if (audience === "selection" && selectedPlayerIds.length === 0) throw new Error("NO_PLAYER");

      const dates = computeDates();
      const testMeta = JSON.stringify(
        selectedTests.map((t) => ({
          test_category: t.category,
          test_type: t.type,
          result_unit: t.unit,
        }))
      );

      // Targeted players metadata (empty array = all athletes of the category)
      const targetPlayers = audience === "selection" ? selectedPlayerIds : [];
      const playersMeta = JSON.stringify(targetPlayers);

      const recurrenceLabel = RECURRENCE_OPTIONS.find((o) => o.value === recurrence)?.label || "";
      const baseNote = notes.trim();
      const audienceLabel =
        audience === "all"
          ? "👥 Tous les athlètes"
          : `👥 ${selectedPlayerIds.length} athlète(s) ciblé(s)`;
      const fullNote =
        `${baseNote ? baseNote + "\n\n" : ""}` +
        `📋 ${selectedTests.length} test(s) planifié(s)${recurrence !== "once" ? ` — ${recurrenceLabel}` : ""}` +
        `\n${audienceLabel}` +
        `\n<!--TESTS:${testMeta}-->` +
        `\n<!--TEST_PLAYERS:${playersMeta}-->`;

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
      setSelectedTestKeys([]);
      setSelectedPlayerIds([]);
      setAudience("all");
      setNotes("");
      onOpenChange(false);
    },
    onError: (e: any) => {
      if (e?.message === "NO_TEST") return toast.error("Sélectionnez au moins un test");
      if (e?.message === "NO_DATE") return toast.error("Choisissez une date de départ");
      if (e?.message === "NO_PLAYER") return toast.error("Sélectionnez au moins un athlète");
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
            Choisissez les tests par catégorie, la date / récurrence, et les athlètes concernés.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-6">
            {/* === TESTS SELECTION (Accordion) === */}
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
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

              <div className="rounded-xl border border-border bg-[hsl(var(--surface-sunken))] p-3 space-y-3">
                {groupedTests.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Aucun test disponible. Créez d'abord un test personnalisé.
                  </p>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Thématique</Label>
                      <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                        <SelectTrigger className="bg-surface">
                          <SelectValue placeholder="Choisir une thématique…" />
                        </SelectTrigger>
                        <SelectContent>
                          {groupedTests.map(([catLabel, tests]) => {
                            const count = selectedCountByCategory[catLabel] || 0;
                            return (
                              <SelectItem key={catLabel} value={catLabel}>
                                <span className="flex items-center gap-2">
                                  <span className="font-medium uppercase text-xs tracking-wide">{catLabel}</span>
                                  <span className="text-xs text-muted-foreground">({tests.length})</span>
                                  {count > 0 && (
                                    <Badge variant="default" className="text-[10px] h-4 px-1.5">{count}</Badge>
                                  )}
                                </span>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedCategory && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-64 overflow-y-auto">
                        {(groupedTests.find(([l]) => l === selectedCategory)?.[1] || []).map((t) => {
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
                    )}
                  </>
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

            {/* === ATHLETES === */}
            <section className="space-y-3">
              <Label className="text-base font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Athlètes concernés
              </Label>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAudience("all")}
                  className={`text-left rounded-xl border px-3 py-2 transition-all ${
                    audience === "all"
                      ? "border-primary bg-primary/10 shadow-sm"
                      : "border-border bg-surface hover:border-border-strong"
                  }`}
                >
                  <p className="text-sm font-semibold">Tous les athlètes</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Toute la catégorie ({players.length})
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setAudience("selection")}
                  className={`text-left rounded-xl border px-3 py-2 transition-all ${
                    audience === "selection"
                      ? "border-primary bg-primary/10 shadow-sm"
                      : "border-border bg-surface hover:border-border-strong"
                  }`}
                >
                  <p className="text-sm font-semibold">Sélection ciblée</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {selectedPlayerIds.length > 0
                      ? `${selectedPlayerIds.length} athlète(s) sélectionné(s)`
                      : "Choisir manuellement"}
                  </p>
                </button>
              </div>

              {audience === "selection" && (
                <div className="rounded-xl border border-border bg-[hsl(var(--surface-sunken))] p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Rechercher un athlète…"
                        value={playerSearch}
                        onChange={(e) => setPlayerSearch(e.target.value)}
                        className="pl-8 h-9"
                      />
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={togglePlayersAll}>
                      {selectedPlayerIds.length === filteredPlayers.length && filteredPlayers.length > 0
                        ? "Tout désélectionner"
                        : "Tout sélectionner"}
                    </Button>
                  </div>

                  <div className="max-h-56 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {filteredPlayers.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4 col-span-full">
                        Aucun athlète trouvé
                      </p>
                    ) : (
                      filteredPlayers.map((p: any) => {
                        const checked = selectedPlayerIds.includes(p.id);
                        return (
                          <label
                            key={p.id}
                            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-all ${
                              checked
                                ? "border-primary bg-primary/10"
                                : "border-border bg-surface hover:border-border-strong"
                            }`}
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => togglePlayer(p.id)}
                            />
                            <span className="flex-1 min-w-0 truncate">
                              <span className="font-medium">
                                {p.first_name} {p.name}
                              </span>
                              {p.position && (
                                <span className="text-muted-foreground ml-1 text-xs">
                                  ({p.position})
                                </span>
                              )}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
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
