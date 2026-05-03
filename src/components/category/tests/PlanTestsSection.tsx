import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarPlus, Search, Star, Bell, Trash2, Pencil, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { format, addWeeks, isBefore, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { getTestCategoriesForSport, type TestCategory } from "@/lib/constants/testCategories";
import { formatCategoryLabel, formatTestTypeLabel } from "./customTestCatalog";
import { useViewerModeContext } from "@/contexts/ViewerModeContext";
import { useSessionNotifications } from "@/lib/hooks/useSessionNotifications";

// ---------- Types ----------
interface TestRef {
  test_category: string;
  test_type: string; // raw test_type or `custom:<id>`
  result_unit?: string;
  label: string;
  category_label: string;
}

interface TestReminder {
  id: string;
  category_id: string;
  test_type: string | null;
  test_metadata: TestRef[] | null;
  frequency_weeks: number;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  session_start_time: string | null;
  session_end_time: string | null;
  location: string | null;
  duration_minutes: number | null;
  auto_assign_athletes: boolean;
}

interface PlanTestsSectionProps {
  categoryId: string;
  sportType?: string;
}

// ---------- Helpers ----------
function generateSessionDates(
  startDate: string,
  frequencyWeeks: number,
  endDate?: string | null,
): string[] {
  const dates: string[] = [];
  const start = new Date(startDate);
  // Hard cap: 2 years to avoid runaway loops
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

const DEFAULT_FORM = {
  start_date: format(new Date(), "yyyy-MM-dd"),
  session_start_time: "09:00",
  session_end_time: "10:00",
  location: "",
  duration_minutes: 60,
  auto_assign_athletes: true,
  recurring: false,
  frequency_weeks: 4,
  end_mode: "date" as "date" | "duration" | "never",
  end_date: format(addWeeks(new Date(), 8), "yyyy-MM-dd"),
  duration_count: 2,
  duration_unit: "months" as "weeks" | "months",
};

// ---------- Component ----------
export function PlanTestsSection({ categoryId, sportType }: PlanTestsSectionProps) {
  const queryClient = useQueryClient();
  const { isViewer } = useViewerModeContext();
  const { notify } = useSessionNotifications();

  // ---- Catalog: built-in + custom tests for this category ----
  const allSportCategories = useMemo(
    () => getTestCategoriesForSport(sportType || "").filter((c) => !c.value.startsWith("rehab_")),
    [sportType],
  );

  const { data: customTestsList } = useQuery({
    queryKey: ["plan-custom-tests", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_test_categories")
        .select("custom_tests(id, name, test_category, unit)")
        .eq("category_id", categoryId);
      if (error) throw error;
      return (data || [])
        .map((row: any) => row.custom_tests)
        .filter(Boolean)
        .filter((t: any) => !t.test_category?.startsWith("rehab_"));
    },
  });

  // Merge built-in + custom into TestCategory[] structure
  const catalog: TestCategory[] = useMemo(() => {
    const map = new Map<string, TestCategory>();
    allSportCategories.forEach((c) => map.set(c.value, { ...c, tests: [...c.tests] }));
    (customTestsList || []).forEach((ct: any) => {
      const cv = ct.test_category;
      if (!cv) return;
      const existing = map.get(cv);
      const entry = {
        value: `custom:${ct.id}`,
        label: ct.name,
        unit: ct.unit || "",
      };
      if (existing) {
        if (!existing.tests.find((t) => t.value === entry.value)) existing.tests.push(entry);
      } else {
        map.set(cv, { value: cv, label: formatCategoryLabel(cv), tests: [entry] });
      }
    });
    return Array.from(map.values());
  }, [allSportCategories, customTestsList]);

  // ---- Selection state ----
  const [selected, setSelected] = useState<Map<string, TestRef>>(new Map());
  const [search, setSearch] = useState("");
  const [showFavorites, setShowFavorites] = useState(false);

  // Favorites (per category) - shared with TestsTab
  const favStorageKey = `tests-fav-categories:${categoryId}`;
  const [favCategories, setFavCategories] = useState<Set<string>>(() => {
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
        setFavCategories(raw ? new Set(JSON.parse(raw) as string[]) : new Set());
      } catch {}
    };
    window.addEventListener("tests-fav-categories-changed", reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener("tests-fav-categories-changed", reload);
      window.removeEventListener("storage", reload);
    };
  }, [favStorageKey]);

  // ---- Form state ----
  const [form, setForm] = useState({ ...DEFAULT_FORM });

  // ---- Filtering ----
  const filteredCatalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalog
      .filter((c) => (showFavorites ? favCategories.has(c.value) : true))
      .map((c) => ({
        ...c,
        tests: c.tests.filter(
          (t) =>
            !q ||
            t.label.toLowerCase().includes(q) ||
            c.label.toLowerCase().includes(q),
        ),
      }))
      .filter((c) => c.tests.length > 0);
  }, [catalog, search, showFavorites, favCategories]);

  // ---- Selection helpers ----
  const toggleTest = (cat: TestCategory, test: TestCategory["tests"][number]) => {
    const key = `${cat.value}::${test.value}`;
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(key)) next.delete(key);
      else
        next.set(key, {
          test_category: cat.value,
          test_type: test.value,
          result_unit: test.unit,
          label: test.label,
          category_label: cat.label,
        });
      return next;
    });
  };

  const isSelected = (cat: TestCategory, test: TestCategory["tests"][number]) =>
    selected.has(`${cat.value}::${test.value}`);

  const removeSelected = (key: string) => {
    setSelected((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  };

  // ---- Existing reminders ----
  const { data: reminders } = useQuery({
    queryKey: ["plan-tests-reminders", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_reminders")
        .select("*")
        .eq("category_id", categoryId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as TestReminder[];
    },
  });

  // ---- Athletes helpers ----
  async function getNonInjuredPlayerIds(): Promise<string[]> {
    const { data: players, error: pErr } = await supabase
      .from("players")
      .select("id")
      .eq("category_id", categoryId);
    if (pErr) throw pErr;
    const { data: injuries, error: iErr } = await supabase
      .from("injuries")
      .select("player_id")
      .eq("category_id", categoryId)
      .eq("status", "active");
    if (iErr) throw iErr;
    const injuredSet = new Set((injuries || []).map((i: any) => i.player_id));
    return (players || []).map((p: any) => p.id).filter((id: string) => !injuredSet.has(id));
  }

  async function createSessionsForTests(
    tests: TestRef[],
    dates: string[],
    f: typeof form,
    reminderId: string | null,
  ): Promise<{ ids: string[]; dates: string[] }> {
    const meta = JSON.stringify(
      tests.map((t) => ({
        test_category: t.test_category,
        test_type: t.test_type,
        result_unit: t.result_unit,
      })),
    );
    const summary = tests.map((t) => `📋 ${t.label}`).join("\n");
    const locationLine = f.location ? `\n📍 Lieu: ${f.location}` : "";
    const sessions = dates.map((date) => ({
      category_id: categoryId,
      session_date: date,
      session_start_time: f.session_start_time || null,
      session_end_time: f.session_end_time || null,
      training_type: "test",
      notes: `${summary}${locationLine}\n<!--TESTS:${meta}-->`,
      test_reminder_id: reminderId,
    }));
    const { data: inserted, error } = await supabase
      .from("training_sessions")
      .insert(sessions)
      .select("id");
    if (error) throw error;

    if (f.auto_assign_athletes && inserted?.length) {
      const playerIds = await getNonInjuredPlayerIds();
      if (playerIds.length > 0) {
        const rows = inserted.flatMap((s: any, idx: number) =>
          playerIds.map((pid) => ({
            training_session_id: s.id,
            category_id: categoryId,
            player_id: pid,
            attendance_date: dates[idx],
            status: "present",
          })),
        );
        if (rows.length > 0) {
          const { error: aErr } = await supabase.from("training_attendance").insert(rows);
          if (aErr) console.error("Attendance auto-assign failed:", aErr);
        }
      }
    }
    return { ids: (inserted || []).map((s: any) => s.id), dates };
  }

  // ---- Submit ----
  const planMutation = useMutation({
    mutationFn: async () => {
      const tests = Array.from(selected.values());
      if (tests.length === 0) throw new Error("Sélectionne au moins un test");

      const computedEndDate = form.recurring
        ? form.end_mode === "never"
          ? null
          : form.end_mode === "duration"
            ? format(
                addWeeks(
                  new Date(form.start_date),
                  form.duration_unit === "months"
                    ? form.duration_count * 4
                    : form.duration_count,
                ),
                "yyyy-MM-dd",
              )
            : form.end_date
        : null;

      const dates = form.recurring
        ? generateSessionDates(form.start_date, form.frequency_weeks, computedEndDate)
        : [form.start_date];
      if (dates.length === 0) throw new Error("Aucune date à planifier");

      let reminderId: string | null = null;
      if (form.recurring) {
        const { data, error } = await supabase
          .from("test_reminders")
          .insert({
            category_id: categoryId,
            test_type: tests[0].test_type, // legacy field
            test_metadata: tests as any,
            frequency_weeks: form.frequency_weeks,
            start_date: form.start_date,
            end_date: computedEndDate,
            session_start_time: form.session_start_time || null,
            session_end_time: form.session_end_time || null,
            location: form.location || null,
            duration_minutes: form.duration_minutes,
            auto_assign_athletes: form.auto_assign_athletes,
            is_active: true,
          } as any)
          .select("id")
          .single();
        if (error) throw error;
        reminderId = data.id;
      }

      const result = await createSessionsForTests(tests, dates, form, reminderId);
      return { ...result, recurring: form.recurring };
    },
    onSuccess: ({ ids, dates, recurring }) => {
      queryClient.invalidateQueries({ queryKey: ["plan-tests-reminders", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["test-reminders", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["training_sessions", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["training_sessions_annual", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["today_sessions", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["today-training-sessions", categoryId] });

      // notify athletes for the first session
      if (ids[0]) {
        notify({
          action: "created",
          sessionId: ids[0],
          categoryId,
          sessionDate: dates[0],
          sessionStartTime: form.session_start_time || null,
          sessionType: "test",
        });
      }

      toast.success(
        recurring
          ? `${dates.length} séance(s) de tests planifiée(s) (rappel récurrent créé)`
          : "Séance de tests planifiée dans le calendrier",
      );
      setSelected(new Map());
    },
    onError: (e: any) => {
      toast.error(e?.message || "Impossible de planifier les tests");
    },
  });

  const handlePlan = () => {
    if (selected.size === 0) {
      toast.error("Sélectionne au moins un test à planifier");
      return;
    }
    if (!form.start_date) {
      toast.error("Choisis une date de départ");
      return;
    }
    planMutation.mutate();
  };

  // ---- Reminder actions ----
  const toggleReminder = useMutation({
    mutationFn: async ({ r, isActive }: { r: TestReminder; isActive: boolean }) => {
      const { error } = await supabase
        .from("test_reminders")
        .update({ is_active: isActive })
        .eq("id", r.id);
      if (error) throw error;
      const today = format(new Date(), "yyyy-MM-dd");
      if (!isActive) {
        const { error: dErr } = await supabase
          .from("training_sessions")
          .delete()
          .eq("test_reminder_id", r.id)
          .gte("session_date", today);
        if (dErr) throw dErr;
      } else if (r.start_date) {
        const tests: TestRef[] = (r.test_metadata && r.test_metadata.length > 0
          ? r.test_metadata
          : [
              {
                test_category: "custom",
                test_type: r.test_type || "",
                label: r.test_type || "Test",
                category_label: "Tests",
              },
            ]) as TestRef[];
        const dates = generateSessionDates(r.start_date, r.frequency_weeks);
        await createSessionsForTests(
          tests,
          dates,
          {
            ...DEFAULT_FORM,
            session_start_time: r.session_start_time || "",
            session_end_time: r.session_end_time || "",
            location: r.location || "",
            duration_minutes: r.duration_minutes ?? 60,
            auto_assign_athletes: r.auto_assign_athletes,
            recurring: true,
            frequency_weeks: r.frequency_weeks,
            start_date: r.start_date,
          },
          r.id,
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plan-tests-reminders", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["training_sessions", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["training_sessions_annual", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["today_sessions", categoryId] });
      toast.success("Rappel mis à jour");
    },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });

  const deleteReminder = useMutation({
    mutationFn: async (id: string) => {
      const today = format(new Date(), "yyyy-MM-dd");
      const { error: dErr } = await supabase
        .from("training_sessions")
        .delete()
        .eq("test_reminder_id", id)
        .gte("session_date", today);
      if (dErr) throw dErr;
      const { error } = await supabase.from("test_reminders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plan-tests-reminders", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["training_sessions", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["training_sessions_annual", categoryId] });
      toast.success("Rappel supprimé");
    },
    onError: () => toast.error("Suppression impossible"),
  });

  const previewDates = form.recurring
    ? generateSessionDates(form.start_date, form.frequency_weeks).slice(0, 4)
    : [];

  return (
    <div className="space-y-6">
      {/* === Planification === */}
      <Card className="bg-gradient-card shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5 text-primary" />
            Planifier des tests dans le calendrier
          </CardTitle>
          <CardDescription>
            Choisis les tests par catégorie, la date / récurrence, et les athlètes concernés. Les
            séances apparaîtront dans le calendrier.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* --- Tests à planifier --- */}
          <div className="rounded-2xl border border-border bg-surface-sunken/40 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Tests à planifier</h3>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={showFavorites ? "default" : "outline"}
                  onClick={() => setShowFavorites((v) => !v)}
                >
                  <Star className={`h-4 w-4 mr-1 ${showFavorites ? "fill-current" : ""}`} />
                  Favoris
                </Button>
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher un test"
                    className="pl-8 h-9 w-[200px]"
                  />
                </div>
              </div>
            </div>

            {/* Selected chips */}
            {selected.size > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {Array.from(selected.entries()).map(([k, v]) => (
                  <Badge key={k} variant="secondary" className="gap-1 pl-2 pr-1">
                    {v.label}
                    <button
                      type="button"
                      onClick={() => removeSelected(k)}
                      className="rounded-full p-0.5 hover:bg-background/60"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            {/* Catalog grouped by category */}
            <div className="max-h-[360px] overflow-y-auto space-y-3 pr-1">
              {filteredCatalog.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Aucun test trouvé.
                </p>
              )}
              {filteredCatalog.map((cat) => (
                <div key={cat.value} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {cat.label}
                    </span>
                    <span className="text-xs text-muted-foreground/70">({cat.tests.length})</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {cat.tests.map((t) => (
                      <label
                        key={t.value}
                        className="flex items-center gap-2 rounded-xl bg-background/60 hover:bg-background border border-border/60 px-2.5 py-2 cursor-pointer transition-colors"
                      >
                        <Checkbox
                          checked={isSelected(cat, t)}
                          onCheckedChange={() => toggleTest(cat, t)}
                        />
                        <span className="text-sm truncate">{t.label}</span>
                        {t.unit && (
                          <span className="text-[11px] text-muted-foreground ml-auto shrink-0">
                            ({t.unit})
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* --- Date & horaires --- */}
          <div className="rounded-2xl border border-border bg-surface-sunken/40 p-4 space-y-3">
            <h3 className="text-sm font-semibold">Date & horaires</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Date de départ</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Heure de début</Label>
                <Input
                  type="time"
                  value={form.session_start_time}
                  onChange={(e) => setForm({ ...form, session_start_time: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Heure de fin</Label>
                <Input
                  type="time"
                  value={form.session_end_time}
                  onChange={(e) => setForm({ ...form, session_end_time: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Lieu (optionnel)</Label>
                <Input
                  placeholder="Ex: Stade municipal"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Durée (minutes)</Label>
                <Input
                  type="number"
                  min={5}
                  value={form.duration_minutes}
                  onChange={(e) =>
                    setForm({ ...form, duration_minutes: parseInt(e.target.value) || 60 })
                  }
                />
              </div>
            </div>
          </div>

          {/* --- Récurrence + auto assign --- */}
          <div className="rounded-2xl border border-border bg-surface-sunken/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-semibold">Récurrence</Label>
                <p className="text-xs text-muted-foreground">
                  Crée automatiquement les séances suivantes pendant ~6 mois.
                </p>
              </div>
              <Switch
                checked={form.recurring}
                onCheckedChange={(checked) => setForm({ ...form, recurring: checked })}
              />
            </div>
            {form.recurring && (
              <div className="space-y-2">
                <Label className="text-xs">Fréquence</Label>
                <Select
                  value={String(form.frequency_weeks)}
                  onValueChange={(v) => setForm({ ...form, frequency_weeks: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Toutes les semaines</SelectItem>
                    <SelectItem value="2">Toutes les 2 semaines</SelectItem>
                    <SelectItem value="3">Toutes les 3 semaines</SelectItem>
                    <SelectItem value="4">Toutes les 4 semaines</SelectItem>
                    <SelectItem value="6">Toutes les 6 semaines</SelectItem>
                    <SelectItem value="8">Toutes les 8 semaines</SelectItem>
                    <SelectItem value="12">Toutes les 12 semaines</SelectItem>
                  </SelectContent>
                </Select>
                {previewDates.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Aperçu : {previewDates.map((d) => format(new Date(d), "dd MMM", { locale: fr })).join(", ")}…
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/40 p-3">
              <div>
                <Label className="text-sm">Auto-assigner les athlètes</Label>
                <p className="text-xs text-muted-foreground">
                  Tous les athlètes non blessés seront ajoutés à chaque séance.
                </p>
              </div>
              <Switch
                checked={form.auto_assign_athletes}
                onCheckedChange={(checked) => setForm({ ...form, auto_assign_athletes: checked })}
              />
            </div>
          </div>

          {/* --- Action --- */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <p className="text-xs text-muted-foreground">
              {selected.size} test{selected.size > 1 ? "s" : ""} sélectionné{selected.size > 1 ? "s" : ""}
              {form.recurring ? ` • ${previewDates.length || 0} séances prévues` : " • 1 séance"}
            </p>
            <Button
              onClick={handlePlan}
              disabled={isViewer || planMutation.isPending}
              size="lg"
              className="bg-gradient-to-r from-primary to-primary/80"
            >
              <CalendarPlus className="h-4 w-4 mr-2" />
              {planMutation.isPending
                ? "Planification..."
                : form.recurring
                  ? "Planifier (récurrent)"
                  : "Planifier dans le calendrier"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* === Existing reminders === */}
      <Card className="bg-gradient-card shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Rappels de tests récurrents
          </CardTitle>
          <CardDescription>
            Les rappels actifs créent automatiquement des séances dans le calendrier.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {reminders && reminders.length > 0 ? (
            <div className="grid gap-3">
              {reminders.map((r) => {
                const tests: TestRef[] =
                  (r.test_metadata && r.test_metadata.length > 0)
                    ? r.test_metadata
                    : [
                        {
                          test_category: "",
                          test_type: r.test_type || "",
                          label: formatTestTypeLabel(r.test_type || ""),
                          category_label: "",
                        },
                      ];
                return (
                  <div
                    key={r.id}
                    className="rounded-2xl border border-border bg-background/40 p-4 flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {tests.map((t, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {t.label}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Début:{" "}
                        {r.start_date
                          ? format(new Date(r.start_date), "dd MMMM yyyy", { locale: fr })
                          : "—"}{" "}
                        • Tous les {r.frequency_weeks} semaines
                        {(r.session_start_time || r.session_end_time) && (
                          <>
                            {" "}
                            • {r.session_start_time?.slice(0, 5) || "—"}
                            {r.session_end_time ? `→${r.session_end_time.slice(0, 5)}` : ""}
                          </>
                        )}
                        {r.location && <> • 📍 {r.location}</>}
                      </p>
                      <Badge
                        variant={r.is_active ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {r.is_active ? "Actif" : "Inactif"}
                      </Badge>
                    </div>
                    {!isViewer && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Switch
                          checked={r.is_active}
                          onCheckedChange={(checked) =>
                            toggleReminder.mutate({ r, isActive: checked })
                          }
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Supprimer"
                          onClick={() => deleteReminder.mutate(r.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">
              Aucun rappel récurrent. Active la récurrence ci-dessus pour en créer un.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
