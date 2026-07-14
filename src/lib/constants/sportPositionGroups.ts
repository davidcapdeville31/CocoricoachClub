// Sport-specific position groups for player selection

export interface PositionGroup {
  id: string;
  label: string;
  positions: string[]; // Position names that belong to this group
}

// Rugby XV position groups
export const RUGBY_XV_POSITION_GROUPS: PositionGroup[] = [
  {
    id: "premiere_ligne",
    label: "Première ligne (1/2/3)",
    positions: [
      "Pilier gauche", "Talonneur", "Pilier droit",
      "pilier", "talonneur", "première ligne", "premiere ligne",
    ],
  },
  {
    id: "deuxieme_ligne",
    label: "Deuxième ligne (4/5)",
    positions: [
      "2ème ligne", "2eme ligne", "Deuxième ligne", "Deuxieme ligne",
      "seconde ligne", "deuxième ligne", "deuxieme ligne",
    ],
  },
  {
    id: "troisieme_ligne",
    label: "Troisième ligne (6/7/8)",
    positions: [
      "Flanker", "N°8", "N8", "Troisième ligne", "Troisieme ligne",
      "troisième ligne", "troisieme ligne", "flanker", "numéro 8", "numero 8",
    ],
  },
  {
    id: "charniere",
    label: "Charnière (9/10)",
    positions: [
      "Demi de mêlée", "Demi d'ouverture", "Demi de melee", "Demi d'ouverture",
      "demi de mêlée", "demi de melee", "demi d'ouverture", "ouvreur", "demi",
    ],
  },
  {
    id: "centres",
    label: "Centres (12/13)",
    positions: [
      "1er centre", "2ème centre", "2eme centre", "Premier centre", "Deuxième centre",
      "centre", "premier centre", "deuxième centre", "deuxieme centre",
    ],
  },
  {
    id: "ailiers_arrieres",
    label: "Ailiers/Arrières (11/14/15)",
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
    positions: ["Pilier gauche", "Talonneur", "Pilier droit", "pilier"],
  },
  {
    id: "arrieres",
    label: "Arrières",
    positions: ["Demi de mêlée", "Centre gauche", "Centre droit", "Arrière", "demi", "centre", "arrière"],
  },
];

// Rugby XIII (Rugby League) position groups
export const RUGBY_XIII_POSITION_GROUPS: PositionGroup[] = [
  {
    id: "avants",
    label: "Avants",
    positions: [
      "Pilier gauche", "Talonneur", "Pilier droit",
      "2ème ligne gauche", "2ème ligne droit", "Troisième ligne centre",
      "pilier", "talonneur", "deuxième ligne", "troisième ligne"
    ],
  },
  {
    id: "arrieres",
    label: "Arrières",
    positions: [
      "Arrière", "Ailier droit", "Ailier gauche",
      "Centre droit", "Centre gauche",
      "Demi d'ouverture", "Demi de mêlée",
      "arrière", "ailier", "centre", "demi"
    ],
  },
];

// Football position groups
export const FOOTBALL_POSITION_GROUPS: PositionGroup[] = [
  {
    id: "gardiens",
    label: "Gardiens",
    positions: ["Gardien", "gardien", "goal", "goalkeeper"],
  },
  {
    id: "defenseurs",
    label: "Défenseurs",
    positions: [
      "Latéral droit", "Latéral gauche", "Défenseur central",
      "défenseur", "arrière", "latéral", "central", "libero"
    ],
  },
  {
    id: "milieux",
    label: "Milieux",
    positions: [
      "Milieu défensif", "Milieu droit", "Milieu gauche",
      "milieu", "meneur", "récupérateur", "relayeur"
    ],
  },
  {
    id: "attaquants",
    label: "Attaquants",
    positions: [
      "Attaquant", "Ailier droit", "Ailier gauche",
      "attaquant", "avant-centre", "buteur", "ailier"
    ],
  },
];

// Handball position groups
export const HANDBALL_POSITION_GROUPS: PositionGroup[] = [
  {
    id: "gardiens",
    label: "Gardiens",
    positions: ["Gardien", "gardien"],
  },
  {
    id: "arrieres",
    label: "Arrières",
    positions: ["Arrière gauche", "Arrière droit", "arrière"],
  },
  {
    id: "ailiers",
    label: "Ailiers",
    positions: ["Ailier gauche", "Ailier droit", "ailier"],
  },
  {
    id: "pivots",
    label: "Pivots/Centres",
    positions: ["Pivot", "Demi-centre", "pivot", "demi-centre"],
  },
];

// Basketball position groups
export const BASKETBALL_POSITION_GROUPS: PositionGroup[] = [
  {
    id: "guards",
    label: "Guards",
    positions: ["Meneur (Point Guard)", "Arrière (Shooting Guard)", "meneur", "arrière", "guard"],
  },
  {
    id: "forwards",
    label: "Ailiers",
    positions: ["Ailier (Small Forward)", "Ailier fort (Power Forward)", "ailier", "forward"],
  },
  {
    id: "centers",
    label: "Pivots",
    positions: ["Pivot (Center)", "pivot", "center"],
  },
];

// Volleyball position groups
export const VOLLEYBALL_POSITION_GROUPS: PositionGroup[] = [
  {
    id: "setters",
    label: "Passeurs",
    positions: ["passeur", "setter"],
  },
  {
    id: "hitters",
    label: "Attaquants",
    positions: ["Avant droit (P2)", "Avant centre (P3)", "Avant gauche (P4)", "attaquant", "pointu", "réceptionneur"],
  },
  {
    id: "liberos",
    label: "Liberos",
    positions: ["libero", "Arrière centre (P6)"],
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
