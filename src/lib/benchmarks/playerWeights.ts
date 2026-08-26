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
  created_at?: string | null;
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

  // `custom:<uuid>` (référence directe) ou `custom_<slug>` (saisie staff historique)
  if (testType.startsWith("custom:") || testType.startsWith("custom_")) {
    const custom = testType.startsWith("custom:")
      ? customTests.find((ct) => ct.id === testType.slice("custom:".length))
      : customTests.find((ct) => normalize(ct.name) === normalize(testType.slice("custom_".length)));
    if (!custom) {
      // Pas de test personnalisé retrouvé : on se rabat sur le nom du slug.
      const slug = normalize(testType.slice("custom_".length));
      return (
        (!unit || unit === "kg") &&
        (slug === "poids" || slug === "weight" || slug === "bodyweight" || slug === "poidsdecorps")
      );
    }

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
  const latest = new Map<string, { weight: number; date: string; createdAt: string }>();

  const consider = (
    playerId: string,
    weight: unknown,
    date?: string | null,
    createdAt?: string | null,
  ) => {
    if (!isPlausibleBodyWeight(weight)) return;
    const current = latest.get(playerId);
    const sourceDate = date || "";
    const sourceCreated = createdAt || "";
    const isNewer =
      !current ||
      sourceDate.localeCompare(current.date) > 0 ||
      // Même jour : la saisie la plus récente l'emporte (correction de poids)
      (sourceDate.localeCompare(current.date) === 0 &&
        sourceCreated.localeCompare(current.createdAt) > 0);
    if (isNewer) {
      latest.set(playerId, { weight: Number(weight), date: sourceDate, createdAt: sourceCreated });
    }
  };

  for (const row of bodyComps) consider(row.player_id, row.weight_kg, row.measurement_date, (row as any).created_at);
  for (const row of playerMeasurements) consider(row.player_id, row.weight_kg, row.measurement_date, (row as any).created_at);
  for (const row of weightTests) {
    if (isBodyWeightTestRecord(row, customTests)) {
      consider(row.player_id, row.result_value, row.test_date, row.created_at);
    }
  }

  const weights = new Map<string, number>();
  for (const [playerId, value] of latest) weights.set(playerId, value.weight);
  return weights;
}