/**
 * RestPauseCreationUI — Interface UNIQUE de saisie
 * 
 * Utilisée pour :
 * - L'insertion initiale (objet vide, aucune série affichée)
 * - La modification (objet existant pré-rempli, même UI)
 * 
 * RÈGLES :
 * - Reps = toujours "MAX" (non modifiable)
 * - Variables dynamiques (Charge, %1RM, Tempo, RPE) ajoutables/supprimables par popover
 * - L'UI doit être VISUELLEMENT IDENTIQUE entre insertion et modification
 */

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { TimeInput } from "@/components/ui/time-input";
import { Plus, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { RestPauseConfig, RestPauseSeries, RestPauseMiniSet, REST_PAUSE_VARIABLES } from "./RestPauseTypes";
import { REST_PAUSE_VARIABLES as VARIABLES } from "./RestPauseTypes";
import { generateMethodNote } from "@/lib/athleteNoteGenerator";
import { AthleteNoteDisplay } from "./AthleteNoteDisplay";

interface RestPauseCreationUIProps {
  config: RestPauseConfig;
  onChange: (config: RestPauseConfig) => void;
}

export const RestPauseCreationUI: React.FC<RestPauseCreationUIProps> = ({
  config,
  onChange,
}) => {
  // Default all variables visible on fresh creation
  const { series, visibleVariables = VARIABLES.map(v => v.key) } = config;
  const [addVarPopoverOpen, setAddVarPopoverOpen] = useState(false);

  const update = (partial: Partial<RestPauseConfig>) => {
    onChange({ ...config, ...partial });
  };

  const updateSeries = (newSeries: RestPauseSeries[]) => {
    update({ series: newSeries });
  };

  // --- Variable operations ---
  const addVariable = (varKey: string) => {
    const newVisibleVars = [...visibleVariables, varKey];
    // Rest-Pause: all reps are MAX → auto-set RPE=10, RIR=0 when adding
    if (varKey === 'rpe') {
      update({ 
        visibleVariables: newVisibleVars,
        series: series.map(s => ({ ...s, rpe: 10 })),
      });
    } else if (varKey === 'rir') {
      update({
        visibleVariables: newVisibleVars,
        series: series.map(s => ({ ...s, rir: 0 })),
      });
    } else {
      update({ visibleVariables: newVisibleVars });
    }
    setAddVarPopoverOpen(false);
  };

  const removeVariable = (varKey: string) => {
    update({
      visibleVariables: visibleVariables.filter(v => v !== varKey),
      // Clear the value from all series
      series: series.map(s => ({ ...s, [varKey]: undefined })),
    });
  };

  const hiddenVariables = VARIABLES.filter(v => !visibleVariables.includes(v.key));

  // --- Série operations ---
  const addSeries = () => {
    updateSeries([...series, { miniSets: [] }]);
  };

  const removeSeries = (sIdx: number) => {
    updateSeries(series.filter((_, i) => i !== sIdx));
  };

  const updateSeriesField = (sIdx: number, field: string, value: any) => {
    const newSeries = [...series];
    newSeries[sIdx] = { ...newSeries[sIdx], [field]: value || undefined };
    updateSeries(newSeries);
  };

  const updateRecovery = (sIdx: number, seconds: number) => {
    updateSeriesField(sIdx, 'recoverySeconds', seconds);
  };

  // --- MiniSet operations ---
  const addMiniSet = (sIdx: number) => {
    const newSeries = [...series];
    newSeries[sIdx] = {
      ...newSeries[sIdx],
      miniSets: [...newSeries[sIdx].miniSets, { reps: "MAX", pauseSeconds: 0 }],
    };
    updateSeries(newSeries);
  };

  const removeMiniSet = (sIdx: number, mIdx: number) => {
    const newSeries = [...series];
    newSeries[sIdx] = {
      ...newSeries[sIdx],
      miniSets: newSeries[sIdx].miniSets.filter((_, i) => i !== mIdx),
    };
    updateSeries(newSeries);
  };

  const updateMiniSetPause = (sIdx: number, mIdx: number, seconds: number) => {
    const newSeries = [...series];
    const newMiniSets = [...newSeries[sIdx].miniSets];
    newMiniSets[mIdx] = { ...newMiniSets[mIdx], pauseSeconds: seconds };
    newSeries[sIdx] = { ...newSeries[sIdx], miniSets: newMiniSets };
    updateSeries(newSeries);
  };

  return (
    <div className="space-y-3 p-2 bg-background rounded-md border border-amber-500/30">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-amber-600">Rest-Pause</Label>
        <div className="flex items-center gap-1">
          {/* Add variable popover */}
          {hiddenVariables.length > 0 && (
            <Popover open={addVarPopoverOpen} onOpenChange={setAddVarPopoverOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="h-5 text-[10px] border-dashed px-1.5 gap-0.5">
                  <Plus className="h-2.5 w-2.5" />
                  Variable
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-44 p-2" align="end">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground px-2 py-1">Ajouter</p>
                  {hiddenVariables.map(v => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => addVariable(v.key)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-accent text-left"
                    >
                      <span>{v.label}</span>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={addSeries} className="h-6 text-xs">
            <Plus className="h-3 w-3 mr-1" />
            Série
          </Button>
        </div>
      </div>

      {series.length === 0 && (
        <div className="text-xs text-muted-foreground text-center py-3 border border-dashed rounded-md">
          Aucune série. Cliquez sur « + Série » pour commencer.
        </div>
      )}

      {series.map((s, sIdx) => (
        <div key={sIdx} className="space-y-1.5 p-2 rounded-md border border-amber-500/20 bg-amber-500/5">
          {/* Series header */}
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-xs bg-amber-500/10 border-amber-500/30">
              Série {sIdx + 1}
            </Badge>
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="sm" onClick={() => addMiniSet(sIdx)} className="h-5 text-[10px] px-1.5">
                <Plus className="h-2.5 w-2.5 mr-0.5" />
                Mini-série
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => removeSeries(sIdx)} className="h-5 w-5 p-0 text-destructive">
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Dynamic variables for this series */}
          {visibleVariables.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {visibleVariables.map(varKey => {
                const varDef = VARIABLES.find(v => v.key === varKey);
                if (!varDef) return null;
                
                // Rest-Pause: all reps are MAX → RPE=10 and RIR=0 locked
                const isLockedByMax = varDef.key === 'rpe' || varDef.key === 'rir';
                const lockedValue = varDef.key === 'rpe' ? 10 : varDef.key === 'rir' ? 0 : null;
                const value = (s as any)[varDef.key];
                
                return (
                  <div key={varKey} className="flex items-center gap-1">
                    <Label className="text-[10px] text-muted-foreground">{varDef.label}</Label>
                    {isLockedByMax ? (
                      <div className="h-7 flex items-center justify-center rounded-md border-2 bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800 w-16 px-1.5">
                        <span className="text-xs font-bold text-red-600 dark:text-red-400">{lockedValue}</span>
                      </div>
                    ) : (
                      <Input
                        type={varDef.type}
                        value={value ?? ""}
                        onChange={(e) => updateSeriesField(
                          sIdx,
                          varDef.key,
                          varDef.type === 'number' ? (e.target.value ? Number(e.target.value) : undefined) : e.target.value
                        )}
                        className="h-7 w-16 text-xs"
                        placeholder={varDef.placeholder}
                        onPointerDown={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                      />
                    )}
                    {varDef.unit && <span className="text-[10px] text-muted-foreground">{varDef.unit}</span>}
                    <button
                      type="button"
                      onClick={() => removeVariable(varKey)}
                      className="h-3 w-3 flex items-center justify-center text-destructive hover:text-destructive/80"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Mini-sets */}
          {s.miniSets.length === 0 && (
            <div className="text-[10px] text-muted-foreground text-center py-2 border border-dashed rounded">
              Aucune mini-série. Cliquez sur « + Mini-série ».
            </div>
          )}

          {s.miniSets.map((ms, mIdx) => {
            const isLastMiniSet = mIdx === s.miniSets.length - 1;
            return (
              <div key={mIdx} className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 shrink-0">
                  MS {mIdx + 1}
                </Badge>

                {/* Reps — always MAX, not editable */}
                <Badge className="bg-red-600 hover:bg-red-600 text-white text-[10px] font-bold px-2 py-0.5">
                  MAX
                </Badge>

                {/* Pause — hidden for last mini-set (no pause after last effort) */}
                {!isLastMiniSet && (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">/</span>
                    <TimeInput
                      value={ms.pauseSeconds || 0}
                      onChange={(seconds) => updateMiniSetPause(sIdx, mIdx, seconds)}
                      compact
                    />
                    <span className="text-xs text-muted-foreground">pause</span>
                  </div>
                )}

                {/* Remove mini-set */}
                <Button type="button" variant="ghost" size="sm" onClick={() => removeMiniSet(sIdx, mIdx)} className="h-6 w-6 p-0 text-destructive shrink-0">
                  <X className="h-3 w-3" />
                </Button>
              </div>
            );
          })}

          {/* Recovery between series */}
          <div className="flex items-center gap-2 pt-1.5 border-t border-amber-500/10">
            <Label className="text-[10px] text-muted-foreground shrink-0">Récupération</Label>
            <TimeInput
              value={s.recoverySeconds || 0}
              onChange={(seconds) => updateRecovery(sIdx, seconds)}
              compact
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default RestPauseCreationUI;
