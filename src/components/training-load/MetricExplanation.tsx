import { MetricType } from "@/lib/trainingLoadCalculations";
import { Info, TrendingUp, Activity, Satellite } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricExplanationProps {
  metric: MetricType;
  className?: string;
}

// Detailed explanations for each metric type
const METRIC_EXPLANATIONS: Record<MetricType, {
  title: string;
  description: string;
  howItWorks: string;
  interpretation: string;
  icon: "ewma" | "awcr" | "gps";
}> = {
  ewma_srpe: {
    title: "EWMA sRPE (Charge interne)",
    description: "Moyenne mobile pondérée exponentiellement de la charge subjective (RPE × Durée).",
    howItWorks: "L'EWMA accorde plus de poids aux séances récentes qu'aux anciennes. La charge aiguë (7j) est comparée à la charge chronique (28j) pour calculer un ratio.",
    interpretation: "Ratio optimal entre 0.85 et 1.30. Au-delà de 1.50 = risque de blessure accru. En dessous de 0.80 = désentraînement possible.",
    icon: "ewma",
  },
  ewma_hsr: {
    title: "EWMA HSR (High Speed Running)",
    description: "Distance parcourue à haute vitesse (>19.8 km/h) mesurée par GPS.",
    howItWorks: "Analyse la charge mécanique liée aux courses à haute intensité. Utilise le même calcul EWMA que pour le sRPE mais sur les données GPS.",
    interpretation: "Indicateur clé de la charge neuromusculaire. Une augmentation rapide du HSR peut prédire un risque de blessure musculaire.",
    icon: "gps",
  },
  ewma_acc_dec: {
    title: "EWMA Accélérations/Décélérations",
    description: "Somme des efforts d'accélération et décélération haute intensité.",
    howItWorks: "Comptabilise les changements de vitesse brusques (>3 m/s²) captés par le GPS. Représente la charge mécanique sur les articulations.",
    interpretation: "Important pour le suivi des sports avec beaucoup de changements de direction. Corrélé au risque de blessures ligamentaires.",
    icon: "gps",
  },
  ewma_player_load: {
    title: "EWMA Player Load",
    description: "Métrique GPS propriétaire mesurant la charge externe totale (Catapult/STATSports).",
    howItWorks: "Combine accélérations 3D pour quantifier la charge mécanique totale. Plus sensible que la distance seule aux mouvements non-locomoteurs.",
    interpretation: "Métrique globale de charge externe. Utile pour comparer des séances de natures différentes (match, musculation, technique).",
    icon: "gps",
  },
  awcr_srpe: {
    title: "AWCR sRPE (Ratio Aiguë/Chronique classique)",
    description: "Ratio traditionnel entre la charge des 7 derniers jours et celle des 28 derniers jours.",
    howItWorks: "Calcul par moyenne simple (non pondérée). Aiguë = moyenne 7j, Chronique = moyenne 28j. Ratio = Aiguë/Chronique.",
    interpretation: "Méthode historique de Gabbett. Moins réactif que l'EWMA mais plus simple à comprendre. Mêmes zones de risque.",
    icon: "awcr",
  },
  awcr_hsr: {
    title: "AWCR HSR (High Speed Running)",
    description: "Ratio aiguë/chronique classique basé sur la distance à haute vitesse GPS.",
    howItWorks: "Moyenne simple des distances HSR sur 7 jours divisée par la moyenne sur 28 jours.",
    interpretation: "Permet de monitorer spécifiquement les efforts de sprint dans le temps. Attention aux pics après période de repos.",
    icon: "gps",
  },
  awcr_acc_dec: {
    title: "AWCR Accélérations/Décélérations",
    description: "Ratio aiguë/chronique traditionnel basé sur les accélérations GPS.",
    howItWorks: "Somme des accélérations et décélérations hautes intensité sur fenêtres de 7 et 28 jours.",
    interpretation: "Suivi de la charge mécanique dans le temps. Important pour la planification de retour de blessure.",
    icon: "gps",
  },
  awcr_player_load: {
    title: "AWCR Player Load",
    description: "Ratio aiguë/chronique classique basé sur le Player Load GPS.",
    howItWorks: "Moyenne des valeurs Player Load sur 7 jours comparée à la moyenne sur 28 jours.",
    interpretation: "Vue globale de la charge externe avec méthode traditionnelle. Complémentaire à l'EWMA pour validation.",
    icon: "gps",
  },
};

export function MetricExplanation({ metric, className }: MetricExplanationProps) {
  const explanation = METRIC_EXPLANATIONS[metric];
  
  if (!explanation) return null;

  const IconComponent = explanation.icon === "gps" ? Satellite : 
                       explanation.icon === "ewma" ? TrendingUp : Activity;

  const bgColor = explanation.icon === "gps" 
    ? "bg-cyan-500/5 border-cyan-500/20" 
    : explanation.icon === "ewma"
    ? "bg-primary/5 border-primary/20"
    : "bg-amber-500/5 border-amber-500/20";

  const iconColor = explanation.icon === "gps" 
    ? "text-cyan-600 dark:text-cyan-400" 
    : explanation.icon === "ewma"
    ? "text-primary"
    : "text-amber-600 dark:text-amber-400";

  return (
    <div className={cn(
      "rounded-lg border p-4 space-y-3",
      bgColor,
      className
    )}>
      <div className="flex items-start gap-3">
        <div className={cn("p-2 rounded-lg bg-background/50", iconColor)}>
          <IconComponent className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            {explanation.title}
            <Info className="h-3 w-3 text-muted-foreground" />
          </h4>
          <p className="text-sm text-muted-foreground mt-1">
            {explanation.description}
          </p>
        </div>
      </div>

      <div className="grid gap-2 text-xs">
        <div className="bg-background/50 rounded-md p-2">
          <span className="font-medium text-foreground">💡 Fonctionnement : </span>
          <span className="text-muted-foreground">{explanation.howItWorks}</span>
        </div>
        <div className="bg-background/50 rounded-md p-2">
          <span className="font-medium text-foreground">📊 Interprétation : </span>
          <span className="text-muted-foreground">{explanation.interpretation}</span>
        </div>
      </div>
    </div>
  );
}
