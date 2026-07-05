import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Link as LinkIcon, Dumbbell, Zap, Activity, Timer, Mountain, Flame, Heart, Target, Clock, Repeat, Skull, RotateCcw, Lightbulb, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { PROGRAM_BUILDER_STYLES, getTrainingStyleConfig } from "@/lib/program-builder-v2/trainingStyles";

export type ConfigMethod = "drop_set" | "rest_pause" | "pyramid_up" | "pyramid_down" | "pyramid_full" | "five_by_five" | "isometric_overcoming" | "isometric_yielding" | "amrap" | "for_time" | "death_by" | "circuit" | "tabata" | "emom" | "intermittent_cardio" | "fartlek" | "stato_dynamique" | "cluster";
export type LinkedMethod = "superset" | "biset" | "triset" | "giant_set" | "bulgarian" | "combine_haltero";
export type BlockType = "echauffement" | "musculation" | "halterophilie" | "crossfit" | "cardio" | "mobilite" | "custom";

// Methods by block type
const STRENGTH_METHODS: (LinkedMethod | ConfigMethod)[] = [
  "superset", "biset", "triset", "giant_set", "bulgarian", "combine_haltero",
  "drop_set", "rest_pause", "pyramid_up", "pyramid_down", "pyramid_full", 
  "five_by_five", "isometric_overcoming", "isometric_yielding",
  "stato_dynamique", "cluster"
];

const CROSSFIT_METHODS: ConfigMethod[] = [
  "amrap", "for_time", "death_by", "circuit", "tabata", "emom"
];

const CARDIO_METHODS: ConfigMethod[] = [
  "circuit", "tabata", "emom", "intermittent_cardio", "fartlek"
];

// All methods available for any block type - coach decides what's appropriate
const ALL_METHODS: (LinkedMethod | ConfigMethod)[] = [
  ...STRENGTH_METHODS, ...CROSSFIT_METHODS, "intermittent_cardio" as ConfigMethod, "fartlek" as ConfigMethod
];

// Get available methods - now returns all methods for all block types
const getMethodsForBlockType = (blockType: BlockType): (LinkedMethod | ConfigMethod)[] => {
  // All blocks now have access to all methods - the coach decides what's appropriate
  return ALL_METHODS;
};

interface TrainingMethodButtonsProps {
  onStartLinkedMethod: (method: LinkedMethod) => void;
  onStartConfigMethod: (method: ConfigMethod) => void;
  isBuilding: boolean;
  blockType?: BlockType; // Optional - if not provided, shows all methods
}

// Get tooltip styling based on method
export const getTooltipColors = (method: string) => {
  const colorMap: Record<string, { bg: string; border: string; header: string; text: string }> = {
    "superset": { 
      bg: "bg-blue-50 dark:bg-slate-900", 
      border: "border-blue-500", 
      header: "bg-gradient-to-r from-blue-500 to-blue-600",
      text: "text-blue-700 dark:text-blue-300"
    },
    "biset": { 
      bg: "bg-cyan-50 dark:bg-slate-900", 
      border: "border-cyan-600", 
      header: "bg-gradient-to-r from-cyan-600 to-cyan-700",
      text: "text-cyan-700 dark:text-cyan-300"
    },
    "triset": { 
      bg: "bg-purple-50 dark:bg-slate-900", 
      border: "border-purple-500", 
      header: "bg-gradient-to-r from-purple-500 to-purple-600",
      text: "text-purple-700 dark:text-purple-300"
    },
    "giant_set": { 
      bg: "bg-pink-50 dark:bg-slate-900", 
      border: "border-pink-500", 
      header: "bg-gradient-to-r from-pink-500 to-pink-600",
      text: "text-pink-700 dark:text-pink-300"
    },
    "bulgarian": { 
      bg: "bg-fuchsia-50 dark:bg-slate-900", 
      border: "border-fuchsia-500", 
      header: "bg-gradient-to-r from-fuchsia-500 to-fuchsia-600",
      text: "text-fuchsia-700 dark:text-fuchsia-300"
    },
    "drop_set": { 
      bg: "bg-red-50 dark:bg-slate-900", 
      border: "border-red-500", 
      header: "bg-gradient-to-r from-red-500 to-red-600",
      text: "text-red-700 dark:text-red-300"
    },
    "rest_pause": { 
      bg: "bg-amber-50 dark:bg-slate-900", 
      border: "border-amber-500", 
      header: "bg-gradient-to-r from-amber-500 to-amber-600",
      text: "text-amber-700 dark:text-amber-300"
    },
    "pyramid_up": { 
      bg: "bg-emerald-50 dark:bg-slate-900", 
      border: "border-emerald-500", 
      header: "bg-gradient-to-r from-emerald-500 to-emerald-600",
      text: "text-emerald-700 dark:text-emerald-300"
    },
    "pyramid_down": { 
      bg: "bg-teal-50 dark:bg-slate-900", 
      border: "border-teal-500", 
      header: "bg-gradient-to-r from-teal-500 to-teal-600",
      text: "text-teal-700 dark:text-teal-300"
    },
    "pyramid_full": { 
      bg: "bg-cyan-50 dark:bg-slate-900", 
      border: "border-cyan-500", 
      header: "bg-gradient-to-r from-cyan-500 to-cyan-600",
      text: "text-cyan-700 dark:text-cyan-300"
    },
    "five_by_five": { 
      bg: "bg-sky-50 dark:bg-slate-900", 
      border: "border-sky-500", 
      header: "bg-gradient-to-r from-sky-500 to-sky-600",
      text: "text-sky-700 dark:text-sky-300"
    },
    "isometric_overcoming": {
      bg: "bg-rose-50 dark:bg-slate-900", 
      border: "border-rose-500", 
      header: "bg-gradient-to-r from-rose-500 to-rose-600",
      text: "text-rose-700 dark:text-rose-300"
    },
    "isometric_yielding": { 
      bg: "bg-emerald-50 dark:bg-slate-900", 
      border: "border-emerald-500", 
      header: "bg-gradient-to-r from-emerald-500 to-emerald-600",
      text: "text-emerald-700 dark:text-emerald-300"
    },
    // CrossFit methods
    "amrap": { 
      bg: "bg-rose-50 dark:bg-slate-900", 
      border: "border-rose-500", 
      header: "bg-gradient-to-r from-rose-500 to-rose-600",
      text: "text-rose-700 dark:text-rose-300"
    },
    "for_time": { 
      bg: "bg-orange-50 dark:bg-slate-900", 
      border: "border-orange-500", 
      header: "bg-gradient-to-r from-orange-500 to-orange-600",
      text: "text-orange-700 dark:text-orange-300"
    },
    "death_by": { 
      bg: "bg-red-50 dark:bg-slate-900", 
      border: "border-red-600", 
      header: "bg-gradient-to-r from-red-600 to-red-700",
      text: "text-red-700 dark:text-red-300"
    },
    "circuit": { 
      bg: "bg-lime-50 dark:bg-slate-900", 
      border: "border-lime-500", 
      header: "bg-gradient-to-r from-lime-500 to-lime-600",
      text: "text-lime-700 dark:text-lime-300"
    },
    "tabata": { 
      bg: "bg-yellow-50 dark:bg-slate-900", 
      border: "border-yellow-500", 
      header: "bg-gradient-to-r from-yellow-500 to-yellow-600",
      text: "text-yellow-700 dark:text-yellow-300"
    },
    "emom": { 
      bg: "bg-indigo-50 dark:bg-slate-900", 
      border: "border-indigo-500", 
      header: "bg-gradient-to-r from-indigo-500 to-indigo-600",
      text: "text-indigo-700 dark:text-indigo-300"
    },
    // Cardio methods
    "intermittent_cardio": { 
      bg: "bg-sky-50 dark:bg-slate-900", 
      border: "border-sky-500", 
      header: "bg-gradient-to-r from-sky-500 to-sky-600",
      text: "text-sky-700 dark:text-sky-300"
    },
    "fartlek": { 
      bg: "bg-green-50 dark:bg-slate-900", 
      border: "border-green-500", 
      header: "bg-gradient-to-r from-green-500 to-green-600",
      text: "text-green-700 dark:text-green-300"
    },
    "stato_dynamique": { 
      bg: "bg-violet-50 dark:bg-slate-900", 
      border: "border-violet-500", 
      header: "bg-gradient-to-r from-violet-500 to-violet-600",
      text: "text-violet-700 dark:text-violet-300"
    },
    "combine_haltero": { 
      bg: "bg-fuchsia-50 dark:bg-slate-900", 
      border: "border-fuchsia-600", 
      header: "bg-gradient-to-r from-fuchsia-600 to-fuchsia-700",
      text: "text-fuchsia-700 dark:text-fuchsia-300"
    },
    "cluster": { 
      bg: "bg-orange-50 dark:bg-slate-900", 
      border: "border-orange-500", 
      header: "bg-gradient-to-r from-orange-500 to-orange-600",
      text: "text-orange-700 dark:text-orange-300"
    },
  };
  return colorMap[method] || { bg: "bg-gray-50 dark:bg-slate-900", border: "border-gray-500", header: "bg-gray-500", text: "text-gray-700" };
};

// Method objectives with icons, descriptions, references and coach tips
export const getMethodObjective = (method: string): { 
  label: string; 
  icon: React.ComponentType<{ className?: string }>; 
  description: string;
  references: string;
  coachTip: string;
} => {
  const objectives: Record<string, { 
    label: string; 
    icon: React.ComponentType<{ className?: string }>; 
    description: string;
    references: string;
    coachTip: string;
  }> = {
    "superset": {
      label: "Hypertrophie / Gain de temps",
      icon: Timer,
      description: "Enchaînement de deux exercices antagonistes sans repos, permettant de faire beaucoup de volume en peu de temps. Cette méthode optimise le temps de travail et favorise des adaptations hypertrophiques.",
      references: "Robbins et al., 2010 (JSCR) ; Kelleher et al., 2010 (JSCR) ; Schoenfeld, 2016",
      coachTip: "Choisis des couples agoniste/antagoniste dans le même plan de travail (sagittal/frontal/horizontal)."
    },
    "biset": {
      label: "Hypertrophie / Stress métabolique / Volume / Gain de temps",
      icon: Dumbbell,
      description: "Enchaînement de deux exercices pour le même groupe musculaire sans repos entre les séries, visant à augmenter le stress métabolique local et le temps sous tension pour favoriser l'hypertrophie. Il permet de travailler sur des angles différents au sein d'un même muscle.",
      references: "Schoenfeld, 2013 ; de Salles et al., 2009",
      coachTip: "Choisis deux exercices complémentaires du même groupe musculaire et ajuste les charges pour maintenir une bonne technique jusqu'au bout."
    },
    "triset": {
      label: "Hypertrophie / Stress métabolique / Volume / Gain de temps",
      icon: Dumbbell,
      description: "Enchaînement de trois exercices consécutifs sans repos, augmentant le stress métabolique et la fatigue locale. Cette méthode favorise l'hypertrophie par accumulation de tension et de fatigue.",
      references: "Schoenfeld, 2013 ; de Salles et al., 2009 ; Wernbom et al., 2007",
      coachTip: "Commence par l'exercice le plus énergivore/difficile pour éviter une perte de qualité technique excessive au fil de la série."
    },
    "giant_set": {
      label: "Hypertrophie / Stress métabolique / Volume / Gain de temps",
      icon: Dumbbell,
      description: "Enchaînement de quatre exercices ou plus pour un même groupe musculaire, maximisant le temps sous tension, la congestion et la tolérance à la fatigue périphérique. Adapté aux athlètes avancés.",
      references: "Schoenfeld, 2010 ; Wernbom et al., 2007 ; Kraemer & Ratamess, 2004",
      coachTip: "Utilise sur des phases courtes ou avec des athlètes expérimentés en raison de la fatigue élevée."
    },
    "bulgarian": {
      label: "Force / Puissance / Vitesse / Explosivité",
      icon: Zap,
      description: "Association d'un mouvement lourd suivi immédiatement d'un mouvement léger et explosif utilisant le même pattern moteur. L'exercice lourd induit une potentialisation post-activation (PAP/PAPE), augmentant temporairement l'activation neuromusculaire et améliorant la production de force et la vitesse sur le mouvement explosif suivant. Méthode réservée aux athlètes avancés.",
      references: "Abadjiev, 1989 ; Zatsiorsky, 1995",
      coachTip: "Peut aussi être appliquée avec des exercices différents mais biomécaniquement similaires (ex : squat → jump squat)."
    },
    "drop_set": {
      label: "Hypertrophie / Volume",
      icon: Flame,
      description: "Après l'échec musculaire, la charge est immédiatement diminuée et la série continue sans repos. Cette méthode augmente le temps sous tension et le recrutement des fibres musculaires, favorisant le stimulus hypertrophique.",
      references: "Fink et al., 2017 (JSCR) ; Schoenfeld et al., 2014",
      coachTip: "Limite à 1–3 drops par série pour éviter une fatigue excessive."
    },
    "rest_pause": {
      label: "Force & Densité",
      icon: Activity,
      description: "Intégration de courtes pauses (10–20 s) après échec au sein d'une série afin de récupérer partiellement et réaliser des répétitions supplémentaires avec une charge élevée. Permet d'augmenter le volume à haute intensité.",
      references: "Prestes et al., 2019 ; Marshall et al., 2012",
      coachTip: "Limite à 1–3 échec consécutifs par série pour éviter une fatigue excessive."
    },
    "pyramid_up": {
      label: "Force / Hypertrophie",
      icon: Mountain,
      description: "Augmentation progressive des charges avec diminution des répétitions, favorisant une activation neuromusculaire graduelle et une montée en intensité sécurisée. Adaptée au développement de la force et à l'apprentissage technique.",
      references: "Fleck & Kraemer, 2014 ; Campos et al., 2002",
      coachTip: "Ne pas aller à l'échec sur les premières séries pour préparer le système nerveux et l'exécution technique."
    },
    "pyramid_down": {
      label: "Force / Hypertrophie",
      icon: Mountain,
      description: "Début à charge élevée suivi d'une réduction progressive, maintenant un haut niveau de tension mécanique malgré la fatigue. Active le phénomène de PAP sur la redescente.",
      references: "Kraemer et al., 2002 ; Ratamess et al., 2009",
      coachTip: "Commence avec une série très lourde, lorsque le système est encore frais."
    },
    "pyramid_full": {
      label: "Force / Hypertrophie",
      icon: Mountain,
      description: "Combinaison ascendante puis descendante, sollicitant simultanément force, volume et stress métabolique dans une seule séquence. Méthode très exigeante.",
      references: "Fleck, 1999 ; Kraemer & Ratamess, 2004",
      coachTip: "Surveille le volume total pour éviter un surmenage."
    },
    "five_by_five": {
      label: "Force / Hypertrophie",
      icon: Dumbbell,
      description: "Format classique à volume modéré et intensité élevée, favorisant le développement de la force maximale et l'hypertrophie. Adapté aux pratiquants intermédiaires.",
      references: "Rhea et al., 2003 ; Kraemer & Ratamess, 2004",
      coachTip: "Garde 2–3 répétitions en réserve sur les premières séries afin de réussir l'intégralité du 5x5."
    },
    "isometric_overcoming": {
      label: "Force / Explosivité / Tendons",
      icon: Zap,
      description: "Contraction isométrique maximale contre une résistance immobile. Cette méthode améliore le recrutement des unités motrices, la force spécifique à l'angle articulaire et favorise des adaptations tendineuses (augmentation de la rigidité) améliorant la transmission de force.",
      references: "Folland et al., 2005 ; Lum & Barbosa, 2019",
      coachTip: "A placer en début de séance pour maximiser l'activation neurale."
    },
    "isometric_yielding": {
      label: "Endurance / Prophylaxie",
      icon: Heart,
      description: "Maintien d'une charge immobile, sollicitant la stabilité articulaire, la tolérance tendineuse et le contrôle neuromusculaire sous fatigue.",
      references: "Kubo et al., 2006 ; Oranchuk et al., 2019",
      coachTip: "Progresse graduellement sur la durée de maintien et la charge pour optimiser les adaptations tendineuses."
    },
    // CrossFit methods
    "amrap": {
      label: "Cardio / Endurance musculaire / Perte de poids",
      icon: Flame,
      description: "Réalisation du maximum de répétitions ou de tours dans un temps imparti. Cette méthode induit une contrainte métabolique élevée et sollicite l'ensemble des filières énergétiques (phosphagène, glycolytique et oxydative), avec une contribution relative dépendant de la durée de l'effort, de l'intensité et des exercices utilisés.",
      references: "Smith et al., 2013 ; Buckley et al., 2015",
      coachTip: "Adopter un rythme de départ soutenable et maintenir une qualité technique constante afin de limiter la dégradation du mouvement sous fatigue."
    },
    "for_time": {
      label: "Cardio / Endurance musculaire / Perte de poids",
      icon: Flame,
      description: "Réalisation d'une tâche prédéfinie le plus rapidement possible. Cette méthode sollicite les filières énergétiques anaérobies et oxydatives, améliore la gestion de l'effort, l'efficacité motrice et la capacité à maintenir une intensité élevée sous fatigue.",
      references: "Butcher et al., 2015 ; Feito et al., 2019",
      coachTip: "Définis un pacing réaliste pour éviter un départ trop rapide."
    },
    "death_by": {
      label: "Jusqu'à la mort",
      icon: Skull,
      description: "Exécution d'un nombre croissant de répétitions ou d'une charge augmentée à chaque intervalle, jusqu'à l'échec. Cette méthode sollicite intensément l'ensemble des filières énergétiques et met à l'épreuve la tolérance à la fatigue physique et mentale.",
      references: "Tibana et al., 2018 ; Hoffman et al., 2015",
      coachTip: "Favorise des mouvements simples et maîtrisés, la fatigue cognitive étant élevée."
    },
    "circuit": {
      label: "Gain de temps / Endurance / Perte de poids",
      icon: RotateCcw,
      description: "Enchaînement d'exercices variés avec repos limité, combinant travail musculaire et effort cardiovasculaire. Cette méthode améliore la condition physique générale, la capacité métabolique et la dépense énergétique.",
      references: "Gettman et al., 1978 ; Alcaraz et al., 2011 ; Paoli et al., 2012",
      coachTip: "Alterner les groupes musculaires pour limiter la fatigue locale et maintenir une intensité globale élevée."
    },
    "tabata": {
      label: "Court et Intense",
      icon: Zap,
      description: "Intervalles courts à intensité supramaximale (20s/10s) permettant de générer une forte accumulation de fatigue et un stress cardiovasculaire élevé.",
      references: "Tabata et al., 1996 ; Foster et al., 2015",
      coachTip: "Réserve aux exercices maîtrisés pour limiter les risques techniques."
    },
    "emom": {
      label: "Endurance / Technique",
      icon: Clock,
      description: "Réalisation d'un volume de travail fixe au début de chaque minute, avec le reste du temps pour récupérer. Cette méthode développe la capacité de travail, la régularité du rythme et la tolérance à la fatigue, tout en maintenant un engagement cardiovasculaire modéré.",
      references: "Feito et al., 2018 ; Tibana et al., 2019",
      coachTip: "Ajuste le volume pour conserver 15–20 secondes de récupération par minute."
    },
    // Cardio methods
    "intermittent_cardio": {
      label: "Développement cardio",
      icon: Heart,
      description: "Alternance structurée d'efforts et de récupérations, permettant de solliciter les filières aérobies et anaérobies selon les ratios travail/repos choisis. La méthode améliore la capacité cardio-respiratoire, la gestion de l'effort et la tolérance à la fatigue.",
      references: "Laursen & Jenkins, 2002 ; Buchheit & Laursen, 2013",
      coachTip: "Adapte les ratios effort/repos à l'objectif : courts et intenses pour la VMA, longs et modérés pour l'endurance fondamentale."
    },
    "fartlek": {
      label: "Endurance / Adaptabilité",
      icon: Activity,
      description: "Entraînement continu avec variations libres d'intensité, permettant de solliciter simultanément les filières énergétiques aérobie et anaérobie. Méthode ludique et adaptative, favorisant l'adaptabilité du coureur à différentes intensités et terrains.",
      references: "Billat, 2001 ; Seiler & Kjerland, 2006",
      coachTip: "Utilise le terrain naturel (côtes, descentes) pour varier les intensités de manière instinctive."
    },
    "stato_dynamique": {
      label: "Force / Explosivité / Puissance",
      icon: Zap,
      description: "Alternance entre une phase isométrique (maintien) et une phase dynamique explosive, visant à maximiser le recrutement des unités motrices et à développer la force explosive spécifique. Cette méthode combine les bénéfices des contractions statiques et dynamiques sur le contrôle moteur et la production de puissance.",
      references: "Cometti, 2003 ; Duchateau & Hainaut, 1984",
      coachTip: "La phase statique doit être réalisée à l'angle articulaire le plus défavorable mécaniquement pour maximiser le recrutement."
    },
    "combine_haltero": {
      label: "Technique Haltéro / Renforcement",
      icon: LinkIcon,
      description: "Enchaînement de mouvements d'haltérophilie complémentaires développant la fluidité technique et la coordination inter-segments.",
      references: "Everett, 2016 ; Waller et al., 2009",
      coachTip: "Ordonne les mouvements du plus complexe au plus simple pour limiter les erreurs sous fatigue."
    },
    "cluster": {
      label: "Force / Puissance",
      icon: Repeat,
      description: "Séries fragmentées avec micro-repos intra-série (15–30 s), permettant de maintenir une haute qualité technique et une production de puissance élevée sur un plus grand nombre de répétitions avec des charges lourdes. Cette méthode réduit la fatigue accumulée tout en optimisant le recrutement des unités motrices à haut seuil.",
      references: "Haff et al., 2003 ; Tufano et al., 2016 ; Hardee et al., 2012",
      coachTip: "La qualité d'exécution prime sur le reste."
    },
  };
  return objectives[method] || { 
    label: "Performance", 
    icon: Target, 
    description: "Méthode d'entraînement spécifique.",
    references: "",
    coachTip: ""
  };
};

// Simplified tooltip content component
export const MethodTooltipContent = ({ 
  style, 
  colors 
}: { 
  style: typeof PROGRAM_BUILDER_STYLES[0];
  colors: ReturnType<typeof getTooltipColors>;
}) => {
  const objective = getMethodObjective(style.value);
  const ObjectiveIcon = objective.icon;
  
  return (
    <div className={cn(
      "rounded-xl overflow-hidden border-2 shadow-xl w-[calc(100vw-24px)] sm:w-auto sm:min-w-[320px] sm:max-w-[400px]",
      colors.border,
      colors.bg
    )}>
      {/* Header with gradient */}
      <div className={cn("px-4 py-3", colors.header)}>
        <h3 className="font-bold text-white text-sm tracking-wide uppercase">
          {style.label}
        </h3>
      </div>
      
      {/* Description paragraph */}
      <div className="px-4 py-3 border-b border-border/30">
        <p className={cn("text-sm leading-relaxed", colors.text)}>
          {objective.description}
        </p>
        {/* Scientific references */}
        {objective.references && (
          <p className="mt-2 text-xs italic text-muted-foreground flex items-start gap-1.5">
            <BookOpen className="h-3 w-3 mt-0.5 flex-shrink-0" />
            <span>{objective.references}</span>
          </p>
        )}
      </div>
      
      {/* Coach tip section */}
      {objective.coachTip && (
        <div className="px-4 py-3 border-b border-border/30 bg-amber-500/5">
          <div className="flex items-start gap-2">
            <div className="p-1.5 rounded-full bg-amber-500/20 flex-shrink-0">
              <Lightbulb className="h-3.5 w-3.5 text-amber-600" />
            </div>
            <div>
              <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
                Tips du coach
              </span>
              <p className="text-sm text-amber-800 dark:text-amber-300 mt-0.5">
                {objective.coachTip}
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Objective section */}
      <div className="px-4 py-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Objectif de la méthode
        </div>
        <div className={cn(
          "flex items-center gap-3 p-3 rounded-lg",
          colors.bg,
          "border",
          colors.border
        )}>
          <div className={cn(
            "p-2 rounded-full",
            colors.header
          )}>
            <ObjectiveIcon className="h-5 w-5 text-white" />
          </div>
          <span className={cn("font-semibold text-base", colors.text)}>
            {objective.label}
          </span>
        </div>
      </div>
    </div>
  );
};

export const TrainingMethodButtons = ({ 
  onStartLinkedMethod, 
  onStartConfigMethod,
  isBuilding,
  blockType = "musculation" // Default to musculation for backward compatibility
}: TrainingMethodButtonsProps) => {
  
  const linkedMethods: LinkedMethod[] = ["superset", "biset", "triset", "giant_set", "bulgarian", "combine_haltero"];
  const configMethods: ConfigMethod[] = ["drop_set", "rest_pause", "pyramid_up", "pyramid_down", "pyramid_full", "five_by_five", "isometric_overcoming", "isometric_yielding", "amrap", "for_time", "death_by", "circuit", "tabata", "emom", "intermittent_cardio", "fartlek", "stato_dynamique", "cluster"];
  
  // Filter methods based on block type
  const availableMethods = getMethodsForBlockType(blockType);
  
  const handleMethodClick = (method: string) => {
    if (linkedMethods.includes(method as LinkedMethod)) {
      onStartLinkedMethod(method as LinkedMethod);
    } else if (configMethods.includes(method as ConfigMethod)) {
      onStartConfigMethod(method as ConfigMethod);
    }
  };

  // Get button style based on method
  const getButtonStyle = (method: string) => {
    const config = getTrainingStyleConfig(method);
    const colorMap: Record<string, string> = {
      "bg-blue-500": "border-blue-500/50 text-blue-600 hover:bg-blue-500/10",
      "bg-cyan-600": "border-cyan-600/50 text-cyan-600 hover:bg-cyan-600/10",
      "bg-purple-500": "border-purple-500/50 text-purple-600 hover:bg-purple-500/10",
      "bg-pink-500": "border-pink-500/50 text-pink-600 hover:bg-pink-500/10",
      "bg-red-500": "border-red-500/50 text-red-600 hover:bg-red-500/10",
      "bg-amber-500": "border-amber-500/50 text-amber-600 hover:bg-amber-500/10",
      "bg-emerald-500": "border-emerald-500/50 text-emerald-600 hover:bg-emerald-500/10",
      "bg-teal-500": "border-teal-500/50 text-teal-600 hover:bg-teal-500/10",
      "bg-cyan-500": "border-cyan-500/50 text-cyan-600 hover:bg-cyan-500/10",
      "bg-sky-500": "border-sky-500/50 text-sky-600 hover:bg-sky-500/10",
      "bg-violet-500": "border-violet-500/50 text-violet-600 hover:bg-violet-500/10",
      "bg-fuchsia-500": "border-fuchsia-500/50 text-fuchsia-600 hover:bg-fuchsia-500/10",
      "bg-fuchsia-600": "border-fuchsia-600/50 text-fuchsia-600 hover:bg-fuchsia-600/10",
      "bg-stone-500": "border-stone-500/50 text-stone-600 hover:bg-stone-500/10",
      "bg-slate-500": "border-slate-500/50 text-slate-600 hover:bg-slate-500/10",
      // CrossFit methods
      "bg-rose-500": "border-rose-500/50 text-rose-600 hover:bg-rose-500/10",
      "bg-orange-500": "border-orange-500/50 text-orange-600 hover:bg-orange-500/10",
      "bg-red-600": "border-red-600/50 text-red-600 hover:bg-red-600/10",
      "bg-lime-500": "border-lime-500/50 text-lime-600 hover:bg-lime-500/10",
      "bg-yellow-500": "border-yellow-500/50 text-yellow-600 hover:bg-yellow-500/10",
      "bg-indigo-500": "border-indigo-500/50 text-indigo-600 hover:bg-indigo-500/10",
      "bg-green-500": "border-green-500/50 text-green-600 hover:bg-green-500/10",
    };
    return colorMap[config.color] || "";
  };

  const getShortLabel = (label: string) => {
    const labelMap: Record<string, string> = {
      "Superset (agoniste/antagoniste)": "Superset",
      "Biset (2 ex même groupe)": "Biset",
      "Triset (3 ex même groupe)": "Triset",
      "Giant Set (4+ ex même groupe)": "Giant Set",
      "Pyramide montante": "Pyr. ↑",
      "Pyramide descendante": "Pyr. ↓",
      "Pyramide complète ↑↓": "Pyr. ↑↓",
      "Rest-Pause": "R-Pause",
      "Drop Set": "Drop Set",
      "5x5": "5x5",
      "Méthode Bulgare": "Bulgare",
      "Iso.Overcoming": "Iso. Over.",
      "Iso.Yielding": "Iso. Yield.",
      // CrossFit methods
      "AMRAP": "AMRAP",
      "For Time": "For Time",
      "Death By": "Death By",
      "Circuit": "Circuit",
      "Tabata": "Tabata",
      "EMOM": "EMOM",
      // Cardio methods
      "Intermittent Cardio": "Intermittent",
      "Fartlek": "Fartlek",
      // Strength intensification
      "Stato-Dynamique": "Stato-Dyn.",
      "Cluster Set": "Cluster",
    };
    return labelMap[label] || label;
  };

  // Filter methods to show (exclude "normal" and filter by block type)
  const methodsToShow = PROGRAM_BUILDER_STYLES.filter(s => 
    s.value !== "normal" && availableMethods.includes(s.value as LinkedMethod | ConfigMethod)
  );

  // Don't render if building or no methods to show
  if (isBuilding || methodsToShow.length === 0) return null;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-wrap gap-1 mb-2">
        {methodsToShow.map((style) => {
          const isLinkedMethod = linkedMethods.includes(style.value as LinkedMethod);
          const buttonStyle = getButtonStyle(style.value);
          const tooltipColors = getTooltipColors(style.value);
          
          return (
            <Tooltip key={style.value}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleMethodClick(style.value)}
                  className={cn("h-7 text-xs gap-1", buttonStyle)}
                >
                  {isLinkedMethod && <LinkIcon className="h-3 w-3" />}
                  {getShortLabel(style.label)}
                </Button>
              </TooltipTrigger>
              <TooltipContent 
                side="top" 
                align="center"
                className="p-0 bg-transparent border-0 shadow-none z-[1000] max-w-[calc(100vw-16px)]"
                sideOffset={8}
                collisionPadding={12}
                avoidCollisions
              >
                <MethodTooltipContent style={style} colors={tooltipColors} />
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
};
