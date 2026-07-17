export interface WeightSourceRow {
  player_id: string;
  weight_kg?: number | string | null;
  measurement_date?: string | null;
}

export interface GenericWeightTestRow {
  player_id: string;
  test_type?: string | null;
  test_category?: string | null;
  result_value?: number | string | null;
  result_unit?: string | null;
  test_date?: string | null;
}

export interface CustomWeightTestLite {
  id: string;
  name?: string | null;
  unit?: string | null;
  test_category?: string | null;
}

function normalize(value: string | null | undefined): string {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s_\-.]+/g, "")
    .trim();
}

function isPlausibleBodyWeight(value: unknown): value is number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 20 && n <= 200;
}

export function isBodyWeightTestRecord(
  test: GenericWeightTestRow,
  customTests: CustomWeightTestLite[] = [],
): boolean {
  if (!isPlausibleBodyWeight(test.result_value)) return false;

  const unit = normalize(test.result_unit);
  if (unit && unit !== "kg") return false;

  const testType = test.test_type || "";
  const normalizedType = normalize(testType);
  const normalizedCategory = normalize(test.test_category);

  if (["weight", "bodyweight", "poids", "massecorporelle", "bodymass"].includes(normalizedType)) {
    return true;
  }

  const isBodyCategory =
    normalizedCategory.includes("anthropometr") ||
    normalizedCategory.includes("corporel") ||
    normalizedCategory.includes("body") ||
    normalizedCategory.includes("compositioncorporelle");
  if (isBodyCategory && (!unit || unit === "kg")) return true;

  if (testType.startsWith("custom:")) {
    const customId = testType.slice("custom:".length);
    const custom = customTests.find((ct) => ct.id === customId);
    if (!custom) return false;

    const customUnit = normalize(custom.unit);
    const customName = normalize(custom.name);
    const customCategory = normalize(custom.test_category);
    const customLooksLikeWeight =
      customName.includes("poids") ||
      customName.includes("weight") ||
      customName.includes("massecorporelle") ||
      customName.includes("bodymass") ||
      customCategory.includes("anthropometr") ||
      customCategory.includes("corporel") ||
      customCategory.includes("body");

    return customUnit === "kg" && customLooksLikeWeight;
  }

  return false;
}

export function collectLatestPlayerWeights({
  bodyComps = [],
  playerMeasurements = [],
  weightTests = [],
  customTests = [],
}: {
  bodyComps?: WeightSourceRow[];
  playerMeasurements?: WeightSourceRow[];
  weightTests?: GenericWeightTestRow[];
  customTests?: CustomWeightTestLite[];
}): Map<string, number> {
  const latest = new Map<string, { weight: number; date: string }>();

  const consider = (playerId: string, weight: unknown, date?: string | null) => {
    if (!isPlausibleBodyWeight(weight)) return;
    const current = latest.get(playerId);
    const sourceDate = date || "";
    if (!current || sourceDate.localeCompare(current.date) > 0) {
      latest.set(playerId, { weight: Number(weight), date: sourceDate });
    }
  };

  for (const row of bodyComps) consider(row.player_id, row.weight_kg, row.measurement_date);
  for (const row of playerMeasurements) consider(row.player_id, row.weight_kg, row.measurement_date);
  for (const row of weightTests) {
    if (isBodyWeightTestRecord(row, customTests)) {
      consider(row.player_id, row.result_value, row.test_date);
    }
  }

  const weights = new Map<string, number>();
  for (const [playerId, value] of latest) weights.set(playerId, value.weight);
  return weights;
}