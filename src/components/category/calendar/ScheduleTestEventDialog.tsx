import { useEffect, useMemo, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClipboardList, Layers, Users, Star, Plus, X } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import {
  TEST_CATEGORIES,
  type TestOption,
  type TestCategory,
} from "@/lib/constants/testCategories";
import {
  mergeCustomTestsIntoCategories,
  type CustomTestCatalogItem,
} from "@/components/category/tests/customTestCatalog";
import { useSessionNotifications } from "@/lib/hooks/useSessionNotifications";
import { cn } from "@/lib/utils";

interface ScheduleTestEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  categoryId: string;
}

interface SelectedTest {
  test_category: string;
  test_category_label: string;
  test_type: string;
  test_label: string;
  result_unit: string;
}

export function ScheduleTestEventDialog({
  open,
  onOpenChange,
  date,
  categoryId,
}: ScheduleTestEventDialogProps) {
  const queryClient = useQueryClient();
  const { notify } = useSessionNotifications();

  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [search, setSearch] = useState("");
  const [selectedTests, setSelectedTests] = useState<Record<string, SelectedTest>>({});
  const [selectedBatteryId, setSelectedBatteryId] = useState<string | null>(null);
  const [mode, setMode] = useState<"individual" | "battery">("individual");
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(true);
  const [notes, setNotes] = useState("");

  // Fetch club_id
  const { data: clubData } = useQuery({
    queryKey: ["category-club", categoryId],
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("club_id")
        .eq("id", categoryId)
        .single();
      return data;
    },
    enabled: open,
  });

  // Fetch custom tests defined in Programmation > Tests for this club
  const { data: customTests } = useQuery({
    queryKey: ["custom-tests-catalog", clubData?.club_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_tests")
        .select("name, test_category, unit, is_time")
        .eq("club_id", clubData?.club_id || "")
        .order("name");
      if (error) throw error;
      return (data || []) as CustomTestCatalogItem[];
    },
    enabled: open && !!clubData?.club_id,
  });

  // Fetch batteries for this category/club
  const { data: batteries } = useQuery({
    queryKey: ["test-batteries-schedule", categoryId, clubData?.club_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_batteries")
        .select("id, name, description, items:test_battery_items(test_name, test_category, unit)")
        .or(`category_id.eq.${categoryId},category_id.is.null`)
        .eq("club_id", clubData?.club_id || "")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!clubData?.club_id,
  });

  // Fetch players
  const { data: players } = useQuery({
    queryKey: ["players-schedule-test", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players_safe")
        .select("id, name, first_name, position")
        .eq("category_id", categoryId)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Auto-select all players by default when dialog opens
  useEffect(() => {
    if (open && players && selectAll) {
      setSelectedPlayers(players.map((p) => p.id));
    }
  }, [open, players, selectAll]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStartTime("09:00");
      setEndTime("10:00");
      setSearch("");
      setSelectedTests({});
      setSelectedBatteryId(null);
      setMode("individual");
      setSelectAll(true);
      setSelectedPlayers([]);
      setNotes("");
    }
  }, [open]);

  // Merge built-in + custom tests into a single hierarchical catalog
  const mergedCategories = useMemo<TestCategory[]>(() => {
    return mergeCustomTestsIntoCategories(TEST_CATEGORIES, customTests || []);
  }, [customTests]);

  const filteredCategories = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return mergedCategories;
    return mergedCategories
      .map((cat) => ({
        ...cat,
        tests: cat.tests.filter(
          (t) =>
            t.label.toLowerCase().includes(q) ||
            cat.label.toLowerCase().includes(q),
        ),
      }))
      .filter((cat) => cat.tests.length > 0);
  }, [mergedCategories, search]);

  const toggleTest = (cat: TestCategory, test: TestOption) => {
    const key = `${cat.value}::${test.value}`;
    setSelectedTests((prev) => {
      const next = { ...prev };
      if (next[key]) {
        delete next[key];
      } else {
        next[key] = {
          test_category: cat.value,
          test_category_label: cat.label,
          test_type: test.value,
          test_label: test.label,
          result_unit: test.unit || "",
        };
      }
      return next;
    });
  };

  const togglePlayer = (id: string) => {
    setSelectAll(false);
    setSelectedPlayers((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  const handleSelectAll = (checked: boolean | string) => {
    const isChecked = Boolean(checked);
    setSelectAll(isChecked);
    if (isChecked && players) {
      setSelectedPlayers(players.map((p) => p.id));
    } else {
      setSelectedPlayers([]);
    }
  };

  const selectedBattery = useMemo(
    () => batteries?.find((b: any) => b.id === selectedBatteryId),
    [batteries, selectedBatteryId],
  );

  const selectedTestsList = Object.values(selectedTests);

  const schedule = useMutation({
    mutationFn: async () => {
      let testsMeta: Array<{
        test_category: string;
        test_type: string;
        result_unit?: string;
      }> = [];
      let title = "";

      if (mode === "battery") {
        if (!selectedBattery) throw new Error("Sélectionnez une batterie");
        testsMeta = (selectedBattery.items || []).map((it: any) => ({
          test_category: it.test_category,
          test_type: it.test_name,
          result_unit: it.unit || "",
        }));
        title = `Batterie : ${selectedBattery.name}`;
      } else {
        if (selectedTestsList.length === 0)
          throw new Error("Sélectionnez au moins un test");
        testsMeta = selectedTestsList.map((t) => ({
          test_category: t.test_category,
          test_type: t.test_type,
          result_unit: t.result_unit,
        }));
        title =
          selectedTestsList.length === 1
            ? `Test : ${selectedTestsList[0].test_label}`
            : `Batterie de ${selectedTestsList.length} tests`;
      }

      if (selectedPlayers.length === 0)
        throw new Error("Sélectionnez au moins un athlète");

      const noteContent = `${title}${notes ? `\n${notes}` : ""}`;
      const fullNotes = `${noteContent}\n<!--TESTS:${JSON.stringify(testsMeta)}-->`;

      const { data: session, error } = await supabase
        .from("training_sessions")
        .insert({
          category_id: categoryId,
          session_date: format(date, "yyyy-MM-dd"),
          session_start_time: startTime,
          session_end_time: endTime,
          training_type: "test",
          notes: fullNotes,
          intensity: 1,
        })
        .select("id")
        .single();
      if (error) throw error;

      // Save participants in event_participants
      if (selectedPlayers.length > 0 && session) {
        await supabase.from("event_participants").insert(
          selectedPlayers.map((pid) => ({
            training_session_id: session.id,
            player_id: pid,
          })),
        );
      }

      return session;
    },
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: ["training_sessions", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["sessions", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["today_sessions", categoryId] });
      toast.success("Test planifié au calendrier");

      if (session?.id) {
        notify({
          action: "created",
          sessionId: session.id,
          categoryId,
          sessionDate: format(date, "yyyy-MM-dd"),
          sessionStartTime: startTime || null,
          sessionType: "test",
        });
      }

      onOpenChange(false);
    },
    onError: (e: any) => {
      toast.error(e?.message || "Erreur lors de la planification");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col overflow-hidden border-border/70 bg-background/95 p-0 shadow-2xl backdrop-blur-md">
        <DialogHeader className="shrink-0 border-b border-border/60 px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <ClipboardList className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            Planifier un test physique
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {format(date, "EEEE d MMMM yyyy", { locale: fr })}
          </p>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-5">
          {/* Time slot */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Heure de début</Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Heure de fin</Label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          {/* Test selection */}
          <Tabs value={mode} onValueChange={(v) => setMode(v as "individual" | "battery")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="individual" className="gap-2">
                <ClipboardList className="h-4 w-4" />
                Tests à la carte
                {selectedTestsList.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {selectedTestsList.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="battery" className="gap-2">
                <Layers className="h-4 w-4" />
                Batterie de tests
                {selectedBatteryId && (
                  <Badge variant="secondary" className="ml-1">1</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="individual" className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Rechercher un test..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <ScrollArea className="h-[260px] rounded-2xl border bg-muted/20 p-2">
                <div className="space-y-2">
                  {filteredCategories.length === 0 ? (
                    <div className="p-6 text-center text-sm text-muted-foreground">
                      Aucun test trouvé
                    </div>
                  ) : (
                    filteredCategories.map((cat) => (
                      <div key={cat.value} className="space-y-1">
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-2 pt-2">
                          {cat.label}
                        </div>
                        {cat.tests.map((test) => {
                          const key = `${cat.value}::${test.value}`;
                          const isSel = !!selectedTests[key];
                          return (
                            <div
                              key={key}
                              onClick={() => toggleTest(cat, test)}
                              className={cn(
                                "flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all",
                                isSel
                                  ? "bg-primary/10 border-primary"
                                  : "bg-background hover:bg-muted/50 border-border/60",
                              )}
                            >
                              <Checkbox
                                checked={isSel}
                                onCheckedChange={() => toggleTest(cat, test)}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">
                                  {test.label}
                                </div>
                                {test.unit && (
                                  <div className="text-xs text-muted-foreground">
                                    Unité : {test.unit}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="battery" className="space-y-3">
              {(batteries?.length ?? 0) === 0 ? (
                <div className="text-center py-10 text-sm text-muted-foreground border-2 border-dashed rounded-2xl">
                  <Layers className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  Aucune batterie disponible.<br />
                  Créez-en une dans <strong>Programmation → Tests</strong>.
                </div>
              ) : (
                <ScrollArea className="h-[260px] rounded-2xl border bg-muted/20 p-2">
                  <div className="space-y-2">
                    {batteries!.map((b: any) => {
                      const isSel = selectedBatteryId === b.id;
                      return (
                        <div
                          key={b.id}
                          onClick={() => setSelectedBatteryId(isSel ? null : b.id)}
                          className={cn(
                            "p-3 rounded-xl border cursor-pointer transition-all",
                            isSel
                              ? "bg-primary/10 border-primary"
                              : "bg-background hover:bg-muted/50 border-border/60",
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <Checkbox checked={isSel} onCheckedChange={() => setSelectedBatteryId(isSel ? null : b.id)} />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm">{b.name}</div>
                              {b.description && (
                                <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                  {b.description}
                                </div>
                              )}
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                <Badge variant="secondary" className="text-[10px]">
                                  {b.items?.length || 0} tests
                                </Badge>
                                {(b.items || []).slice(0, 4).map((it: any, i: number) => (
                                  <Badge key={i} variant="outline" className="text-[10px]">
                                    {it.test_name}
                                  </Badge>
                                ))}
                                {(b.items?.length || 0) > 4 && (
                                  <Badge variant="outline" className="text-[10px]">
                                    +{(b.items?.length || 0) - 4}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>

          {/* Athlete selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Athlètes concernés
                <Badge variant="secondary">
                  {selectedPlayers.length}/{players?.length || 0}
                </Badge>
              </Label>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="select-all-players"
                  checked={selectAll}
                  onCheckedChange={handleSelectAll}
                />
                <Label htmlFor="select-all-players" className="text-xs cursor-pointer">
                  Tout l'effectif
                </Label>
              </div>
            </div>
            <ScrollArea className="h-[160px] rounded-2xl border bg-muted/20 p-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {(players || []).map((p) => {
                  const isSel = selectedPlayers.includes(p.id);
                  return (
                    <div
                      key={p.id}
                      onClick={() => togglePlayer(p.id)}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all text-sm",
                        isSel
                          ? "bg-primary/10 border-primary"
                          : "bg-background hover:bg-muted/50 border-border/60",
                      )}
                    >
                      <Checkbox checked={isSel} onCheckedChange={() => togglePlayer(p.id)} />
                      <span className="truncate">
                        {p.first_name} {p.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Optional notes */}
          <div className="space-y-1.5">
            <Label>Notes (optionnel)</Label>
            <Input
              placeholder="Lieu, consignes particulières..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t border-border/60 px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={() => schedule.mutate()} disabled={schedule.isPending}>
            {schedule.isPending ? "Planification..." : "Planifier au calendrier"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
