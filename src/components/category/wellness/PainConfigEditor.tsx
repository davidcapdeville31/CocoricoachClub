import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, RotateCcw, Save, Trash2, Activity } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DEFAULT_PAIN_CONFIG,
  mergePainConfig,
  type PainConfig,
  type PainNature,
  type PainScaleLevel,
} from "@/lib/wellness/questionConfig";

const PRESET_COLORS = [
  "hsl(var(--status-optimal))",
  "hsl(var(--status-optimal) / 0.7)",
  "hsl(var(--status-attention))",
  "hsl(var(--status-critical) / 0.7)",
  "hsl(var(--status-critical))",
  "hsl(var(--primary))",
  "hsl(var(--accent))",
];

interface Props {
  categoryId: string;
}

export function PainConfigEditor({ categoryId }: Props) {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<PainConfig>(DEFAULT_PAIN_CONFIG);
  const [dirty, setDirty] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["wellness_pain_config_editor", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wellness_question_configs")
        .select("pain_config")
        .eq("category_id", categoryId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (data !== undefined) {
      setConfig(mergePainConfig((data?.pain_config as unknown as PainConfig) ?? null));
      setDirty(false);
    }
  }, [data]);

  const updateLevel = (idx: number, patch: Partial<PainScaleLevel>) => {
    setConfig((prev) => ({
      ...prev,
      scale: prev.scale.map((l, i) => (i === idx ? { ...l, ...patch } : l)),
    }));
    setDirty(true);
  };

  const updateNature = (idx: number, patch: Partial<PainNature>) => {
    setConfig((prev) => ({
      ...prev,
      natures: prev.natures.map((n, i) => (i === idx ? { ...n, ...patch } : n)),
    }));
    setDirty(true);
  };

  const removeNature = (idx: number) => {
    setConfig((prev) => ({ ...prev, natures: prev.natures.filter((_, i) => i !== idx) }));
    setDirty(true);
  };

  const addNature = () => {
    const id = `nature_${Date.now()}`;
    setConfig((prev) => ({
      ...prev,
      natures: [...prev.natures, { key: id, label: "Nouvelle nature", emoji: "🩹" }],
    }));
    setDirty(true);
  };

  const resetAll = () => {
    setConfig(DEFAULT_PAIN_CONFIG);
    setDirty(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      // Upsert preserving existing questions column if present
      const { data: existing } = await supabase
        .from("wellness_question_configs")
        .select("questions")
        .eq("category_id", categoryId)
        .maybeSingle();
      const payload: any = {
        category_id: categoryId,
        pain_config: config as any,
      };
      if (existing?.questions) payload.questions = existing.questions;
      else payload.questions = [];
      const { error } = await supabase
        .from("wellness_question_configs")
        .upsert(payload, { onConflict: "category_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Barème de douleur enregistré");
      queryClient.invalidateQueries({ queryKey: ["wellness_pain_config", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["wellness_pain_config_editor", categoryId] });
      setDirty(false);
    },
    onError: () => toast.error("Erreur lors de l'enregistrement"),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-destructive" />
              Barème de Douleur
            </CardTitle>
            <CardDescription>
              Personnalisez l'échelle (1 = légère → 5 = intense) et la liste des natures de douleur disponibles
              lors du signalement. Appliqué uniquement à cette catégorie.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={resetAll} disabled={isLoading}>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Réinitialiser
            </Button>
            <Button size="sm" onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
              <Save className="h-4 w-4 mr-1.5" />
              Enregistrer
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Scale 1..5 */}
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">
            Échelle d'intensité (1 = légère → 5 = intense)
          </Label>
          <div className="space-y-2">
            {config.scale.map((level, idx) => (
              <div key={level.value} className="flex items-center gap-2">
                <div
                  className="h-9 w-9 rounded-md border flex items-center justify-center text-sm font-bold shrink-0 text-white"
                  style={{ backgroundColor: level.color }}
                >
                  {level.value}
                </div>
                <Input
                  className="flex-1 h-9"
                  value={level.label}
                  onChange={(e) => updateLevel(idx, { label: e.target.value })}
                  placeholder={`Libellé niveau ${level.value}`}
                />
                <div className="flex gap-1">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => updateLevel(idx, { color: c })}
                      className={cn(
                        "h-6 w-6 rounded-md border-2 transition-all",
                        level.color === c ? "border-foreground scale-110" : "border-transparent",
                      )}
                      style={{ backgroundColor: c }}
                      aria-label={`Couleur ${c}`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Natures */}
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">
            Natures de douleur disponibles
          </Label>
          <div className="space-y-2">
            {config.natures.map((n, idx) => (
              <div key={n.key} className="flex items-center gap-2">
                <Input
                  className="w-14 text-center text-lg h-9"
                  value={n.emoji ?? ""}
                  onChange={(e) => updateNature(idx, { emoji: e.target.value.slice(0, 2) })}
                  aria-label="Emoji"
                />
                <Input
                  className="flex-1 h-9"
                  value={n.label}
                  onChange={(e) => updateNature(idx, { label: e.target.value })}
                  placeholder="Libellé (ex: Musculaire)"
                />
                <Button size="icon" variant="ghost" onClick={() => removeNature(idx)} title="Supprimer">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" className="mt-2 w-full" onClick={addNature}>
            <Plus className="h-4 w-4 mr-1.5" />
            Ajouter une nature
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
