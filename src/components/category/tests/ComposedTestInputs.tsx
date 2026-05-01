import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useMemo } from "react";
import { FormulaConfig, evaluateFormula } from "@/lib/tests/formulaEngine";

interface Props {
  config: FormulaConfig;
  values: Record<string, string>;
  onValuesChange: (values: Record<string, string>) => void;
  onComputed: (result: number | null) => void;
  fallbackUnit?: string;
}

/**
 * Renders one input per measure of a composed test, computes the result live
 * and propagates it via onComputed.
 */
export function ComposedTestInputs({ config, values, onValuesChange, onComputed, fallbackUnit }: Props) {
  const computed = useMemo(() => {
    const parsed: Record<string, number> = {};
    for (const inp of config.inputs) {
      const raw = values[inp.key];
      const n = parseFloat((raw || "").replace(",", "."));
      if (!Number.isFinite(n)) return null;
      parsed[inp.key] = n;
    }
    return evaluateFormula(config.formula, parsed, config.result_decimals ?? 2);
  }, [config, values]);

  useEffect(() => {
    onComputed(computed);
  }, [computed, onComputed]);

  return (
    <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">
        Mesures à saisir
      </Label>
      {config.inputs.map((inp) => (
        <div key={inp.key} className="flex items-center gap-2">
          <span className="font-mono font-bold text-primary w-6 text-center text-sm">{inp.key}</span>
          <Label className="flex-1 text-sm font-normal">
            {inp.label || `Mesure ${inp.key}`}
          </Label>
          <Input
            type="number"
            step="any"
            inputMode="decimal"
            value={values[inp.key] || ""}
            onChange={(e) => onValuesChange({ ...values, [inp.key]: e.target.value })}
            className="w-28"
            placeholder={inp.unit || ""}
          />
          {inp.unit && (
            <span className="text-xs text-muted-foreground w-10">{inp.unit}</span>
          )}
        </div>
      ))}
      <div className="flex items-center justify-between pt-2 border-t border-dashed">
        <span className="text-sm text-muted-foreground">Résultat calculé</span>
        <span className="font-bold text-primary text-base">
          {computed !== null
            ? `${computed} ${config.result_unit || fallbackUnit || ""}`.trim()
            : "—"}
        </span>
      </div>
    </div>
  );
}
