/**
 * Convertit les `scoring_scale.variants` d'un `custom_tests` en benchmarks
 * synthétiques utilisables par la matrice / la comparaison. Chaque variant
 * (filtré par poste et/ou sexe) devient un benchmark distinct avec ses seuils.
 */

export interface SynthLevel {
  label: string;
  threshold: number | null;
  color: string;
}
export interface SynthBenchmark {
  id: string;
  name: string;
  test_category: string;
  test_type: string;
  unit: string | null;
  lower_is_better: boolean;
  levels: SynthLevel[];
  use_body_weight_ratio: boolean;
  body_weight_multiplier: number | null;
  filter_type: string;
  filter_value: string | null;
  gender_filter: string | null;
}

interface Range {
  id?: string;
  min: number | null;
  max: number | null;
  label?: string | null;
  points?: number | null;
}
interface Variant {
  id?: string;
  label?: string;
  filter?: {
    genders?: string[];
    positionGroups?: string[];
    [k: string]: any;
  };
  ranges?: Range[];
  lowerIsBetter?: boolean;
}
interface ScoringScale {
  ranges?: Range[];
  variants?: Variant[];
  lowerIsBetter?: boolean;
}

const DEFAULT_COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#10b981", "#059669"];
const DEFAULT_LABELS = ["Insuffisant", "Moyen", "Bon", "Excellent", "Élite"];

function isRatioUnit(u: string | null | undefined) {
  if (!u) return false;
  const s = u.toLowerCase().replace(/\s+/g, "");
  return s === "×pdc" || s === "xpdc" || s === "/pdc";
}

function rangesToLevels(ranges: Range[], lowerIsBetter: boolean): SynthLevel[] {
  const sorted = [...ranges].sort((a, b) => (a.points ?? 0) - (b.points ?? 0));
  // levels order = du pire au meilleur (points croissant)
  return sorted.map((r, i) => {
    const threshold = lowerIsBetter
      ? r.max ?? r.min ?? null
      : r.min ?? r.max ?? null;
    return {
      label: r.label && r.label.trim() ? r.label : DEFAULT_LABELS[i] || `Niveau ${i}`,
      threshold: threshold != null ? Number(threshold) : null,
      color: DEFAULT_COLORS[i] || DEFAULT_COLORS[DEFAULT_COLORS.length - 1],
    };
  });
}

export function synthesizeBenchmarksFromCustomTest(ct: {
  id: string;
  name: string;
  unit: string | null;
  test_category?: string | null;
  scoring_scale?: ScoringScale | null;
}): SynthBenchmark[] {
  const scale = ct.scoring_scale;
  if (!scale) return [];
  const results: SynthBenchmark[] = [];
  const isRatio = isRatioUnit(ct.unit);
  // On utilise le NOM du test comme test_type logique afin de regrouper les
  // variantes synthétiques avec un éventuel benchmark BDD portant le même nom
  // (ex. « Squat 3RM » ↔ preset `squat_3rm`) — le regroupement se fait via
  // `normalizeTestKey`, qui rend « Squat 3RM » ≡ « squat_3rm ».
  const testType = ct.name;


  // Variantes (poste / sexe)
  for (const v of scale.variants || []) {
    const ranges = v.ranges || [];
    if (!ranges.length) continue;
    const lower = !!v.lowerIsBetter;
    const levels = rangesToLevels(ranges, lower);
    const positions = v.filter?.positionGroups || [];
    const genders = v.filter?.genders || [];
    // Combinaisons poste × sexe (au moins une entrée)
    const posList = positions.length ? positions : [null];
    const genList = genders.length ? genders : [null];
    for (const pos of posList) {
      for (const gen of genList) {
        results.push({
          id: `synth-${ct.id}-${v.id || v.label || Math.random().toString(36).slice(2)}-${pos ?? "any"}-${gen ?? "any"}`,
          name: v.label ? `${ct.name} — ${v.label}` : ct.name,
          test_category: ct.test_category || "custom",
          test_type: testType,
          unit: ct.unit,
          lower_is_better: lower,
          levels,
          use_body_weight_ratio: isRatio,
          body_weight_multiplier: null,
          filter_type: pos ? "position" : "all",
          filter_value: pos,
          gender_filter: gen,
        });
      }
    }
  }

  // Barème de base (sans filtre) si défini
  if (scale.ranges && scale.ranges.length) {
    const lower = !!scale.lowerIsBetter;
    const hasThresholds = scale.ranges.some((r) => r.min != null || r.max != null);
    if (hasThresholds) {
      results.push({
        id: `synth-${ct.id}-base`,
        name: ct.name,
        test_category: ct.test_category || "custom",
        test_type: testType,
        unit: ct.unit,
        lower_is_better: lower,
        levels: rangesToLevels(scale.ranges, lower),
        use_body_weight_ratio: isRatio,
        body_weight_multiplier: null,
        filter_type: "all",
        filter_value: null,
        gender_filter: null,
      });
    }
  }

  return results;
}

export function synthesizeBenchmarks(
  customTests: {
    id: string;
    name: string;
    unit: string | null;
    test_category?: string | null;
    scoring_scale?: ScoringScale | null;
  }[],
): SynthBenchmark[] {
  const out: SynthBenchmark[] = [];
  for (const ct of customTests) {
    out.push(...synthesizeBenchmarksFromCustomTest(ct));
  }
  return out;
}
