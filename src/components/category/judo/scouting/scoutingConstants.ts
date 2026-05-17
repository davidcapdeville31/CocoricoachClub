// ============================================================
// Constantes pour la fiche scouting Judo haut niveau
// Options chips pour profil général, kumikata, tactique, physique...
// ============================================================

export type ChipOption = { key: string; label: string; tone?: "danger" | "control" | "opportunism" | "newaza" | "physical" };

// -------- PROFIL GÉNÉRAL --------
export const GLOBAL_STYLES: ChipOption[] = [
  { key: "dominant", label: "Dominant", tone: "danger" },
  { key: "balanced", label: "Équilibré", tone: "control" },
  { key: "dominated", label: "Dominé" },
  { key: "opportunist", label: "Opportuniste", tone: "opportunism" },
  { key: "manager", label: "Gestionnaire", tone: "control" },
  { key: "unpredictable", label: "Imprévisible", tone: "opportunism" },
];

export const INTENSITIES: ChipOption[] = [
  { key: "explosive", label: "Explosif", tone: "danger" },
  { key: "controlled", label: "Contrôlé", tone: "control" },
  { key: "defensive", label: "Défensif" },
  { key: "hyperactive", label: "Hyperactif", tone: "danger" },
  { key: "low_volume", label: "Faible volume" },
  { key: "high_pressure", label: "Haute pression", tone: "danger" },
];

export const RHYTHMS: ChipOption[] = [
  { key: "slow_start", label: "Démarrage lent" },
  { key: "strong_hajime", label: "Fort dès le hajime", tone: "danger" },
  { key: "build_up", label: "Monte en puissance" },
  { key: "fades_fast", label: "Faiblit rapidement" },
  { key: "very_steady", label: "Très constant", tone: "control" },
  { key: "peak_golden", label: "Pic en golden score", tone: "danger" },
];

export const MENTAL_BEHAVIORS: ChipOption[] = [
  { key: "calm", label: "Très calme", tone: "control" },
  { key: "panics", label: "Panique sous pression" },
  { key: "frustrates", label: "Se frustre vite" },
  { key: "smart", label: "Combat intelligent", tone: "control" },
  { key: "seeks_penalties", label: "Cherche les pénalités", tone: "opportunism" },
  { key: "shido_disrupt", label: "Se désorganise après shido" },
  { key: "mental_strong", label: "Mental fort", tone: "danger" },
];

export const SCORE_MANAGEMENT: ChipOption[] = [
  { key: "locks_when_lead", label: "Verrouille quand mène", tone: "control" },
  { key: "keeps_attacking", label: "Continue d'attaquer", tone: "danger" },
  { key: "becomes_defensive", label: "Devient défensif" },
  { key: "risks_behind", label: "Prend des risques en retard", tone: "opportunism" },
  { key: "advanced_tactical", label: "Gestion tactique avancée", tone: "control" },
];

// -------- KUMIKATA --------
export const KUMIKATA_STYLES: ChipOption[] = [
  { key: "sleeve_dominant", label: "Manche dominante" },
  { key: "deep_lapel", label: "Revers profond" },
  { key: "high_collar", label: "Col haut" },
  { key: "double_sleeve", label: "Double manche" },
  { key: "cross_grip", label: "Prise croisée" },
  { key: "russian_grip", label: "Russian grip" },
  { key: "belt", label: "Ceinture" },
  { key: "pistol_grip", label: "Pistol grip" },
  { key: "low_sleeve", label: "Manche basse" },
  { key: "anti_seoi", label: "Garde anti-seoi" },
];

export const KUMIKATA_OBJECTIVES: ChipOption[] = [
  { key: "block_sleeve", label: "Bloquer manche" },
  { key: "break_posture", label: "Casser posture" },
  { key: "setup_seoi", label: "Préparer seoi" },
  { key: "setup_uchimata", label: "Préparer uchi-mata" },
  { key: "neutralize", label: "Neutraliser" },
  { key: "seek_penalty", label: "Chercher pénalité" },
  { key: "control_displacement", label: "Contrôler déplacement" },
];

export const KUMIKATA_BEHAVIOR: ChipOption[] = [
  { key: "enters_immediately", label: "Entre immédiatement", tone: "danger" },
  { key: "waits_reaction", label: "Attend réaction" },
  { key: "changes_grip", label: "Change de garde souvent" },
  { key: "aggressive_hands", label: "Très agressif mains", tone: "danger" },
  { key: "defensive_hands", label: "Défensif mains" },
  { key: "refuses_exchange", label: "Refuse échange de garde" },
];

export const GRIP_ZONES: ChipOption[] = [
  { key: "sleeve", label: "Manche" },
  { key: "lapel", label: "Revers" },
  { key: "collar", label: "Col" },
  { key: "opposite_sleeve", label: "Manche opposée" },
  { key: "belt", label: "Ceinture" },
];

// -------- TOKUI-WAZA --------
export const WAZA_CATEGORIES = [
  { key: "ashi_waza", label: "Ashi-waza", color: "control" },
  { key: "te_waza", label: "Te-waza", color: "danger" },
  { key: "koshi_waza", label: "Koshi-waza", color: "opportunism" },
  { key: "sutemi_waza", label: "Sutemi-waza", color: "newaza" },
] as const;

export const COMMON_TECHNIQUES = [
  "Uchi-mata", "Seoi-nage", "Ippon-seoi-nage", "Tai-otoshi", "Ouchi-gari", "Kouchi-gari",
  "O-soto-gari", "Harai-goshi", "Sasae-tsurikomi-ashi", "De-ashi-barai", "Ko-soto-gake",
  "Tomoe-nage", "Sumi-gaeshi", "Ura-nage", "Yoko-tomoe-nage", "Hane-goshi",
  "Sode-tsurikomi-goshi", "Drop seoi", "Morote-seoi", "Soto-makikomi",
];

export const TECHNIQUE_DIRECTIONS = [
  { key: "forward", label: "Avant" },
  { key: "backward", label: "Arrière" },
  { key: "left", label: "Gauche" },
  { key: "right", label: "Droite" },
  { key: "diagonal_fl", label: "Diagonale avant-gauche" },
  { key: "diagonal_fr", label: "Diagonale avant-droite" },
];

// -------- NE-WAZA --------
export const NEWAZA_STYLES: ChipOption[] = [
  { key: "immobilizations", label: "Immobilisations", tone: "newaza" },
  { key: "chokes", label: "Étranglements", tone: "newaza" },
  { key: "armlocks", label: "Clés", tone: "newaza" },
  { key: "reversals", label: "Retournements" },
  { key: "fast_transitions", label: "Transitions rapides", tone: "danger" },
  { key: "turtle_defense", label: "Défense tortue" },
];

export const NEWAZA_BEHAVIOR: ChipOption[] = [
  { key: "follows_immediately", label: "Suit immédiatement au sol", tone: "danger" },
  { key: "never_follows", label: "Ne suit jamais" },
  { key: "aggressive_transition", label: "Très agressif transition", tone: "danger" },
  { key: "patient", label: "Très patient" },
  { key: "compact_defense", label: "Défense compacte" },
  { key: "gives_back", label: "Donne le dos" },
];

export const NEWAZA_EXITS: ChipOption[] = [
  { key: "bridge", label: "Pontage" },
  { key: "rotation", label: "Rotation" },
  { key: "closing", label: "Fermeture" },
  { key: "guard_recovery", label: "Recomposition garde" },
];

// -------- TACTIQUE --------
export const COMMON_SHIDOS: ChipOption[] = [
  { key: "non_combat", label: "Non-combativité" },
  { key: "excessive_defense", label: "Défense excessive" },
  { key: "false_attack", label: "Fausse attaque" },
  { key: "out_of_area", label: "Sortie" },
  { key: "illegal_grip", label: "Saisie illégale" },
];

export const REFEREE_BEHAVIOR: ChipOption[] = [
  { key: "seeks_penalties", label: "Cherche pénalités", tone: "opportunism" },
  { key: "clean_fighter", label: "Combat propre" },
  { key: "exploits_pauses", label: "Exploite les pauses" },
  { key: "influences_rhythm", label: "Influence rythme" },
];

export const END_GAME_BEHAVIOR: ChipOption[] = [
  { key: "locks_down", label: "Verrouille" },
  { key: "attacks", label: "Attaque", tone: "danger" },
  { key: "tires", label: "Fatigue" },
  { key: "becomes_dangerous", label: "Devient dangereux", tone: "danger" },
  { key: "ultra_defensive", label: "Ultra défensif" },
];

// -------- PHYSIQUE --------
export const PHYSICAL_TYPES: ChipOption[] = [
  { key: "powerful", label: "Puissant", tone: "physical" },
  { key: "explosive", label: "Explosif", tone: "danger" },
  { key: "fast", label: "Rapide", tone: "physical" },
  { key: "enduring", label: "Endurant", tone: "physical" },
  { key: "flexible", label: "Flexible" },
  { key: "mobile", label: "Mobile" },
];

export const POSTURES: ChipOption[] = [
  { key: "very_low", label: "Très basse" },
  { key: "straight", label: "Droite" },
  { key: "broken_forward", label: "Cassée avant" },
  { key: "very_mobile", label: "Très mobile" },
];

export const DISPLACEMENTS: ChipOption[] = [
  { key: "circle", label: "Cercle" },
  { key: "straight_line", label: "Ligne droite" },
  { key: "forward_pressure", label: "Pression avant", tone: "danger" },
  { key: "constant_retreat", label: "Recul constant" },
  { key: "many_feints", label: "Beaucoup de feintes" },
];

export const CARDIO_LEVELS: ChipOption[] = [
  { key: "fades_fast", label: "Faiblit vite" },
  { key: "stable", label: "Stable" },
  { key: "very_enduring", label: "Très endurant", tone: "physical" },
];

// -------- TIMING / DISTANCE / PHASES --------
export const TIMINGS: ChipOption[] = [
  { key: "displacement", label: "Sur déplacement" },
  { key: "step_resume", label: "Sur reprise d'appui" },
  { key: "reaction", label: "En réaction" },
  { key: "grip_break", label: "Après cassage de garde" },
  { key: "false_attack", label: "Sur fausse attaque" },
  { key: "counter", label: "Contre-attaque", tone: "opportunism" },
];

export const DISTANCES: ChipOption[] = [
  { key: "close", label: "Collé" },
  { key: "mid", label: "Mi-distance" },
  { key: "long", label: "Longue distance" },
];

export const DANGER_PHASES: ChipOption[] = [
  { key: "start", label: "Début combat", tone: "danger" },
  { key: "matte_resume", label: "Reprise matte" },
  { key: "edge", label: "Bord de tapis", tone: "danger" },
  { key: "golden_score", label: "Golden score", tone: "danger" },
  { key: "after_shido", label: "Après shido adverse" },
];

// -------- COULEURS UTILITAIRES TAILWIND --------
export const TONE_CLASSES = {
  danger: "bg-rose-500/15 text-rose-600 border-rose-500/30 hover:bg-rose-500/25 dark:text-rose-300",
  control: "bg-blue-500/15 text-blue-600 border-blue-500/30 hover:bg-blue-500/25 dark:text-blue-300",
  opportunism: "bg-orange-500/15 text-orange-600 border-orange-500/30 hover:bg-orange-500/25 dark:text-orange-300",
  newaza: "bg-violet-500/15 text-violet-600 border-violet-500/30 hover:bg-violet-500/25 dark:text-violet-300",
  physical: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/25 dark:text-emerald-300",
} as const;

export const TONE_ACTIVE = {
  danger: "bg-rose-500 text-white border-rose-500 hover:bg-rose-600",
  control: "bg-blue-500 text-white border-blue-500 hover:bg-blue-600",
  opportunism: "bg-orange-500 text-white border-orange-500 hover:bg-orange-600",
  newaza: "bg-violet-500 text-white border-violet-500 hover:bg-violet-600",
  physical: "bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600",
} as const;
