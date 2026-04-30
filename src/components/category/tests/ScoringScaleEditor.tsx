import { useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScoringScale, ScoringRange } from "@/lib/constants/testUnits";

interface ScoringScaleEditorProps {
  value?: ScoringScale | null;
  onChange: (scale: ScoringScale) => void;
  unit?: string;
  className?: string;
}

const newRange = (points = 0): ScoringRange => ({
  id: crypto.randomUUID(),
  min: null,
  max: null,
  points,
  label: "",
});

export function ScoringScaleEditor({ value, onChange, unit = "", className }: ScoringScaleEditorProps) {
  const ranges = value?.ranges ?? [];
  const lowerIsBetter = value?.lowerIsBetter ?? false;

  useEffect(() => {
    if (!value) {
      onChange({ ranges: [newRange(0), newRange(1)], lowerIsBetter: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const maxPoints = useMemo(() => ranges.reduce((m, r) => Math.max(m, r.points), 0), [ranges]);

  // Compute gradient color (red → orange → yellow → green) based on rank
  // rank 0 = worst (red), rank n-1 = best (dark green)
  const getGradientColor = (rank: number, total: number): string => {
    if (total <= 1) return "hsl(140, 80%, 30%)";
    const t = rank / (total - 1); // 0 → 1
    // Hue: 0 (rouge pétant) → 40 (orange) → 60 (jaune) → 90 (vert clair) → 145 (vert foncé)
    let hue: number;
    if (t < 0.5) {
      // 0 → 0.5  : rouge → jaune
      hue = t * 2 * 60;
    } else {
      // 0.5 → 1  : jaune → vert foncé
      hue = 60 + (t - 0.5) * 2 * 85;
    }
    // Saturation forte partout, lightness qui baisse fortement côté vert pour bien différencier
    const saturation = 85;
    const lightness = 52 - t * 25; // de 52% (rouge vif) à 27% (vert foncé)
    return `hsl(${Math.round(hue)}, ${saturation}%, ${Math.round(lightness)}%)`;
  };

  // Sort ranges by points to determine ranking (worst → best)
  // If lowerIsBetter, the lowest points still = worst (points = quality score)
  const rankedIds = useMemo(() => {
    const sorted = [...ranges].sort((a, b) => a.points - b.points);
    const map = new Map<string, number>();
    sorted.forEach((r, idx) => map.set(r.id, idx));
    return map;
  }, [ranges]);

  const update = (next: ScoringRange[], newLowerIsBetter = lowerIsBetter) => {
    onChange({ ranges: next, lowerIsBetter: newLowerIsBetter });
  };

  const addRange = () => {
    update([...ranges, newRange(maxPoints + 1)]);
  };

  const removeRange = (id: string) => {
    update(ranges.filter(r => r.id !== id));
  };

  const updateRange = (id: string, patch: Partial<ScoringRange>) => {
    update(ranges.map(r => (r.id === id ? { ...r, ...patch } : r)));
  };

  const parseNum = (v: string): number | null => {
    if (v === "" || v === "-") return null;
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
  };

  return (
    <div className={cn("space-y-3 rounded-2xl border bg-muted/40 p-4", className)}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <Label className="text-sm font-semibold">Barème de notation</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Définissez les plages de valeurs et leurs points.
            {unit && <span className="ml-1">Unité : <strong>{unit}</strong></span>}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => update(ranges, !lowerIsBetter)}
          className="gap-1.5"
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          {lowerIsBetter ? "Plus bas = mieux" : "Plus haut = mieux"}
        </Button>
      </div>

      <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
        <div className="col-span-1"></div>
        <div className="col-span-3">Min ({unit || "valeur"})</div>
        <div className="col-span-3">Max ({unit || "valeur"})</div>
        <div className="col-span-2">Points</div>
        <div className="col-span-2">Label (optionnel)</div>
        <div className="col-span-1"></div>
      </div>

      <div className="space-y-2">
        {ranges.map((r) => {
          const rank = rankedIds.get(r.id) ?? 0;
          const color = getGradientColor(rank, ranges.length);
          return (
          <div key={r.id} className="grid grid-cols-12 gap-2 items-center">
            <div
              className="col-span-1 h-9 rounded-md border shadow-sm transition-colors"
              style={{ backgroundColor: color }}
              title={`Niveau ${rank + 1} / ${ranges.length}`}
            />
            <Input
              type="number"
              step="0.01"
              placeholder="—"
              className="col-span-3 h-9"
              value={r.min ?? ""}
              onChange={e => updateRange(r.id, { min: parseNum(e.target.value) })}
            />
            <Input
              type="number"
              step="0.01"
              placeholder="—"
              className="col-span-3 h-9"
              value={r.max ?? ""}
              onChange={e => updateRange(r.id, { max: parseNum(e.target.value) })}
            />
            <Input
              type="number"
              step="0.5"
              className="col-span-2 h-9 font-semibold"
              value={r.points}
              onChange={e => updateRange(r.id, { points: parseFloat(e.target.value) || 0 })}
            />
            <Input
              placeholder="Ex: PÔLE U14"
              className="col-span-2 h-9"
              value={r.label ?? ""}
              onChange={e => updateRange(r.id, { label: e.target.value })}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="col-span-1 h-9 w-9 text-destructive"
              onClick={() => removeRange(r.id)}
              disabled={ranges.length <= 1}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-1">
        <Button type="button" variant="outline" size="sm" onClick={addRange} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Ajouter une plage
        </Button>
        <div className="text-xs text-muted-foreground">
          Score max : <strong className="text-foreground">{maxPoints} pts</strong>
        </div>
      </div>

      <div className="text-xs text-muted-foreground bg-background/60 rounded-lg p-2 border border-dashed">
        💡 Laissez Min ou Max vide pour définir des bornes ouvertes (ex: Min vide = "tout en dessous de Max").
      </div>
    </div>
  );
}
