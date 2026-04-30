// Predefined measurement units for custom tests
export interface TestUnitOption {
  value: string;        // unit_kind stored in DB
  label: string;        // displayed label
  unit: string;         // display unit (e.g. "s", "m", "kg")
  isTime?: boolean;
  group: string;
}

export const TEST_UNIT_OPTIONS: TestUnitOption[] = [
  { value: "time_s", label: "Temps (secondes)", unit: "s", isTime: true, group: "Temps" },
  { value: "time_min", label: "Temps (minutes)", unit: "min", isTime: true, group: "Temps" },
  { value: "time_ms", label: "Temps (millisecondes)", unit: "ms", isTime: true, group: "Temps" },
  { value: "distance_cm", label: "Distance (cm)", unit: "cm", group: "Distance" },
  { value: "distance_m", label: "Distance (mètres)", unit: "m", group: "Distance" },
  { value: "distance_km", label: "Distance (km)", unit: "km", group: "Distance" },
  { value: "load_kg", label: "Charge (kg)", unit: "kg", group: "Charge / Poids" },
  { value: "load_lbs", label: "Charge (lbs)", unit: "lbs", group: "Charge / Poids" },
  { value: "speed_kmh", label: "Vitesse (km/h)", unit: "km/h", group: "Vitesse" },
  { value: "speed_ms", label: "Vitesse (m/s)", unit: "m/s", group: "Vitesse" },
  { value: "reps", label: "Répétitions", unit: "reps", group: "Quantité" },
  { value: "count", label: "Nombre / Comptage", unit: "", group: "Quantité" },
  { value: "percent", label: "Pourcentage (%)", unit: "%", group: "Quantité" },
  { value: "score", label: "Score / Points", unit: "pts", group: "Quantité" },
  { value: "watts", label: "Puissance (watts)", unit: "W", group: "Puissance" },
  { value: "bpm", label: "Fréquence cardiaque (bpm)", unit: "bpm", group: "Physiologique" },
  { value: "rpe", label: "RPE (1-10)", unit: "RPE", group: "Subjectif" },
  { value: "angle_deg", label: "Angle (degrés)", unit: "°", group: "Mobilité" },
  { value: "custom", label: "Autre / Personnalisé", unit: "", group: "Autre" },
];

export const getUnitByKind = (kind?: string | null): TestUnitOption | undefined =>
  TEST_UNIT_OPTIONS.find(u => u.value === kind);

export interface ScoringRange {
  id: string;
  min: number | null;       // null = no lower bound
  max: number | null;       // null = no upper bound
  points: number;
  label?: string;           // optional label (e.g. "PÔLE 1ere année")
}

export interface ScoringScale {
  ranges: ScoringRange[];
  lowerIsBetter?: boolean;  // for time-based tests where lower = better
}

/**
 * Compute points awarded for a given result value based on a scoring scale.
 * Returns 0 if no range matches.
 */
export function computePoints(value: number | null | undefined, scale?: ScoringScale | null): number {
  if (value == null || isNaN(value) || !scale?.ranges?.length) return 0;
  for (const r of scale.ranges) {
    const minOk = r.min == null || value >= r.min;
    const maxOk = r.max == null || value <= r.max;
    if (minOk && maxOk) return r.points;
  }
  return 0;
}

/**
 * Find which range label matches a value (for display)
 */
export function findMatchingRange(value: number | null | undefined, scale?: ScoringScale | null): ScoringRange | null {
  if (value == null || isNaN(value) || !scale?.ranges?.length) return null;
  for (const r of scale.ranges) {
    const minOk = r.min == null || value >= r.min;
    const maxOk = r.max == null || value <= r.max;
    if (minOk && maxOk) return r;
  }
  return null;
}

export interface BatteryLevel {
  id: string;
  minPercent: number;       // 0-100
  label: string;            // "Excellent", "Bon"...
  color?: string;           // hex or tailwind class
}

export const DEFAULT_BATTERY_LEVELS: BatteryLevel[] = [
  { id: "1", minPercent: 85, label: "Excellent", color: "#10b981" },
  { id: "2", minPercent: 70, label: "Bon", color: "#3b82f6" },
  { id: "3", minPercent: 50, label: "Moyen", color: "#f59e0b" },
  { id: "4", minPercent: 0, label: "Insuffisant", color: "#ef4444" },
];

export function getLevelForPercent(percent: number, levels: BatteryLevel[] = DEFAULT_BATTERY_LEVELS): BatteryLevel {
  const sorted = [...levels].sort((a, b) => b.minPercent - a.minPercent);
  return sorted.find(l => percent >= l.minPercent) ?? sorted[sorted.length - 1];
}
