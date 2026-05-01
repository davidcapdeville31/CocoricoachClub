import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  ChevronDown, 
  ChevronUp, 
  User, 
  PlayCircle, 
  ShieldAlert, 
  Target,
  Plus,
  X 
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { 
  PositioningCriteria, 
  ExecutionCriteria, 
  SafetyPrevention 
} from "./ExerciseDescriptionCard";

export interface ExerciseDescriptionFormData {
  general_description: string;
  positioning_criteria: PositioningCriteria;
  execution_criteria: ExecutionCriteria;
  safety_prevention: SafetyPrevention;
}

interface ExerciseDescriptionFormProps {
  data: ExerciseDescriptionFormData;
  onChange: (data: ExerciseDescriptionFormData) => void;
  className?: string;
}

const SectionHeader = ({ 
  icon: Icon, 
  title, 
  color,
  isOpen,
  onToggle 
}: { 
  icon: React.ElementType; 
  title: string; 
  color: string;
  isOpen: boolean;
  onToggle: () => void;
}) => (
  <button 
    type="button"
    onClick={onToggle}
    className={cn(
      "w-full flex items-center justify-between p-3 rounded-lg border transition-colors",
      isOpen ? "bg-muted/50 border-border" : "bg-card hover:bg-muted/30 border-border/50"
    )}
  >
    <div className={cn("flex items-center gap-2 font-semibold text-sm", color)}>
      <Icon className="h-4 w-4" />
      <span>{title}</span>
    </div>
    {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
  </button>
);

const KeyPointsEditor = ({
  points,
  onChange
}: {
  points: string[];
  onChange: (points: string[]) => void;
}) => {
  const [newPoint, setNewPoint] = useState("");

  const addPoint = () => {
    if (newPoint.trim()) {
      onChange([...points, newPoint.trim()]);
      setNewPoint("");
    }
  };

  const removePoint = (index: number) => {
    onChange(points.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs">Points techniques clés</Label>
      <div className="flex flex-wrap gap-1 min-h-[32px] p-2 border rounded-md bg-background">
        {points.length === 0 ? (
          <span className="text-muted-foreground text-xs">Aucun point clé ajouté</span>
        ) : (
          points.map((point, idx) => (
            <Badge 
              key={idx} 
              variant="secondary"
              className="cursor-pointer hover:bg-destructive/20 text-xs"
              onClick={() => removePoint(idx)}
            >
              {point} <X className="h-3 w-3 ml-1" />
            </Badge>
          ))
        )}
      </div>
      <div className="flex gap-2">
        <Input
          value={newPoint}
          onChange={(e) => setNewPoint(e.target.value)}
          placeholder="Ajouter un point clé..."
          className="text-sm"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addPoint();
            }
          }}
        />
        <Button type="button" size="sm" variant="outline" onClick={addPoint}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

const ArrayFieldEditor = ({
  label,
  items,
  onChange,
  placeholder
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
}) => {
  const [newItem, setNewItem] = useState("");

  const addItem = () => {
    if (newItem.trim()) {
      onChange([...items, newItem.trim()]);
      setNewItem("");
    }
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <div className="flex flex-wrap gap-1 min-h-[32px] p-2 border rounded-md bg-background">
        {items.length === 0 ? (
          <span className="text-muted-foreground text-xs">Aucun élément</span>
        ) : (
          items.map((item, idx) => (
            <Badge 
              key={idx} 
              variant="outline"
              className="cursor-pointer hover:bg-destructive/20 text-xs border-amber-500 text-amber-600"
              onClick={() => removeItem(idx)}
            >
              {item} <X className="h-3 w-3 ml-1" />
            </Badge>
          ))
        )}
      </div>
      <div className="flex gap-2">
        <Input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder={placeholder}
          className="text-sm"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addItem();
            }
          }}
        />
        <Button type="button" size="sm" variant="outline" onClick={addItem}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export const ExerciseDescriptionForm = ({
  data,
  onChange,
  className
}: ExerciseDescriptionFormProps) => {
  const [positioningOpen, setPositioningOpen] = useState(false);
  const [executionOpen, setExecutionOpen] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);

  const updatePositioning = (field: keyof PositioningCriteria, value: string) => {
    onChange({
      ...data,
      positioning_criteria: {
        ...data.positioning_criteria,
        [field]: value || undefined
      }
    });
  };

  const updateExecution = (field: keyof ExecutionCriteria, value: string | string[]) => {
    onChange({
      ...data,
      execution_criteria: {
        ...data.execution_criteria,
        [field]: value || undefined
      }
    });
  };

  const updateSafety = (field: keyof SafetyPrevention, value: string | string[]) => {
    onChange({
      ...data,
      safety_prevention: {
        ...data.safety_prevention,
        [field]: value || undefined
      }
    });
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Description générale */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-primary">
          <Target className="h-4 w-4" />
          <Label className="text-sm font-semibold">Description générale</Label>
        </div>
        <Textarea
          value={data.general_description}
          onChange={(e) => onChange({ ...data, general_description: e.target.value })}
          placeholder="Décrivez le mouvement, les objectifs et les bénéfices de l'exercice..."
          rows={3}
          className="text-sm"
        />
      </div>

      {/* Critères de positionnement */}
      <Collapsible open={positioningOpen} onOpenChange={setPositioningOpen}>
        <SectionHeader 
          icon={User} 
          title="Critères de positionnement" 
          color="text-blue-600 dark:text-blue-400"
          isOpen={positioningOpen}
          onToggle={() => setPositioningOpen(!positioningOpen)}
        />
        <CollapsibleContent className="mt-2 space-y-3 pl-2 border-l-2 border-blue-500/30 ml-2">
          <div className="space-y-2">
            <Label className="text-xs">Placement du corps</Label>
            <Input
              value={data.positioning_criteria?.body_placement || ""}
              onChange={(e) => updatePositioning('body_placement', e.target.value)}
              placeholder="Ex: Debout, pieds écartés largeur des épaules"
              className="text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Position des pieds</Label>
            <Input
              value={data.positioning_criteria?.feet_position || ""}
              onChange={(e) => updatePositioning('feet_position', e.target.value)}
              placeholder="Ex: Pieds parallèles, légèrement ouverts"
              className="text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Position des mains / prise</Label>
            <Input
              value={data.positioning_criteria?.hands_grip || ""}
              onChange={(e) => updatePositioning('hands_grip', e.target.value)}
              placeholder="Ex: Prise pronation, écartement supérieur aux épaules"
              className="text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Alignement articulaire</Label>
            <Input
              value={data.positioning_criteria?.joint_alignment || ""}
              onChange={(e) => updatePositioning('joint_alignment', e.target.value)}
              placeholder="Ex: Genoux alignés avec les orteils"
              className="text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Posture et gainage initial</Label>
            <Input
              value={data.positioning_criteria?.initial_posture || ""}
              onChange={(e) => updatePositioning('initial_posture', e.target.value)}
              placeholder="Ex: Dos droit, gainage abdominal activé"
              className="text-sm"
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Critères de réalisation */}
      <Collapsible open={executionOpen} onOpenChange={setExecutionOpen}>
        <SectionHeader 
          icon={PlayCircle} 
          title="Critères de réalisation" 
          color="text-emerald-600 dark:text-emerald-400"
          isOpen={executionOpen}
          onToggle={() => setExecutionOpen(!executionOpen)}
        />
        <CollapsibleContent className="mt-2 space-y-3 pl-2 border-l-2 border-emerald-500/30 ml-2">
          <div className="space-y-2">
            <Label className="text-xs">Déroulement du mouvement</Label>
            <Textarea
              value={data.execution_criteria?.movement_flow || ""}
              onChange={(e) => updateExecution('movement_flow', e.target.value)}
              placeholder="Décrivez les phases du mouvement..."
              rows={2}
              className="text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Amplitude</Label>
            <Input
              value={data.execution_criteria?.range_of_motion || ""}
              onChange={(e) => updateExecution('range_of_motion', e.target.value)}
              placeholder="Ex: Amplitude complète, coudes à 90°"
              className="text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Vitesse / contrôle</Label>
            <Input
              value={data.execution_criteria?.speed_control || ""}
              onChange={(e) => updateExecution('speed_control', e.target.value)}
              placeholder="Ex: Phase excentrique lente (3s), concentrique explosive"
              className="text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Respiration</Label>
            <Input
              value={data.execution_criteria?.breathing || ""}
              onChange={(e) => updateExecution('breathing', e.target.value)}
              placeholder="Ex: Inspirer à la descente, expirer à la poussée"
              className="text-sm"
            />
          </div>
          <KeyPointsEditor
            points={data.execution_criteria?.key_points || []}
            onChange={(points) => updateExecution('key_points', points)}
          />
        </CollapsibleContent>
      </Collapsible>

      {/* Sécurité / prévention */}
      <Collapsible open={safetyOpen} onOpenChange={setSafetyOpen}>
        <SectionHeader 
          icon={ShieldAlert} 
          title="Sécurité / prévention" 
          color="text-amber-600 dark:text-amber-400"
          isOpen={safetyOpen}
          onToggle={() => setSafetyOpen(!safetyOpen)}
        />
        <CollapsibleContent className="mt-2 space-y-3 pl-2 border-l-2 border-amber-500/30 ml-2">
          <ArrayFieldEditor
            label="Erreurs fréquentes à éviter"
            items={data.safety_prevention?.common_errors || []}
            onChange={(items) => updateSafety('common_errors', items)}
            placeholder="Ex: Dos rond, genoux qui rentrent..."
          />
          <ArrayFieldEditor
            label="Zones à risque"
            items={data.safety_prevention?.risk_zones || []}
            onChange={(items) => updateSafety('risk_zones', items)}
            placeholder="Ex: Lombaires, Épaules..."
          />
          <div className="space-y-2">
            <Label className="text-xs">Consignes importantes</Label>
            <Textarea
              value={data.safety_prevention?.safety_instructions || ""}
              onChange={(e) => updateSafety('safety_instructions', e.target.value)}
              placeholder="Consignes de sécurité essentielles..."
              rows={2}
              className="text-sm"
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default ExerciseDescriptionForm;
