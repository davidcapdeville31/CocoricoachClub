import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Info, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type BowlingExercise,
  type BowlingExerciseField,
  type BowlingParent,
  BOWLING_DTN_EXERCISES,
  BOWLING_PARENT_LABELS,
  getBowlingExercisesByParent,
  getBowlingExerciseById,
} from "@/lib/constants/bowlingExercises";

interface Props {
  parent: BowlingParent;
  exerciseId: string | null;
  variables: Record<string, unknown>;
  /** For loading oil patterns scoped to a category (planning context). */
  categoryId?: string;
  onExerciseChange: (exerciseId: string | null) => void;
  onVariablesChange: (next: Record<string, unknown>) => void;
}

export function BowlingExerciseVariables({
  parent,
  exerciseId,
  variables,
  categoryId,
  onExerciseChange,
  onVariablesChange,
}: Props) {
  const availableExercises = getBowlingExercisesByParent(parent);
  const exercise = getBowlingExerciseById(exerciseId);

  return (
    <div className="space-y-3 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-3">
      {/* Exercise picker */}
      <div className="space-y-1">
        <Label className="text-xs font-semibold flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-primary" />
          Exercice DTN ({BOWLING_PARENT_LABELS[parent]})
        </Label>
        <Select
          value={exerciseId || ""}
          onValueChange={(v) => {
            onExerciseChange(v);
            // Reset variables when exercise changes
            onVariablesChange({});
          }}
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="Choisir un exercice..." />
          </SelectTrigger>
          <SelectContent className="z-[100]">
            {availableExercises.map((ex) => (
              <SelectItem key={ex.id} value={ex.id}>
                {ex.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Objective / criterion */}
      {exercise && (
        <div className="rounded-lg bg-background/60 border border-border/60 p-2.5 space-y-1.5">
          <div className="flex items-start gap-1.5 text-xs">
            <Info className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-foreground/90">Objectif</p>
              <p className="text-muted-foreground">{exercise.objective}</p>
            </div>
          </div>
          <div className="flex items-start gap-1.5 text-xs">
            <Badge variant="outline" className="text-[10px] mt-0.5">Réussite</Badge>
            <p className="text-muted-foreground">{exercise.successCriterion}</p>
          </div>
        </div>
      )}

      {/* Variables form */}
      {exercise && exercise.fields.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {exercise.fields
            .filter((f) => !f.hidden)
            .map((field) => (
              <FieldRenderer
                key={field.key}
                field={field}
                value={variables[field.key]}
                categoryId={categoryId}
                onChange={(v) =>
                  onVariablesChange({ ...variables, [field.key]: v })
                }
              />
            ))}
        </div>
      )}
    </div>
  );
}

interface FieldProps {
  field: BowlingExerciseField;
  value: unknown;
  categoryId?: string;
  onChange: (v: unknown) => void;
}

function FieldRenderer({ field, value, categoryId, onChange }: FieldProps) {
  if (field.type === "number") {
    return (
      <div className="space-y-1">
        <Label className="text-[11px] text-muted-foreground">{field.label}</Label>
        <Input
          type="number"
          min={field.min}
          max={field.max}
          step={field.step ?? 1}
          value={(value as number) ?? ""}
          onChange={(e) => {
            const n = e.target.value === "" ? null : parseInt(e.target.value, 10);
            onChange(Number.isNaN(n) ? null : n);
          }}
          placeholder={field.placeholder}
          className="h-8 text-xs"
        />
        {field.help && <p className="text-[10px] text-muted-foreground italic">{field.help}</p>}
      </div>
    );
  }

  if (field.type === "text") {
    return (
      <div className="space-y-1">
        <Label className="text-[11px] text-muted-foreground">{field.label}</Label>
        <Input
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className="h-8 text-xs"
        />
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <div className="space-y-1">
        <Label className="text-[11px] text-muted-foreground">{field.label}</Label>
        <Select value={(value as string) || ""} onValueChange={(v) => onChange(v)}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Sélectionner..." />
          </SelectTrigger>
          <SelectContent className="z-[100]">
            {(field.options || []).map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-xs">
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {field.help && <p className="text-[10px] text-muted-foreground italic">{field.help}</p>}
      </div>
    );
  }

  if (field.type === "multiselect") {
    const selected = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div className="space-y-1 sm:col-span-2">
        <Label className="text-[11px] text-muted-foreground">{field.label}</Label>
        <div className="flex flex-wrap gap-1.5">
          {(field.options || []).map((o) => {
            const checked = selected.includes(o.value);
            return (
              <button
                type="button"
                key={o.value}
                onClick={() =>
                  onChange(
                    checked
                      ? selected.filter((s) => s !== o.value)
                      : [...selected, o.value],
                  )
                }
                className={cn(
                  "px-2 py-1 rounded-md text-[11px] border transition-all",
                  checked
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-background hover:bg-muted border-border text-foreground/80",
                )}
              >
                {o.label}
              </button>
            );
          })}
        </div>
        {field.help && <p className="text-[10px] text-muted-foreground italic">{field.help}</p>}
      </div>
    );
  }

  if (field.type === "oil") {
    return (
      <OilPatternPicker
        label={field.label}
        help={field.help}
        categoryId={categoryId}
        value={(value as string) || ""}
        onChange={(v) => onChange(v)}
      />
    );
  }

  return null;
}

function OilPatternPicker({
  label,
  help,
  categoryId,
  value,
  onChange,
}: {
  label: string;
  help?: string;
  categoryId?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const { data: patterns } = useQuery({
    queryKey: ["bowling_oil_patterns_for_category", categoryId],
    queryFn: async () => {
      const q = supabase
        .from("bowling_oil_patterns")
        .select("id, name, length_feet, volume_ml, gender")
        .order("name");
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: true,
  });

  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={(v) => onChange(v === "__none__" ? "" : v)}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder="À plat / non applicable" />
        </SelectTrigger>
        <SelectContent className="z-[100]">
          <SelectItem value="__none__" className="text-xs italic">À plat / non applicable</SelectItem>
          {(patterns || []).map((p: any) => (
            <SelectItem key={p.id} value={p.id} className="text-xs">
              {p.name}
              {p.length_feet ? ` · ${p.length_feet}ft` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {help && <p className="text-[10px] text-muted-foreground italic">{help}</p>}
    </div>
  );
}

export { BOWLING_DTN_EXERCISES };
