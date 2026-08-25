// Sport-specific position groups for player selection

export interface PositionGroup {
  id: string;
  label: string;
  labelKey: string; // i18n key suffix under roster.positions
  positions: string[]; // Position names that belong to this group
}

// Rugby XV position groups
export const RUGBY_XV_POSITION_GROUPS: PositionGroup[] = [
  {
    id: "premiere_ligne",
    label: "Première ligne (1/2/3)",
    labelKey: "rugbyXv.premiere_ligne",
    positions: [
      "Pilier gauche", "Talonneur", "Pilier droit",
      "pilier", "talonneur", "première ligne", "premiere ligne",
    ],
  },
  {
    id: "deuxieme_ligne",
    label: "Deuxième ligne (4/5)",
    labelKey: "rugbyXv.deuxieme_ligne",
    positions: [
      "2ème ligne", "2eme ligne", "Deuxième ligne", "Deuxieme ligne",
      "seconde ligne", "deuxième ligne", "deuxieme ligne",
    ],
  },
  {
    id: "troisieme_ligne",
    label: "Troisième ligne (6/7/8)",
    labelKey: "rugbyXv.troisieme_ligne",
    positions: [
      "Flanker", "N°8", "N8", "Troisième ligne", "Troisieme ligne",
      "troisième ligne", "troisieme ligne", "flanker", "numéro 8", "numero 8",
    ],
  },
  {
    id: "charniere",
    label: "Charnière (9/10)",
    labelKey: "rugbyXv.charniere",
    positions: [
      "Demi de mêlée", "Demi d'ouverture", "Demi de melee", "Demi d'ouverture",
      "demi de mêlée", "demi de melee", "demi d'ouverture", "ouvreur", "demi",
    ],
  },
  {
    id: "centres",
    label: "Centres (12/13)",
    labelKey: "rugbyXv.centres",
    positions: [
      "1er centre", "2ème centre", "2eme centre", "Premier centre", "Deuxième centre",
      "centre", "premier centre", "deuxième centre", "deuxieme centre",
    ],
  },
  {
    id: "ailiers_arrieres",
    label: "Ailiers/Arrières (11/14/15)",
    labelKey: "rugbyXv.ailiers_arrieres",
    positions: [
      "Ailier gauche", "Ailier droit", "Arrière",
      "ailier", "arrière", "arriere",
    ],
  },
];

// Rugby 7s position groups
export const RUGBY_7S_POSITION_GROUPS: PositionGroup[] = [
  {
    id: "avants",
    label: "Avants",
    labelKey: "rugby7s.avants",
    positions: ["Pilier gauche", "Talonneur", "Pilier droit", "pilier"],
  },
  {
    id: "arrieres",
    label: "Arrières",
    labelKey: "rugby7s.arrieres",
    positions: ["Demi de mêlée", "Centre gauche", "Centre droit", "Arrière", "demi", "centre", "arrière"],
  },
];

// Rugby XIII (Rugby League) position groups
export const RUGBY_XIII_POSITION_GROUPS: PositionGroup[] = [
  {
    id: "avants",
    label: "Avants",
    labelKey: "rugbyXiii.avants",
    positions: [
      "Pilier gauche", "Talonneur", "Pilier droit",
      "2ème ligne gauche", "2ème ligne droit", "Troisième ligne centre",
      "pilier", "talonneur", "deuxième ligne", "troisième ligne"
    ],
  },
  {
    id: "arrieres",
    label: "Arrières",
    labelKey: "rugbyXiii.arrieres",
    positions: [
      "Arrière", "Ailier droit", "Ailier gauche",
      "Centre droit", "Centre gauche",
      "Demi d'ouverture", "Demi de mêlée",
      "arrière", "ailier", "centre", "demi"
    ],
  },
];

// Football position groups (granular)
export const FOOTBALL_POSITION_GROUPS: PositionGroup[] = [
  {
    id: "gardiens",
    label: "Gardiens",
    labelKey: "football.gardiens",
    positions: ["Gardien", "gardien", "goal", "goalkeeper", "portier"],
  },
  {
    id: "defenseurs_centraux",
    label: "Défenseurs centraux",
    labelKey: "football.defenseurs_centraux",
    positions: [
      "Défenseur central", "défenseur central",
      "central", "stoppeur", "libero", "libéro",
    ],
  },
  {
    id: "lateraux",
    label: "Latéraux (droit/gauche)",
    labelKey: "football.lateraux",
    positions: [
      "Latéral droit", "Latéral gauche", "latéral", "lateral",
      "arrière droit", "arrière gauche", "piston", "arrière latéral",
    ],
  },
  {
    id: "milieux_defensifs",
    label: "Milieux défensifs / récupérateurs",
    labelKey: "football.milieux_defensifs",
    positions: [
      "Milieu défensif", "milieu défensif", "milieu defensif",
      "récupérateur", "recuperateur", "sentinelle", "n°6", "n6",
    ],
  },
  {
    id: "milieux_offensifs",
    label: "Milieux offensifs / relayeurs",
    labelKey: "football.milieux_offensifs",
    positions: [
      "Milieu offensif", "milieu offensif", "meneur", "meneur de jeu",
      "relayeur", "n°10", "n10", "milieu axial", "milieu central",
    ],
  },
  {
    id: "ailiers",
    label: "Ailiers (droit/gauche)",
    labelKey: "football.ailiers",
    positions: [
      "Ailier droit", "Ailier gauche", "ailier", "winger",
      "milieu droit", "milieu gauche",
    ],
  },
  {
    id: "attaquants",
    label: "Attaquants / avant-centres",
    labelKey: "football.attaquants",
    positions: [
      "Attaquant", "attaquant", "avant-centre", "avant centre",
      "buteur", "n°9", "n9", "second attaquant", "seconde pointe",
    ],
  },
];

// Handball position groups (granular)
export const HANDBALL_POSITION_GROUPS: PositionGroup[] = [
  {
    id: "gardiens",
    label: "Gardiens",
    labelKey: "handball.gardiens",
    positions: ["Gardien", "gardien", "goal"],
  },
  {
    id: "ailier_gauche",
    label: "Ailier gauche",
    labelKey: "handball.ailier_gauche",
    positions: ["Ailier gauche", "ailier gauche", "AG"],
  },
  {
    id: "ailier_droit",
    label: "Ailier droit",
    labelKey: "handball.ailier_droit",
    positions: ["Ailier droit", "ailier droit", "AD"],
  },
  {
    id: "arriere_gauche",
    label: "Arrière gauche",
    labelKey: "handball.arriere_gauche",
    positions: ["Arrière gauche", "arrière gauche", "ARG"],
  },
  {
    id: "arriere_droit",
    label: "Arrière droit",
    labelKey: "handball.arriere_droit",
    positions: ["Arrière droit", "arrière droit", "ARD"],
  },
  {
    id: "demi_centre",
    label: "Demi-centre",
    labelKey: "handball.demi_centre",
    positions: ["Demi-centre", "demi-centre", "demi centre", "DC"],
  },
  {
    id: "pivots",
    label: "Pivot",
    labelKey: "handball.pivots",
    positions: ["Pivot", "pivot"],
  },
];

// Basketball position groups (granular by numbered position)
export const BASKETBALL_POSITION_GROUPS: PositionGroup[] = [
  {
    id: "meneurs",
    label: "Meneur (1 - Point Guard)",
    labelKey: "basketball.meneurs",
    positions: ["Meneur (Point Guard)", "Meneur", "meneur", "point guard", "PG", "n°1", "n1"],
  },
  {
    id: "arrieres",
    label: "Arrière (2 - Shooting Guard)",
    labelKey: "basketball.arrieres",
    positions: ["Arrière (Shooting Guard)", "Arrière", "arrière", "shooting guard", "SG", "n°2", "n2"],
  },
  {
    id: "ailiers",
    label: "Ailier (3 - Small Forward)",
    labelKey: "basketball.ailiers",
    positions: ["Ailier (Small Forward)", "Ailier", "ailier", "small forward", "SF", "n°3", "n3"],
  },
  {
    id: "ailiers_forts",
    label: "Ailier fort (4 - Power Forward)",
    labelKey: "basketball.ailiers_forts",
    positions: ["Ailier fort (Power Forward)", "Ailier fort", "ailier fort", "power forward", "PF", "n°4", "n4"],
  },
  {
    id: "pivots",
    label: "Pivot (5 - Center)",
    labelKey: "basketball.pivots",
    positions: ["Pivot (Center)", "Pivot", "pivot", "center", "n°5", "n5"],
  },
];

// Volleyball position groups (granular)
export const VOLLEYBALL_POSITION_GROUPS: PositionGroup[] = [
  {
    id: "passeurs",
    label: "Passeurs",
    labelKey: "volleyball.passeurs",
    positions: ["Passeur", "passeur", "setter"],
  },
  {
    id: "centraux",
    label: "Centraux",
    labelKey: "volleyball.centraux",
    positions: ["Central", "central", "middle blocker", "contre central"],
  },
  {
    id: "pointus",
    label: "Pointus / Opposites",
    labelKey: "volleyball.pointus",
    positions: ["Pointu", "pointu", "opposite", "opposé", "oppose"],
  },
  {
    id: "receptionneurs",
    label: "Réceptionneurs-attaquants",
    labelKey: "volleyball.receptionneurs",
    positions: [
      "Réceptionneur", "réceptionneur", "receptionneur",
      "réceptionneur-attaquant", "receptionneur-attaquant",
      "attaquant réceptionneur", "outside hitter",
      "Avant droit (P2)", "Avant centre (P3)", "Avant gauche (P4)",
    ],
  },
  {
    id: "liberos",
    label: "Liberos",
    labelKey: "volleyball.liberos",
    positions: ["Libero", "libero", "libéro", "Arrière centre (P6)"],
  },
];


// Get position groups for a sport
export function getPositionGroupsForSport(sportType: string | undefined): PositionGroup[] {
  if (!sportType) return [];
  
  const baseSport = sportType.includes('_') ? sportType.split('_')[0].toLowerCase() : sportType.toLowerCase();
  
  switch (baseSport) {
    case "xv":
    case "academie":
    case "national_team":
    case "rugby":
      return RUGBY_XV_POSITION_GROUPS;
    case "7":
      return RUGBY_7S_POSITION_GROUPS;
    case "xiii":
      return RUGBY_XIII_POSITION_GROUPS;
    case "football":
      return FOOTBALL_POSITION_GROUPS;
    case "handball":
      return HANDBALL_POSITION_GROUPS;
    case "basketball":
      return BASKETBALL_POSITION_GROUPS;
    case "volleyball":
      return VOLLEYBALL_POSITION_GROUPS;
    default:
      return [];
  }
}

// Check if a player's position belongs to a group
export function playerBelongsToGroup(playerPosition: string | undefined, group: PositionGroup): boolean {
  if (!playerPosition) return false;
  
  const normalizedPosition = playerPosition.toLowerCase().trim();
  
  return group.positions.some(pos => {
    const normalizedGroupPos = pos.toLowerCase().trim();
    return normalizedPosition.includes(normalizedGroupPos) || normalizedGroupPos.includes(normalizedPosition);
  });
}

// Check if a sport has position groups
export function sportHasPositionGroups(sportType: string | undefined): boolean {
  return getPositionGroupsForSport(sportType).length > 0;
}

// Get translated display label for a position group (FR fallback via i18n)
export function getPositionGroupLabel(group: PositionGroup, t: (key: string, opts?: Record<string, unknown>) => string): string {
  return t(`roster.positions.${group.labelKey}`, { defaultValue: group.label });
}
