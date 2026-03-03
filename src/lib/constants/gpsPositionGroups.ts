/**
 * GPS Position Groups per sport for objectives.
 * Each sport defines position groups with their associated position names.
 */

export interface GpsPositionGroup {
  id: string;
  label: string;
  positions: string[]; // Position names that belong to this group
}

export interface GpsObjectiveTargets {
  total_distance_m?: number | null;
  high_speed_distance_m?: number | null;
  sprint_count?: number | null;
  vmax_percentage?: number | null;
}

export interface GpsTemplateGroup {
  position_group: string;
  targets: GpsObjectiveTargets;
  targets_min?: GpsObjectiveTargets; // For range display
}

export interface GpsObjectiveTemplate {
  id: string;
  name: string;
  groups: GpsTemplateGroup[];
}

// ===================== RUGBY XV =====================
export const RUGBY_XV_GPS_GROUPS: GpsPositionGroup[] = [
  {
    id: "avants",
    label: "Avants",
    positions: ["Pilier gauche", "Talonneur", "Pilier droit", "2ème ligne", "Flanker", "N°8"],
  },
  {
    id: "trois_quarts",
    label: "3/4",
    positions: ["Demi de mêlée", "Demi d'ouverture", "1er centre", "2ème centre", "Ailier gauche", "Ailier droit", "Arrière"],
  },
];

export const RUGBY_XV_TEMPLATES: GpsObjectiveTemplate[] = [
  {
    id: "vitesse",
    name: "Vitesse",
    groups: [
      {
        position_group: "Avants",
        targets_min: { total_distance_m: 3000, high_speed_distance_m: 300, sprint_count: 5, vmax_percentage: 85 },
        targets: { total_distance_m: 4000, high_speed_distance_m: 500, sprint_count: 10, vmax_percentage: 95 },
      },
      {
        position_group: "3/4",
        targets_min: { total_distance_m: 4000, high_speed_distance_m: 600, sprint_count: 10, vmax_percentage: 90 },
        targets: { total_distance_m: 5500, high_speed_distance_m: 900, sprint_count: 20, vmax_percentage: 100 },
      },
    ],
  },
  {
    id: "jeu_reduit",
    name: "Jeu réduit",
    groups: [
      {
        position_group: "Avants",
        targets_min: { total_distance_m: 3500, high_speed_distance_m: 400, sprint_count: 5, vmax_percentage: 80 },
        targets: { total_distance_m: 5000, high_speed_distance_m: 700, sprint_count: 10, vmax_percentage: 90 },
      },
      {
        position_group: "3/4",
        targets_min: { total_distance_m: 4500, high_speed_distance_m: 700, sprint_count: 8, vmax_percentage: 85 },
        targets: { total_distance_m: 6000, high_speed_distance_m: 1000, sprint_count: 15, vmax_percentage: 95 },
      },
    ],
  },
  {
    id: "contact",
    name: "Contact",
    groups: [
      {
        position_group: "Avants",
        targets_min: { total_distance_m: 2500, high_speed_distance_m: 200, sprint_count: 3, vmax_percentage: 75 },
        targets: { total_distance_m: 4000, high_speed_distance_m: 400, sprint_count: 6, vmax_percentage: 85 },
      },
      {
        position_group: "3/4",
        targets_min: { total_distance_m: 3000, high_speed_distance_m: 300, sprint_count: 5, vmax_percentage: 80 },
        targets: { total_distance_m: 4500, high_speed_distance_m: 600, sprint_count: 10, vmax_percentage: 90 },
      },
    ],
  },
  {
    id: "match_simulation",
    name: "Match simulation",
    groups: [
      {
        position_group: "Avants",
        targets_min: { total_distance_m: 5000, high_speed_distance_m: 500, sprint_count: 5, vmax_percentage: 85 },
        targets: { total_distance_m: 7000, high_speed_distance_m: 800, sprint_count: 10, vmax_percentage: 95 },
      },
      {
        position_group: "3/4",
        targets_min: { total_distance_m: 6000, high_speed_distance_m: 800, sprint_count: 15, vmax_percentage: 90 },
        targets: { total_distance_m: 9000, high_speed_distance_m: 1200, sprint_count: 25, vmax_percentage: 100 },
      },
    ],
  },
];

// ===================== RUGBY 7 =====================
export const RUGBY_7S_GPS_GROUPS: GpsPositionGroup[] = [
  { id: "avants", label: "Avants", positions: ["Pilier gauche", "Talonneur", "Pilier droit"] },
  { id: "arrieres", label: "Arrières", positions: ["Demi de mêlée", "Centre gauche", "Centre droit", "Arrière"] },
];

// ===================== FOOTBALL =====================
export const FOOTBALL_GPS_GROUPS: GpsPositionGroup[] = [
  { id: "gardien", label: "Gardien", positions: ["Gardien"] },
  { id: "defenseurs", label: "Défenseurs", positions: ["Latéral droit", "Défenseur central", "Latéral gauche"] },
  { id: "milieux", label: "Milieux", positions: ["Milieu défensif", "Milieu droit", "Milieu gauche"] },
  { id: "attaquants", label: "Attaquants", positions: ["Attaquant", "Ailier droit", "Ailier gauche"] },
];

export const FOOTBALL_TEMPLATES: GpsObjectiveTemplate[] = [
  {
    id: "match_simulation",
    name: "Match simulation",
    groups: [
      { position_group: "Gardien", targets: { total_distance_m: 5500, high_speed_distance_m: 100, sprint_count: 2, vmax_percentage: 70 } },
      { position_group: "Défenseurs", targets: { total_distance_m: 9500, high_speed_distance_m: 600, sprint_count: 15, vmax_percentage: 85 } },
      { position_group: "Milieux", targets: { total_distance_m: 11000, high_speed_distance_m: 900, sprint_count: 20, vmax_percentage: 90 } },
      { position_group: "Attaquants", targets: { total_distance_m: 10000, high_speed_distance_m: 1000, sprint_count: 25, vmax_percentage: 95 } },
    ],
  },
  {
    id: "intensite",
    name: "Haute intensité",
    groups: [
      { position_group: "Gardien", targets: { total_distance_m: 3000, high_speed_distance_m: 50, sprint_count: 1, vmax_percentage: 60 } },
      { position_group: "Défenseurs", targets: { total_distance_m: 5000, high_speed_distance_m: 400, sprint_count: 8, vmax_percentage: 80 } },
      { position_group: "Milieux", targets: { total_distance_m: 6000, high_speed_distance_m: 500, sprint_count: 12, vmax_percentage: 85 } },
      { position_group: "Attaquants", targets: { total_distance_m: 5500, high_speed_distance_m: 600, sprint_count: 15, vmax_percentage: 90 } },
    ],
  },
];

// ===================== HANDBALL =====================
export const HANDBALL_GPS_GROUPS: GpsPositionGroup[] = [
  { id: "gardien", label: "Gardien", positions: ["Gardien"] },
  { id: "ailiers", label: "Ailiers", positions: ["Ailier gauche", "Ailier droit"] },
  { id: "arrieres", label: "Arrières", positions: ["Arrière gauche", "Demi-centre", "Arrière droit"] },
  { id: "pivot", label: "Pivot", positions: ["Pivot"] },
];

// ===================== BASKETBALL =====================
export const BASKETBALL_GPS_GROUPS: GpsPositionGroup[] = [
  { id: "meneurs", label: "Meneurs/Arrières", positions: ["Meneur (Point Guard)", "Arrière (Shooting Guard)"] },
  { id: "ailiers", label: "Ailiers", positions: ["Ailier (Small Forward)", "Ailier fort (Power Forward)"] },
  { id: "pivot", label: "Pivot", positions: ["Pivot (Center)"] },
];

/**
 * Get position groups for a given sport type
 */
export function getGpsPositionGroups(sportType: string): GpsPositionGroup[] {
  const baseSport = sportType.includes('_') ? sportType.split('_')[0].toLowerCase() : sportType.toLowerCase();
  
  switch (baseSport) {
    case "xv":
    case "academie":
    case "national_team":
      return RUGBY_XV_GPS_GROUPS;
    case "7":
      return RUGBY_7S_GPS_GROUPS;
    case "football":
      return FOOTBALL_GPS_GROUPS;
    case "handball":
      return HANDBALL_GPS_GROUPS;
    case "basketball":
      return BASKETBALL_GPS_GROUPS;
    default:
      return RUGBY_XV_GPS_GROUPS;
  }
}

/**
 * Get system templates for a given sport type
 */
export function getSystemTemplates(sportType: string): GpsObjectiveTemplate[] {
  const baseSport = sportType.includes('_') ? sportType.split('_')[0].toLowerCase() : sportType.toLowerCase();
  
  switch (baseSport) {
    case "xv":
    case "academie":
    case "national_team":
      return RUGBY_XV_TEMPLATES;
    case "football":
      return FOOTBALL_TEMPLATES;
    default:
      return RUGBY_XV_TEMPLATES;
  }
}

/**
 * Determine which position group a player belongs to based on their position
 */
export function getPlayerPositionGroup(
  playerPosition: string | null | undefined,
  groups: GpsPositionGroup[]
): GpsPositionGroup | null {
  if (!playerPosition) return null;
  const lowerPos = playerPosition.toLowerCase();
  
  for (const group of groups) {
    if (group.positions.some(p => lowerPos.includes(p.toLowerCase()) || p.toLowerCase().includes(lowerPos))) {
      return group;
    }
  }
  
  // Try by number for rugby
  const numMatch = playerPosition.match(/\d+/);
  if (numMatch) {
    const num = parseInt(numMatch[0]);
    for (const group of groups) {
      if (group.id === "avants" && num >= 1 && num <= 8) return group;
      if ((group.id === "trois_quarts" || group.id === "arrieres") && num >= 9 && num <= 15) return group;
    }
  }
  
  return null;
}

/**
 * Calculate the status color based on actual vs target with tolerance
 */
export type ObjectiveStatus = "green" | "orange" | "red" | "none";

export function getObjectiveStatus(
  actual: number | null | undefined,
  target: number | null | undefined,
  toleranceGreen: number = 15,
  toleranceOrange: number = 30
): ObjectiveStatus {
  if (actual == null || target == null || target === 0) return "none";
  
  const deviation = Math.abs((actual - target) / target) * 100;
  
  if (deviation <= toleranceGreen) return "green";
  if (deviation <= toleranceOrange) return "orange";
  return "red";
}

export function getDeviationPercent(
  actual: number | null | undefined,
  target: number | null | undefined
): number | null {
  if (actual == null || target == null || target === 0) return null;
  return Math.round(((actual - target) / target) * 100);
}
