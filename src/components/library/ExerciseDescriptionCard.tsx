import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { 
  Target, 
  User, 
  PlayCircle, 
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Info,
  Footprints,
  Hand,
  Move,
  Activity,
  Wind,
  AlertTriangle,
  CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface PositioningCriteria {
  body_placement?: string;
  feet_position?: string;
  hands_grip?: string;
  joint_alignment?: string;
  initial_posture?: string;
}

export interface ExecutionCriteria {
  movement_flow?: string;
  range_of_motion?: string;
  speed_control?: string;
  breathing?: string;
  key_points?: string[];
}

export interface SafetyPrevention {
  common_errors?: string[];
  risk_zones?: string[];
  safety_instructions?: string;
}

export interface ExerciseDescriptionData {
  general_description?: string | null;
  positioning_criteria?: PositioningCriteria | null;
  execution_criteria?: ExecutionCriteria | null;
  safety_prevention?: SafetyPrevention | null;
}

interface ExerciseDescriptionCardProps {
  exerciseName: string;
  data: ExerciseDescriptionData;
  variant?: "full" | "compact" | "inline";
  defaultOpen?: boolean;
  className?: string;
}

const SectionHeader = ({ 
  icon: Icon, 
  title, 
  color 
}: { 
  icon: React.ElementType; 
  title: string; 
  color: string;
}) => (
  <div className={cn("flex items-center gap-2 font-semibold text-sm mb-2", color)}>
    <Icon className="h-4 w-4" />
    <span>{title}</span>
  </div>
);

const CriteriaItem = ({ 
  icon: Icon, 
  label, 
  value 
}: { 
  icon: React.ElementType; 
  label: string; 
  value?: string;
}) => {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 text-sm py-1">
      <Icon className="h-3.5 w-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />
      <div>
        <span className="font-medium text-foreground">{label}:</span>{" "}
        <span className="text-muted-foreground">{value}</span>
      </div>
    </div>
  );
};

export const ExerciseDescriptionCard = ({
  exerciseName,
  data,
  variant = "full",
  defaultOpen = false,
  className,
}: ExerciseDescriptionCardProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  const hasDescription = data.general_description;
  const hasPositioning = data.positioning_criteria && Object.values(data.positioning_criteria).some(v => v);
  const hasExecution = data.execution_criteria && (
    data.execution_criteria.movement_flow ||
    data.execution_criteria.range_of_motion ||
    data.execution_criteria.speed_control ||
    data.execution_criteria.breathing ||
    (data.execution_criteria.key_points && data.execution_criteria.key_points.length > 0)
  );
  const hasSafety = data.safety_prevention && (
    (data.safety_prevention.common_errors && data.safety_prevention.common_errors.length > 0) ||
    (data.safety_prevention.risk_zones && data.safety_prevention.risk_zones.length > 0) ||
    data.safety_prevention.safety_instructions
  );
  
  const hasAnyContent = hasDescription || hasPositioning || hasExecution || hasSafety;
  
  if (!hasAnyContent) {
    return variant === "inline" ? null : (
      <div className={cn("text-sm text-muted-foreground italic p-2", className)}>
        Aucune description disponible pour cet exercice.
      </div>
    );
  }

  // Inline variant - just show a tooltip trigger
  if (variant === "inline") {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button className={cn(
            "flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors",
            className
          )}>
            <Info className="h-3.5 w-3.5" />
            <span>Voir les consignes</span>
            {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <ExerciseDescriptionContent data={data} compact />
        </CollapsibleContent>
      </Collapsible>
    );
  }

  // Compact variant - collapsible card
  if (variant === "compact") {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Info className="h-4 w-4 text-primary" />
              <span>Consignes d'exécution</span>
            </div>
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <ExerciseDescriptionContent data={data} compact />
        </CollapsibleContent>
      </Collapsible>
    );
  }

  // Full variant - complete card display
  return (
    <Card className={cn("border-border", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Fiche technique : {exerciseName}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ExerciseDescriptionContent data={data} />
      </CardContent>
    </Card>
  );
};

const ExerciseDescriptionContent = ({ 
  data, 
  compact = false 
}: { 
  data: ExerciseDescriptionData; 
  compact?: boolean;
}) => {
  const positioning = data.positioning_criteria || {};
  const execution = data.execution_criteria || {};
  const safety = data.safety_prevention || {};

  return (
    <div className={cn("space-y-4", compact && "text-sm")}>
      {/* 1. Description générale */}
      {data.general_description && (
        <div className="space-y-1">
          <SectionHeader 
            icon={Target} 
            title="Description générale" 
            color="text-primary" 
          />
          <p className="text-muted-foreground pl-6">{data.general_description}</p>
        </div>
      )}

      {/* 2. Critères de positionnement */}
      {(positioning.body_placement || positioning.feet_position || 
        positioning.hands_grip || positioning.joint_alignment || 
        positioning.initial_posture) && (
        <div className="space-y-1">
          <SectionHeader 
            icon={User} 
            title="Critères de positionnement" 
            color="text-blue-600 dark:text-blue-400" 
          />
          <div className="pl-6 space-y-0.5">
            <CriteriaItem icon={Move} label="Placement du corps" value={positioning.body_placement} />
            <CriteriaItem icon={Footprints} label="Position des pieds" value={positioning.feet_position} />
            <CriteriaItem icon={Hand} label="Position des mains / prise" value={positioning.hands_grip} />
            <CriteriaItem icon={Activity} label="Alignement articulaire" value={positioning.joint_alignment} />
            <CriteriaItem icon={CheckCircle2} label="Posture et gainage initial" value={positioning.initial_posture} />
          </div>
        </div>
      )}

      {/* 3. Critères de réalisation */}
      {(execution.movement_flow || execution.range_of_motion || 
        execution.speed_control || execution.breathing || 
        (execution.key_points && execution.key_points.length > 0)) && (
        <div className="space-y-1">
          <SectionHeader 
            icon={PlayCircle} 
            title="Critères de réalisation" 
            color="text-emerald-600 dark:text-emerald-400" 
          />
          <div className="pl-6 space-y-0.5">
            <CriteriaItem icon={Move} label="Déroulement du mouvement" value={execution.movement_flow} />
            <CriteriaItem icon={Activity} label="Amplitude" value={execution.range_of_motion} />
            <CriteriaItem icon={PlayCircle} label="Vitesse / contrôle" value={execution.speed_control} />
            <CriteriaItem icon={Wind} label="Respiration" value={execution.breathing} />
            {execution.key_points && execution.key_points.length > 0 && (
              <div className="pt-1">
                <span className="font-medium text-foreground text-sm">Points techniques clés:</span>
                <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-0.5">
                  {execution.key_points.map((point, idx) => (
                    <li key={idx} className="text-sm">{point}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. Sécurité / prévention */}
      {((safety.common_errors && safety.common_errors.length > 0) || 
        (safety.risk_zones && safety.risk_zones.length > 0) || 
        safety.safety_instructions) && (
        <div className="space-y-1">
          <SectionHeader 
            icon={ShieldAlert} 
            title="Sécurité / prévention" 
            color="text-amber-600 dark:text-amber-400" 
          />
          <div className="pl-6 space-y-2">
            {safety.common_errors && safety.common_errors.length > 0 && (
              <div>
                <span className="font-medium text-foreground text-sm flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                  Erreurs fréquentes à éviter:
                </span>
                <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-0.5">
                  {safety.common_errors.map((error, idx) => (
                    <li key={idx} className="text-sm">{error}</li>
                  ))}
                </ul>
              </div>
            )}
            {safety.risk_zones && safety.risk_zones.length > 0 && (
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="font-medium text-foreground text-sm">Zones à risque:</span>
                {safety.risk_zones.map((zone, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs border-amber-500 text-amber-600">
                    {zone}
                  </Badge>
                ))}
              </div>
            )}
            {safety.safety_instructions && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md p-2 text-sm">
                <span className="font-medium text-amber-800 dark:text-amber-300">⚠️ Consignes importantes:</span>
                <p className="text-amber-700 dark:text-amber-400 mt-1">{safety.safety_instructions}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExerciseDescriptionCard;
