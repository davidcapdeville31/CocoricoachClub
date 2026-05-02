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
import { ClipboardList, Layers, Users, Star, Plus, X, Info, Image as ImageIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import {
  TEST_CATEGORIES,
  type TestCategory,
} from "@/lib/constants/testCategories";
import {
  mergeCustomTestsIntoCategories,
  type CustomTestCatalogItem,
} from "@/components/category/tests/customTestCatalog";
import { normalizeCustomTestType } from "@/components/category/tests/customTestCatalog";
import { useSessionNotifications } from "@/lib/hooks/useSessionNotifications";
import { cn } from "@/lib/utils";

interface ScheduleTestEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  categoryId: string;
  /** When provided, the dialog edits this existing test session instead of creating a new one. */
  editSessionId?: string | null;
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
  editSessionId,
}: ScheduleTestEventDialogProps) {
  const queryClient = useQueryClient();
  const { notify } = useSessionNotifications();
  const isEditMode = !!editSessionId;

  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [activeTest, setActiveTest] = useState<string>("");
  const [selectedTests, setSelectedTests] = useState<Record<string, SelectedTest>>({});
  const [selectedBatteryId, setSelectedBatteryId] = useState<string | null>(null);
  const [mode, setMode] = useState<"individual" | "battery">("individual");
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(true);
  const [notes, setNotes] = useState("");

  // Favorites — synced with Programmation > Tests via localStorage + custom event
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

  const toggleFavorite = (categoryValue: string) => {
    setFavoriteCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryValue)) next.delete(categoryValue);
      else next.add(categoryValue);
      try {
        localStorage.setItem(favStorageKey, JSON.stringify(Array.from(next)));
      } catch {}
      window.dispatchEvent(
        new CustomEvent("tests-fav-categories-changed", { detail: { key: favStorageKey } }),
      );
      return next;
    });
  };

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
        .select("id, name, test_category, unit, is_time, description, image_url, video_url, objectives")
        .eq("club_id", clubData?.club_id || "")
        .order("name");
      if (error) throw error;
      return (data || []) as (CustomTestCatalogItem & { id: string; description?: string | null; image_url?: string | null; video_url?: string | null; objectives?: string | null })[];
    },
    enabled: open && !!clubData?.club_id,
  });

  // Map for quick metadata lookup by normalized test value
  const customMetaByValue = useMemo(() => {
    const map = new Map<string, any>();
    (customTests || []).forEach((t: any) => {
      const v = `custom_${normalizeCustomTestType(t.name)}`;
      map.set(v, t);
    });
    return map;
  }, [customTests]);

  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewVideo, setPreviewVideo] = useState<string | null>(null);

  const getYoutubeEmbed = (url: string) => {
    const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?\/\s]+)/);
    return m ? `https://www.youtube.com/embed/${m[1]}` : null;
  };
  const getVimeoEmbed = (url: string) => {
    const m = url.match(/vimeo\.com\/(\d+)/);
    return m ? `https://player.vimeo.com/video/${m[1]}` : null;
  };


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

  // Auto-select all players by default when dialog opens (creation only).
  useEffect(() => {
    if (open && !isEditMode && players && selectAll) {
      setSelectedPlayers(players.map((p) => p.id));
    }
  }, [open, players, selectAll, isEditMode]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStartTime("09:00");
      setEndTime("10:00");
      setActiveCategory("");
      setActiveTest("");
      setSelectedTests({});
      setSelectedBatteryId(null);
      setMode("individual");
      setSelectAll(true);
      setSelectedPlayers([]);
      setNotes("");
    }
  }, [open]);

  // --- Edit mode: load existing session + participants ----------------------
  const { data: existingSession } = useQuery({
    queryKey: ["test-session-edit", editSessionId],
    queryFn: async () => {
      if (!editSessionId) return null;
      const { data, error } = await supabase
        .from("training_sessions")
        .select("id, session_start_time, session_end_time, notes")
        .eq("id", editSessionId)
        .single();
      if (error) throw error;
      const { data: parts } = await supabase
        .from("event_participants")
        .select("player_id")
        .eq("training_session_id", editSessionId);
      return { session: data, participantIds: (parts || []).map((p) => p.player_id) };
    },
    enabled: open && !!editSessionId,
  });

  // Merge built-in + custom tests into a single hierarchical catalog
  const mergedCategories = useMemo<TestCategory[]>(() => {
    return mergeCustomTestsIntoCategories(TEST_CATEGORIES, customTests || []);
  }, [customTests]);

  // Sort categories: favorites first, then alphabetical by label
  const orderedCategories = useMemo(() => {
    const arr = [...mergedCategories];
    arr.sort((a, b) => {
      const af = favoriteCategories.has(a.value) ? 0 : 1;
      const bf = favoriteCategories.has(b.value) ? 0 : 1;
      if (af !== bf) return af - bf;
      return a.label.localeCompare(b.label);
    });
    return arr;
  }, [mergedCategories, favoriteCategories]);

  // Hydrate state once existingSession AND mergedCategories are available
  useEffect(() => {
    if (!open || !isEditMode || !existingSession?.session) return;
    const s = existingSession.session;
    if (s.session_start_time) setStartTime(String(s.session_start_time).slice(0, 5));
    if (s.session_end_time) setEndTime(String(s.session_end_time).slice(0, 5));

    const rawNotes = s.notes || "";
    const metaMatch = rawNotes.match(/<!--TESTS:(.*?)-->/);
    let visibleNotes = rawNotes.replace(/<!--TESTS:.*?-->/g, "").trim();
    // Strip the auto-prepended "Test : ..." / "Batterie : ..." title line
    visibleNotes = visibleNotes.replace(/^(Test\s*:|Batterie[^\n]*).*?(\n|$)/, "").trim();
    setNotes(visibleNotes);

    if (metaMatch) {
      try {
        const meta = JSON.parse(metaMatch[1]) as Array<{
          test_category: string;
          test_type: string;
          result_unit?: string;
        }>;
        const next: Record<string, SelectedTest> = {};
        meta.forEach((m) => {
          const cat = mergedCategories.find((c) => c.value === m.test_category);
          const t = cat?.tests.find((tt) => tt.value === m.test_type);
          const key = `${m.test_category}::${m.test_type}`;
          next[key] = {
            test_category: m.test_category,
            test_category_label: cat?.label || m.test_category,
            test_type: m.test_type,
            test_label: t?.label || m.test_type,
            result_unit: m.result_unit || t?.unit || "",
          };
        });
        setSelectedTests(next);
        setMode("individual");
        // Auto-select the category of the first hydrated test so the user sees the checked tests
        const firstMeta = meta[0];
        if (firstMeta?.test_category) {
          setActiveCategory(firstMeta.test_category);
        }
      } catch (err) {
        console.warn("Could not parse TESTS metadata", err);
      }
    }

    setSelectAll(false);
    setSelectedPlayers(existingSession.participantIds || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEditMode, existingSession, mergedCategories]);

  const selectedCategory = useMemo(
    () => mergedCategories.find((c) => c.value === activeCategory) || null,
    [mergedCategories, activeCategory],
  );

  const addCurrentTest = () => {
    if (!selectedCategory || !activeTest) {
      toast.error("Sélectionnez une catégorie et un test");
      return;
    }
    const test = selectedCategory.tests.find((t) => t.value === activeTest);
    if (!test) return;
    const key = `${selectedCategory.value}::${test.value}`;
    setSelectedTests((prev) => {
      if (prev[key]) return prev;
      return {
        ...prev,
        [key]: {
          test_category: selectedCategory.value,
          test_category_label: selectedCategory.label,
          test_type: test.value,
          test_label: test.label,
          result_unit: test.unit || "",
        },
      };
    });
    setActiveTest("");
  };

  const removeSelectedTest = (key: string) => {
    setSelectedTests((prev) => {
      const next = { ...prev };
      delete next[key];
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

      let savedSessionId: string | null = null;

      if (isEditMode && editSessionId) {
        // UPDATE existing test session
        const { error } = await supabase
          .from("training_sessions")
          .update({
            session_date: format(date, "yyyy-MM-dd"),
            session_start_time: startTime,
            session_end_time: endTime,
            notes: fullNotes,
          })
          .eq("id", editSessionId);
        if (error) throw error;
        savedSessionId = editSessionId;

        // Re-sync participants: delete existing + insert new selection
        await supabase
          .from("event_participants")
          .delete()
          .eq("training_session_id", editSessionId);

        if (selectedPlayers.length > 0) {
          await supabase.from("event_participants").insert(
            selectedPlayers.map((pid) => ({
              training_session_id: editSessionId,
              player_id: pid,
            })),
          );
        }
      } else {
        // CREATE new test session
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
        savedSessionId = session?.id ?? null;

        if (selectedPlayers.length > 0 && savedSessionId) {
          await supabase.from("event_participants").insert(
            selectedPlayers.map((pid) => ({
              training_session_id: savedSessionId!,
              player_id: pid,
            })),
          );
        }
      }

      return { id: savedSessionId };
    },
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: ["training_sessions", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["sessions", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["today_sessions", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["test-session-edit", editSessionId] });
      toast.success(isEditMode ? "Test mis à jour" : "Test planifié au calendrier");

      if (session?.id && !isEditMode) {
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
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col overflow-hidden border-border/70 bg-background/95 p-0 shadow-2xl backdrop-blur-md">
        <DialogHeader className="shrink-0 border-b border-border/60 px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <ClipboardList className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            {isEditMode ? "Modifier le test physique" : "Planifier un test physique"}
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
              {/* Category + Test selectors with favorite toggle */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Thématique</Label>
                  <div className="flex items-center gap-2">
                    <Select
                      value={activeCategory}
                      onValueChange={(v) => {
                        setActiveCategory(v);
                        setActiveTest("");
                      }}
                    >
                      <SelectTrigger className="flex-1 bg-muted/40">
                        <SelectValue placeholder="Choisir une thématique" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[320px]">
                        {orderedCategories.map((cat) => {
                          const isFav = favoriteCategories.has(cat.value);
                          return (
                            <SelectItem key={cat.value} value={cat.value}>
                              <span className="flex items-center gap-2">
                                {isFav && (
                                  <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                                )}
                                {cat.label}
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    {activeCategory && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="shrink-0"
                        onClick={() => toggleFavorite(activeCategory)}
                        title={
                          favoriteCategories.has(activeCategory)
                            ? "Retirer des favoris"
                            : "Ajouter aux favoris"
                        }
                      >
                        <Star
                          className={cn(
                            "h-4 w-4",
                            favoriteCategories.has(activeCategory)
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-muted-foreground",
                          )}
                        />
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Tests list for selected category */}
              {!selectedCategory ? (
                <div className="rounded-2xl border-2 border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                  Sélectionnez d'abord une thématique pour afficher les tests disponibles.
                </div>
              ) : (selectedCategory.tests || []).length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                  Aucun test dans cette thématique.
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">
                      Tests disponibles
                      <span className="text-muted-foreground ml-1">
                        ({selectedCategory.tests.length})
                      </span>
                    </Label>
                    {selectedTestsList.length > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setSelectedTests({})}
                      >
                        Tout désélectionner
                      </Button>
                    )}
                  </div>
                  <ScrollArea className="h-[260px] rounded-2xl border bg-muted/20 p-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {selectedCategory.tests.map((test) => {
                        const key = `${selectedCategory.value}::${test.value}`;
                        const isSel = !!selectedTests[key];
                        const meta = customMetaByValue.get(test.value);
                        const toggle = () => {
                          setSelectedTests((prev) => {
                            const next = { ...prev };
                            if (next[key]) delete next[key];
                            else
                              next[key] = {
                                test_category: selectedCategory.value,
                                test_category_label: selectedCategory.label,
                                test_type: test.value,
                                test_label: test.label,
                                result_unit: test.unit || "",
                              };
                            return next;
                          });
                        };
                        return (
                          <div
                            key={test.value}
                            className={cn(
                              "flex items-center gap-2 p-2 rounded-lg border transition-all text-sm",
                              isSel
                                ? "bg-primary/15 border-primary ring-1 ring-primary/40"
                                : "bg-background hover:bg-muted/50 border-border/60",
                            )}
                          >
                            {meta?.image_url ? (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setPreviewImage(meta.image_url); }}
                                className="shrink-0 h-10 w-10 rounded-md overflow-hidden border border-border bg-muted"
                                title="Voir la photo"
                              >
                                <img src={meta.image_url} alt={test.label} className="h-full w-full object-cover" />
                              </button>
                            ) : (
                              <div className="shrink-0 h-10 w-10 rounded-md bg-muted flex items-center justify-center text-muted-foreground">
                                <ImageIcon className="h-4 w-4" />
                              </div>
                            )}
                            <label
                              className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
                              onClick={(e) => { e.preventDefault(); toggle(); }}
                            >
                              <Checkbox checked={isSel} onCheckedChange={toggle} />
                              <span className="flex-1 truncate text-foreground">
                                {test.label}
                                {test.unit && (
                                  <span className="text-muted-foreground text-xs ml-1">
                                    ({test.unit})
                                  </span>
                                )}
                              </span>
                            </label>
                            {(meta?.description || meta?.objectives || meta?.video_url) && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 shrink-0"
                                    title="Détails"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Info className="h-4 w-4 text-muted-foreground" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent side="left" className="w-72 text-sm space-y-2">
                                  <p className="font-semibold">{test.label}</p>
                                  {meta?.description && (
                                    <p className="text-muted-foreground whitespace-pre-wrap text-xs">
                                      {meta.description}
                                    </p>
                                  )}
                                  {meta?.objectives && (
                                    <div className="text-xs">
                                      <span className="font-medium">Objectifs : </span>
                                      <span className="text-muted-foreground">{meta.objectives}</span>
                                    </div>
                                  )}
                                  {meta?.video_url && (
                                    <button
                                      type="button"
                                      onClick={() => setPreviewVideo(meta.video_url)}
                                      className="text-xs text-primary hover:underline inline-block"
                                    >
                                      Voir la vidéo →
                                    </button>
                                  )}
                                </PopoverContent>
                              </Popover>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                  {selectedTestsList.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      <strong>{selectedTestsList.length}</strong> test
                      {selectedTestsList.length > 1 ? "s" : ""} sélectionné
                      {selectedTestsList.length > 1 ? "s" : ""}.
                    </p>
                  )}
                </div>
              )}
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
            {schedule.isPending
              ? (isEditMode ? "Mise à jour..." : "Planification...")
              : (isEditMode ? "Enregistrer les modifications" : "Planifier au calendrier")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
