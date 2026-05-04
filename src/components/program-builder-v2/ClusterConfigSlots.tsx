import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Check, Timer, Dumbbell, Clock, Target, Percent, Weight, Gauge, Info, Layers, Plus, Trash2, Pencil, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { SetClusterStep } from "@/lib/program-builder-v2/variableSetsTypes";
import { TimeInput, formatSecondsToTime } from "@/components/ui/time-input";
import { useMethodEditing } from "@/hooks/program-builder-v2/useMethodEditing";
import { MethodActionButtons } from "./shared/MethodActionButtons";
import { generateMethodNote } from "@/lib/program-builder-v2/athleteNoteGenerator";
import { AthleteNoteDisplay } from "./AthleteNoteDisplay";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

import {
  ClusterConfig,
  ClusterStep,
  getDefaultClusterConfig,
  formatClusterSummary,
  calculateClusterVolume,
  validateClusterConfig,
} from "@/lib/program-builder-v2/clusterTypes";

/** Per-series cluster data: each series stores its own cluster steps + intensity variables */
interface ClusterSeriesData {
  setNumber: number;
  clusterSteps: SetClusterStep[];
  percentage?: number;
  weight_kg?: number;
  rpe?: number;
  rest_seconds?: number;
}

const MAX_CLUSTERS_PER_SERIES = 3;

/** Create default cluster series from global template */
const createClusterSeriesFromTemplate = (
  setNumber: number, 
  templateSteps: ClusterStep[]
): ClusterSeriesData => ({
  setNumber,
  clusterSteps: templateSteps.slice(0, MAX_CLUSTERS_PER_SERIES).map(s => ({
    reps: s.reps,
    restAfterSeconds: s.restAfterSeconds,
  })),
});

/** Initialize all series from template */
const createAllClusterSeries = (
  count: number, 
  templateSteps: ClusterStep[]
): ClusterSeriesData[] => 
  Array.from({ length: count }, (_, i) => createClusterSeriesFromTemplate(i + 1, templateSteps));

interface ClusterConfigSlotsProps {
  onValidate: (config: ClusterConfig) => void;
  onCancel: () => void;
  initialConfig?: ClusterConfig;
  exerciseName?: string;
  blockId?: string;
}

export const ClusterConfigSlots = ({
  onValidate,
  onCancel,
  initialConfig,
  exerciseName,
  blockId,
}: ClusterConfigSlotsProps) => {
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: blockId ? `drop-${blockId}` : `cluster-drop-${Math.random()}`,
    data: { type: "training-block-placeholder", blockId },
  });
  const [config, setConfig] = useState<ClusterConfig>(
    initialConfig || getDefaultClusterConfig()
  );

  // Per-series cluster data (variable sets mode)
  const [clusterSeries, setClusterSeries] = useState<ClusterSeriesData[]>(() => {
    if (initialConfig?.variableSets) {
      // Restore from saved variable sets
      return initialConfig.variableSets.map((vs, i) => ({
        setNumber: vs.setNumber,
        clusterSteps: vs.clusterSteps?.length 
          ? vs.clusterSteps 
          : (initialConfig.clusterSteps || getDefaultClusterConfig().clusterSteps).slice(0, MAX_CLUSTERS_PER_SERIES).map(s => ({
              reps: s.reps,
              restAfterSeconds: s.restAfterSeconds,
            })),
        percentage: vs.percentage,
        weight_kg: vs.weight_kg,
        rpe: vs.rpe,
        rest_seconds: vs.rest_seconds,
      }));
    }
    return createAllClusterSeries(
      initialConfig?.sets || 4,
      initialConfig?.clusterSteps || getDefaultClusterConfig().clusterSteps
    );
  });

  const [variableSetsOpen, setVariableSetsOpen] = useState(false);

  const {
    isEditing,
    enableEditing,
    handleValidate,
    handleCancel,
  } = useMethodEditing<ClusterConfig>({
    onValidate,
    onCancel,
    initialConfig,
  });

  // --- Global cluster template management (used as default for new series) ---
  const addClusterStep = () => {
    if (config.clusterSteps.length >= MAX_CLUSTERS_PER_SERIES) return;
    setConfig(prev => {
      const newSteps = [...prev.clusterSteps];
      if (newSteps.length > 0) {
        newSteps[newSteps.length - 1] = {
          ...newSteps[newSteps.length - 1],
          restAfterSeconds: newSteps[newSteps.length - 1].restAfterSeconds ?? 20,
        };
      }
      newSteps.push({ reps: 2, restAfterSeconds: undefined });
      return { ...prev, clusterSteps: newSteps };
    });
  };

  const removeClusterStep = (index: number) => {
    if (config.clusterSteps.length <= 2) return;
    setConfig(prev => {
      const newSteps = prev.clusterSteps.filter((_, i) => i !== index);
      if (newSteps.length > 0) {
        newSteps[newSteps.length - 1] = {
          ...newSteps[newSteps.length - 1],
          restAfterSeconds: undefined,
        };
      }
      return { ...prev, clusterSteps: newSteps };
    });
  };

  const updateClusterStep = (index: number, updates: Partial<ClusterStep>) => {
    setConfig(prev => {
      const newSteps = [...prev.clusterSteps];
      newSteps[index] = { ...newSteps[index], ...updates };
      return { ...prev, clusterSteps: newSteps };
    });
  };

  // --- Sets count sync ---
  const updateSetsCount = (newCount: number) => {
    setConfig(prev => ({ ...prev, sets: newCount }));
    setClusterSeries(prev => {
      if (newCount > prev.length) {
        const toAdd = Array.from(
          { length: newCount - prev.length }, 
          (_, i) => createClusterSeriesFromTemplate(prev.length + i + 1, config.clusterSteps)
        );
        return [...prev, ...toAdd];
      }
      return prev.slice(0, newCount).map((s, i) => ({ ...s, setNumber: i + 1 }));
    });
  };

  // --- Per-series cluster editing ---
  const addClusterToSeries = (seriesIdx: number) => {
    setClusterSeries(prev => prev.map((s, i) => {
      if (i !== seriesIdx || s.clusterSteps.length >= MAX_CLUSTERS_PER_SERIES) return s;
      const newSteps = [...s.clusterSteps];
      if (newSteps.length > 0) {
        newSteps[newSteps.length - 1] = {
          ...newSteps[newSteps.length - 1],
          restAfterSeconds: newSteps[newSteps.length - 1].restAfterSeconds ?? 20,
        };
      }
      newSteps.push({ reps: 2, restAfterSeconds: undefined });
      return { ...s, clusterSteps: newSteps };
    }));
  };

  const removeClusterFromSeries = (seriesIdx: number, clusterIdx: number) => {
    setClusterSeries(prev => prev.map((s, i) => {
      if (i !== seriesIdx || s.clusterSteps.length <= 1) return s;
      const newSteps = s.clusterSteps.filter((_, ci) => ci !== clusterIdx);
      if (newSteps.length > 0) {
        newSteps[newSteps.length - 1] = { ...newSteps[newSteps.length - 1], restAfterSeconds: undefined };
      }
      return { ...s, clusterSteps: newSteps };
    }));
  };

  const updateClusterInSeries = (seriesIdx: number, clusterIdx: number, updates: Partial<SetClusterStep>) => {
    setClusterSeries(prev => prev.map((s, i) => {
      if (i !== seriesIdx) return s;
      const newSteps = [...s.clusterSteps];
      newSteps[clusterIdx] = { ...newSteps[clusterIdx], ...updates };
      return { ...s, clusterSteps: newSteps };
    }));
  };

  const updateSeriesVariable = (seriesIdx: number, key: keyof ClusterSeriesData, value: any) => {
    setClusterSeries(prev => prev.map((s, i) => 
      i === seriesIdx ? { ...s, [key]: value } : s
    ));
  };

  // Apply global template to all series
  const applyTemplateToAll = () => {
    setClusterSeries(prev => prev.map(s => ({
      ...s,
      clusterSteps: config.clusterSteps.slice(0, MAX_CLUSTERS_PER_SERIES).map(step => ({
        reps: step.reps,
        restAfterSeconds: step.restAfterSeconds,
      })),
    })));
  };

  // Build final config for validation (persist per-series data into variableSets)
  const buildFinalConfig = (): ClusterConfig => ({
    ...config,
    useVariableSets: variableSetsOpen,
    variableSets: clusterSeries.map(s => ({
      setNumber: s.setNumber,
      clusterSteps: s.clusterSteps,
      percentage: s.percentage,
      weight_kg: s.weight_kg,
      rpe: s.rpe,
      rest_seconds: s.rest_seconds,
    })),
  });

  const volume = calculateClusterVolume(config);
  const errors = validateClusterConfig(config);

  return (
    <Card ref={setDropRef} className={cn(
      "border-orange-500/30 bg-orange-500/5 transition-all",
      isOver && "ring-2 ring-orange-500 bg-orange-500/10"
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Layers className="h-5 w-5 text-orange-600" />
            Configuration Cluster Set
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Mini-séries avec repos courts pour maintenir la qualité des répétitions à haute intensité
        </p>
        
        {exerciseName ? (
          <Badge variant="outline" className="w-fit border-orange-500/50 bg-orange-500/10">
            <Dumbbell className="h-3 w-3 mr-1" />
            {exerciseName}
          </Badge>
        ) : (
          <div className={cn(
            "p-3 rounded-lg border-2 border-dashed text-center transition-all",
            isOver
              ? "border-orange-500 bg-orange-500/15"
              : "border-orange-500/30 bg-orange-500/5"
          )}>
            <Dumbbell className="h-5 w-5 mx-auto mb-1 text-orange-500/70" />
            <p className="text-sm text-muted-foreground">
              {isOver ? "Déposez l'exercice ici" : "Glissez ou cliquez sur un exercice de musculation"}
            </p>
          </div>
        )}
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Global Cluster Template */}
        <div className="space-y-3 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
          <div className="flex items-center justify-between">
            <Label className="font-semibold text-orange-700 dark:text-orange-400 flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Structure du Cluster ({config.clusterSteps.length} clusters, max {MAX_CLUSTERS_PER_SERIES})
            </Label>
            {isEditing && (
              <Button
                variant="outline"
                size="sm"
                onClick={addClusterStep}
                disabled={config.clusterSteps.length >= MAX_CLUSTERS_PER_SERIES}
                className="text-xs border-orange-500/30 hover:bg-orange-500/10"
              >
                <Plus className="h-3 w-3 mr-1" />
                Ajouter
              </Button>
            )}
          </div>
          
          <div className="space-y-2">
            {config.clusterSteps.map((step, index) => (
              <div key={index} className="flex items-center gap-2 p-2 rounded-md bg-background/50 border border-border/50">
                <Badge variant="secondary" className="text-xs shrink-0">C{index + 1}</Badge>
                
                {isEditing ? (
                  <>
                    <div className="flex items-center gap-1">
                      {step.reps === 'max' ? (
                        <Button variant="default" size="sm" onClick={() => updateClusterStep(index, { reps: 2 })} className="h-8 px-3 bg-orange-600 hover:bg-orange-700 text-xs font-bold">MAX</Button>
                      ) : (
                                  <Input type="number" min={0} placeholder="2" value={step.reps === 0 ? '0' : step.reps || ''}
                                    onChange={(e) => { const val = e.target.value; if (val === '' || val === '0') { updateClusterStep(index, { reps: val === '' ? 0 : 0 }); return; } const num = parseInt(val); if (!isNaN(num) && num >= 0) updateClusterStep(index, { reps: num }); }}
                                    onPointerDown={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onFocus={(e) => e.target.select()} onWheel={(e) => e.currentTarget.blur()}
                                    className="w-16 h-8 text-xs text-center" />
                      )}
                      <Button variant={step.reps === 'max' ? 'secondary' : 'outline'} size="sm" onClick={() => updateClusterStep(index, { reps: step.reps === 'max' ? 2 : 'max' })} className="h-8 px-2 text-xs" title="Échec musculaire">
                        {step.reps === 'max' ? '123' : 'MAX'}
                      </Button>
                      <span className="text-xs text-muted-foreground">reps</span>
                    </div>
                    
                    {index < config.clusterSteps.length - 1 && (
                      <div className="flex items-center gap-1">
                        <Timer className="h-3 w-3 text-muted-foreground shrink-0" />
                        <TimeInput value={step.restAfterSeconds ?? 20} onChange={(seconds) => updateClusterStep(index, { restAfterSeconds: seconds })} min={5} max={300} compact />
                      </div>
                    )}
                    
                    <Button variant="ghost" size="icon" onClick={() => removeClusterStep(index)} disabled={config.clusterSteps.length <= 2} className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{step.reps === 'max' ? 'MAX' : `${step.reps} reps`}</span>
                    {index < config.clusterSteps.length - 1 && step.restAfterSeconds && (
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Timer className="h-3 w-3" />{step.restAfterSeconds}s
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {/* Visual preview */}
          <div className="p-2 rounded-md bg-background/50 border border-border/50">
            <p className="text-xs text-muted-foreground mb-1">Aperçu d'une série (modèle):</p>
            <div className="flex items-center gap-1 flex-wrap text-xs">
              {config.clusterSteps.map((step, i) => (
                <div key={i} className="flex items-center gap-1">
                  <Badge variant={step.reps === 'max' ? 'default' : 'secondary'} className={cn("text-xs", step.reps === 'max' && "bg-orange-600")}>
                    {step.reps === 'max' ? 'MAX' : `${step.reps} rep${(step.reps as number) > 1 ? 's' : ''}`}
                  </Badge>
                  {i < config.clusterSteps.length - 1 && step.restAfterSeconds && (
                    <span className="text-muted-foreground flex items-center gap-0.5">
                      <Timer className="h-3 w-3" />{step.restAfterSeconds}s
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Variables d'intensité */}
        <div className="space-y-3 p-3 rounded-lg bg-muted/50 border border-border/50">
          <Label className="font-semibold flex items-center gap-2">
            <Dumbbell className="h-4 w-4" />
            Variables d'intensité
          </Label>
          
          {isEditing ? (
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1"><Percent className="h-3 w-3" /> % 1RM</Label>
                <NumericInput value={config.loadType === 'percentage' ? config.loadValue : ''} onChange={(val) => setConfig(prev => ({ ...prev, loadType: 'percentage', loadValue: parseFloat(val) || undefined }))} placeholder="85" minChars={5} maxChars={7} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1"><Weight className="h-3 w-3" /> Charge (kg)</Label>
                <NumericInput value={config.loadType === 'weight_kg' ? config.loadValue : ''} onChange={(val) => setConfig(prev => ({ ...prev, loadType: 'weight_kg', loadValue: parseFloat(val) || undefined }))} placeholder="100" minChars={5} maxChars={8} suffix="kg" className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1"><Gauge className="h-3 w-3" /> RPE cible</Label>
                <NumericInput value={config.targetRpe} onChange={(val) => setConfig(prev => ({ ...prev, targetRpe: parseFloat(val) || undefined }))} placeholder="8" minChars={4} maxChars={5} className="h-9" />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1"><Percent className="h-3 w-3" /> % 1RM</Label>
                <div className="h-9 px-3 py-2 rounded-lg border bg-muted/50 flex items-center text-sm font-medium">
                  {config.loadType === 'percentage' && config.loadValue ? `${config.loadValue}%` : '-'}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1"><Weight className="h-3 w-3" /> Charge (kg)</Label>
                <div className="h-9 px-3 py-2 rounded-lg border bg-muted/50 flex items-center text-sm font-medium">
                  {config.loadType === 'weight_kg' && config.loadValue ? `${config.loadValue} kg` : '-'}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1"><Gauge className="h-3 w-3" /> RPE cible</Label>
                <div className="h-9 px-3 py-2 rounded-lg border bg-muted/50 flex items-center text-sm font-medium">
                  {config.targetRpe ?? '-'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sets and Recovery */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Target className="h-4 w-4" /> Nombre de séries</Label>
            {isEditing ? (
              <div className="flex items-center gap-1">
                <NumericInput value={config.sets} onChange={(val) => updateSetsCount(parseInt(val) || 1)} placeholder="4" minChars={4} maxChars={5} className="h-10" />
                <div className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => updateSetsCount((config.sets || 1) + 1)}
                    className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSetsCount(Math.max(1, (config.sets || 1) - 1))}
                    className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="h-10 px-3 py-2 rounded-lg border bg-muted/50 flex items-center text-sm font-medium">{config.sets} séries</div>
            )}
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Clock className="h-4 w-4" /> Repos inter-séries</Label>
            {isEditing ? (
              <TimeInput value={config.interSetRestSeconds} onChange={(seconds) => setConfig(prev => ({ ...prev, interSetRestSeconds: seconds }))} min={30} max={600} />
            ) : (
              <div className="h-10 px-3 py-2 rounded-lg border bg-muted/50 flex items-center text-sm font-medium">{formatSecondsToTime(config.interSetRestSeconds)}</div>
            )}
          </div>
        </div>

        {/* Per-Series Variable Clusters */}
        {config.sets > 0 && (
          <Collapsible open={variableSetsOpen} onOpenChange={setVariableSetsOpen}>
            <div className="flex items-center gap-2 mb-2">
              <CollapsibleTrigger asChild>
                <Button type="button" variant="outline" size="sm" className={cn("h-7 text-xs gap-1.5 transition-colors", variableSetsOpen && "bg-primary/10 border-primary/50")}>
                  <Layers className="h-3.5 w-3.5" />
                  <span>Séries variables</span>
                  {variableSetsOpen ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
                </Button>
              </CollapsibleTrigger>
              {variableSetsOpen && isEditing && (
                <Button type="button" variant="ghost" size="sm" onClick={applyTemplateToAll} className="h-7 text-xs text-muted-foreground">
                  Appliquer le modèle à toutes
                </Button>
              )}
            </div>

            <CollapsibleContent>
              <div className="space-y-3">
                {clusterSeries.map((series, sIdx) => (
                  <div key={sIdx} className="p-3 rounded-lg border border-orange-500/20 bg-orange-500/5 space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs border-orange-500/50 bg-orange-500/10 font-semibold">
                        Série {series.setNumber}
                      </Badge>
                      {isEditing && series.clusterSteps.length < MAX_CLUSTERS_PER_SERIES && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => addClusterToSeries(sIdx)} className="h-6 text-xs text-orange-600">
                          <Plus className="h-3 w-3 mr-1" /> Cluster
                        </Button>
                      )}
                    </div>

                    {/* Cluster steps for this series */}
                    <div className="space-y-1">
                      {series.clusterSteps.map((cluster, cIdx) => (
                        <div key={cIdx} className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary" className="text-[10px] w-8 justify-center">C{cIdx + 1}</Badge>
                          
                          {isEditing ? (
                            <>
                              <div className="flex items-center gap-1">
                                {cluster.reps === 'max' ? (
                                  <Button type="button" variant="default" size="sm" onClick={() => updateClusterInSeries(sIdx, cIdx, { reps: 2 })} className="h-7 px-2 bg-orange-600 hover:bg-orange-700 text-[10px] font-bold">MAX</Button>
                                ) : (
                                  <Input type="number" min={0} value={cluster.reps === 0 ? '0' : cluster.reps || ''} onChange={(e) => { const val = e.target.value; if (val === '' || val === '0') { updateClusterInSeries(sIdx, cIdx, { reps: 0 }); return; } const n = parseInt(val); if (!isNaN(n) && n >= 0) updateClusterInSeries(sIdx, cIdx, { reps: n }); }}
                                    onPointerDown={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onFocus={(e) => e.target.select()} onWheel={(e) => e.currentTarget.blur()}
                                    className="w-14 h-7 text-xs text-center" />
                                )}
                                <Button type="button" variant={cluster.reps === 'max' ? 'secondary' : 'outline'} size="sm" onClick={() => updateClusterInSeries(sIdx, cIdx, { reps: cluster.reps === 'max' ? 2 : 'max' })} className="h-7 px-1.5 text-[9px]" title="MAX">
                                  {cluster.reps === 'max' ? '123' : 'MAX'}
                                </Button>
                                <span className="text-[10px] text-muted-foreground">reps</span>
                              </div>

                              {cIdx < series.clusterSteps.length - 1 && (
                                <div className="flex items-center gap-1">
                                  <Timer className="h-3 w-3 text-muted-foreground" />
                                  <TimeInput value={cluster.restAfterSeconds ?? 20} onChange={(s) => updateClusterInSeries(sIdx, cIdx, { restAfterSeconds: s })} min={5} max={300} compact />
                                </div>
                              )}

                              {series.clusterSteps.length > 1 && (
                                <button type="button" onClick={() => removeClusterFromSeries(sIdx, cIdx)} className="h-5 w-5 flex items-center justify-center text-destructive hover:text-destructive/80">
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                            </>
                          ) : (
                            <div className="flex items-center gap-2 text-xs">
                              <Badge variant="secondary" className="text-[10px]">
                                {cluster.reps === 'max' ? <span className="text-destructive font-bold">MAX</span> : `${cluster.reps} reps`}
                              </Badge>
                              {cIdx < series.clusterSteps.length - 1 && cluster.restAfterSeconds && (
                                <span className="text-muted-foreground flex items-center gap-0.5 text-[10px]">
                                  <Timer className="h-3 w-3" />{cluster.restAfterSeconds}s
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Per-series intensity variables */}
                    {isEditing ? (
                      <div className="flex items-center gap-2 pt-1 border-t border-border/30 flex-wrap">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground">%</span>
                          <Input type="number" value={series.percentage || ''} onChange={(e) => updateSeriesVariable(sIdx, 'percentage', parseFloat(e.target.value) || undefined)}
                            onPointerDown={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onFocus={(e) => e.target.select()} onWheel={(e) => e.currentTarget.blur()}
                            placeholder="85" className="w-14 h-7 text-xs" />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground">kg</span>
                          <Input type="number" value={series.weight_kg || ''} onChange={(e) => updateSeriesVariable(sIdx, 'weight_kg', parseFloat(e.target.value) || undefined)}
                            onPointerDown={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onFocus={(e) => e.target.select()} onWheel={(e) => e.currentTarget.blur()}
                            placeholder="100" className="w-16 h-7 text-xs" />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground">RPE</span>
                          <Input type="number" value={series.rpe || ''} onChange={(e) => updateSeriesVariable(sIdx, 'rpe', parseFloat(e.target.value) || undefined)} min={1} max={10}
                            onPointerDown={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onFocus={(e) => e.target.select()} onWheel={(e) => e.currentTarget.blur()}
                            placeholder="8" className="w-14 h-7 text-xs" />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 pt-1 border-t border-border/30 flex-wrap">
                        {series.percentage && <Badge variant="secondary" className="text-[10px]">{series.percentage}%</Badge>}
                        {series.weight_kg && <Badge variant="secondary" className="text-[10px]">{series.weight_kg}kg</Badge>}
                        {series.rpe && <Badge variant="secondary" className="text-[10px]">RPE {series.rpe}</Badge>}
                        {!series.percentage && !series.weight_kg && !series.rpe && (
                          <span className="text-[10px] text-muted-foreground italic">Variables globales</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Volume Summary */}
        <div className="p-3 rounded-lg bg-muted/30 border">
          <div className="flex items-center gap-2 mb-2">
            <Info className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Résumé</span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xl font-bold text-primary">{volume.repsPerSet === 'variable' ? '~' : volume.repsPerSet}</p>
              <p className="text-xs text-muted-foreground">reps/série</p>
            </div>
            <div>
              <p className="text-xl font-bold text-primary">{volume.totalReps === 'variable' ? '~' : volume.totalReps}</p>
              <p className="text-xs text-muted-foreground">reps totales</p>
            </div>
            {volume.estimatedTonnage && (
              <div>
                <p className="text-xl font-bold text-primary">{volume.estimatedTonnage}kg</p>
                <p className="text-xs text-muted-foreground">tonnage estimé</p>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">{formatClusterSummary(config)}</p>
        </div>

        {/* Errors */}
        {errors.length > 0 && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
            <ul className="text-sm text-destructive space-y-1">
              {errors.map((error, i) => <li key={i}>• {error}</li>)}
            </ul>
          </div>
        )}

        {/* Note auto-générée pour l'athlète — dynamique, toujours visible */}
        <AthleteNoteDisplay
          note={generateMethodNote({
            methodType: 'cluster',
            exerciseName,
            clusterConfig: {
              clusterSteps: config.clusterSteps,
              sets: config.sets,
              interSetRestSeconds: config.interSetRestSeconds,
              loadType: config.loadType,
              loadValue: config.loadValue,
              targetRpe: config.targetRpe,
            },
          })}
        />
        {/* Actions */}
        <MethodActionButtons
          isEditing={isEditing}
          onValidate={() => handleValidate(buildFinalConfig())}
          onEdit={enableEditing}
          onCancel={handleCancel}
          isValid={errors.length === 0 && !!exerciseName}
          methodColor="bg-orange-600 hover:bg-orange-700"
        />
      </CardContent>
    </Card>
  );
};
