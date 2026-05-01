import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel,
} from "@/components/ui/select";
import { Plus, Trash2, Calculator } from "lucide-react";
import {
  FormulaConfig,
  INPUT_KEYS,
  evaluateFormula,
  makeDefaultFormulaConfig,
} from "@/lib/tests/formulaEngine";
import {
  TEST_UNIT_OPTIONS,
  computePoints,
  findMatchingRange,
  type ScoringScale,
} from "@/lib/constants/testUnits";
import { useMemo, useState } from "react";

interface Props {
  value: FormulaConfig | null;
  onChange: (cfg: FormulaConfig | null) => void;
  resultUnit?: string;
  scoringScale?: ScoringScale | null;
}

export function FormulaConfigEditor({ value, onChange, resultUnit, scoringScale }: Props) {
  const cfg = value ?? { ...makeDefaultFormulaConfig(), enabled: false };
  const enabled = !!cfg.enabled;

  const [previewValues, setPreviewValues] = useState<Record<string, string>>({});

  const update = (patch: Partial<FormulaConfig>) => {
    onChange({ ...cfg, ...patch });
  };

  const setEnabled = (v: boolean) => {
    if (v) {
      onChange({ ...makeDefaultFormulaConfig(), ...cfg, enabled: true });
    } else {
      onChange(null);
    }
  };

  const addInput = () => {
    if (cfg.inputs.length >= INPUT_KEYS.length) return;
    const nextKey = INPUT_KEYS[cfg.inputs.length];
    update({ inputs: [...cfg.inputs, { key: nextKey, label: "", unit: "" }] });
  };

  const removeInput = (idx: number) => {
    if (cfg.inputs.length <= 1) return;
    const next = cfg.inputs.filter((_, i) => i !== idx).map((inp, i) => ({ ...inp, key: INPUT_KEYS[i] }));
    update({ inputs: next });
  };

  const updateInput = (idx: number, patch: Partial<{ label: string; unit: string }>) => {
    const next = cfg.inputs.map((inp, i) => (i === idx ? { ...inp, ...patch } : inp));
    update({ inputs: next });
  };

  // Group units for Select
  const groupedUnits = useMemo(() => {
    const groups = new Map<string, typeof TEST_UNIT_OPTIONS>();
    TEST_UNIT_OPTIONS.forEach(opt => {
      const arr = groups.get(opt.group) ?? [];
      arr.push(opt);
      groups.set(opt.group, arr);
    });
    return Array.from(groups.entries());
  }, []);

  const previewResult = useMemo(() => {
    if (!enabled) return null;
    const parsed: Record<string, number> = {};
    for (const inp of cfg.inputs) {
      const raw = previewValues[inp.key];
      const n = parseFloat((raw || "").replace(",", "."));
      if (!Number.isFinite(n)) return null;
      parsed[inp.key] = n;
    }
    return evaluateFormula(cfg.formula, parsed, cfg.result_decimals ?? 2);
  }, [enabled, cfg, previewValues]);

  // Compute score from scoring scale based on the calculated result
  const previewScore = useMemo(() => {
    if (previewResult === null || !scoringScale?.ranges?.length) return null;
    const points = computePoints(previewResult, scoringScale);
    const range = findMatchingRange(previewResult, scoringScale);
    return { points, label: range?.label || "" };
  }, [previewResult, scoringScale]);

  return (
    <div className="rounded-2xl border bg-muted/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-semibold flex items-center gap-2">
            <Calculator className="h-4 w-4" /> Test composé (formule multi-mesures)
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            L'athlète saisit plusieurs mesures, le résultat final est calculé automatiquement (ex: ratio).
          </p>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>

      {enabled && (
        <div className="space-y-3 pt-2">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Mesures à saisir</Label>
            {cfg.inputs.map((inp, idx) => (
              <div key={inp.key} className="flex items-center gap-2">
                <span className="font-mono font-bold text-primary w-6 text-center">{inp.key}</span>
                <Input
                  value={inp.label}
                  onChange={(e) => updateInput(idx, { label: e.target.value })}
                  placeholder="Libellé (ex: Distance mur/malléole)"
                  className="flex-1"
                />
                <Select
                  value={inp.unit || ""}
                  onValueChange={(v) => updateInput(idx, { unit: v })}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Unité" />
                  </SelectTrigger>
                  <SelectContent>
                    {groupedUnits.map(([group, opts]) => (
                      <SelectGroup key={group}>
                        <SelectLabel>{group}</SelectLabel>
                        {opts.map(opt => (
                          <SelectItem key={opt.value} value={opt.unit || opt.value}>
                            {opt.unit ? `${opt.unit} — ${opt.label}` : opt.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeInput(idx)}
                  disabled={cfg.inputs.length <= 1}
                  className="h-9 w-9"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addInput}
              disabled={cfg.inputs.length >= INPUT_KEYS.length}
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter une mesure
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Formule de calcul</Label>
            <Input
              value={cfg.formula}
              onChange={(e) => update({ formula: e.target.value })}
              placeholder="Ex: A / B"
              className="font-mono"
            />
            <p className="text-[11px] text-muted-foreground">
              Utilise les variables {cfg.inputs.map((i) => i.key).join(", ")} et les opérateurs <code>+ - * / ( )</code>. Fonctions disponibles : <code>min, max, abs, sqrt, pow</code>.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Décimales du résultat</Label>
              <Input
                type="number"
                min={0}
                max={4}
                value={cfg.result_decimals ?? 2}
                onChange={(e) => update({ result_decimals: parseInt(e.target.value, 10) || 0 })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Unité du résultat (auto si vide)</Label>
              <Input
                value={cfg.result_unit || ""}
                onChange={(e) => update({ result_unit: e.target.value })}
                placeholder={resultUnit || "ex: ratio"}
              />
              {resultUnit && (
                <p className="text-[11px] text-muted-foreground">
                  💡 Le barème de notation utilise l'unité <strong>{cfg.result_unit || resultUnit}</strong> (= unité du résultat calculé).
                </p>
              )}
            </div>
          </div>

          <div className="rounded-xl bg-background/60 border border-dashed p-3 space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Aperçu du calcul</Label>
            <div className="flex flex-wrap gap-2">
              {cfg.inputs.map((inp) => (
                <div key={inp.key} className="flex items-center gap-1">
                  <span className="font-mono text-xs text-primary">{inp.key}=</span>
                  <Input
                    type="number"
                    step="any"
                    value={previewValues[inp.key] || ""}
                    onChange={(e) => setPreviewValues({ ...previewValues, [inp.key]: e.target.value })}
                    className="w-20 h-8 text-sm"
                    placeholder={inp.unit || ""}
                  />
                  {inp.unit && <span className="text-xs text-muted-foreground">{inp.unit}</span>}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Résultat = </span>
                <span className="font-bold text-primary">
                  {previewResult !== null ? `${previewResult} ${cfg.result_unit || resultUnit || ""}`.trim() : "—"}
                </span>
              </div>
              {previewScore !== null && (
                <div className="px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/30">
                  <span className="text-muted-foreground text-xs">Note : </span>
                  <span className="font-bold text-primary">{previewScore.points} pts</span>
                  {previewScore.label && (
                    <span className="text-xs text-muted-foreground ml-1">({previewScore.label})</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
