// Safe formula evaluator for composed tests.
// Supports inputs referenced as A, B, C, ... and operators + - * / ( ) and Math functions: min, max, abs, sqrt, pow.
// Returns null if the formula is invalid or any input is missing/non-numeric.

export interface FormulaInput {
  key: string;       // "A", "B", "C", ...
  label: string;     // human label, e.g. "Distance mur/malléole"
  unit?: string;     // optional unit, e.g. "cm"
}

export interface FormulaConfig {
  enabled: boolean;
  inputs: FormulaInput[];
  formula: string;             // e.g. "A / B"
  result_unit?: string;        // optional unit displayed for result
  result_decimals?: number;    // round to N decimals
}

export const INPUT_KEYS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

const ALLOWED_RE = /^[\sA-La-l0-9+\-*/().,minaxbsqrtpow]*$/;

export function makeDefaultFormulaConfig(): FormulaConfig {
  return {
    enabled: false,
    inputs: [
      { key: "A", label: "", unit: "" },
      { key: "B", label: "", unit: "" },
    ],
    formula: "A / B",
    result_unit: "",
    result_decimals: 2,
  };
}

export function isValidFormulaConfig(cfg: any): cfg is FormulaConfig {
  return (
    cfg &&
    typeof cfg === "object" &&
    cfg.enabled === true &&
    Array.isArray(cfg.inputs) &&
    cfg.inputs.length >= 1 &&
    typeof cfg.formula === "string" &&
    cfg.formula.trim().length > 0
  );
}

export function evaluateFormula(
  formula: string,
  values: Record<string, number | null | undefined>,
  decimals = 4,
): number | null {
  const trimmed = (formula || "").trim();
  if (!trimmed) return null;
  if (!ALLOWED_RE.test(trimmed)) return null;

  // Replace each variable by its numeric value
  let expr = trimmed;
  for (const key of INPUT_KEYS) {
    const v = values[key];
    if (v === undefined || v === null || Number.isNaN(Number(v))) {
      // Variable used but missing → bail out if expression contains it
      const re = new RegExp(`\\b${key}\\b`);
      if (re.test(expr)) return null;
    } else {
      expr = expr.replace(new RegExp(`\\b${key}\\b`, "g"), `(${Number(v)})`);
    }
  }

  // Whitelist Math.* helpers
  const safeExpr = expr
    .replace(/\bmin\b/g, "Math.min")
    .replace(/\bmax\b/g, "Math.max")
    .replace(/\babs\b/g, "Math.abs")
    .replace(/\bsqrt\b/g, "Math.sqrt")
    .replace(/\bpow\b/g, "Math.pow");

  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(`"use strict"; return (${safeExpr});`);
    const result = fn();
    if (typeof result !== "number" || !Number.isFinite(result)) return null;
    const f = 10 ** Math.max(0, Math.min(8, decimals));
    return Math.round(result * f) / f;
  } catch {
    return null;
  }
}
