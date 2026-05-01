// V2 namespace - exact copy from Remix project for program builder methods/styles.

export interface TrainingStyleCharacteristics {
  effortPercu: number;
  hypertrophie: number;
  forcePuissance: number;
  enduranceMusculaire: number;
  vitesse: number;
  stressNerveux: number;
  stressMecanique: number;
  experienceRequise: number;
  methodeAccumulation: boolean;
  methodeIntensification: boolean;
}

export interface TrainingStyleConfig {
  value: string;
  label: string;
  color: string;
  description: string;
  characteristics?: TrainingStyleCharacteristics;
}

export const TRAINING_STYLES: TrainingStyleConfig[] = [
  { value: "normal", label: "Normal", color: "", description: "Exécution classique : effectuez toutes les séries d'un exercice avant de passer au suivant.", characteristics: { effortPercu: 2, hypertrophie: 3, forcePuissance: 3, enduranceMusculaire: 2, vitesse: 2, stressNerveux: 2, stressMecanique: 2, experienceRequise: 1, methodeAccumulation: true, methodeIntensification: false } },
  { value: "superset", label: "Superset (agoniste/antagoniste)", color: "bg-blue-500", description: "Enchaînement de deux exercices antagonistes sans repos.", characteristics: { effortPercu: 4, hypertrophie: 4, forcePuissance: 2, enduranceMusculaire: 4, vitesse: 2, stressNerveux: 3, stressMecanique: 3, experienceRequise: 2, methodeAccumulation: true, methodeIntensification: false } },
  { value: "biset", label: "Biset (2 ex même groupe)", color: "bg-cyan-600", description: "Enchaînement de deux exercices pour le même groupe musculaire sans repos.", characteristics: { effortPercu: 4, hypertrophie: 5, forcePuissance: 2, enduranceMusculaire: 4, vitesse: 2, stressNerveux: 3, stressMecanique: 4, experienceRequise: 2, methodeAccumulation: true, methodeIntensification: false } },
  { value: "triset", label: "Triset (3 ex même groupe)", color: "bg-purple-500", description: "Enchaînez 3 exercices ciblant le même groupe musculaire sans repos.", characteristics: { effortPercu: 5, hypertrophie: 5, forcePuissance: 2, enduranceMusculaire: 5, vitesse: 1, stressNerveux: 4, stressMecanique: 5, experienceRequise: 3, methodeAccumulation: true, methodeIntensification: false } },
  { value: "giant_set", label: "Giant Set (4+ ex même groupe)", color: "bg-pink-500", description: "Enchaînez 4 exercices ou plus ciblant le même groupe musculaire.", characteristics: { effortPercu: 5, hypertrophie: 5, forcePuissance: 2, enduranceMusculaire: 5, vitesse: 1, stressNerveux: 5, stressMecanique: 5, experienceRequise: 4, methodeAccumulation: true, methodeIntensification: false } },
  { value: "drop_set", label: "Drop Set", color: "bg-red-500", description: "Série jusqu'à l'échec, puis réduction immédiate du poids (20-25%) et continuation sans repos.", characteristics: { effortPercu: 5, hypertrophie: 5, forcePuissance: 3, enduranceMusculaire: 4, vitesse: 1, stressNerveux: 4, stressMecanique: 5, experienceRequise: 3, methodeAccumulation: false, methodeIntensification: true } },
  { value: "rest_pause", label: "Rest-Pause", color: "bg-amber-500", description: "Série jusqu'à l'échec, repos 10-15s, reprise jusqu'à l'échec.", characteristics: { effortPercu: 5, hypertrophie: 4, forcePuissance: 4, enduranceMusculaire: 3, vitesse: 2, stressNerveux: 5, stressMecanique: 4, experienceRequise: 4, methodeAccumulation: false, methodeIntensification: true } },
  { value: "pyramid_up", label: "Pyramide montante", color: "bg-emerald-500", description: "Augmentation progressive du poids et diminution des reps.", characteristics: { effortPercu: 4, hypertrophie: 4, forcePuissance: 4, enduranceMusculaire: 3, vitesse: 2, stressNerveux: 4, stressMecanique: 4, experienceRequise: 2, methodeAccumulation: true, methodeIntensification: true } },
  { value: "pyramid_down", label: "Pyramide descendante", color: "bg-teal-500", description: "Commencer lourd avec peu de reps, diminuer le poids en augmentant les reps.", characteristics: { effortPercu: 4, hypertrophie: 5, forcePuissance: 4, enduranceMusculaire: 4, vitesse: 2, stressNerveux: 4, stressMecanique: 4, experienceRequise: 3, methodeAccumulation: true, methodeIntensification: true } },
  { value: "pyramid_full", label: "Pyramide complète ↑↓", color: "bg-cyan-500", description: "Combinaison montante et descendante.", characteristics: { effortPercu: 5, hypertrophie: 5, forcePuissance: 4, enduranceMusculaire: 4, vitesse: 2, stressNerveux: 5, stressMecanique: 5, experienceRequise: 3, methodeAccumulation: true, methodeIntensification: true } },
  { value: "cluster", label: "Cluster Set", color: "bg-orange-500", description: "Mini-séries avec 10-30s de repos entre chaque pour maintenir la qualité à haute intensité.", characteristics: { effortPercu: 4, hypertrophie: 3, forcePuissance: 5, enduranceMusculaire: 2, vitesse: 4, stressNerveux: 5, stressMecanique: 4, experienceRequise: 4, methodeAccumulation: false, methodeIntensification: true } },
  { value: "emom", label: "EMOM", color: "bg-indigo-500", description: "Every Minute On the Minute.", characteristics: { effortPercu: 4, hypertrophie: 3, forcePuissance: 3, enduranceMusculaire: 5, vitesse: 3, stressNerveux: 3, stressMecanique: 3, experienceRequise: 2, methodeAccumulation: true, methodeIntensification: false } },
  { value: "amrap", label: "AMRAP", color: "bg-rose-500", description: "As Many Reps/Rounds As Possible dans un temps donné.", characteristics: { effortPercu: 5, hypertrophie: 3, forcePuissance: 2, enduranceMusculaire: 5, vitesse: 3, stressNerveux: 4, stressMecanique: 4, experienceRequise: 2, methodeAccumulation: true, methodeIntensification: false } },
  { value: "circuit", label: "Circuit", color: "bg-lime-500", description: "Enchaînement d'exercices différents avec peu de repos.", characteristics: { effortPercu: 4, hypertrophie: 2, forcePuissance: 2, enduranceMusculaire: 5, vitesse: 3, stressNerveux: 3, stressMecanique: 3, experienceRequise: 2, methodeAccumulation: true, methodeIntensification: false } },
  { value: "for_time", label: "For Time", color: "bg-orange-500", description: "Compléter un circuit le plus rapidement possible.", characteristics: { effortPercu: 5, hypertrophie: 2, forcePuissance: 2, enduranceMusculaire: 5, vitesse: 4, stressNerveux: 4, stressMecanique: 3, experienceRequise: 2, methodeAccumulation: true, methodeIntensification: false } },
  { value: "death_by", label: "Death By", color: "bg-red-600", description: "Ajouter 1 rep chaque minute jusqu'à l'échec.", characteristics: { effortPercu: 5, hypertrophie: 2, forcePuissance: 2, enduranceMusculaire: 5, vitesse: 3, stressNerveux: 5, stressMecanique: 4, experienceRequise: 3, methodeAccumulation: true, methodeIntensification: true } },
  { value: "tabata", label: "Tabata", color: "bg-yellow-500", description: "20s effort max / 10s repos x 8.", characteristics: { effortPercu: 5, hypertrophie: 2, forcePuissance: 2, enduranceMusculaire: 5, vitesse: 5, stressNerveux: 4, stressMecanique: 3, experienceRequise: 2, methodeAccumulation: true, methodeIntensification: false } },
  { value: "five_by_five", label: "5x5", color: "bg-sky-500", description: "5 séries de 5 reps à 80-85% 1RM.", characteristics: { effortPercu: 4, hypertrophie: 3, forcePuissance: 5, enduranceMusculaire: 2, vitesse: 2, stressNerveux: 4, stressMecanique: 4, experienceRequise: 2, methodeAccumulation: false, methodeIntensification: true } },
  { value: "bulgarian", label: "Méthode Bulgare", color: "bg-fuchsia-500", description: "Contraste lourd/léger pour potentiation.", characteristics: { effortPercu: 5, hypertrophie: 3, forcePuissance: 5, enduranceMusculaire: 2, vitesse: 5, stressNerveux: 5, stressMecanique: 4, experienceRequise: 4, methodeAccumulation: false, methodeIntensification: true } },
  { value: "isometric_overcoming", label: "Iso.Overcoming", color: "bg-rose-500", description: "Contraction maximale contre résistance fixe.", characteristics: { effortPercu: 5, hypertrophie: 2, forcePuissance: 5, enduranceMusculaire: 2, vitesse: 2, stressNerveux: 5, stressMecanique: 5, experienceRequise: 4, methodeAccumulation: false, methodeIntensification: true } },
  { value: "isometric_yielding", label: "Iso.Yielding", color: "bg-emerald-500", description: "Maintien d'une charge le plus longtemps possible.", characteristics: { effortPercu: 4, hypertrophie: 3, forcePuissance: 4, enduranceMusculaire: 4, vitesse: 1, stressNerveux: 4, stressMecanique: 4, experienceRequise: 3, methodeAccumulation: true, methodeIntensification: true } },
  { value: "intermittent_cardio", label: "Intermittent Cardio", color: "bg-sky-500", description: "Alternance effort/récupération.", characteristics: { effortPercu: 4, hypertrophie: 1, forcePuissance: 1, enduranceMusculaire: 5, vitesse: 4, stressNerveux: 3, stressMecanique: 2, experienceRequise: 2, methodeAccumulation: true, methodeIntensification: false } },
  { value: "fartlek", label: "Fartlek", color: "bg-green-500", description: "Phases d'effort variables et récupération active.", characteristics: { effortPercu: 4, hypertrophie: 1, forcePuissance: 2, enduranceMusculaire: 5, vitesse: 4, stressNerveux: 3, stressMecanique: 2, experienceRequise: 2, methodeAccumulation: true, methodeIntensification: false } },
  { value: "stato_dynamique", label: "Stato-Dynamique", color: "bg-violet-500", description: "Combinaison phases isométriques et dynamiques.", characteristics: { effortPercu: 5, hypertrophie: 3, forcePuissance: 5, enduranceMusculaire: 3, vitesse: 4, stressNerveux: 5, stressMecanique: 5, experienceRequise: 3, methodeAccumulation: false, methodeIntensification: true } },
  { value: "combine_haltero", label: "Combiné Haltéro", color: "bg-fuchsia-600", description: "Enchaînement de mouvements d'haltérophilie sans lâcher la barre.", characteristics: { effortPercu: 5, hypertrophie: 2, forcePuissance: 5, enduranceMusculaire: 3, vitesse: 4, stressNerveux: 5, stressMecanique: 4, experienceRequise: 4, methodeAccumulation: false, methodeIntensification: true } },
];

export const getTrainingStyleConfig = (style: string): TrainingStyleConfig => {
  const config = TRAINING_STYLES.find(s => s.value === style);
  return config || TRAINING_STYLES[0];
};

export const WORKOUT_BUILDER_STYLES = TRAINING_STYLES.filter(s =>
  ["normal", "superset", "biset", "triset", "giant_set", "drop_set", "rest_pause", "pyramid_up", "pyramid_down", "cluster", "emom", "amrap", "circuit", "five_by_five", "bulgarian", "isometric_overcoming", "isometric_yielding"].includes(s.value)
);

export const PROGRAM_BUILDER_STYLES = TRAINING_STYLES.filter(s =>
  ["normal", "superset", "biset", "triset", "giant_set", "drop_set", "rest_pause", "pyramid_up", "pyramid_down", "pyramid_full", "five_by_five", "bulgarian", "isometric_overcoming", "isometric_yielding", "amrap", "for_time", "death_by", "circuit", "tabata", "emom", "intermittent_cardio", "fartlek", "stato_dynamique", "combine_haltero", "cluster"].includes(s.value)
);
