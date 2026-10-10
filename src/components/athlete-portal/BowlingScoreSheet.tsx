import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BowlingBallSelector } from "@/components/bowling/BowlingBallSelector";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Target, TrendingUp, Save, X, CheckCircle, ChevronDown } from "lucide-react";
import { getStatTextColor, getStatColor } from "@/lib/bowling/statColors";
import { MobileBowlingFrames } from "@/components/bowling/MobileBowlingFrames";
import { changeThrow, emptyFrames, scoreFrames, isGameComplete } from "@/lib/bowling/scoreRules";
import { calculateBowlingStats } from "@/lib/bowling/scoreStats";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

export interface ThrowData {
  value: string; // "X", "/", "0"-"9", "-" (miss)
  pins: number;
  isPocket: boolean;
  isSplit: boolean;
  isSinglePin: boolean;
  isSinglePinConverted: boolean;
  /** Missing metadata means legacy observations; an empty array means not observed. */
  observed?: string[];
}

export interface FrameData {
  throws: ThrowData[];
  score: number | null;
  cumulativeScore: number | null;
}

export interface BowlingStats {
  pocketOpportunities?: number;
  spareOpportunities?: number;
  totalScore: number;
  strikes: number;
  spares: number;
  splitCount: number;
  splitConverted: number;
  splitOnLastThrow: number;
  singlePinCount: number;
  singlePinConverted: number;
  pocketCount: number;
  totalThrows: number;
  totalFrames: number;
  strikePercentage: number;
  sparePercentage: number;
  splitPercentage: number;
  singlePinConversionRate: number;
  pocketPercentage: number;
  openFrames: number;
  firstBallGte8Count: number;
  firstBallGte8Opportunities: number;
  firstBallGte8Percentage: number;
}

interface BowlingScoreSheetProps {
  onSave?: (stats: BowlingStats, frames: FrameData[], ballData?: { mode: string; ballId?: string | null; frameBalls?: (string | null)[]; frameLines?: (string | null)[]; frameSurfaces?: (string | null)[] }) => void;
  onCancel?: () => void;
  initialFrames?: FrameData[];
  playerId?: string;
  categoryId?: string;
  readOnly?: boolean;
  trackPockets?: boolean;
  compact?: boolean;
  gameNumber?: number;
  onDraftChange?: (stats: BowlingStats, frames: FrameData[]) => void;
  beforeThrowChange?: () => boolean;
}

const createEmptyFrame = (): FrameData => ({
  throws: [],
  score: null,
  cumulativeScore: null,
});

const createEmptyThrow = (): ThrowData => ({
  value: "",
  pins: 0,
  isPocket: false,
  isSplit: false,
  isSinglePin: false,
  isSinglePinConverted: false,
});

export function BowlingScoreSheet({ onSave, onCancel, initialFrames, playerId, categoryId, readOnly, trackPockets = true, compact: compactProp = false, gameNumber = 1, onDraftChange, beforeThrowChange }: BowlingScoreSheetProps) {
  const isMobile = useIsMobile();
  const compact = compactProp || isMobile;
  const [frames, setFrames] = useState<FrameData[]>(() => 
    initialFrames || Array.from({ length: 10 }, () => createEmptyFrame())
  );
  const [isSaved, setIsSaved] = useState(readOnly || false);
  const [ballMode, setBallMode] = useState<"simple" | "advanced">("simple");
  const [selectedBallId, setSelectedBallId] = useState<string | null>(null);
  const [frameBalls, setFrameBalls] = useState<(string | null)[]>(Array(10).fill(null));
  const [frameLines, setFrameLines] = useState<(string | null)[]>(Array(10).fill(null));
  const [frameSurfaces, setFrameSurfaces] = useState<(string | null)[]>(Array(10).fill(null));
  const [detailsOpen, setDetailsOpen] = useState(!compact);
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const getInputKey = (frameIndex: number, throwIndex: number) => `${frameIndex}-${throwIndex}`;

  const setInputRef = (frameIndex: number, throwIndex: number, el: HTMLInputElement | null) => {
    const key = getInputKey(frameIndex, throwIndex);
    if (el) {
      inputRefs.current.set(key, el);
    } else {
      inputRefs.current.delete(key);
    }
  };

  // Find the next editable throw position
  const findNextThrow = useCallback((frameIndex: number, throwIndex: number, currentFrames: FrameData[]): [number, number] | null => {
    // Try next throw in same frame
    const nextThrow = throwIndex + 1;
    const maxThrows = frameIndex < 9 ? 2 : 3;
    if (nextThrow < maxThrows) {
      // Check if this throw would be editable
      const frame = currentFrames[frameIndex];
      if (frameIndex < 9) {
        if (nextThrow === 1 && frame.throws[0]?.value === "X") {
          // Strike in frames 1-9, move to next frame
          return frameIndex < 9 ? [frameIndex + 1, 0] : null;
        }
        return [frameIndex, nextThrow];
      } else {
        // 10th frame - always advance within frame up to max
        return [frameIndex, nextThrow];
      }
    }
    // Move to next frame
    if (frameIndex < 9) {
      return [frameIndex + 1, 0];
    }
    return null; // End of game
  }, []);

  // Find the previous editable throw position
  const findPrevThrow = useCallback((frameIndex: number, throwIndex: number, currentFrames: FrameData[]): [number, number] | null => {
    if (throwIndex > 0) {
      return [frameIndex, throwIndex - 1];
    }
    if (frameIndex > 0) {
      const prevFrame = currentFrames[frameIndex - 1];
      if (prevFrame.throws[0]?.value === "X" && frameIndex - 1 < 9) {
        return [frameIndex - 1, 0]; // Strike frame, only 1 throw
      }
      return [frameIndex - 1, 1]; // Normal frame, go to 2nd throw
    }
    return null;
  }, []);

  const focusInput = useCallback((frameIndex: number, throwIndex: number) => {
    // Small delay to allow React to render
    setTimeout(() => {
      const key = getInputKey(frameIndex, throwIndex);
      const input = inputRefs.current.get(key);
      if (input) {
        input.focus();
        input.select();
      }
    }, 50);
  }, []);
  const handleFrameBallChange = (frameIndex: number, ballId: string | null) => {
    setFrameBalls(prev => {
      const next = [...prev];
      next[frameIndex] = ballId;
      return next;
    });
  };

  const handleFrameDetailChange = (frameIndex: number, field: "line" | "surface", value: string) => {
    const setter = field === "line" ? setFrameLines : setFrameSurfaces;
    setter(prev => {
      const next = [...prev];
      next[frameIndex] = value;
      return next;
    });
  };
  const [stats, setStats] = useState<BowlingStats>({
    totalScore: 0,
    strikes: 0,
    spares: 0,
    splitCount: 0,
    splitConverted: 0,
    splitOnLastThrow: 0,
    singlePinCount: 0,
    singlePinConverted: 0,
    pocketCount: 0,
    totalThrows: 0,
    totalFrames: 10,
    strikePercentage: 0,
    sparePercentage: 0,
    splitPercentage: 0,
    singlePinConversionRate: 0,
    pocketPercentage: 0,
    openFrames: 0,
    firstBallGte8Count: 0,
    firstBallGte8Opportunities: 0,
    firstBallGte8Percentage: 0,
  });

  // Reset frames when initialFrames changes (for editing existing games)
  useEffect(() => {
    if (initialFrames) {
      setFrames(initialFrames);
      setIsSaved(readOnly || false);
    } else {
      setFrames(Array.from({ length: 10 }, () => createEmptyFrame()));
      setIsSaved(false);
    }
  }, [initialFrames, readOnly]);

  const calculateAllScores = scoreFrames;
  const calculateStats = calculateBowlingStats;

  // Helper: Check if pocket checkbox is allowed for this throw
  const isPocketAllowed = (frameIndex: number, throwIndex: number, frame: FrameData): boolean => {
    const isTenthFrame = frameIndex === 9;
    
    // Frames 1-9: only first throw
    if (!isTenthFrame) {
      return throwIndex === 0;
    }
    
    // 10th frame:
    // - 1st throw: always allowed (first ball)
    // - 2nd throw: only if 1st was a strike (fresh pins)
    // - 3rd throw: if 2nd was a strike (fresh pins) OR if 2nd was a spare (fresh pins after spare)
    if (throwIndex === 0) return true;
    if (throwIndex === 1) return frame.throws[0]?.value === "X";
    if (throwIndex === 2) return frame.throws[1]?.value === "X" || frame.throws[1]?.value === "/";
    
    return false;
  };

  // Helper: Check if single pin situation applies (first throw = 9 pins)
  const isSinglePinAllowed = (frameIndex: number, throwIndex: number, frame: FrameData): boolean => {
    // Same logic as pocket - only on "first throw" contexts
    if (!isPocketAllowed(frameIndex, throwIndex, frame)) return false;
    
    // And the throw value must be "9" (leaving 1 pin)
    const throwData = frame.throws[throwIndex];
    return throwData?.value === "9";
  };

  // Update stats when frames change
  useEffect(() => {
    const updatedFrames = calculateAllScores(frames);
    setStats(calculateStats(updatedFrames));
  }, [frames, calculateAllScores, calculateStats]);

  const applyThrow = (frameIndex: number, throwIndex: number, rawValue: string): FrameData[] | null => {
    const result = changeThrow(frames, frameIndex, throwIndex, rawValue);
    if (result.error) { toast.error(result.error); return null; }
    if (result.incompatible && !window.confirm("Cette correction rend des lancers de cette frame incompatibles. Retirer uniquement ces lancers ? Les frames suivantes seront conservées.")) return null;
    if (beforeThrowChange && !beforeThrowChange()) return null;
    const updated = result.frames;
    setFrames(updated);
    setIsSaved(false);
    onDraftChange?.(calculateStats(updated), updated);
    return updated;
  };
  const handleThrowInput = (frameIndex: number, throwIndex: number, rawValue: string) => {
    const updated = applyThrow(frameIndex, throwIndex, rawValue.length > 1 ? rawValue.slice(-1) : rawValue);
    if (updated && rawValue) {
      const next = findNextThrow(frameIndex, throwIndex, updated);
      if (next) focusInput(next[0], next[1]);
    }
  };

  const handleObservation = (frameIndex: number, throwIndex: number, field: keyof ThrowData, value: boolean | undefined) => {
    const updated = frames.map((f, fi) => fi !== frameIndex ? f : ({ ...f, throws: f.throws.map((t, ti) => {
      if (ti !== throwIndex) return t;
      const observed = t.observed ?? ["isPocket", "isSplit", "isSinglePin", "isSinglePinConverted"];
      return { ...t, [field]: value ?? false, observed: value === undefined ? observed.filter(k => k !== field) : [...new Set([...observed, field])] };
    }) }));
    setFrames(updated);
    onDraftChange?.(calculateStats(updated), updated);
  };

  // Handle keyboard navigation (arrow keys)
  const handleKeyDown = (frameIndex: number, throwIndex: number, e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      const next = findNextThrow(frameIndex, throwIndex, frames);
      if (next) focusInput(next[0], next[1]);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const prev = findPrevThrow(frameIndex, throwIndex, frames);
      if (prev) focusInput(prev[0], prev[1]);
    } else if (e.key === "Backspace" || e.key === "Delete") {
      const currentValue = frames[frameIndex]?.throws[throwIndex]?.value || "";
      // If the current cell is already empty, jump to previous cell and clear it
      if (currentValue === "") {
        e.preventDefault();
        const prev = findPrevThrow(frameIndex, throwIndex, frames);
        if (prev) {
          handleThrowInput(prev[0], prev[1], "");
          focusInput(prev[0], prev[1]);
        }
      }
    }
  };

  // Handle checkbox changes
  const handleCheckboxChange = (
    frameIndex: number, 
    throwIndex: number, 
    field: "isPocket" | "isSplit" | "isSinglePin" | "isSinglePinConverted"
  ) => {
    const current = frames[frameIndex]?.throws[throwIndex];
    if (current) handleObservation(frameIndex, throwIndex, field, !current[field]);
  };

  // Get max throws for a frame
  const getMaxThrows = (frameIndex: number): number => {
    if (frameIndex < 9) return 2;
    
    // 10th frame can have up to 3 throws
    const frame = frames[frameIndex];
    if (!frame.throws.length) return 3;
    
    const first = frame.throws[0];
    if (first?.value === "X") return 3;
    
    if (frame.throws.length >= 2) {
      const second = frame.throws[1];
      if (second?.value === "/" || first?.value === "X") return 3;
    }
    
    return 2;
  };

  // Check if throw is editable
  const isThrowEditable = (frameIndex: number, throwIndex: number): boolean => {
    const frame = frames[frameIndex];
    
    // First throw is always editable
    if (throwIndex === 0) return true;
    
    // For frames 1-9
    if (frameIndex < 9) {
      // Second throw only available if first wasn't a strike
      if (throwIndex === 1) {
        return frame.throws[0]?.value !== "X";
      }
      return false;
    }
    
    // 10th frame logic
    if (throwIndex === 1) return true; // Always have 2nd throw in 10th
    if (throwIndex === 2) {
      const first = frame.throws[0];
      const second = frame.throws[1];
      return first?.value === "X" || second?.value === "/" || second?.value === "X";
    }
    
    return false;
  };

  const handleSave = () => {
    if (!frames.some(frame => frame.throws.some(roll => roll.value))) {
      toast.error("Renseignez au moins un lancer avant d’enregistrer la partie.");
      return;
    }
    setIsSaved(true);
    const ballData = playerId ? {
      mode: ballMode,
      ballId: ballMode === "simple" ? selectedBallId : null,
      frameBalls: ballMode === "advanced" ? frameBalls : undefined,
      frameLines: ballMode === "advanced" ? frameLines : undefined,
      frameSurfaces: ballMode === "advanced" ? frameSurfaces : undefined,
    } : undefined;
    onSave?.(calculateStats(scoreFrames(frames)), scoreFrames(frames), ballData);
  };

  // Get cell background color based on throw value and split status
  const getThrowCellStyle = (value: string, throwData?: ThrowData): string => {
    if (value === "X") return "bg-primary text-primary-foreground font-bold";
    if (value === "/") return "bg-secondary text-secondary-foreground font-bold";
    if (value === "" || value === "-") return "bg-muted/50";
    // Red background for splits
    if (throwData?.isSplit) return "bg-destructive text-destructive-foreground font-bold";
    return "bg-accent text-accent-foreground";
  };

  return (
    <div className={`space-y-6 ${isSaved ? "opacity-80" : ""}`}>
      {/* Saved indicator */}
      {isSaved && (
        <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-muted border border-border">
          <CheckCircle className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium text-foreground">
            Partie enregistrée - Consultation uniquement
          </span>
        </div>
      )}

      {/* Ball Selector */}
      {playerId && categoryId && !isSaved && (
        <BowlingBallSelector
          playerId={playerId}
          categoryId={categoryId}
          mode={ballMode}
          onModeChange={setBallMode}
          selectedBallId={selectedBallId}
          onBallChange={setSelectedBallId}
          frameBalls={frameBalls}
          onFrameBallChange={handleFrameBallChange}
          frameLines={frameLines}
          frameSurfaces={frameSurfaces}
          onFrameDetailChange={handleFrameDetailChange}
        />
      )}

      {isMobile && <MobileBowlingFrames frames={scoreFrames(frames)} stats={stats} gameNumber={gameNumber} readOnly={!!readOnly || isSaved} trackPockets={trackPockets} onThrow={applyThrow} onObservation={handleObservation} />}
      {/* Classic Bowling Score Sheet remains on desktop. */}
      {!isMobile && <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center justify-between gap-2 flex-wrap">
            <span className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Feuille de Score
              {isSaved && <Badge variant="secondary" className="ml-2">Enregistrée</Badge>}
            </span>
            <span className="flex items-center gap-3 text-sm font-normal">
              <span className="flex items-baseline gap-1.5 px-2.5 py-1 rounded-md bg-primary/10 border border-primary/20">
                <span className="text-xs text-muted-foreground">Score</span>
                <span className="text-base font-bold text-primary">{stats.totalScore}</span>
              </span>
              <span className="flex items-baseline gap-1.5 px-2.5 py-1 rounded-md bg-muted border border-border">
                <span className="text-xs text-muted-foreground">Frames</span>
                <span className="text-base font-bold text-foreground">{stats.totalFrames}</span>
              </span>
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 sm:p-4">
          <div className="pb-2 w-full overflow-x-auto -mx-1 px-1">
            {/* Classic scoresheet table */}
            <table className={`table-fixed border-collapse border-2 border-foreground/30 ${compact ? "w-full min-w-[320px]" : "w-full min-w-[560px]"}`}>
              <colgroup>
                <col style={{ width: compact ? "44px" : "60px" }} />
                {frames.map((_, frameIndex) => (
                  <col
                    key={frameIndex}
                    style={{
                      width: frameIndex === 9 ? "16%" : "8.4%",
                    }}
                  />
                ))}
              </colgroup>
              <thead>
                {compact && (
                  <tr>
                    <th className="border border-foreground/20 bg-muted px-1 py-0.5 text-[8px] font-medium text-muted-foreground">P/S</th>
                    {frames.map((frame, frameIndex) => {
                      const isTenth = frameIndex === 9;
                      const throwIndices = isTenth ? [0, 1, 2] : [0];
                      const hasAnyThrow = throwIndices.some(ti => frame.throws[ti]?.value);
                      return (
                        <th key={frameIndex} className="border border-foreground/20 bg-muted px-0.5 py-0.5">
                          {hasAnyThrow ? (
                            <div className={`flex items-center justify-center ${isTenth ? "gap-1" : "gap-0.5"}`}>
                              {throwIndices.map((ti) => {
                                const t = frame.throws[ti];
                                if (!t?.value) {
                                  return isTenth ? (
                                    <span key={ti} className="text-[8px] text-muted-foreground/40 w-3 text-center">·</span>
                                  ) : null;
                                }
                                const pocketAllowed = isPocketAllowed(frameIndex, ti, frame);
                                const splitAllowed = t.value !== "X" && t.value !== "/";
                                if (!pocketAllowed && !splitAllowed) {
                                  return isTenth ? (
                                    <span key={ti} className="text-[8px] text-muted-foreground/40 w-3 text-center">·</span>
                                  ) : null;
                                }
                                return (
                                  <div key={ti} className="flex items-center gap-0.5">
                                    {pocketAllowed && trackPockets && (
                                      <button
                                        type="button"
                                        disabled={isSaved}
                                        onClick={() => handleCheckboxChange(frameIndex, ti, "isPocket")}
                                        className={`text-[8px] font-bold rounded px-1 py-0 border leading-tight transition-colors disabled:opacity-60 ${
                                          t.isPocket
                                            ? "bg-primary text-primary-foreground border-primary"
                                            : "bg-background border-border hover:bg-muted-foreground/10 text-muted-foreground"
                                        }`}
                                        title={`Boule en poche (lancer ${ti + 1})`}
                                      >
                                        P
                                      </button>
                                    )}
                                    {splitAllowed && (
                                      <button
                                        type="button"
                                        disabled={isSaved}
                                        onClick={() => handleCheckboxChange(frameIndex, ti, "isSplit")}
                                        className={`text-[8px] font-bold rounded px-1 py-0 border leading-tight transition-colors disabled:opacity-60 ${
                                          t.isSplit
                                            ? "bg-destructive text-destructive-foreground border-destructive"
                                            : "bg-background border-border hover:bg-muted-foreground/10 text-muted-foreground"
                                        }`}
                                        title={`Split (lancer ${ti + 1})`}
                                      >
                                        S
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-[8px] text-muted-foreground/40">·</span>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                )}
                <tr>
                  <th className={`border border-foreground/20 bg-muted px-1 py-1 text-[10px] font-medium`}></th>
                  {frames.map((_, frameIndex) => (
                    <th 
                      key={frameIndex} 
                      className="border border-foreground/20 bg-muted px-1 py-1 text-xs font-bold text-center"
                      colSpan={1}
                    >
                      {frameIndex + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Throws row - small boxes at top right of each cell */}
                <tr>
                  <td className={`border border-foreground/20 bg-muted/50 ${compact ? "text-[10px]" : "text-xs"} font-medium text-center px-1 whitespace-nowrap`}>
                    Joueur
                  </td>
                  {frames.map((frame, frameIndex) => {
                    const maxThrows = getMaxThrows(frameIndex);
                    const isTenth = frameIndex === 9;
                    
                    return (
                      <td 
                        key={frameIndex} 
                        className="border border-foreground/20 p-0 relative h-12"
                      >
                        {/* Throw boxes at top */}
                        <div className={`absolute top-0 right-0 flex ${isTenth ? "" : ""}`}>
                          {Array.from({ length: maxThrows }).map((_, throwIndex) => {
                            const throwData = frame.throws[throwIndex];
                            const editable = isThrowEditable(frameIndex, throwIndex);
                            const value = throwData?.value || "";
                            
                            // For regular frames, first throw takes more space, second is in corner
                            const isFirstThrow = throwIndex === 0;
                            const boxSize = compact
                              ? (isTenth ? "w-[20px] h-[22px]" : isFirstThrow ? "w-[18px] h-[20px]" : "w-[16px] h-[20px]")
                              : (isTenth ? "w-[28px] h-[24px]" : isFirstThrow ? "w-[24px] h-[22px]" : "w-[22px] h-[22px]");
                            
                            return (
                              <div 
                                key={throwIndex} 
                                className={`${boxSize} border-l border-b border-foreground/20 relative ${
                                  throwIndex === 0 && !isTenth ? "border-l-0" : ""
                                }`}
                              >
                                <Input
                                  ref={(el) => setInputRef(frameIndex, throwIndex, el)}
                                  type="text"
                                  maxLength={1}
                                  value={value}
                                  onChange={(e) => handleThrowInput(frameIndex, throwIndex, e.target.value)}
                                  onKeyDown={(e) => handleKeyDown(frameIndex, throwIndex, e)}
                                  disabled={!editable || isSaved}
                                  className={`w-full h-full text-center ${compact ? "text-[10px]" : "text-xs"} font-bold p-0 uppercase rounded-none border-0 focus:ring-1 focus:ring-primary ${getThrowCellStyle(value, throwData)} ${isSaved ? "opacity-70" : ""}`}
                                  placeholder=""
                                />
                              </div>
                            );
                          })}
                        </div>
                        
                        {/* Cumulative score - centered at bottom */}
                        <div className={`absolute bottom-0.5 left-0 right-0 text-center ${compact ? "text-xs" : "text-sm"} font-semibold`}>
                          {frame.cumulativeScore ?? ""}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>

        </CardContent>
      </Card>}


      {/* Throw Details - Collapsible (hidden in compact/focus mode; P/S now inline in scoresheet header) */}
      {!compact && !isMobile && (
      <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
        <Card className={compact ? "shadow-sm" : ""}>
          <CollapsibleTrigger asChild>
            <CardHeader className={`${compact ? "p-1.5" : "pb-2"} cursor-pointer hover:bg-muted/50 transition-colors`}>
              <CardTitle className={`${compact ? "text-[11px] font-medium" : "text-lg"} flex items-center justify-between gap-1`}>
                <span className="flex items-center gap-1">
                  <Target className={compact ? "h-3 w-3 text-muted-foreground" : "h-4 w-4"} />
                  {compact ? "Lancers" : "Détails des lancers"}
                </span>
                <ChevronDown className={`${compact ? "h-3 w-3" : "h-5 w-5"} transition-transform duration-200 ${detailsOpen ? "rotate-180" : ""}`} />
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
           <CollapsibleContent>
            <CardContent className={compact ? "p-2 pt-0" : ""}>
              {/* Toggle all pockets button */}
              {!isSaved && trackPockets && (
                <div className={compact ? "mb-2 flex gap-2" : "mb-4 flex gap-2"}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                        const allPocketsChecked = frames.every((frame, fi) =>
                          frame.throws.every((t, ti) => {
                            if (!t.value) return true;
                            if (!isPocketAllowed(fi, ti, frame)) return true;
                            return t.isPocket;
                          })
                        );
                        const updated = frames.map((frame, fi) => ({
                          ...frame,
                          throws: frame.throws.map((t, ti) => {
                            if (!t.value) return t;
                            if (!isPocketAllowed(fi, ti, frame)) return t;
                            return { ...t, isPocket: !allPocketsChecked, observed: [...new Set([...(t.observed ?? ["isPocket", "isSplit", "isSinglePin", "isSinglePinConverted"]), "isPocket"])] };
                          }),
                        }));
                        setFrames(updated);
                        onDraftChange?.(calculateStats(updated), updated);
                    }}
                    className={compact ? "h-6 px-2 text-[10px] gap-1" : "gap-1"}
                  >
                    <Target className={compact ? "h-3 w-3" : "h-4 w-4"} />
                    {frames.every((frame, fi) =>
                      frame.throws.every((t, ti) => {
                        if (!t.value) return true;
                        if (!isPocketAllowed(fi, ti, frame)) return true;
                        return t.isPocket;
                      })
                    )
                      ? (compact ? "Décocher poches" : "Décocher toutes les poches")
                      : (compact ? "Cocher poches" : "Cocher toutes les poches")}
                  </Button>
                </div>
              )}
              <div className={compact
                ? "grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-2"
                : "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-10 gap-1.5"}>
                {frames.map((frame, frameIndex) => {
                  const hasAnyThrow = frame.throws.some((t) => t.value);
                  if (!hasAnyThrow) return null;
                  return (
                    <div
                      key={frameIndex}
                      className="rounded-md border bg-muted/30 px-1.5 py-1 flex flex-col gap-1"
                    >
                      <div className="text-[10px] font-semibold text-muted-foreground leading-none">
                        F{frameIndex + 1}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        {frame.throws.map((throwData, throwIndex) => {
                          if (!throwData.value) return null;
                          const pocketAllowed = isPocketAllowed(frameIndex, throwIndex, frame);
                          const showSplit =
                            throwData.value !== "X" && throwData.value !== "/";
                          // In read-only (saved) mode, only render active badges to avoid overflow in narrow cells.
                          const showPocketBadge = trackPockets && pocketAllowed && (!isSaved || throwData.isPocket);
                          const showSplitBadge = showSplit && (!isSaved || throwData.isSplit);
                          if (!showPocketBadge && !showSplitBadge && !pocketAllowed) return null;
                          return (
                            <div key={throwIndex} className="flex flex-wrap items-center gap-1 min-w-0">
                              <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                                L{throwIndex + 1}:{throwData.value}
                              </span>
                              {showPocketBadge && (
                                <button
                                  type="button"
                                  disabled={isSaved}
                                  onClick={() => handleCheckboxChange(frameIndex, throwIndex, "isPocket")}
                                  className={`text-[10px] font-semibold rounded px-1.5 py-0.5 border transition-colors disabled:opacity-60 shrink-0 ${
                                    throwData.isPocket
                                      ? "bg-primary text-primary-foreground border-primary"
                                      : "bg-background border-border hover:bg-muted"
                                  }`}
                                  title="Boule en poche"
                                >
                                  P
                                </button>
                              )}
                              {showSplitBadge && (
                                <button
                                  type="button"
                                  disabled={isSaved}
                                  onClick={() => handleCheckboxChange(frameIndex, throwIndex, "isSplit")}
                                  className={`text-[10px] font-semibold rounded px-1.5 py-0.5 border transition-colors disabled:opacity-60 shrink-0 ${
                                    throwData.isSplit
                                      ? "bg-destructive text-destructive-foreground border-destructive"
                                      : "bg-background border-border hover:bg-muted"
                                  }`}
                                  title="Split"
                                >
                                  S
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              {!compact && (
                <p className="mt-2 text-[10px] text-muted-foreground">
                  P = Boule en poche · S = Split — cliquer pour activer
                </p>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
      )}

      {/* Statistics Summary — collapsed by default in compact (multi-athlete) mode */}
      <Card className={`bg-gradient-to-br from-primary/5 to-primary/10 ${compact ? "shadow-sm border-muted/50" : ""}`}>
        <Collapsible defaultOpen={!compact && !isMobile}>
          <CollapsibleTrigger asChild>
            <CardHeader className={`${compact ? "p-2.5 pb-2" : "pb-2"} cursor-pointer hover:bg-primary/5 transition-colors rounded-t-xl`}>
              <CardTitle className={`${compact ? "text-xs font-semibold" : "text-lg"} flex items-center gap-1.5`}>
                <TrendingUp className={compact ? "h-3.5 w-3.5" : "h-5 w-5"} />
                Statistiques calculées
                <Badge variant="secondary" className="ml-1 text-[10px] font-mono">
                  {stats.totalScore}
                </Badge>
                <ChevronDown className={`${compact ? "h-3.5 w-3.5" : "h-4 w-4"} ml-auto text-muted-foreground transition-transform data-[state=open]:rotate-180`} />
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className={compact ? "p-2.5 pt-0" : ""}>
              <div className={compact ? "grid grid-cols-2 gap-2" : "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4"}>
                 <StatBox 
                  label="% Strikes" 
                  value={stats.totalFrames === 0 ? "—" : `${stats.strikePercentage}%`}
                  detail={`${stats.strikes}/${stats.totalFrames} f.`}
                  bgColorClass={getStatColor("strike", stats.strikePercentage).bg}
                  textColorClass={getStatColor("strike", stats.strikePercentage).text}
                  compact={compact}
                />
                <StatBox 
                  label="% Spares" 
                  value={stats.spareOpportunities === 0 ? "—" : `${stats.sparePercentage}%`}
                  detail={`${stats.spares} sp. (ex. spl)`}
                  bgColorClass={getStatColor("spare", stats.sparePercentage).bg}
                  textColorClass={getStatColor("spare", stats.sparePercentage).text}
                  compact={compact}
                />
                <StatBox 
                  label="% Splits conv." 
                  value={stats.splitCount === 0 ? "—" : `${stats.splitPercentage}%`}
                  detail={`${stats.splitConverted}/${stats.splitCount} spl.`}
                  note={stats.splitOnLastThrow > 0 ? `+${stats.splitOnLastThrow} excl.` : undefined}
                  compact={compact}
                />
                <StatBox 
                  label="% QS converties" 
                  value={stats.singlePinCount === 0 ? "—" : `${stats.singlePinConversionRate}%`}
                  detail={`${stats.singlePinConverted}/${stats.singlePinCount}`}
                  bgColorClass={getStatColor("singlePin", stats.singlePinConversionRate).bg}
                  textColorClass={getStatColor("singlePin", stats.singlePinConversionRate).text}
                  compact={compact}
                />
                <StatBox 
                  label="% Poches" 
                  value={stats.pocketOpportunities === 0 ? "—" : `${stats.pocketPercentage}%`}
                  detail={`${stats.pocketCount} lanc.`}
                  bgColorClass={getStatColor("pocket", stats.pocketPercentage).bg}
                  textColorClass={getStatColor("pocket", stats.pocketPercentage).text}
                  compact={compact}
                />
                <StatBox 
                  label="% Boules ≥8" 
                  value={stats.firstBallGte8Opportunities === 0 ? "—" : `${stats.firstBallGte8Percentage}%`}
                  detail={`${stats.firstBallGte8Count}/${stats.firstBallGte8Opportunities}`}
                  bgColorClass={getStatColor("firstBallGte8", stats.firstBallGte8Percentage).bg}
                  textColorClass={getStatColor("firstBallGte8", stats.firstBallGte8Percentage).text}
                  compact={compact}
                />
                <StatBox 
                  label="Frames ouvertes" 
                  value={stats.openFrames.toString()}
                  detail="hors splits"
                  compact={compact}
                />
                <StatBox 
                  label="Score total" 
                  value={stats.totalScore.toString()}
                  detail="points"
                  highlight
                  compact={compact}
                />
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Action Buttons */}
      <div className={`flex gap-2 ${compact ? "mt-2 justify-end" : "mt-4"}`}>
        <Button 
          variant="outline" 
          className={isMobile ? "h-12 flex-1" : compact ? "h-7 text-[11px] px-2.5 font-medium flex-1 sm:flex-none" : "flex-1"} 
          onClick={onCancel}
        >
          <X className={compact ? "h-3 w-3 mr-1" : "h-4 w-4 mr-2"} />
          {isSaved ? "Fermer" : "Annuler"}
        </Button>
        {isSaved && !readOnly && <Button variant="outline" className="h-12 flex-1" onClick={() => setIsSaved(false)}>Modifier</Button>}
        {!isSaved && (
          <Button 
            className={isMobile ? "h-12 flex-1 bg-bowling-ink text-card" : compact ? "h-7 text-[11px] px-3 font-medium flex-1 sm:flex-none" : "flex-1"} 
            onClick={handleSave}
          >
            <Save className={compact ? "h-3 w-3 mr-1" : "h-4 w-4 mr-2"} />
            {isGameComplete(frames) ? "Enregistrer" : "Enregistrer en cours"}
          </Button>
        )}
      </div>
    </div>
  );
}

interface StatBoxProps {
  label: string;
  value: string;
  detail: string;
  note?: string;
  highlight?: boolean;
  colorClass?: string;
  bgColorClass?: string;
  textColorClass?: string;
  compact?: boolean;
}

function StatBox({ label, value, detail, note, highlight, colorClass, bgColorClass, textColorClass, compact }: StatBoxProps) {
  const paddingClass = compact ? "p-1.5" : "p-3";
  const labelSizeClass = compact ? "text-[10px]" : "text-xs";
  const valueSizeClass = compact ? "text-sm" : "text-xl";
  const detailSizeClass = compact ? "text-[9px]" : "text-xs";

  if (bgColorClass && !compact) {
    const isNoire2 = textColorClass?.includes("text-red");
    const valueColor = isNoire2 ? "text-red-600 font-extrabold" : "text-white";
    return (
      <div className={`${paddingClass} rounded-lg ${bgColorClass} text-white flex flex-col justify-between h-full min-h-[56px] leading-tight`}>
        <div className={`${labelSizeClass} opacity-90 truncate font-medium`}>{label}</div>
        <div className={`${valueSizeClass} font-bold ${valueColor} my-0.5`}>{value}</div>
        <div className={`${detailSizeClass} opacity-80 truncate`}>{detail}</div>
        {note && <div className={`${detailSizeClass} opacity-70 truncate`}>{note}</div>}
      </div>
    );
  }
  return (
    <div className={`${paddingClass} rounded-lg ${highlight ? "bg-primary/20 border border-primary/30" : "bg-background border"} flex flex-col justify-between h-full min-h-[56px] leading-tight`}>
      <div className={`${labelSizeClass} text-muted-foreground truncate font-medium`}>{label}</div>
      <div className={`${valueSizeClass} font-bold ${colorClass || (highlight ? "text-primary" : "")} my-0.5`}>{value}</div>
      <div className={`${detailSizeClass} text-muted-foreground truncate`}>{detail}</div>
      {note && <div className={`${detailSizeClass} text-muted-foreground truncate`}>{note}</div>}
    </div>
  );
}
