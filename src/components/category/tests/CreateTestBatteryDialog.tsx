import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Search, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  TEST_UNIT_OPTIONS, type ScoringScale, DEFAULT_BATTERY_LEVELS, type BatteryLevel,
} from "@/lib/constants/testUnits";
import { ScoringScaleEditor } from "./ScoringScaleEditor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CreateTestBatteryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
  clubId: string;
  batteryId?: string | null;
}

interface SelectedItem {
  id: string;
  custom_test_id: string;
  test_name: string;
  test_category: string;
  unit: string;
  scoring_scale: ScoringScale | null;
  max_points: number;
}

export function CreateTestBatteryDialog({ open, onOpenChange, categoryId, clubId, batteryId }: CreateTestBatteryDialogProps) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Record<string, SelectedItem>>({});
  const [levels, setLevels] = useState<BatteryLevel[]>(DEFAULT_BATTERY_LEVELS);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  // Load custom tests with scoring scale for this club
  const { data: customTests } = useQuery({
    queryKey: ["custom-tests-scored", clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_tests")
        .select("id, name, test_category, unit, scoring_scale, max_points")
        .eq("club_id", clubId)
        .order("name");
      if (error) throw error;
      return (data || []).filter((t: any) => t.scoring_scale);
    },
    enabled: open,
  });

  // Load existing battery if editing
  const { data: existingBattery } = useQuery({
    queryKey: ["test-battery", batteryId],
    queryFn: async () => {
      if (!batteryId) return null;
      const { data: b } = await supabase.from("test_batteries").select("*").eq("id", batteryId).single();
      const { data: items } = await supabase
        .from("test_battery_items").select("*").eq("battery_id", batteryId).order("position");
      return { battery: b, items: items || [] };
    },
    enabled: open && !!batteryId,
  });

  useEffect(() => {
    if (!open) return;
    if (existingBattery?.battery) {
      setName(existingBattery.battery.name);
      setDescription(existingBattery.battery.description || "");
      setLevels((existingBattery.battery.levels as any) || DEFAULT_BATTERY_LEVELS);
      const sel: Record<string, SelectedItem> = {};
      existingBattery.items.forEach((it: any) => {
        if (it.custom_test_id) {
          sel[it.custom_test_id] = {
            id: it.id,
            custom_test_id: it.custom_test_id,
            test_name: it.test_name,
            test_category: it.test_category,
            unit: it.unit || "",
            scoring_scale: it.scoring_scale,
            max_points: Number(it.max_points) || 0,
          };
        }
      });
      setSelected(sel);
    } else if (!batteryId) {
      // Mode création: réinitialiser
      setName(""); setDescription(""); setSelected({});
      setLevels(DEFAULT_BATTERY_LEVELS);
    }
  }, [existingBattery, open, batteryId]);

  const filteredTests = useMemo(() => {
    const q = search.toLowerCase().trim();
    return (customTests || []).filter((t: any) =>
      !q || t.name.toLowerCase().includes(q) || (t.test_category || "").toLowerCase().includes(q)
    );
  }, [customTests, search]);

  const totalMax = useMemo(
    () => Object.values(selected).reduce((s, it) => s + it.max_points, 0),
    [selected]
  );

  const toggleTest = (test: any) => {
    setSelected(prev => {
      const next = { ...prev };
      if (next[test.id]) {
        delete next[test.id];
      } else {
        next[test.id] = {
          id: crypto.randomUUID(),
          custom_test_id: test.id,
          test_name: test.name,
          test_category: test.test_category,
          unit: test.unit || "",
          scoring_scale: test.scoring_scale,
          max_points: Number(test.max_points) || 0,
        };
      }
      return next;
    });
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Le nom de la batterie est requis");
      if (Object.keys(selected).length === 0) throw new Error("Sélectionnez au moins un test");

      const { data: user } = await supabase.auth.getUser();
      let bId = batteryId;

      if (bId) {
        await supabase.from("test_batteries").update({
          name: name.trim(),
          description: description.trim() || null,
          levels: levels as any,
        }).eq("id", bId);
        await supabase.from("test_battery_items").delete().eq("battery_id", bId);
      } else {
        const { data: created, error } = await supabase.from("test_batteries").insert({
          club_id: clubId,
          category_id: categoryId,
          name: name.trim(),
          description: description.trim() || null,
          levels: levels as any,
          created_by: user?.user?.id || null,
        }).select("id").single();
        if (error) throw error;
        bId = created.id;
      }

      const items = Object.values(selected).map((it, idx) => ({
        battery_id: bId!,
        custom_test_id: it.custom_test_id,
        test_category: it.test_category,
        test_name: it.test_name,
        unit: it.unit,
        scoring_scale: it.scoring_scale as any,
        max_points: it.max_points,
        position: idx,
      }));
      const { error: itemsErr } = await supabase.from("test_battery_items").insert(items);
      if (itemsErr) throw itemsErr;
    },
    onSuccess: () => {
      toast.success(batteryId ? "Batterie mise à jour" : "Batterie créée");
      qc.invalidateQueries({ queryKey: ["test-batteries", categoryId] });
      qc.invalidateQueries({ queryKey: ["test-battery", batteryId] });
      reset();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error("Erreur : " + e.message),
  });

  const reset = () => {
    setName(""); setDescription(""); setSearch(""); setSelected({});
    setLevels(DEFAULT_BATTERY_LEVELS); setActiveItemId(null);
  };

  const updateLevel = (id: string, patch: Partial<BatteryLevel>) =>
    setLevels(levels.map(l => l.id === id ? { ...l, ...patch } : l));

  const addLevel = () =>
    setLevels([...levels, { id: crypto.randomUUID(), minPercent: 0, label: "Nouveau", color: "#6b7280" }]);

  const removeLevel = (id: string) => setLevels(levels.filter(l => l.id !== id));

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v && !batteryId) reset(); }}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{batteryId ? "Modifier la batterie" : "Nouvelle batterie de tests"}</DialogTitle>
          <DialogDescription>
            Sélectionnez les tests barémés à inclure et configurez les niveaux qualitatifs.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nom</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Tests entrée Pôle U14" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Optionnel"
                rows={3}
                className="min-h-[80px] resize-y"
              />
            </div>
          </div>

          <Tabs defaultValue="tests" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="tests">Tests ({Object.keys(selected).length})</TabsTrigger>
              <TabsTrigger value="levels">Niveaux ({levels.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="tests" className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Rechercher un test barémé..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>

              {(customTests?.length ?? 0) === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground border rounded-2xl bg-muted/30">
                  Aucun test barémé disponible.<br />
                  Créez d'abord des tests personnalisés avec un barème activé.
                </div>
              ) : (
                <ScrollArea className="h-[280px] rounded-2xl border bg-muted/20 p-2">
                  <div className="space-y-1.5">
                    {filteredTests.map((t: any) => {
                      const isSel = !!selected[t.id];
                      return (
                        <div
                          key={t.id}
                          onClick={() => toggleTest(t)}
                          className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                            isSel ? "bg-primary/10 border-primary" : "bg-background hover:bg-muted/50"
                          }`}
                        >
                          <Checkbox checked={isSel} onCheckedChange={() => toggleTest(t)} />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{t.name}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {t.test_category} • {t.unit || "—"}
                            </div>
                          </div>
                          <Badge variant="secondary">{Number(t.max_points) || 0} pts</Badge>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}

              <div className="flex items-center justify-between p-3 rounded-2xl bg-primary/5 border border-primary/20">
                <span className="text-sm font-medium">Score total possible</span>
                <Badge className="text-base px-3 py-1">{totalMax} pts</Badge>
              </div>
            </TabsContent>

            <TabsContent value="levels" className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Définissez les seuils en % du score total pour qualifier la performance.
              </p>
              <div className="space-y-2">
                {levels.map((l) => (
                  <div key={l.id} className="grid grid-cols-12 gap-2 items-center">
                    <Input type="number" min="0" max="100" className="col-span-2 h-9"
                      value={l.minPercent}
                      onChange={e => updateLevel(l.id, { minPercent: parseFloat(e.target.value) || 0 })} />
                    <span className="col-span-1 text-sm text-muted-foreground">%</span>
                    <Input className="col-span-6 h-9" placeholder="Label"
                      value={l.label}
                      onChange={e => updateLevel(l.id, { label: e.target.value })} />
                    <Input type="color" className="col-span-2 h-9 p-1"
                      value={l.color || "#6b7280"}
                      onChange={e => updateLevel(l.id, { color: e.target.value })} />
                    <Button type="button" variant="ghost" size="sm" className="col-span-1 text-destructive"
                      onClick={() => removeLevel(l.id)} disabled={levels.length <= 1}>×</Button>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addLevel}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter un niveau
              </Button>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Enregistrement..." : (batteryId ? "Mettre à jour" : "Créer la batterie")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
