/**
 * RestPauseCreationUI — Interface UNIQUE de saisie
 *
 * Reps des mini-séries: "MAX" par défaut, modifiable (cliquer pour passer en number).
 * Variables ajoutables au niveau série ET au niveau mini-série.
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { RestPauseConfig, RestPauseSeries, RestPauseMiniSet } from "./RestPauseTypes";
import { REST_PAUSE_VARIABLES as VARIABLES } from "./RestPauseTypes";

interface RestPauseCreationUIProps {
  config: RestPauseConfig;
  onChange: (config: RestPauseConfig) => void;
}

// Variables applicables aux mini-séries (toutes sauf "reps" qui a sa propre UI)
const MINISET_VARIABLES = VARIABLES.filter(v => v.key !== 'reps');

export const RestPauseCreationUI: React.FC<RestPauseCreationUIProps> = ({
  config,
  onChange,
}) => {
  const {
    series,
    visibleVariables = VARIABLES.map(v => v.key),
    visibleMiniSetVariables = [],
  } = config;
  const [addVarPopoverOpen, setAddVarPopoverOpen] = useState(false);
  const [addMiniVarPopoverOpen, setAddMiniVarPopoverOpen] = useState(false);

  const update = (partial: Partial<RestPauseConfig>) => {
    onChange({ ...config, ...partial });
  };

  const updateSeries = (newSeries: RestPauseSeries[]) => {
    update({ series: newSeries });
  };

  // --- Series-level variables ---
  const addVariable = (varKey: string) => {
    const newVisibleVars = [...visibleVariables, varKey];
    if (varKey === 'rpe') {
      update({ visibleVariables: newVisibleVars, series: series.map(s => ({ ...s, rpe: s.rpe ?? 10 })) });
    } else if (varKey === 'rir') {
      update({ visibleVariables: newVisibleVars, series: series.map(s => ({ ...s, rir: s.rir ?? 0 })) });
    } else {
      update({ visibleVariables: newVisibleVars });
    }
    setAddVarPopoverOpen(false);
  };

  const removeVariable = (varKey: string) => {
    update({
      visibleVariables: visibleVariables.filter(v => v !== varKey),
      series: series.map(s => ({ ...s, [varKey]: undefined })),
    });
  };

  const hiddenVariables = VARIABLES.filter(v => !visibleVariables.includes(v.key));

  // --- Mini-set-level variables ---
  const addMiniSetVariable = (varKey: string) => {
    update({ visibleMiniSetVariables: [...visibleMiniSetVariables, varKey] });
    setAddMiniVarPopoverOpen(false);
  };

  const removeMiniSetVariable = (varKey: string) => {
    update({
      visibleMiniSetVariables: visibleMiniSetVariables.filter(v => v !== varKey),
      series: series.map(s => ({
        ...s,
        miniSets: s.miniSets.map(ms => ({ ...ms, [varKey]: undefined })),
      })),
    });
  };

  const hiddenMiniSetVariables = MINISET_VARIABLES.filter(v => !visibleMiniSetVariables.includes(v.key));

  // --- Série operations ---
  const addSeries = () => updateSeries([...series, { miniSets: [] }]);
  const removeSeries = (sIdx: number) => updateSeries(series.filter((_, i) => i !== sIdx));

  const updateSeriesField = (sIdx: number, field: string, value: any) => {
    const newSeries = [...series];
    newSeries[sIdx] = { ...newSeries[sIdx], [field]: value === "" || value === undefined ? undefined : value };
    updateSeries(newSeries);
  };

  const updateRecovery = (sIdx: number, seconds: number) => updateSeriesField(sIdx, 'recoverySeconds', seconds);

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

  const updateMiniSetField = (sIdx: number, mIdx: number, field: keyof RestPauseMiniSet, value: any) => {
    const newSeries = [...series];
    const newMiniSets = [...newSeries[sIdx].miniSets];
    newMiniSets[mIdx] = { ...newMiniSets[mIdx], [field]: value === "" || value === undefined ? undefined : value } as RestPauseMiniSet;
    newSeries[sIdx] = { ...newSeries[sIdx], miniSets: newMiniSets };
    updateSeries(newSeries);
  };

  const toggleMiniSetMax = (sIdx: number, mIdx: number) => {
    const cur = series[sIdx].miniSets[mIdx];
    if (cur.reps === "MAX") {
      updateMiniSetField(sIdx, mIdx, 'reps', 8);
    } else {
      updateMiniSetField(sIdx, mIdx, 'reps', "MAX");
    }
  };

  return (
    <div className="space-y-3 p-2 bg-background rounded-md border border-amber-500/30">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-amber-600">Rest-Pause</Label>
        <div className="flex items-center gap-1">
          {hiddenVariables.length > 0 && (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); }}
                  className="h-5 text-[10px] border-dashed px-1.5 gap-0.5"
                  title="Ajouter une variable série"
                >
                  <Plus className="h-2.5 w-2.5" />
                  Var. série
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-44 z-[60]" align="end">
                <DropdownMenuLabel className="text-xs">Ajouter (par série)</DropdownMenuLabel>
                {hiddenVariables.map(v => (
                  <DropdownMenuItem
                    key={v.key}
                    onSelect={(e) => {
                      e.preventDefault();
                      addVariable(v.key);
                    }}
                    className="text-xs cursor-pointer"
                  >
                    {v.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
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
              {/* Add variable to mini-sets */}
              {hiddenMiniSetVariables.length > 0 && (
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onPointerDown={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => { e.stopPropagation(); }}
                      className="h-5 text-[10px] border-dashed px-1.5 gap-0.5"
                      title="Ajouter une variable aux mini-séries"
                    >
                      <Plus className="h-2.5 w-2.5" />
                      Var. mini-série
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-48 z-[60]" align="end">
                    <DropdownMenuLabel className="text-xs">Ajouter (par mini-série)</DropdownMenuLabel>
                    {hiddenMiniSetVariables.map(v => (
                      <DropdownMenuItem
                        key={v.key}
                        onSelect={(e) => {
                          e.preventDefault();
                          addMiniSetVariable(v.key);
                        }}
                        className="text-xs cursor-pointer"
                      >
                        {v.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <Button type="button" variant="ghost" size="sm" onClick={() => addMiniSet(sIdx)} className="h-5 text-[10px] px-1.5">
                <Plus className="h-2.5 w-2.5 mr-0.5" />
                Mini-série
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => removeSeries(sIdx)} className="h-5 w-5 p-0 text-destructive">
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Series-level variables */}
          {visibleVariables.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {visibleVariables.map(varKey => {
                const varDef = VARIABLES.find(v => v.key === varKey);
                if (!varDef) return null;
                const value = (s as any)[varDef.key];
                return (
                  <div key={varKey} className="flex items-center gap-1">
                    <Label className="text-[10px] text-muted-foreground">{varDef.label}</Label>
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

          {s.miniSets.length === 0 && (
            <div className="text-[10px] text-muted-foreground text-center py-2 border border-dashed rounded">
              Aucune mini-série. Cliquez sur « + Mini-série ».
            </div>
          )}

          {s.miniSets.map((ms, mIdx) => {
            const isLastMiniSet = mIdx === s.miniSets.length - 1;
            const isMax = ms.reps === "MAX";
            return (
              <div key={mIdx} className="flex items-center gap-2 flex-wrap py-1">
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 shrink-0">
                  MS {mIdx + 1}
                </Badge>

                {/* Reps editable: button MAX toggle + number input */}
                <div className="flex items-center gap-1">
                  <Label className="text-[10px] text-muted-foreground">Reps</Label>
                  {isMax ? (
                    <Badge
                      onClick={() => toggleMiniSetMax(sIdx, mIdx)}
                      className="bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold px-2 py-0.5 cursor-pointer"
                      title="Cliquez pour saisir un nombre de reps"
                    >
                      MAX
                    </Badge>
                  ) : (
                    <>
                      <Input
                        type="number"
                        value={ms.reps ?? ""}
                        onChange={(e) => updateMiniSetField(sIdx, mIdx, 'reps', e.target.value ? Number(e.target.value) : "")}
                        className="h-7 w-14 text-xs"
                        placeholder="8"
                        onPointerDown={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                      />
                      <button
                        type="button"
                        onClick={() => toggleMiniSetMax(sIdx, mIdx)}
                        className="text-[9px] text-muted-foreground hover:text-red-600 underline"
                        title="Repasser en MAX"
                      >
                        MAX
                      </button>
                    </>
                  )}
                </div>

                {/* Mini-set variables */}
                {visibleMiniSetVariables.map(varKey => {
                  const varDef = MINISET_VARIABLES.find(v => v.key === varKey);
                  if (!varDef) return null;
                  const value = (ms as any)[varDef.key];
                  return (
                    <div key={varKey} className="flex items-center gap-1">
                      <Label className="text-[10px] text-muted-foreground">{varDef.label}</Label>
                      <Input
                        type={varDef.type}
                        value={value ?? ""}
                        onChange={(e) => updateMiniSetField(
                          sIdx,
                          mIdx,
                          varDef.key as keyof RestPauseMiniSet,
                          varDef.type === 'number' ? (e.target.value ? Number(e.target.value) : undefined) : e.target.value
                        )}
                        className="h-7 w-14 text-xs"
                        placeholder={varDef.placeholder}
                        onPointerDown={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                      />
                      {varDef.unit && <span className="text-[10px] text-muted-foreground">{varDef.unit}</span>}
                      {/* Remove only on first mini-set to avoid clutter — removes from all */}
                      {mIdx === 0 && (
                        <button
                          type="button"
                          onClick={() => removeMiniSetVariable(varKey)}
                          className="h-3 w-3 flex items-center justify-center text-destructive hover:text-destructive/80"
                          title="Retirer cette variable de toutes les mini-séries"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      )}
                    </div>
                  );
                })}

                {/* Pause */}
                {!isLastMiniSet && (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">/</span>
                    <TimeInput
                      value={ms.pauseSeconds || 0}
                      onChange={(seconds) => updateMiniSetField(sIdx, mIdx, 'pauseSeconds', seconds)}
                      compact
                    />
                    <span className="text-xs text-muted-foreground">pause</span>
                  </div>
                )}

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
