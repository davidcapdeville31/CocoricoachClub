/**
 * Helpers pour matcher un benchmark (test_category / test_type) avec un
 * résultat de test, qu'il soit stocké sous forme de preset (`squat_1rm`) ou
 * de test personnalisé (`custom:<uuid>`).
 */

export interface CustomTestLite {
  id: string;
  name: string;
  test_category?: string | null;
}

/**
 * Normalise un identifiant/nom de test pour comparaison souple.
 * "Squat 3RM" ≈ "squat_3rm" ≈ "SQUAT-3RM"
 */
export function normalizeTestKey(v: string | null | undefined): string {
  if (!v) return "";
  return v
    .toLowerCase()
    .replace(/^custom:/, "")
    .replace(/[\s_\-.]+/g, "")
    .trim();
}

/**
 * Renvoie l'ensemble des `test_type` acceptés pour ce benchmark, en incluant
 * les tests personnalisés dont le nom correspond (match par nom).
 *
 * - benchmark preset `squat_1rm` → accepte `squat_1rm` + tout `custom:<uuid>`
 *   dont le nom normalisé vaut `squat1rm`.
 * - benchmark `custom:<uuid>` → accepte cet UUID + presets dont l'id normalisé
 *   correspond au nom du custom test (fallback inverse).
 */
export function resolveAcceptedTestTypes(
  benchmarkTestType: string,
  customTests: CustomTestLite[],
): Set<string> {
  const accepted = new Set<string>([benchmarkTestType]);
  const targetKey = normalizeTestKey(benchmarkTestType);
  if (!targetKey) return accepted;

  for (const ct of customTests) {
    const ctKey = normalizeTestKey(ct.name);
    const ctId = `custom:${ct.id}`;
    if (ctKey && ctKey === targetKey) {
      accepted.add(ctId);
    }
    // Cas inverse : benchmark ciblant un custom, mais résultat sur un preset homonyme
    if (benchmarkTestType.startsWith("custom:") && benchmarkTestType === ctId) {
      // le nom du custom peut matcher un preset — on garde la clé normalisée
      // pour permettre au caller de retomber sur son preset via matches par clé
      const nameKey = normalizeTestKey(ct.name);
      if (nameKey) accepted.add(nameKey); // pseudo-token, comparé via normalizeTestKey côté caller
    }
  }
  return accepted;
}

/** True si un résultat (`test_type`) est acceptable pour ce benchmark. */
export function matchesBenchmark(
  resultTestType: string,
  benchmarkTestType: string,
  customTests: CustomTestLite[],
): boolean {
  const accepted = resolveAcceptedTestTypes(benchmarkTestType, customTests);
  if (accepted.has(resultTestType)) return true;
  // Fallback : comparer clés normalisées
  const rk = normalizeTestKey(resultTestType);
  return accepted.has(rk);
}
