import i18n from "@/i18n";

/**
 * Translation of sport position names (stored in French in the database)
 * into the active interface language. Works for every discipline.
 */
const EN_POSITIONS: Record<string, string> = {
  // Rugby
  "pilier gauche": "Loosehead prop",
  "pilier droit": "Tighthead prop",
  pilier: "Prop",
  talonneur: "Hooker",
  "2ème ligne": "Second row",
  "2eme ligne": "Second row",
  "2ème ligne gauche": "Left second row",
  "2ème ligne droit": "Right second row",
  "deuxième ligne": "Second row",
  "troisième ligne": "Back row",
  "troisième ligne centre": "Loose forward",
  flanker: "Flanker",
  "n°8": "Number 8",
  "demi de mêlée": "Scrum-half",
  "demi d'ouverture": "Fly-half",
  demi: "Half-back",
  "1er centre": "Inside centre",
  "2ème centre": "Outside centre",
  "centre gauche": "Left centre",
  "centre droit": "Right centre",
  centre: "Centre",
  "ailier gauche": "Left wing",
  "ailier droit": "Right wing",
  ailier: "Winger",
  arrière: "Full-back",
  arriere: "Full-back",
  "link gauche": "Left link",
  "link droit": "Right link",
  // Football
  gardien: "Goalkeeper",
  "défenseur central": "Centre-back",
  "latéral droit": "Right-back",
  "latéral gauche": "Left-back",
  "milieu défensif": "Defensive midfielder",
  "milieu offensif": "Attacking midfielder",
  "milieu droit": "Right midfielder",
  "milieu gauche": "Left midfielder",
  "milieu central": "Central midfielder",
  attaquant: "Striker",
  "avant-centre": "Centre-forward",
  // Handball
  "arrière gauche": "Left back",
  "arrière droit": "Right back",
  "demi-centre": "Centre back",
  pivot: "Pivot",
  // Basketball
  "meneur (point guard)": "Point guard",
  meneur: "Point guard",
  "arrière (shooting guard)": "Shooting guard",
  "ailier (small forward)": "Small forward",
  "ailier fort (power forward)": "Power forward",
  "pivot (center)": "Center",
  // Volleyball
  passeur: "Setter",
  central: "Middle blocker",
  pointu: "Opposite",
  réceptionneur: "Outside hitter",
  libero: "Libero",
  "avant droit (p2)": "Front right (P2)",
  "avant centre (p3)": "Front centre (P3)",
  "avant gauche (p4)": "Front left (P4)",
  "arrière gauche (p5)": "Back left (P5)",
  "arrière centre (p6)": "Back centre (P6)",
  "arrière droit (p1)": "Back right (P1)",
};

export function translatePositionName(position?: string | null): string {
  if (!position) return "";
  if (i18n.language !== "en") return position;
  const key = position.trim().toLowerCase();
  return EN_POSITIONS[key] ?? position;
}
