import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, RotateCcw, Save, ListChecks, ChevronDown, ChevronUp, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DEFAULT_WELLNESS_QUESTIONS,
  mergeWithDefaults,
  type WellnessQuestion,
  type WellnessScaleLevel,
} from "@/lib/wellness/questionConfig";

interface Props {
  categoryId: string;
  hideHeader?: boolean;
}

const PRESET_COLORS = [
  "hsl(var(--status-optimal))",
  "hsl(var(--status-optimal) / 0.7)",
  "hsl(var(--status-attention))",
  "hsl(var(--status-critical) / 0.7)",
  "hsl(var(--status-critical))",
  "hsl(var(--primary))",
  "hsl(var(--accent))",
];

function cloneScale(s: WellnessScaleLevel[]): WellnessScaleLevel[] {
  return s.map((l) => ({ ...l }));
}

export function WellnessQuestionsEditor({ categoryId, hideHeader }: Props) {
  const queryClient = useQueryClient();
  const [questions, setQuestions] = useState<WellnessQuestion[]>(DEFAULT_WELLNESS_QUESTIONS);
  const [dirty, setDirty] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["wellness_question_config_editor", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wellness_question_configs")
        .select("questions")
        .eq("category_id", categoryId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (data !== undefined) {
      const raw = (data?.questions as unknown as WellnessQuestion[]) || null;
      setQuestions(mergeWithDefaults(raw));
      setDirty(false);
    }
  }, [data]);

  const updateQuestion = (idx: number, patch: Partial<WellnessQuestion>) => {
    setQuestions((prev) => prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
    setDirty(true);
  };

  const updateScaleLevel = (qIdx: number, levelIdx: number, patch: Partial<WellnessScaleLevel>) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIdx
          ? { ...q, scale: q.scale.map((l, li) => (li === levelIdx ? { ...l, ...patch } : l)) }
          : q,
      ),
    );
    setDirty(true);
  };

  const removeQuestion = (idx: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
    setDirty(true);
  };

  const resetQuestion = (idx: number) => {
    const q = questions[idx];
    const def = DEFAULT_WELLNESS_QUESTIONS.find((d) => d.key === q.key);
    if (def) {
      setQuestions((prev) => prev.map((qq, i) => (i === idx ? { ...def, enabled: qq.enabled } : qq)));
      setDirty(true);
    }
  };

  const addCustomQuestion = () => {
    const id = `custom_${Date.now()}`;
    const q: WellnessQuestion = {
      key: id,
      label: "Nouvelle question",
      emoji: "✨",
      enabled: true,
      inverted: false,
      is_custom: true,
      scale: cloneScale(DEFAULT_WELLNESS_QUESTIONS[0].scale).map((l, i) => ({
        ...l,
        label: `Niveau ${i + 1}`,
      })),
    };
    setQuestions((prev) => [...prev, q]);
    setExpanded((prev) => ({ ...prev, [id]: true }));
    setDirty(true);
  };

  const resetAll = () => {
    setQuestions(DEFAULT_WELLNESS_QUESTIONS);
    setDirty(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("wellness_question_configs")
        .upsert(
          { category_id: categoryId, questions: questions as any },
          { onConflict: "category_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Questions du wellness enregistrées");
      queryClient.invalidateQueries({ queryKey: ["wellness_question_config", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["wellness_question_config_editor", categoryId] });
      setDirty(false);
    },
    onError: () => toast.error("Erreur lors de l'enregistrement"),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ListChecks className="h-4 w-4 text-primary" />
              Questions du Wellness
            </CardTitle>
            <CardDescription>
              Activez, modifiez ou ajoutez des questions. Les libellés et couleurs de chaque niveau sont personnalisables. Sauvegarde appliquée à cette catégorie uniquement.
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
      <CardContent className="space-y-3">
        {questions.map((q, idx) => {
          const isOpen = expanded[q.key] ?? false;
          return (
            <div
              key={q.key}
              className={cn(
                "rounded-xl border bg-surface-sunken/40 overflow-hidden",
                !q.enabled && "opacity-60",
              )}
            >
              <div className="flex items-center gap-2 p-3">
                <Input
                  className="w-14 text-center text-lg"
                  value={q.emoji}
                  onChange={(e) => updateQuestion(idx, { emoji: e.target.value.slice(0, 2) })}
                  aria-label="Emoji"
                />
                <Input
                  className="flex-1"
                  value={q.label}
                  onChange={(e) => updateQuestion(idx, { label: e.target.value })}
                  placeholder="Libellé de la question"
                />
                <div className="flex items-center gap-2 px-2">
                  <Switch
                    checked={q.enabled}
                    onCheckedChange={(v) => updateQuestion(idx, { enabled: v })}
                  />
                  <span className="text-xs text-muted-foreground hidden sm:inline">
                    {q.enabled ? "Active" : "Désactivée"}
                  </span>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setExpanded((prev) => ({ ...prev, [q.key]: !isOpen }))}
                >
                  {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
                {q.is_custom ? (
                  <Button size="icon" variant="ghost" onClick={() => removeQuestion(idx)} title="Supprimer">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                ) : (
                  <Button size="icon" variant="ghost" onClick={() => resetQuestion(idx)} title="Réinitialiser">
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {isOpen && (
                <div className="p-3 pt-0 space-y-3 border-t border-border/50">
                  <div className="flex items-center gap-3 pt-3">
                    <Label className="text-xs">Sens du barème</Label>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={q.inverted}
                        onCheckedChange={(v) => updateQuestion(idx, { inverted: v })}
                      />
                      <span className="text-xs text-muted-foreground">
                        {q.inverted ? "1 = très bon · 5 = très mauvais" : "1 = très mauvais · 5 = très bon"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-1.5 p-2.5 rounded-lg bg-muted/50 border border-border/50">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Indication du barème</p>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm">1</span>
                        <span className="text-muted-foreground">:</span>
                        <span className="font-medium">{q.scale[0].label}</span>
                      </div>
                      <span className="text-muted-foreground text-lg">→</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm">5</span>
                        <span className="text-muted-foreground">:</span>
                        <span className="font-medium">{q.scale[4].label}</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1 italic">
                      {q.inverted
                        ? "Le score 1 représente l'état le plus favorable, 5 le moins favorable."
                        : "Le score 1 représente l'état le moins favorable, 5 le plus favorable."}
                    </p>
                  </div>

                  <div className="space-y-2">
                    {q.scale.map((level, lIdx) => (
                      <div key={lIdx} className="flex items-center gap-2">
                        <div
                          className="h-8 w-8 rounded-md border flex items-center justify-center text-xs font-bold shrink-0"
                          style={{ backgroundColor: level.color, color: "white" }}
                        >
                          {level.value}
                        </div>
                        <Input
                          className="flex-1 h-9"
                          value={level.label}
                          onChange={(e) => updateScaleLevel(idx, lIdx, { label: e.target.value })}
                          placeholder={`Libellé niveau ${level.value}`}
                        />
                        <div className="flex gap-1">
                          {PRESET_COLORS.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => updateScaleLevel(idx, lIdx, { color: c })}
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
              )}
            </div>
          );
        })}

        <Button variant="outline" className="w-full" onClick={addCustomQuestion}>
          <Plus className="h-4 w-4 mr-1.5" />
          Ajouter une question
        </Button>
      </CardContent>
    </Card>
  );
}
