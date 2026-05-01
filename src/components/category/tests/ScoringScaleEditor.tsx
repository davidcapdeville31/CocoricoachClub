import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ArrowUpDown, Users, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ScoringScale,
  ScoringRange,
  ScoringVariant,
  ScoringVariantFilter,
} from "@/lib/constants/testUnits";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { getPositionGroupsForSport } from "@/lib/constants/sportPositionGroups";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ScoringScaleEditorProps {
  value?: ScoringScale | null;
  onChange: (scale: ScoringScale) => void;
  unit?: string;
  className?: string;
  /** Sport type used to derive available position groups (rugby, football...) */
  sportType?: string;
}

const newRange = (points = 0): ScoringRange => ({
  id: crypto.randomUUID(),
  min: null,
  max: null,
  points,
  label: "",
});

const newVariant = (label = "Nouveau barème"): ScoringVariant => ({
  id: crypto.randomUUID(),
  label,
  filter: {},
  ranges: [newRange(0), newRange(1)],
  lowerIsBetter: false,
});

// ─────────────────────────────────────────────────────────────────────────────
// Inner editor for a single set of ranges (re-used for default + each variant)
// ─────────────────────────────────────────────────────────────────────────────
interface RangesEditorProps {
  ranges: ScoringRange[];
  lowerIsBetter: boolean;
  unit: string;
  onChangeRanges: (next: ScoringRange[]) => void;
  onToggleDirection: () => void;
}

function RangesEditor({
  ranges, lowerIsBetter, unit, onChangeRanges, onToggleDirection,
}: RangesEditorProps) {
  const maxPoints = useMemo(() => ranges.reduce((m, r) => Math.max(m, r.points), 0), [ranges]);

  const getGradientColor = (rank: number, total: number): string => {
    if (total <= 1) return "hsl(140, 80%, 30%)";
    const t = rank / (total - 1);
    let hue: number;
    if (t < 0.5) hue = t * 2 * 60;
    else hue = 60 + (t - 0.5) * 2 * 85;
    const saturation = 85;
    const lightness = 52 - t * 25;
    return `hsl(${Math.round(hue)}, ${saturation}%, ${Math.round(lightness)}%)`;
  };

  const rankedIds = useMemo(() => {
    const sorted = [...ranges].sort((a, b) => a.points - b.points);
    const map = new Map<string, number>();
    sorted.forEach((r, idx) => map.set(r.id, idx));
    return map;
  }, [ranges]);

  const addRange = () => onChangeRanges([...ranges, newRange(maxPoints + 1)]);
  const removeRange = (id: string) => onChangeRanges(ranges.filter(r => r.id !== id));
  const updateRange = (id: string, patch: Partial<ScoringRange>) =>
    onChangeRanges(ranges.map(r => (r.id === id ? { ...r, ...patch } : r)));

  const parseNum = (v: string): number | null => {
    if (v === "" || v === "-") return null;
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onToggleDirection}
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
                type="number" step="0.01" placeholder="—"
                className="col-span-3 h-9"
                value={r.min ?? ""}
                onChange={e => updateRange(r.id, { min: parseNum(e.target.value) })}
              />
              <Input
                type="number" step="0.01" placeholder="—"
                className="col-span-3 h-9"
                value={r.max ?? ""}
                onChange={e => updateRange(r.id, { max: parseNum(e.target.value) })}
              />
              <Input
                type="number" step="0.5"
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
                type="button" variant="ghost" size="icon"
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
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Variant filter editor (gender + position group)
// ─────────────────────────────────────────────────────────────────────────────
interface VariantFilterEditorProps {
  filter: ScoringVariantFilter;
  onChange: (next: ScoringVariantFilter) => void;
  sportType?: string;
}

function VariantFilterEditor({ filter, onChange, sportType }: VariantFilterEditorProps) {
  const positionGroups = useMemo(() => getPositionGroupsForSport(sportType), [sportType]);
  const selectedGender = filter.genders?.[0] || "any";
  const selectedGroup = filter.positionGroups?.[0] || "any";

  const setGender = (v: string) => {
    onChange({ ...filter, genders: v === "any" ? undefined : [v] });
  };
  const setGroup = (v: string) => {
    onChange({ ...filter, positionGroups: v === "any" ? undefined : [v] });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-xl bg-background/60 p-3 border border-dashed">
      <div className="space-y-1">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Genre ciblé</Label>
        <Select value={selectedGender} onValueChange={setGender}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Tous les genres</SelectItem>
            <SelectItem value="male">Garçons</SelectItem>
            <SelectItem value="female">Filles</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          Groupe de poste {positionGroups.length === 0 && "(non disponible pour ce sport)"}
        </Label>
        <Select value={selectedGroup} onValueChange={setGroup} disabled={positionGroups.length === 0}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Tous les postes</SelectItem>
            {positionGroups.map(g => (
              <SelectItem key={g.id} value={g.id}>{g.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main editor
// ─────────────────────────────────────────────────────────────────────────────
export function ScoringScaleEditor({
  value, onChange, unit = "", className, sportType,
}: ScoringScaleEditorProps) {
  const ranges = value?.ranges ?? [];
  const lowerIsBetter = value?.lowerIsBetter ?? false;
  const variants = value?.variants ?? [];

  useEffect(() => {
    if (!value) {
      onChange({ ranges: [newRange(0), newRange(1)], lowerIsBetter: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const positionGroupsCount = getPositionGroupsForSport(sportType).length;

  const update = (next: Partial<ScoringScale>) => {
    onChange({
      ranges,
      lowerIsBetter,
      variants,
      ...next,
    });
  };

  // Tabs state: "default" or variant id
  const [activeTab, setActiveTab] = useState<string>("default");

  const addVariant = () => {
    const v = newVariant(`Barème ${variants.length + 1}`);
    update({ variants: [...variants, v] });
    setActiveTab(v.id);
  };

  const updateVariant = (id: string, patch: Partial<ScoringVariant>) => {
    update({
      variants: variants.map(v => (v.id === id ? { ...v, ...patch } : v)),
    });
  };

  const removeVariant = (id: string) => {
    update({ variants: variants.filter(v => v.id !== id) });
    setActiveTab("default");
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
          onClick={addVariant}
          className="gap-1.5"
        >
          <Users className="h-3.5 w-3.5" />
          Ajouter un barème spécifique
        </Button>
      </div>

      {variants.length > 0 && (
        <Alert className="bg-primary/5 border-primary/20">
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Les barèmes spécifiques s'appliquent automatiquement selon le profil de l'athlète
            (genre, poste). <strong>Pensez à renseigner ces informations</strong> dans
            l'onglet <strong>Effectif → Fiche du joueur</strong>. Si aucun barème spécifique
            ne correspond, le barème <em>par défaut</em> est utilisé.
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-background/60 p-1">
          <TabsTrigger value="default" className="gap-1.5">
            Par défaut
            <Badge variant="secondary" className="text-[9px] px-1 py-0">tous</Badge>
          </TabsTrigger>
          {variants.map(v => (
            <TabsTrigger key={v.id} value={v.id} className="gap-1.5">
              {v.label || "Sans nom"}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeVariant(v.id); }}
                className="ml-1 rounded-full hover:bg-destructive/20 p-0.5"
                aria-label="Supprimer ce barème"
              >
                <X className="h-3 w-3" />
              </button>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="default" className="mt-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            Ce barème est utilisé quand aucun barème spécifique ne correspond à l'athlète.
          </p>
          <RangesEditor
            ranges={ranges}
            lowerIsBetter={lowerIsBetter}
            unit={unit}
            onChangeRanges={(next) => update({ ranges: next })}
            onToggleDirection={() => update({ lowerIsBetter: !lowerIsBetter })}
          />
        </TabsContent>

        {variants.map(v => (
          <TabsContent key={v.id} value={v.id} className="mt-3 space-y-3">
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Nom du barème
              </Label>
              <Input
                value={v.label}
                placeholder="Ex: Avants, Filles U16…"
                onChange={(e) => updateVariant(v.id, { label: e.target.value })}
              />
            </div>

            <VariantFilterEditor
              filter={v.filter}
              onChange={(filter) => updateVariant(v.id, { filter })}
              sportType={sportType}
            />

            {positionGroupsCount === 0 && (
              <p className="text-[11px] text-muted-foreground italic">
                ℹ️ Ce sport n'a pas de groupes de poste prédéfinis — vous pouvez tout de même
                cibler par genre.
              </p>
            )}

            <RangesEditor
              ranges={v.ranges}
              lowerIsBetter={!!v.lowerIsBetter}
              unit={unit}
              onChangeRanges={(next) => updateVariant(v.id, { ranges: next })}
              onToggleDirection={() => updateVariant(v.id, { lowerIsBetter: !v.lowerIsBetter })}
            />
          </TabsContent>
        ))}
      </Tabs>

      <div className="text-xs text-muted-foreground bg-background/60 rounded-lg p-2 border border-dashed">
        💡 Laissez Min ou Max vide pour définir des bornes ouvertes (ex: Min vide = "tout en dessous de Max").
      </div>
    </div>
  );
}
