import { getBaseSport, type StatField } from "@/lib/constants/sportStats";
import { groupStatsByTheme, STAT_GROUP_PALETTE, type StatGroup } from "@/lib/statSubGroups";

const shots = [
  { prefix: "conversion", keys: ["conversions", "conversionsMade", "conversionsMissed", "conversionAttempts"], attempted: "conversionAttempts", made: "conversionsMade", missed: "conversionsMissed", label: "Transformations", points: undefined },
  { prefix: "penalty", keys: ["penaltiesScored", "penaltiesMade", "penaltiesMissed", "penaltyAttempts"], attempted: "penaltyAttempts", made: "penaltiesMade", missed: "penaltiesMissed", label: "Pénalités", points: "penaltiesPoints" },
  { prefix: "drop", keys: ["dropGoals", "dropsMade", "dropsMissed", "dropAttempts"], attempted: "dropAttempts", made: "dropsMade", missed: "dropsMissed", label: "Drops", points: "dropsPoints" },
];

export function athleteStatFields(stats: StatField[], sportType: string): StatField[] {
  if (getBaseSport(sportType) !== "rugby") return stats;
  const hidden = new Set(["tryAssists", "breakthroughs", "totalContacts", "defenseCollisions", ...shots.flatMap(s => s.keys)]);
  const fields: StatField[] = stats.filter(s => !hidden.has(s.key)).map(s => ({ ...s, enterable: s.computedFrom ? s.enterable : true, category: /collision/i.test(s.key) ? "defense" : s.category }));
  for (const shot of shots) {
    if (!stats.some(s => shot.keys.includes(s.key))) continue;
    const field = (key: string, label: string): StatField => ({ key, label, shortLabel: label, category: "scoring", type: "number", enterable: true });
    if (shot.points) fields.push(field(shot.points, "Points marqués"));
    fields.push(field(shot.attempted, `${shot.label} tentées (total)`), field(shot.made, `${shot.label} réussies`), field(shot.missed, `${shot.label} manquées`),
      { key: `${shot.prefix}Success`, label: `% de réussite — ${shot.label}`, shortLabel: "% de réussite", category: "scoring", type: "percentage", max: 100, computedFrom: { successKey: shot.made, totalKey: shot.attempted } });
  }
  return fields;
}

export function athleteStatGroups(category: string, stats: StatField[], sportType: string): StatGroup[] {
  if (getBaseSport(sportType) !== "rugby" || category !== "scoring") return groupStatsByTheme(category, stats, { sportType });
  const definitions = [
    { key: "tries", label: "Essais", match: (key: string) => key === "tries" },
    ...shots.map(s => ({ key: s.prefix, label: s.label, match: (key: string) => [...s.keys, s.points, `${s.prefix}Success`].includes(key) })),
  ];
  const groups: StatGroup[] = definitions.map((d, i) => ({ key: d.key, label: d.label, items: stats.filter(s => d.match(s.key)), color: STAT_GROUP_PALETTE[i] })).filter(g => g.items.length > 0);
  const others = stats.filter(s => !definitions.some(d => d.match(s.key)));
  if (others.length) groups.push({ key: "_others", label: "Autres", items: others, color: null });
  return groups;
}

export function athletePercentages(values: Record<string, number>, stats: StatField[]): Record<string, number> {
  const result = { ...values };
  for (const stat of stats) {
    if (!stat.computedFrom) continue;
    const { successKey, totalKey, failureKey } = stat.computedFrom;
    const success = result[successKey] || 0;
    const total = totalKey ? result[totalKey] || 0 : success + (failureKey ? result[failureKey] || 0 : 0);
    result[stat.key] = total > 0 ? Math.round(success / total * 100) : 0;
  }
  return result;
}

// Aliases represent the same successful kick, not an additional count.
export function rugbyScoringAliases(values: Record<string, number>): Record<string, number> {
  return { ...values, conversions: values.conversionsMade || 0, penaltiesScored: values.penaltiesMade || 0, dropGoals: values.dropsMade || 0 };
}

export function athleteStatDescription(stat: StatField, sportType: string, original: string): string {
  if (getBaseSport(sportType) !== "rugby" || stat.computedFrom) return original;
  if (/Points$/.test(stat.key)) return "Points que tu as personnellement marqués avec ces coups de pied. Une pénalité ou un drop réussi vaut 3 points.";
  if (/collision/i.test(stat.key)) return stat.key === "totalCollisions" ? "Nombre total de collisions auxquelles tu as participé." : stat.key === "collisionsOver5m" ? "Collisions avec au moins 5 mètres d'élan avant le contact." : "Collisions avec moins de 5 mètres d'élan avant le contact.";
  if (/calcul[ée]/i.test(original)) return `À saisir : ${stat.label}, uniquement pour tes propres actions pendant la compétition.`;
  return original;
}
