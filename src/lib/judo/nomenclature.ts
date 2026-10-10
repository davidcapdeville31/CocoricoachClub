/**
 * Nomenclature judo structurée et extensible (Kodokan).
 * Les clés sont stables et servent aux statistiques ; les libellés peuvent évoluer.
 */
export type JudoPosition = "tachi" | "ne";

export interface JudoFamily {
  key: string;
  label: string;
  hint: string;
  position: JudoPosition;
}

export interface JudoTechnique {
  key: string;
  label: string;
  family: string;
}

export const JUDO_FAMILIES: JudoFamily[] = [
  { key: "te_waza", label: "Te-waza", hint: "Techniques de bras", position: "tachi" },
  { key: "koshi_waza", label: "Koshi-waza", hint: "Techniques de hanche", position: "tachi" },
  { key: "ashi_waza", label: "Ashi-waza", hint: "Techniques de jambe", position: "tachi" },
  { key: "ma_sutemi_waza", label: "Ma-sutemi-waza", hint: "Sacrifices arrière", position: "tachi" },
  { key: "yoko_sutemi_waza", label: "Yoko-sutemi-waza", hint: "Sacrifices latéraux", position: "tachi" },
  { key: "osaekomi_waza", label: "Osaekomi-waza", hint: "Immobilisations", position: "ne" },
  { key: "shime_waza", label: "Shime-waza", hint: "Étranglements", position: "ne" },
  { key: "kansetsu_waza", label: "Kansetsu-waza", hint: "Clés articulaires", position: "ne" },
];

const T = (family: string, labels: string[]): JudoTechnique[] =>
  labels.map((label) => ({ key: label.toLowerCase().replace(/[^a-z0-9]+/g, "_"), label, family }));

export const JUDO_TECHNIQUES: JudoTechnique[] = [
  ...T("te_waza", ["Seoi-nage", "Ippon-seoi-nage", "Seoi-otoshi", "Tai-otoshi", "Kata-guruma", "Sukui-nage", "Uki-otoshi", "Sumi-otoshi", "Obi-otoshi", "Yama-arashi", "Morote-gari", "Kuchiki-taoshi", "Kibisu-gaeshi", "Uchi-mata-sukashi", "Ko-uchi-gaeshi"]),
  ...T("koshi_waza", ["O-goshi", "Uki-goshi", "Harai-goshi", "Tsurikomi-goshi", "Sode-tsurikomi-goshi", "Koshi-guruma", "Hane-goshi", "Utsuri-goshi", "Ushiro-goshi", "Tsuri-goshi", "Ura-nage"]),
  ...T("ashi_waza", ["O-soto-gari", "O-uchi-gari", "Ko-uchi-gari", "Ko-soto-gari", "Ko-soto-gake", "Uchi-mata", "De-ashi-harai", "Okuri-ashi-harai", "Sasae-tsurikomi-ashi", "Harai-tsurikomi-ashi", "Hiza-guruma", "Ashi-guruma", "O-guruma", "O-soto-guruma", "O-soto-otoshi", "Tsubame-gaeshi", "Hane-goshi-gaeshi", "Harai-goshi-gaeshi", "Uchi-mata-gaeshi", "O-soto-gaeshi", "O-uchi-gaeshi"]),
  ...T("ma_sutemi_waza", ["Tomoe-nage", "Sumi-gaeshi", "Hikikomi-gaeshi", "Tawara-gaeshi", "Ura-nage (sutemi)"]),
  ...T("yoko_sutemi_waza", ["Yoko-otoshi", "Tani-otoshi", "Hane-makikomi", "Soto-makikomi", "Uchi-makikomi", "Uki-waza", "Yoko-wakare", "Yoko-guruma", "Yoko-gake", "Daki-wakare", "O-soto-makikomi", "Uchi-mata-makikomi", "Harai-makikomi"]),
  ...T("osaekomi_waza", ["Kesa-gatame", "Kuzure-kesa-gatame", "Ushiro-kesa-gatame", "Kata-gatame", "Kami-shiho-gatame", "Kuzure-kami-shiho-gatame", "Yoko-shiho-gatame", "Tate-shiho-gatame", "Uki-gatame", "Ura-gatame"]),
  ...T("shime_waza", ["Okuri-eri-jime", "Nami-juji-jime", "Gyaku-juji-jime", "Kata-juji-jime", "Hadaka-jime", "Kata-ha-jime", "Kata-te-jime", "Ryote-jime", "Sode-guruma-jime", "Do-jime", "Sankaku-jime", "Tsukkomi-jime"]),
  ...T("kansetsu_waza", ["Ude-hishigi-juji-gatame", "Ude-garami", "Ude-hishigi-ude-gatame", "Ude-hishigi-hiza-gatame", "Ude-hishigi-waki-gatame", "Ude-hishigi-hara-gatame", "Ude-hishigi-ashi-gatame", "Ude-hishigi-te-gatame", "Ude-hishigi-sankaku-gatame"]),
];

/** Situations pédagogiques de ne-waza — distinctes des familles officielles. */
export const NE_WAZA_SITUATIONS = [
  { key: "retournement", label: "Retournements" },
  { key: "passage_garde", label: "Passage de garde" },
  { key: "defense_sol", label: "Défense au sol" },
  { key: "sortie_immobilisation", label: "Sortie d'immobilisation" },
  { key: "transition_debout_sol", label: "Transition debout → sol" },
];

export const JUDO_MODALITIES: Array<{ key: string; label: string; hint: string; fields: Array<"duration" | "sets" | "reps" | "rest" | "partner"> }> = [
  { key: "tandoku_renshu", label: "Tandoku-renshu", hint: "Travail seul", fields: ["duration", "sets", "reps", "rest"] },
  { key: "uchi_komi", label: "Uchi-komi", hint: "Répétitions d'entrée", fields: ["sets", "reps", "rest", "partner"] },
  { key: "nage_komi", label: "Nage-komi", hint: "Projections complètes", fields: ["sets", "reps", "rest", "partner"] },
  { key: "kakari_geiko", label: "Kakari-geiko", hint: "Attaques continues", fields: ["duration", "sets", "rest", "partner"] },
  { key: "yaku_soku_geiko", label: "Yaku-soku-geiko", hint: "Randori convenu", fields: ["duration", "sets", "rest", "partner"] },
  { key: "libre", label: "Travail technique libre", hint: "Format libre", fields: ["duration"] },
];

export const TACTICAL_AXES = [
  { key: "kumi_kata", label: "Kumi-kata" },
  { key: "distance", label: "Gestion de la distance" },
  { key: "deplacements", label: "Déplacements et placement" },
  { key: "opportunites", label: "Création d'opportunités" },
  { key: "enchainements", label: "Enchaînements d'attaques" },
  { key: "combinaisons", label: "Combinaisons" },
  { key: "contre_attaques", label: "Attaques et contre-attaques" },
  { key: "transition", label: "Transition tachi-waza / ne-waza" },
  { key: "rythme", label: "Gestion du rythme" },
  { key: "score_temps", label: "Gestion du score et du temps" },
  { key: "bordure", label: "Bordure de tapis" },
  { key: "profils", label: "Profils d'adversaires" },
];

/** Exemples pédagogiques courts, insérés uniquement sur action volontaire. */
export const TACTICAL_EXAMPLES = [
  "Gagner la garde manche avant d'attaquer",
  "Attaquer dans les 5 s après la saisie",
  "Sortir de la bordure sans être pénalisé",
  "Mener d'un waza-ari : gérer les 30 dernières secondes",
];

export const RANDORI_TYPES = [
  { key: "tachi", label: "Tachi-waza" },
  { key: "ne", label: "Ne-waza" },
  { key: "mixte", label: "Mixte" },
];

export const OPPOSITION_TYPES = [
  { key: "libre", label: "Randori libre" },
  { key: "theme", label: "Randori à thème" },
  { key: "situationnel", label: "Randori situationnel" },
  { key: "progressive", label: "Opposition progressive" },
  { key: "competition", label: "Orientée compétition" },
];

export const RANDORI_EVALUATION_FIELDS = [
  { key: "reussites", label: "Réussites techniques" },
  { key: "kumi_kata", label: "Qualité du kumi-kata" },
  { key: "adaptation", label: "Capacité d'adaptation" },
  { key: "engagement", label: "Engagement" },
  { key: "tactique", label: "Gestion tactique" },
];

export const PHYSICAL_QUALITIES = [
  { key: "force", label: "Force" },
  { key: "puissance", label: "Puissance" },
  { key: "vitesse", label: "Vitesse" },
  { key: "endurance", label: "Endurance" },
  { key: "mobilite", label: "Mobilité" },
  { key: "coordination", label: "Coordination" },
  { key: "gainage", label: "Gainage" },
  { key: "prevention", label: "Prévention" },
];

export const WARMUP_OPTIONS = [
  { key: "general", label: "Général" },
  { key: "mobilite", label: "Mobilité" },
  { key: "deplacements", label: "Déplacements" },
  { key: "ukemi", label: "Ukemi" },
  { key: "specifique", label: "Spécifique judo" },
  { key: "activation", label: "Activation neuromusculaire" },
];

export const COOLDOWN_OPTIONS = [
  { key: "recup_active", label: "Récupération active" },
  { key: "respiration", label: "Respiration" },
  { key: "mobilite_douce", label: "Mobilité douce" },
  { key: "retour_seance", label: "Retour sur la séance" },
  { key: "autre", label: "Autre" },
];

export const SESSION_OBJECTIVES = [
  { key: "technique", label: "Technique" },
  { key: "tactique", label: "Tactique" },
  { key: "randori", label: "Randori / Opposition" },
  { key: "physique", label: "Physique" },
  { key: "mental", label: "Mental" },
  { key: "recuperation", label: "Récupération" },
];

export const labelOf = (list: Array<{ key: string; label: string }>, key: string | null | undefined) =>
  list.find((x) => x.key === key)?.label ?? key ?? "";

export const techniqueByKey = (key: string) => JUDO_TECHNIQUES.find((t) => t.key === key);
export const familyByKey = (key: string) => JUDO_FAMILIES.find((f) => f.key === key);

const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

/** Recherche tolérante (accents, tirets, espaces) dans la nomenclature. */
export function searchTechniques(query: string, position?: JudoPosition | null): JudoTechnique[] {
  const q = normalize(query);
  const allowed = new Set(JUDO_FAMILIES.filter((f) => !position || f.position === position).map((f) => f.key));
  return JUDO_TECHNIQUES.filter((t) => allowed.has(t.family) && (!q || normalize(t.label).includes(q)));
}
