import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Calculator } from "lucide-react";
import {
  FormulaConfig,
  INPUT_KEYS,
  evaluateFormula,
  makeDefaultFormulaConfig,
} from "@/lib/tests/formulaEngine";
import { useMemo, useState } from "react";

interface Props {
  value: FormulaConfig | null;
  onChange: (cfg: FormulaConfig | null) => void;
  resultUnit?: string;
}

export function FormulaConfigEditor({ value, onChange, resultUnit }: Props) {
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
                <Input
                  value={inp.unit || ""}
                  onChange={(e) => updateInput(idx, { unit: e.target.value })}
                  placeholder="Unité"
                  className="w-24"
                />
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
                </div>
              ))}
            </div>
            <p className="text-sm">
              <span className="text-muted-foreground">Résultat = </span>
              <span className="font-bold text-primary">
                {previewResult !== null ? `${previewResult} ${cfg.result_unit || resultUnit || ""}`.trim() : "—"}
              </span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
