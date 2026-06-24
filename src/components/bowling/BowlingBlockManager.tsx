import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Circle, Lock, ChevronDown, ChevronRight, Package, ArrowRightLeft, GripVertical } from "lucide-react";
import { BowlingScoreSheet, FrameData, BowlingStats } from "@/components/athlete-portal/BowlingScoreSheet";
import {
  DndContext,
  closestCorners,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";

function SortableRoundWrapper({
  id,
  children,
}: {
  id: string | number;
  children: (handleProps: {
    listeners: ReturnType<typeof useSortable>["listeners"];
    attributes: ReturnType<typeof useSortable>["attributes"];
    isDragging: boolean;
  }) => React.ReactNode;
}) {
  const { setNodeRef, transform, transition, listeners, attributes, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : "auto",
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`touch-none ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
    >
      {children({ listeners, attributes, isDragging })}
    </div>
  );
}

const blurOnWheel = (e: React.WheelEvent<HTMLInputElement>) => {
  e.currentTarget.blur();
};

// Bowling competition categories
const BOWLING_COMPETITION_CATEGORIES = [
  { value: "individuelle", label: "Individuelle" },
  { value: "doublette", label: "Doublette" },
  { value: "triplette", label: "Triplette" },
  { value: "equipe_4", label: "Équipe de 4" },
  { value: "equipe_5", label: "Équipe de 5" },
  { value: "masters", label: "Masters" },
  { value: "practice_officiel", label: "Practice officiel" },
  { value: "practice_non_officiel", label: "Practice non officiel" },
];

// Bowling phases
const BOWLING_PHASES = [
  { value: "qualification", label: "Qualifications" },
  { value: "round_robin", label: "Round Robin" },
  { value: "quart", label: "Quart de finale" },
  { value: "demi", label: "Demi-finale" },
  { value: "petite_finale", label: "Petite finale" },
  { value: "finale", label: "Finale" },
];

export { BOWLING_COMPETITION_CATEGORIES, BOWLING_PHASES };

export interface BowlingBlock {
  id: string;
  name?: string;
  roundDate: string;
  bowlingCategory: string;
  phase: string;
  opponent_name: string;
  notes: string;
  debriefing: string;
  isCollapsed: boolean;
  trackPockets: boolean;
}

export interface Round {
  id?: string;
  round_number: number;
  opponent_name: string;
  result: string;
  notes: string;
  stats: Record<string, number>;
  phase: string;
  lane?: number;
  wind_conditions?: string;
  current_conditions?: string;
  temperature_celsius?: number;
  final_time_seconds?: number;
  ranking?: number;
  gap_to_first?: string;
  bowlingCategory?: string;
  isLocked?: boolean;
  bowlingFrames?: FrameData[];
  roundDate?: string;
  blockId?: string;
  ballData?: { mode: string; ballId?: string | null; frameBalls?: (string | null)[] };
  oilPatternId?: string;
}

interface BowlingBlockManagerProps {
  playerId: string;
  categoryId: string;
  matchId: string;
  rounds: Round[];
  blocks: BowlingBlock[];
  matchDate?: string;
  onBlocksChange: (blocks: BowlingBlock[]) => void;
  onRoundsChange: (rounds: Round[]) => void;
  onScoreSave: (roundNumber: number, stats: BowlingStats, frames: FrameData[], ballData?: any) => void;
  onLock: (roundNumber: number) => void;
  onUnlock: (roundNumber: number) => void;
  compact?: boolean;
  /** When set, only the block at this index is rendered (forced open). */
  focusBlockIdx?: number | null;
  /** When set (with focusBlockIdx), only the game at this index inside the block is rendered. */
  focusGameIdx?: number | null;
}

export function BowlingBlockManager({
  playerId,
  categoryId,
  matchId,
  rounds,
  blocks,
  matchDate,
  onBlocksChange,
  onRoundsChange,
  onScoreSave,
  onLock,
  onUnlock,
  compact = false,
  focusBlockIdx = null,
  focusGameIdx = null,
}: BowlingBlockManagerProps) {
  const focusMode = focusBlockIdx !== null;
  // Track which locked rounds are expanded (default collapsed for compact view)
  const [expandedRounds, setExpandedRounds] = useState<Set<number>>(new Set());
  const lockedRoundNumbers = rounds
    .filter((round) => round.isLocked)
    .map((round) => round.round_number);
  const areAllLockedRoundsExpanded =
    lockedRoundNumbers.length > 0 && lockedRoundNumbers.every((roundNumber) => expandedRounds.has(roundNumber));

  const toggleRoundExpanded = (roundNumber: number) => {
    setExpandedRounds(prev => {
      const next = new Set(prev);
      if (next.has(roundNumber)) next.delete(roundNumber);
      else next.add(roundNumber);
      return next;
    });
  };

  const toggleAllLockedRounds = () => {
    setExpandedRounds((prev) => {
      if (areAllLockedRoundsExpanded) {
        const next = new Set(prev);
        lockedRoundNumbers.forEach((roundNumber) => next.delete(roundNumber));
        return next;
      }

      const next = new Set(prev);
      lockedRoundNumbers.forEach((roundNumber) => next.add(roundNumber));
      return next;
    });
  };
  const addBlock = () => {
    const newBlock: BowlingBlock = {
      id: `block_${Date.now()}`,
      name: "",
      roundDate: matchDate?.split("T")[0] || new Date().toISOString().split("T")[0],
      bowlingCategory: "",
      phase: "",
      opponent_name: "",
      notes: "",
      debriefing: "",
      isCollapsed: true,
      trackPockets: true,
    };
    onBlocksChange([...blocks, newBlock]);
  };

  const updateBlock = (blockId: string, updates: Partial<BowlingBlock>) => {
    onBlocksChange(blocks.map(b => b.id === blockId ? { ...b, ...updates } : b));
    // Also update all rounds in this block with shared metadata
    const block = blocks.find(b => b.id === blockId);
    if (block) {
      const updatedRounds = rounds.map(r => {
        if (r.blockId === blockId) {
          return {
            ...r,
            roundDate: updates.roundDate ?? block.roundDate,
            bowlingCategory: updates.bowlingCategory ?? block.bowlingCategory,
            phase: updates.phase ?? block.phase,
            opponent_name: updates.opponent_name ?? block.opponent_name,
          };
        }
        return r;
      });
      onRoundsChange(updatedRounds);
    }
  };

  const removeBlock = (blockId: string) => {
    onBlocksChange(blocks.filter(b => b.id !== blockId));
    onRoundsChange(rounds.filter(r => r.blockId !== blockId));
  };

  const reorderRoundsInBlock = (blockId: string, oldIndex: number, newIndex: number) => {
    if (oldIndex === newIndex) return;
    const blockRoundsSorted = rounds
      .filter((r) => r.blockId === blockId)
      .sort((a, b) => a.round_number - b.round_number);
    if (oldIndex < 0 || newIndex < 0 || oldIndex >= blockRoundsSorted.length || newIndex >= blockRoundsSorted.length) return;
    const originalNumbers = blockRoundsSorted.map((r) => r.round_number);
    const reordered = arrayMove(blockRoundsSorted, oldIndex, newIndex);
    // Reassign round_number based on the original sorted numbers (keeping the block's number set intact).
    const renumberMap = new Map<number, number>();
    reordered.forEach((round, idx) => {
      renumberMap.set(round.round_number, originalNumbers[idx]);
    });
    onRoundsChange(
      rounds.map((r) => {
        if (r.blockId !== blockId) return r;
        const newNumber = renumberMap.get(r.round_number);
        return newNumber !== undefined ? { ...r, round_number: newNumber } : r;
      }),
    );
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const toggleBlock = (blockId: string) => {
    onBlocksChange(blocks.map(b => b.id === blockId ? { ...b, isCollapsed: !b.isCollapsed } : b));
  };

  const addGameToBlock = (blockId: string) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;
    const maxRound = rounds.length > 0 ? Math.max(...rounds.map(r => r.round_number)) : 0;
    const newRound: Round = {
      round_number: maxRound + 1,
      opponent_name: block.opponent_name,
      result: "",
      notes: "",
      stats: {},
      phase: block.phase,
      bowlingCategory: block.bowlingCategory,
      roundDate: block.roundDate,
      blockId: blockId,
      isLocked: false,
      bowlingFrames: undefined,
    };
    onRoundsChange([...rounds, newRound]);
  };

  const removeGame = (roundNumber: number) => {
    onRoundsChange(rounds.filter(r => r.round_number !== roundNumber));
  };

  const moveGameToBlock = (roundNumber: number, newBlockId: string) => {
    const targetBlock = blocks.find(b => b.id === newBlockId);
    if (!targetBlock) return;
    onRoundsChange(rounds.map(r => {
      if (r.round_number === roundNumber) {
        return {
          ...r,
          blockId: newBlockId,
          roundDate: targetBlock.roundDate,
          bowlingCategory: targetBlock.bowlingCategory,
          phase: targetBlock.phase,
          opponent_name: targetBlock.opponent_name,
        };
      }
      return r;
    }));
  };

  const getBlockRounds = (blockId: string) => {
    return rounds.filter(r => r.blockId === blockId).sort((a, b) => a.round_number - b.round_number);
  };

  // Orphan rounds (no block) - for backward compatibility
  const orphanRounds = rounds.filter(r => !r.blockId);

  return (
    <div className="space-y-4 pb-6">
      {lockedRoundNumbers.length > 0 && !focusMode && (
        <div className="sticky top-0 z-10 flex justify-end bg-background/95 pb-2 backdrop-blur-sm">
          <Button type="button" variant="outline" size="sm" onClick={toggleAllLockedRounds}>
            {areAllLockedRoundsExpanded ? "Réduire toutes les parties" : "Dérouler toutes les parties"}
          </Button>
        </div>
      )}

      {/* Orphan rounds (legacy data without blocks) */}
      {orphanRounds.length > 0 && !focusMode && (
        <Card className="border-dashed border-muted-foreground/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Parties sans épreuve (anciennes données)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {orphanRounds.map(round => (
              <div key={round.round_number} className="p-2 rounded border text-sm flex items-center justify-between">
                <span>Partie #{round.round_number} — Score: {round.stats["gameScore"] || 0}</span>
                <div className="flex items-center gap-2">
                  {blocks.length > 0 && (
                    <Select onValueChange={(v) => moveGameToBlock(round.round_number, v)}>
                      <SelectTrigger className="h-7 w-32 text-xs">
                        <SelectValue placeholder="Déplacer..." />
                      </SelectTrigger>
                      <SelectContent className="z-[200]">
                        {blocks.map((b, i) => (
                          <SelectItem key={b.id} value={b.id}>Épreuve {i + 1}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {round.isLocked && <Lock className="h-3 w-3 text-muted-foreground" />}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Focus mode: missing block placeholder */}
      {focusMode && focusBlockIdx !== null && blocks[focusBlockIdx] === undefined && (
        <Card className="border-dashed border-primary/40 bg-primary/5">
          <CardContent className="py-6 flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-muted-foreground">
              Cette athlète n'a pas d'Épreuve {focusBlockIdx + 1}.
            </p>
            <Button size="sm" onClick={addBlock} className="gap-2">
              <Plus className="h-4 w-4" />
              Créer l'Épreuve {focusBlockIdx + 1}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Blocks */}
      {blocks.map((block, blockIdx) => {
        if (focusMode && blockIdx !== focusBlockIdx) return null;
        const blockRounds = getBlockRounds(block.id);
        const blockHasLockedGames = blockRounds.some(r => r.isLocked);
        const blockTotal = blockRounds.reduce((s, r) => s + (r.stats["gameScore"] || 0), 0);
        const blockAvg = blockRounds.length > 0 ? (blockTotal / blockRounds.length).toFixed(1) : "—";
        const isOpen = focusMode ? true : !block.isCollapsed;

        return (
          <Card key={block.id} className={focusMode ? "border-primary/20 shadow-none" : "border-primary/20"}>
            <Collapsible open={isOpen} onOpenChange={() => !focusMode && toggleBlock(block.id)}>
              {/* Block header — hidden in focus mode (already shown in toolbar) */}
              {!focusMode && (
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center gap-2 text-left hover:opacity-80 transition-opacity shrink-0">
                        {block.isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        <Package className="h-4 w-4 text-primary" />
                        <span className="font-semibold text-sm whitespace-nowrap">Épreuve {blockIdx + 1}</span>
                      </button>
                    </CollapsibleTrigger>
                    <Input
                      value={block.name || ""}
                      onChange={(e) => updateBlock(block.id, { name: e.target.value })}
                      placeholder="Nom de l'épreuve (optionnel)"
                      className="h-7 text-xs max-w-[220px]"
                      onClick={(e) => e.stopPropagation()}
                    />
                    {block.bowlingCategory && (
                      <Badge variant="secondary" className="text-xs">
                        {BOWLING_COMPETITION_CATEGORIES.find(c => c.value === block.bowlingCategory)?.label || block.bowlingCategory}
                      </Badge>
                    )}
                    {block.phase && (
                      <Badge variant="outline" className="text-xs">
                        {BOWLING_PHASES.find(p => p.value === block.phase)?.label || block.phase}
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-xs ml-1">
                      {blockRounds.length} partie{blockRounds.length !== 1 ? "s" : ""}
                    </Badge>
                    {blockRounds.length > 0 && (
                      <span className="text-xs text-muted-foreground ml-1">
                        Moy: <strong>{blockAvg}</strong>
                      </span>
                    )}
                  </div>
                  {!blockHasLockedGames && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeBlock(block.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              )}

              <CollapsibleContent>
                <CardContent className={focusMode ? "space-y-2 pt-3" : "space-y-4 pt-0"}>
                  {/* Block metadata — shown in full mode always, in focus mode only when block has no games yet */}
                  {(!focusMode || blockRounds.length === 0) && (
                  <div className={`grid grid-cols-2 sm:grid-cols-4 ${focusMode ? "gap-2 p-2" : "gap-3 p-3"} rounded-lg bg-muted/50 border`}>
                    <div>
                      <Label className="text-xs font-medium">Jour</Label>
                      <Input
                        type="date"
                        value={block.roundDate}
                        onChange={(e) => updateBlock(block.id, { roundDate: e.target.value })}
                        className="h-8 text-xs"
                        
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-medium">Catégorie</Label>
                      <Select
                        value={block.bowlingCategory}
                        onValueChange={(v) => updateBlock(block.id, { bowlingCategory: v })}
                        
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Sélectionner..." />
                        </SelectTrigger>
                        <SelectContent className="z-[200]">
                          {BOWLING_COMPETITION_CATEGORIES.map(cat => (
                            <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs font-medium">Phase</Label>
                      <Select
                        value={block.phase}
                        onValueChange={(v) => updateBlock(block.id, { phase: v })}
                        
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Sélectionner..." />
                        </SelectTrigger>
                        <SelectContent className="z-[200]">
                          {BOWLING_PHASES.map(p => (
                            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs font-medium">Adversaire</Label>
                      <Input
                        value={block.opponent_name}
                        onChange={(e) => updateBlock(block.id, { opponent_name: e.target.value })}
                        placeholder="Nom adversaire"
                        className="h-8 text-xs"
                        
                      />
                    </div>
                  </div>
                  )}
                  
                  {/* Pocket tracking toggle — hidden in focus mode (set once per épreuve in full view) */}
                  {!focusMode && (
                  <div className="flex items-center gap-2 p-2 rounded-lg border border-dashed border-primary/30 bg-primary/5">
                    <Checkbox
                      id={`trackPockets-${block.id}`}
                      checked={block.trackPockets !== false}
                      onCheckedChange={(checked) => updateBlock(block.id, { trackPockets: !!checked })}
                    />
                    <Label htmlFor={`trackPockets-${block.id}`} className="text-sm font-medium cursor-pointer">
                      🎯 Statistiques de poches
                    </Label>
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {block.trackPockets !== false ? "Activé" : "Désactivé"}
                    </span>
                  </div>
                  )}

                  {/* Games within block */}
                  {focusMode && focusGameIdx !== null && blockRounds[focusGameIdx] === undefined ? (
                    <div className="text-center py-6 space-y-3 border border-dashed rounded-lg bg-muted/20">
                      <p className="text-sm text-muted-foreground">
                        Pas encore de Partie {focusGameIdx + 1} pour cette athlète.
                      </p>
                      <Button size="sm" onClick={() => addGameToBlock(block.id)} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Ajouter la Partie {focusGameIdx + 1}
                      </Button>
                    </div>
                  ) : blockRounds.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-4">
                      Aucune partie dans cette épreuve. Ajoutez votre première partie ci-dessous.
                    </p>
                  ) : (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(event: DragEndEvent) => {
                        const { active, over } = event;
                        if (!over || active.id === over.id) return;
                        const ids = blockRounds.map((r) => r.round_number);
                        const oldIndex = ids.indexOf(Number(active.id));
                        const newIndex = ids.indexOf(Number(over.id));
                        reorderRoundsInBlock(block.id, oldIndex, newIndex);
                      }}
                    >
                      <SortableContext
                        items={blockRounds.map((r) => r.round_number)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-3">
                          {blockRounds.map((round, gameIdx) => {
                            if (focusMode && focusGameIdx !== null && gameIdx !== focusGameIdx) return null;
                            return (
                              <SortableRoundWrapper key={round.round_number} id={round.round_number}>
                                {({ listeners, attributes }) => (
                        <Card className={`relative ${round.isLocked ? "border-muted-foreground/30" : ""} ${focusMode ? "shadow-none" : ""}`}>
                          {round.isLocked && (
                            <div className={`absolute ${focusMode ? "top-1 right-1" : "top-2 right-2"} z-10`}>
                              <Button
                                variant="outline"
                                size="sm"
                                className={focusMode ? "h-6 text-[10px] gap-1 px-2" : "h-7 text-xs gap-1"}
                                onClick={() => onUnlock(round.round_number)}
                              >
                                <Lock className="h-3 w-3" />
                                Modifier
                              </Button>
                            </div>
                          )}
                          <CardHeader className={focusMode ? "py-1 px-2" : "pb-1 pt-3"}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1">
                                {!focusMode && (
                                  <button
                                    type="button"
                                    {...attributes}
                                    {...listeners}
                                    className="cursor-grab active:cursor-grabbing touch-none p-1 -ml-1 rounded hover:bg-muted text-muted-foreground"
                                    title="Réordonner cette partie"
                                    aria-label="Réordonner cette partie"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <GripVertical className="h-4 w-4" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="flex items-center gap-2 text-left hover:opacity-80 transition-opacity"
                                  onClick={() => round.isLocked && toggleRoundExpanded(round.round_number)}
                                >
                                  {round.isLocked && (
                                    expandedRounds.has(round.round_number)
                                      ? <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                      : <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                  )}
                                  <CardTitle className={focusMode ? "text-xs flex items-center gap-1.5" : "text-sm flex items-center gap-2"}>
                                    <Circle className="h-3 w-3 text-primary" />
                                    Partie {gameIdx + 1}
                                    {round.stats["gameScore"] > 0 && (
                                      <Badge variant="outline" className="text-[10px] font-mono px-1 py-0">
                                        {round.stats["gameScore"]}
                                      </Badge>
                                    )}
                                  </CardTitle>
                                </button>
                              </div>
                              <div className="flex items-center gap-1">
                                {/* Move to another block — hidden in focus mode */}
                                {!focusMode && blocks.length > 1 && (
                                  <Select onValueChange={(v) => moveGameToBlock(round.round_number, v)}>
                                    <SelectTrigger className="h-7 w-28 text-xs">
                                      <ArrowRightLeft className="h-3 w-3 mr-1" />
                                      <span className="text-[10px]">Déplacer</span>
                                    </SelectTrigger>
                                    <SelectContent className="z-[200]">
                                      {blocks.filter(b => b.id !== block.id).map((b, i) => {
                                        const bIdx = blocks.findIndex(bl => bl.id === b.id);
                                        return (
                                          <SelectItem key={b.id} value={b.id}>Épreuve {bIdx + 1}</SelectItem>
                                        );
                                      })}
                                    </SelectContent>
                                  </Select>
                                )}
                                {!round.isLocked && (
                                  <Button variant="ghost" size="icon" className={focusMode ? "h-6 w-6" : "h-7 w-7"} onClick={() => removeGame(round.round_number)}>
                                    <Trash2 className="h-3 w-3 text-destructive" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardHeader>
                          {(!round.isLocked || expandedRounds.has(round.round_number)) && (
                            <>
                              <CardContent className={focusMode ? "pt-0 px-2 pb-2" : "pt-0"}>
                                <BowlingScoreSheet
                                  compact={compact}
                                  trackPockets={block.trackPockets !== false}
                                  key={`bowling-${round.round_number}-${round.isLocked}`}
                                  initialFrames={round.bowlingFrames}
                                  playerId={playerId}
                                  categoryId={categoryId}
                                  readOnly={round.isLocked}
                                  onSave={(stats, frames, ballData) => {
                                    onScoreSave(round.round_number, stats, frames, ballData);
                                  }}
                                  onCancel={() => {
                                    if (!round.isLocked) removeGame(round.round_number);
                                  }}
                                />
                              </CardContent>
                            </>
                          )}
                        </Card>
                                )}
                              </SortableRoundWrapper>
                            );
                          })}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}

                  {/* Debriefing section */}
                  {!focusMode && (
                  <div className="space-y-2 p-3 rounded-lg border border-primary/10 bg-primary/5">
                    <Label className="text-xs font-medium flex items-center gap-1.5">
                      📝 Débriefing de l'épreuve {blockIdx + 1}
                    </Label>
                    <Textarea
                      value={block.debriefing || ""}
                      onChange={(e) => updateBlock(block.id, { debriefing: e.target.value })}
                      placeholder="Compte-rendu de la journée, axes de travail identifiés, observations du coach..."
                      rows={3}
                      className="text-sm"
                    />
                  </div>
                  )}

                  {/* Add game button */}
                  {!focusMode && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => addGameToBlock(block.id)}
                    className="w-full gap-2 border-dashed"
                  >
                    <Plus className="h-4 w-4" />
                    Ajouter une partie à l'épreuve {blockIdx + 1}
                  </Button>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        );
      })}

      {/* Add block button */}
      {!focusMode && (
        <Button
          size="sm"
          onClick={addBlock}
          className="w-full gap-2 bg-primary hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Ajouter une épreuve
        </Button>
      )}
    </div>
  );
}
