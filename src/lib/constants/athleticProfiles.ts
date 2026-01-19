// Athletic profile configurations per sport
import { getMainSportFromType } from "./sportTypes";

export interface AthleticProfileTest {
  key: string;
  label: string;
  shortLabel: string;
  unit: string;
  testType: string; // Matches test type in database
  tableSource: "speed_tests" | "jump_tests" | "generic_tests";
  higherIsBetter: boolean;
}

export interface AthleticProfileConfig {
  sport: string;
  label: string;
  tests: [AthleticProfileTest, AthleticProfileTest];
  profileDescription: string;
  profileTypes: {
    primary: {
      label: string;
      description: string;
      recommendations: string[];
    };
    balanced: {
      label: string;
      description: string;
      recommendations: string[];
    };
    secondary: {
      label: string;
      description: string;
      recommendations: string[];
    };
    insufficientData: {
      label: string;
      description: string;
      recommendations: string[];
    };
  };
}

export const ATHLETIC_PROFILES: Record<string, AthleticProfileConfig> = {
  rugby: {
    sport: "rugby",
    label: "Rugby",
    tests: [
      {
        key: "vma",
        label: "VMA (1600m)",
        shortLabel: "VMA",
        unit: "km/h",
        testType: "1600m_run",
        tableSource: "speed_tests",
        higherIsBetter: true,
      },
      {
        key: "vmax",
        label: "Sprint 40m",
        shortLabel: "Vmax",
        unit: "km/h",
        testType: "40m_sprint",
        tableSource: "speed_tests",
        higherIsBetter: true,
      },
    ],
    profileDescription: "Capacité aérobie / Vitesse maximale",
    profileTypes: {
      primary: {
        label: "Profil Endurance",
        description: "Excellente capacité aérobie",
        recommendations: [
          "Développer la vitesse maximale",
          "Travail de puissance et explosivité",
          "Maintenir le niveau d'endurance élevé",
        ],
      },
      balanced: {
        label: "Profil Mixte",
        description: "Équilibre entre vitesse et endurance",
        recommendations: [
          "Maintenir l'équilibre actuel",
          "Travail de vitesse répétée (RSA)",
          "Continuer le développement harmonieux",
        ],
      },
      secondary: {
        label: "Profil Vitesse",
        description: "Explosif et puissant sur courtes distances",
        recommendations: [
          "Travail de vitesse maximale et accélérations",
          "Renforcement musculaire explosif",
          "Améliorer l'endurance pour équilibrer le profil",
        ],
      },
      insufficientData: {
        label: "Données insuffisantes",
        description: "Tests VMA et sprint 40m requis",
        recommendations: [
          "Effectuer un test de sprint 40m",
          "Effectuer un test de course 1600m",
        ],
      },
    },
  },
  judo: {
    sport: "judo",
    label: "Judo",
    tests: [
      {
        key: "sjft",
        label: "Special Judo Fitness Test (SJFT)",
        shortLabel: "SJFT",
        unit: "index",
        testType: "sjft",
        tableSource: "generic_tests",
        higherIsBetter: false, // Lower index = better
      },
      {
        key: "pullups",
        label: "Tractions max / Grip isométrique",
        shortLabel: "Tractions",
        unit: "reps",
        testType: "max_pullups",
        tableSource: "generic_tests",
        higherIsBetter: true,
      },
    ],
    profileDescription: "Endurance combat / Puissance de tirage",
    profileTypes: {
      primary: {
        label: "Profil Endurance Combat",
        description: "Excellente résistance à la fatigue en combat",
        recommendations: [
          "Développer la puissance de grip",
          "Travail de force explosive des bras",
          "Maintenir le haut niveau d'endurance",
        ],
      },
      balanced: {
        label: "Profil Équilibré",
        description: "Bon équilibre endurance/puissance",
        recommendations: [
          "Maintenir l'équilibre actuel",
          "Travail en randori longue durée",
          "Continuer le renforcement du grip",
        ],
      },
      secondary: {
        label: "Profil Puissance Tirage",
        description: "Excellente force de préhension et tirage",
        recommendations: [
          "Améliorer l'endurance en combat",
          "Travail de résistance lactique",
          "Randori à haute intensité prolongé",
        ],
      },
      insufficientData: {
        label: "Données insuffisantes",
        description: "Tests SJFT et tractions requis",
        recommendations: [
          "Effectuer le Special Judo Fitness Test",
          "Effectuer un test de tractions max",
        ],
      },
    },
  },
  handball: {
    sport: "handball",
    label: "Handball",
    tests: [
      {
        key: "sprint30",
        label: "Sprint 30m",
        shortLabel: "Sprint 30m",
        unit: "s",
        testType: "sprint_30m",
        tableSource: "generic_tests",
        higherIsBetter: false,
      },
      {
        key: "cmj",
        label: "Counter Movement Jump",
        shortLabel: "CMJ",
        unit: "cm",
        testType: "cmj",
        tableSource: "jump_tests",
        higherIsBetter: true,
      },
    ],
    profileDescription: "Vitesse linéaire / Puissance verticale",
    profileTypes: {
      primary: {
        label: "Profil Vitesse",
        description: "Excellent sprinter sur courtes distances",
        recommendations: [
          "Développer la puissance verticale",
          "Travail pliométrique",
          "Maintenir la vitesse maximale",
        ],
      },
      balanced: {
        label: "Profil Athlétique Complet",
        description: "Bon équilibre vitesse/détente",
        recommendations: [
          "Maintenir l'équilibre actuel",
          "Travail de coordination athlétique",
          "Développement harmonieux",
        ],
      },
      secondary: {
        label: "Profil Explosif Vertical",
        description: "Excellente détente verticale",
        recommendations: [
          "Améliorer la vitesse de démarrage",
          "Travail de sprints répétés",
          "Renforcement des appuis",
        ],
      },
      insufficientData: {
        label: "Données insuffisantes",
        description: "Tests sprint 30m et CMJ requis",
        recommendations: [
          "Effectuer un test de sprint 30m",
          "Effectuer un test de détente verticale (CMJ)",
        ],
      },
    },
  },
  football: {
    sport: "football",
    label: "Football",
    tests: [
      {
        key: "30_15ift",
        label: "30-15 Intermittent Fitness Test",
        shortLabel: "30-15 IFT",
        unit: "km/h",
        testType: "30_15_ift",
        tableSource: "generic_tests",
        higherIsBetter: true,
      },
      {
        key: "sprint30",
        label: "Sprint 30m",
        shortLabel: "Sprint 30m",
        unit: "s",
        testType: "sprint_30m",
        tableSource: "generic_tests",
        higherIsBetter: false,
      },
    ],
    profileDescription: "Capacité haute intensité répétée / Vitesse max",
    profileTypes: {
      primary: {
        label: "Profil Intermittent",
        description: "Excellente capacité à répéter les efforts intenses",
        recommendations: [
          "Développer la vitesse maximale",
          "Travail d'accélération",
          "Maintenir l'endurance haute intensité",
        ],
      },
      balanced: {
        label: "Profil Athlétique Complet",
        description: "Bon équilibre endurance/vitesse",
        recommendations: [
          "Maintenir l'équilibre actuel",
          "Travail de vitesse répétée",
          "Développement harmonieux",
        ],
      },
      secondary: {
        label: "Profil Vitesse",
        description: "Excellente vitesse de pointe",
        recommendations: [
          "Améliorer la capacité à répéter",
          "Travail intermittent haute intensité",
          "Développer l'endurance aérobie",
        ],
      },
      insufficientData: {
        label: "Données insuffisantes",
        description: "Tests 30-15 IFT et sprint 30m requis",
        recommendations: [
          "Effectuer le test 30-15 IFT",
          "Effectuer un test de sprint 30m",
        ],
      },
    },
  },
  aviron: {
    sport: "aviron",
    label: "Aviron",
    tests: [
      {
        key: "ergo2000",
        label: "2000m Ergomètre",
        shortLabel: "2000m Ergo",
        unit: "min",
        testType: "2000m_ergo",
        tableSource: "generic_tests",
        higherIsBetter: false,
      },
      {
        key: "peakpower",
        label: "Peak Power 10s",
        shortLabel: "Peak Power",
        unit: "W",
        testType: "peak_power_10s",
        tableSource: "generic_tests",
        higherIsBetter: true,
      },
    ],
    profileDescription: "Endurance spécifique / Puissance maximale",
    profileTypes: {
      primary: {
        label: "Profil Endurant",
        description: "Excellente endurance spécifique aviron",
        recommendations: [
          "Développer la puissance de départ",
          "Travail de puissance maximale",
          "Maintenir le niveau d'endurance",
        ],
      },
      balanced: {
        label: "Profil Complet",
        description: "Bon équilibre endurance/puissance",
        recommendations: [
          "Maintenir l'équilibre actuel",
          "Travail technique sur l'eau",
          "Développement harmonieux",
        ],
      },
      secondary: {
        label: "Profil Puissant",
        description: "Excellente puissance maximale",
        recommendations: [
          "Améliorer l'endurance spécifique",
          "Travail de seuils lactiques",
          "Sorties longues régulières",
        ],
      },
      insufficientData: {
        label: "Données insuffisantes",
        description: "Tests 2000m ergo et Peak Power requis",
        recommendations: [
          "Effectuer un test 2000m ergomètre",
          "Effectuer un test de puissance 10s",
        ],
      },
    },
  },
  volleyball: {
    sport: "volleyball",
    label: "Volleyball",
    tests: [
      {
        key: "cmj",
        label: "Counter Movement Jump",
        shortLabel: "CMJ",
        unit: "cm",
        testType: "cmj",
        tableSource: "jump_tests",
        higherIsBetter: true,
      },
      {
        key: "dropjump",
        label: "Drop Jump (RSI)",
        shortLabel: "Drop Jump",
        unit: "RSI",
        testType: "drop_jump",
        tableSource: "jump_tests",
        higherIsBetter: true,
      },
    ],
    profileDescription: "Force explosive / Élasticité",
    profileTypes: {
      primary: {
        label: "Profil Force Explosive",
        description: "Excellente force explosive verticale",
        recommendations: [
          "Développer la réactivité musculaire",
          "Travail pliométrique intensif",
          "Maintenir la puissance maximale",
        ],
      },
      balanced: {
        label: "Profil Athlétique Complet",
        description: "Bon équilibre force/élasticité",
        recommendations: [
          "Maintenir l'équilibre actuel",
          "Travail de coordination sauts",
          "Développement harmonieux",
        ],
      },
      secondary: {
        label: "Profil Élastique",
        description: "Excellente réactivité et élasticité",
        recommendations: [
          "Développer la force maximale",
          "Travail de renforcement musculaire",
          "Musculation des membres inférieurs",
        ],
      },
      insufficientData: {
        label: "Données insuffisantes",
        description: "Tests CMJ et Drop Jump requis",
        recommendations: [
          "Effectuer un test de CMJ",
          "Effectuer un test de Drop Jump (RSI)",
        ],
      },
    },
  },
  bowling: {
    sport: "bowling",
    label: "Bowling",
    tests: [
      {
        key: "ybalance",
        label: "Y-Balance Test",
        shortLabel: "Y-Balance",
        unit: "cm",
        testType: "y_balance",
        tableSource: "generic_tests",
        higherIsBetter: true,
      },
      {
        key: "fatiguePrecision",
        label: "Précision sous fatigue",
        shortLabel: "Précision",
        unit: "%",
        testType: "fatigue_precision",
        tableSource: "generic_tests",
        higherIsBetter: true,
      },
    ],
    profileDescription: "Stabilité / Résistance fatigue technique",
    profileTypes: {
      primary: {
        label: "Profil Stabilité",
        description: "Excellent équilibre et contrôle postural",
        recommendations: [
          "Améliorer la résistance à la fatigue",
          "Travail de répétition haute intensité",
          "Maintenir la stabilité posturale",
        ],
      },
      balanced: {
        label: "Profil Équilibré",
        description: "Bonne stabilité et résistance",
        recommendations: [
          "Maintenir l'équilibre actuel",
          "Travail technique régulier",
          "Développement harmonieux",
        ],
      },
      secondary: {
        label: "Profil Endurant Technique",
        description: "Excellente résistance à la fatigue technique",
        recommendations: [
          "Améliorer l'équilibre statique",
          "Travail proprioceptif",
          "Renforcement du gainage",
        ],
      },
      insufficientData: {
        label: "Données insuffisantes",
        description: "Tests Y-Balance et précision requis",
        recommendations: [
          "Effectuer le Y-Balance Test",
          "Effectuer un test de précision sous fatigue",
        ],
      },
    },
  },
  basketball: {
    sport: "basketball",
    label: "Basketball",
    tests: [
      {
        key: "sprint20",
        label: "Sprint 20m",
        shortLabel: "Sprint 20m",
        unit: "s",
        testType: "sprint_20m",
        tableSource: "generic_tests",
        higherIsBetter: false,
      },
      {
        key: "cmj",
        label: "Counter Movement Jump",
        shortLabel: "CMJ",
        unit: "cm",
        testType: "cmj",
        tableSource: "jump_tests",
        higherIsBetter: true,
      },
    ],
    profileDescription: "Vitesse / Explosivité verticale",
    profileTypes: {
      primary: {
        label: "Profil Vitesse",
        description: "Excellent sprinter sur courtes distances",
        recommendations: [
          "Développer la détente verticale",
          "Travail pliométrique",
          "Maintenir la vitesse de démarrage",
        ],
      },
      balanced: {
        label: "Profil Athlétique Complet",
        description: "Bon équilibre vitesse/détente",
        recommendations: [
          "Maintenir l'équilibre actuel",
          "Travail de coordination",
          "Développement harmonieux",
        ],
      },
      secondary: {
        label: "Profil Explosif Vertical",
        description: "Excellente détente verticale",
        recommendations: [
          "Améliorer la vitesse de course",
          "Travail de sprints courts",
          "Renforcement des appuis latéraux",
        ],
      },
      insufficientData: {
        label: "Données insuffisantes",
        description: "Tests sprint 20m et CMJ requis",
        recommendations: [
          "Effectuer un test de sprint 20m",
          "Effectuer un test de détente (CMJ)",
        ],
      },
    },
  },
};

export function getAthleticProfileConfig(sportType: string): AthleticProfileConfig {
  const mainSport = getMainSportFromType(sportType);
  return ATHLETIC_PROFILES[mainSport] || ATHLETIC_PROFILES.rugby;
}
