// Training styles definitions with tooltips for coaches and athletes

export interface TrainingStyleCharacteristics {
  effortPercu: number; // 1-5
  hypertrophie: number; // 1-5
  forcePuissance: number; // 1-5
  enduranceMusculaire: number; // 1-5
  vitesse: number; // 1-5
  stressNerveux: number; // 1-5
  stressMecanique: number; // 1-5
  experienceRequise: number; // 1-5
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
  { 
    value: "normal", 
    label: "Normal", 
    color: "",
    description: "Exécution classique : effectuez toutes les séries d'un exercice avant de passer au suivant.",
    characteristics: {
      effortPercu: 2,
      hypertrophie: 3,
      forcePuissance: 3,
      enduranceMusculaire: 2,
      vitesse: 2,
      stressNerveux: 2,
      stressMecanique: 2,
      experienceRequise: 1,
      methodeAccumulation: true,
      methodeIntensification: false,
    }
  },
  { 
    value: "superset", 
    label: "Superset (agoniste/antagoniste)", 
    color: "bg-blue-500",
    description: "Enchaînement de deux exercices antagonistes sans repos, permettant d'augmenter la densité d'entraînement tout en maintenant un volume total proche des formats traditionnels.",
    characteristics: {
      effortPercu: 4,
      hypertrophie: 4,
      forcePuissance: 2,
      enduranceMusculaire: 4,
      vitesse: 2,
      stressNerveux: 3,
      stressMecanique: 3,
      experienceRequise: 2,
      methodeAccumulation: true,
      methodeIntensification: false,
    }
  },
  { 
    value: "biset", 
    label: "Biset (2 ex même groupe)", 
    color: "bg-cyan-600",
    description: "Enchaînement de deux exercices pour le même groupe musculaire sans repos entre les séries, visant à augmenter le stress métabolique local et le temps sous tension.",
    characteristics: {
      effortPercu: 4,
      hypertrophie: 5,
      forcePuissance: 2,
      enduranceMusculaire: 4,
      vitesse: 2,
      stressNerveux: 3,
      stressMecanique: 4,
      experienceRequise: 2,
      methodeAccumulation: true,
      methodeIntensification: false,
    }
  },
  {
    value: "triset", 
    label: "Triset (3 ex même groupe)", 
    color: "bg-purple-500",
    description: "Enchaînez 3 exercices ciblant le même groupe musculaire sans repos. Idéal pour épuiser complètement un muscle.",
    characteristics: {
      effortPercu: 5,
      hypertrophie: 5,
      forcePuissance: 2,
      enduranceMusculaire: 5,
      vitesse: 1,
      stressNerveux: 4,
      stressMecanique: 5,
      experienceRequise: 3,
      methodeAccumulation: true,
      methodeIntensification: false,
    }
  },
  { 
    value: "giant_set", 
    label: "Giant Set (4+ ex même groupe)", 
    color: "bg-pink-500",
    description: "Enchaînez 4 exercices ou plus ciblant le même groupe musculaire. Technique avancée pour un volume intense.",
    characteristics: {
      effortPercu: 5,
      hypertrophie: 5,
      forcePuissance: 2,
      enduranceMusculaire: 5,
      vitesse: 1,
      stressNerveux: 5,
      stressMecanique: 5,
      experienceRequise: 4,
      methodeAccumulation: true,
      methodeIntensification: false,
    }
  },
  { 
    value: "drop_set", 
    label: "Drop Set", 
    color: "bg-red-500",
    description: "Effectuez une série jusqu'à l'échec, puis réduisez immédiatement le poids (20-25%) et continuez sans repos. Répétez 2-3 fois.",
    characteristics: {
      effortPercu: 5,
      hypertrophie: 5,
      forcePuissance: 3,
      enduranceMusculaire: 4,
      vitesse: 1,
      stressNerveux: 4,
      stressMecanique: 5,
      experienceRequise: 3,
      methodeAccumulation: false,
      methodeIntensification: true,
    }
  },
  { 
    value: "rest_pause", 
    label: "Rest-Pause", 
    color: "bg-amber-500",
    description: "Effectuez une série jusqu'à l'échec, reposez 10-15 secondes, puis reprenez jusqu'à l'échec. Répétez 2-3 fois dans la même série.",
    characteristics: {
      effortPercu: 5,
      hypertrophie: 4,
      forcePuissance: 4,
      enduranceMusculaire: 3,
      vitesse: 2,
      stressNerveux: 5,
      stressMecanique: 4,
      experienceRequise: 4,
      methodeAccumulation: false,
      methodeIntensification: true,
    }
  },
  { 
    value: "pyramid_up", 
    label: "Pyramide montante", 
    color: "bg-emerald-500",
    description: "Augmentez progressivement le poids à chaque série tout en diminuant les répétitions. Ex: 12@60%, 10@70%, 8@80%.",
    characteristics: {
      effortPercu: 4,
      hypertrophie: 4,
      forcePuissance: 4,
      enduranceMusculaire: 3,
      vitesse: 2,
      stressNerveux: 4,
      stressMecanique: 4,
      experienceRequise: 2,
      methodeAccumulation: true,
      methodeIntensification: true,
    }
  },
  { 
    value: "pyramid_down", 
    label: "Pyramide descendante", 
    color: "bg-teal-500",
    description: "Commencez lourd avec peu de reps, puis diminuez le poids en augmentant les répétitions. Ex: 6@85%, 8@75%, 12@65%.",
    characteristics: {
      effortPercu: 4,
      hypertrophie: 5,
      forcePuissance: 4,
      enduranceMusculaire: 4,
      vitesse: 2,
      stressNerveux: 4,
      stressMecanique: 4,
      experienceRequise: 3,
      methodeAccumulation: true,
      methodeIntensification: true,
    }
  },
  { 
    value: "pyramid_full", 
    label: "Pyramide complète ↑↓", 
    color: "bg-cyan-500",
    description: "Combinez montante et descendante : montez en poids jusqu'au pic, puis redescendez. Ex: 12-10-8-6-8-10-12 reps.",
    characteristics: {
      effortPercu: 5,
      hypertrophie: 5,
      forcePuissance: 4,
      enduranceMusculaire: 4,
      vitesse: 2,
      stressNerveux: 5,
      stressMecanique: 5,
      experienceRequise: 3,
      methodeAccumulation: true,
      methodeIntensification: true,
    }
  },
  { 
    value: "cluster", 
    label: "Cluster Set", 
    color: "bg-orange-500",
    description: "Divisez une série en mini-séries avec 10-30s de repos entre chaque. Ex: 2 reps, 20s repos, 2 reps, 20s repos, 2 reps. Permet de maintenir la qualité à haute intensité.",
    characteristics: {
      effortPercu: 4,
      hypertrophie: 3,
      forcePuissance: 5,
      enduranceMusculaire: 2,
      vitesse: 4,
      stressNerveux: 5,
      stressMecanique: 4,
      experienceRequise: 4,
      methodeAccumulation: false,
      methodeIntensification: true,
    }
  },
  { 
    value: "emom", 
    label: "EMOM", 
    color: "bg-indigo-500",
    description: "Every Minute On the Minute : effectuez un nombre fixe de reps au début de chaque minute. Le reste de la minute = repos.",
    characteristics: {
      effortPercu: 4,
      hypertrophie: 3,
      forcePuissance: 3,
      enduranceMusculaire: 5,
      vitesse: 3,
      stressNerveux: 3,
      stressMecanique: 3,
      experienceRequise: 2,
      methodeAccumulation: true,
      methodeIntensification: false,
    }
  },
  { 
    value: "amrap", 
    label: "AMRAP", 
    color: "bg-rose-500",
    description: "As Many Reps/Rounds As Possible : effectuez le maximum de répétitions ou tours dans un temps donné.",
    characteristics: {
      effortPercu: 5,
      hypertrophie: 3,
      forcePuissance: 2,
      enduranceMusculaire: 5,
      vitesse: 3,
      stressNerveux: 4,
      stressMecanique: 4,
      experienceRequise: 2,
      methodeAccumulation: true,
      methodeIntensification: false,
    }
  },
  { 
    value: "circuit", 
    label: "Circuit", 
    color: "bg-lime-500",
    description: "Enchaînez plusieurs exercices différents avec peu ou pas de repos. Idéal pour le cardio et l'endurance musculaire.",
    characteristics: {
      effortPercu: 4,
      hypertrophie: 2,
      forcePuissance: 2,
      enduranceMusculaire: 5,
      vitesse: 3,
      stressNerveux: 3,
      stressMecanique: 3,
      experienceRequise: 2,
      methodeAccumulation: true,
      methodeIntensification: false,
    }
  },
  // === NEW METHODS ===
  { 
    value: "for_time", 
    label: "For Time", 
    color: "bg-orange-500",
    description: "Complétez un circuit d'exercices le plus rapidement possible. Le temps final est votre score.",
    characteristics: {
      effortPercu: 5,
      hypertrophie: 2,
      forcePuissance: 2,
      enduranceMusculaire: 5,
      vitesse: 4,
      stressNerveux: 4,
      stressMecanique: 3,
      experienceRequise: 2,
      methodeAccumulation: true,
      methodeIntensification: false,
    }
  },
  { 
    value: "death_by", 
    label: "Death By", 
    color: "bg-red-600",
    description: "Ajoutez 1 rep chaque minute jusqu'à l'échec. Minute 1 = 1 rep, Minute 2 = 2 reps, etc. Le workout se termine quand vous ne pouvez plus finir dans la minute.",
    characteristics: {
      effortPercu: 5,
      hypertrophie: 2,
      forcePuissance: 2,
      enduranceMusculaire: 5,
      vitesse: 3,
      stressNerveux: 5,
      stressMecanique: 4,
      experienceRequise: 3,
      methodeAccumulation: true,
      methodeIntensification: true,
    }
  },
  { 
    value: "tabata", 
    label: "Tabata", 
    color: "bg-yellow-500",
    description: "Protocole d'intervalles : 20 secondes d'effort maximal, 10 secondes de repos, répétés 8 fois (4 minutes). Paramètres modifiables.",
    characteristics: {
      effortPercu: 5,
      hypertrophie: 2,
      forcePuissance: 2,
      enduranceMusculaire: 5,
      vitesse: 5,
      stressNerveux: 4,
      stressMecanique: 3,
      experienceRequise: 2,
      methodeAccumulation: true,
      methodeIntensification: false,
    }
  },
  { 
    value: "five_by_five", 
    label: "5x5", 
    color: "bg-sky-500",
    description: "Méthode classique de force : 5 séries de 5 répétitions avec charge lourde (80-85% 1RM). Repos long (3-5min) entre les séries.",
    characteristics: {
      effortPercu: 4,
      hypertrophie: 3,
      forcePuissance: 5,
      enduranceMusculaire: 2,
      vitesse: 2,
      stressNerveux: 4,
      stressMecanique: 4,
      experienceRequise: 2,
      methodeAccumulation: false,
      methodeIntensification: true,
    }
  },
  {
    value: "bulgarian", 
    label: "Méthode Bulgare", 
    color: "bg-fuchsia-500",
    description: "Contraste lourd/léger : alternez un exercice lourd (85-95% 1RM) avec un exercice léger explosif pour potentiation post-activation.",
    characteristics: {
      effortPercu: 5,
      hypertrophie: 3,
      forcePuissance: 5,
      enduranceMusculaire: 2,
      vitesse: 5,
      stressNerveux: 5,
      stressMecanique: 4,
      experienceRequise: 4,
      methodeAccumulation: false,
      methodeIntensification: true,
    }
  },
  { 
    value: "isometric_overcoming", 
    label: "Iso.Overcoming", 
    color: "bg-rose-500",
    description: "Contraction maximale contre une résistance fixe immobile. Développe la force à un angle spécifique. 6-10 secondes de tension maximale.",
    characteristics: {
      effortPercu: 5,
      hypertrophie: 2,
      forcePuissance: 5,
      enduranceMusculaire: 2,
      vitesse: 2,
      stressNerveux: 5,
      stressMecanique: 5,
      experienceRequise: 4,
      methodeAccumulation: false,
      methodeIntensification: true,
    }
  },
  { 
    value: "isometric_yielding", 
    label: "Iso.Yielding", 
    color: "bg-emerald-500",
    description: "Maintien d'une charge à un angle spécifique le plus longtemps possible. Développe l'endurance de force et le contrôle neuromusculaire.",
    characteristics: {
      effortPercu: 4,
      hypertrophie: 3,
      forcePuissance: 4,
      enduranceMusculaire: 4,
      vitesse: 1,
      stressNerveux: 4,
      stressMecanique: 4,
      experienceRequise: 3,
      methodeAccumulation: true,
      methodeIntensification: true,
    }
  },
  { 
    value: "intermittent_cardio", 
    label: "Intermittent Cardio", 
    color: "bg-sky-500",
    description: "Alternance répétée effort/récupération pour le développement des capacités cardio-respiratoires. Supports: course, vélo, natation.",
    characteristics: {
      effortPercu: 4,
      hypertrophie: 1,
      forcePuissance: 1,
      enduranceMusculaire: 5,
      vitesse: 4,
      stressNerveux: 3,
      stressMecanique: 2,
      experienceRequise: 2,
      methodeAccumulation: true,
      methodeIntensification: false,
    }
  },
  { 
    value: "fartlek", 
    label: "Fartlek", 
    color: "bg-green-500",
    description: "Méthode alternant des phases d'effort d'intensité variable et des phases de récupération active, de manière libre ou structurée, visant le développement aérobie/anaérobie et l'adaptabilité.",
    characteristics: {
      effortPercu: 4,
      hypertrophie: 1,
      forcePuissance: 2,
      enduranceMusculaire: 5,
      vitesse: 4,
      stressNerveux: 3,
      stressMecanique: 2,
      experienceRequise: 2,
      methodeAccumulation: true,
      methodeIntensification: false,
    }
  },
  { 
    value: "stato_dynamique", 
    label: "Stato-Dynamique", 
    color: "bg-violet-500",
    description: "Méthode de renforcement combinant des phases de contraction isométrique et dynamiques pour développer la force maximale, l'explosivité et le recrutement des unités motrices à haute intensité.",
    characteristics: {
      effortPercu: 5,
      hypertrophie: 3,
      forcePuissance: 5,
      enduranceMusculaire: 3,
      vitesse: 4,
      stressNerveux: 5,
      stressMecanique: 5,
      experienceRequise: 3,
      methodeAccumulation: false,
      methodeIntensification: true,
    }
  },
  { 
    value: "combine_haltero", 
    label: "Combiné Haltéro", 
    color: "bg-fuchsia-600",
    description: "Enchaînement de plusieurs mouvements d'haltérophilie (techniques et semi-techniques) effectués à la suite sans lâcher la barre. Permet de travailler la fluidité et les transitions entre les positions.",
    characteristics: {
      effortPercu: 5,
      hypertrophie: 2,
      forcePuissance: 5,
      enduranceMusculaire: 3,
      vitesse: 4,
      stressNerveux: 5,
      stressMecanique: 4,
      experienceRequise: 4,
      methodeAccumulation: false,
      methodeIntensification: true,
    }
  },
];

export const getTrainingStyleConfig = (style: string): TrainingStyleConfig => {
  const config = TRAINING_STYLES.find(s => s.value === style);
  return config || TRAINING_STYLES[0];
};

// Simpler list for workout builder (subset of styles)
export const WORKOUT_BUILDER_STYLES = TRAINING_STYLES.filter(s => 
  ["normal", "superset", "biset", "triset", "giant_set", "drop_set", "rest_pause", "pyramid_up", "pyramid_down", "cluster", "emom", "amrap", "circuit", "five_by_five", "bulgarian", "isometric_overcoming", "isometric_yielding"].includes(s.value)
);

// Program builder styles (more focused on strength + CrossFit methods)
export const PROGRAM_BUILDER_STYLES = TRAINING_STYLES.filter(s => 
  ["normal", "superset", "biset", "triset", "giant_set", "drop_set", "rest_pause", "pyramid_up", "pyramid_down", "pyramid_full", "five_by_five", "bulgarian", "isometric_overcoming", "isometric_yielding", "amrap", "for_time", "death_by", "circuit", "tabata", "emom", "intermittent_cardio", "fartlek", "stato_dynamique", "combine_haltero", "cluster"].includes(s.value)
);
