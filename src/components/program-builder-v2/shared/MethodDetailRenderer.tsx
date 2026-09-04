/**
 * MethodDetailRenderer — Affichage universel des méthodes côté athlète
 * 
 * Rend fidèlement TOUTE la richesse des données définies par le coach :
 * - Structure détaillée par méthode (Drop Set, Rest-Pause, Cluster, etc.)
 * - Variables par série (variableSets)
 * - Notes pédagogiques auto-générées
 * - Précisions du coach
 * - Configs CrossFit (EMOM, AMRAP, Tabata, Death By, For Time, Circuit)
 * - Fartlek, Intermittent Cardio, Stato-Dynamique
 */

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  Zap,
  Clock,
  Timer,
  Target,
  Gauge,
  ChevronDown,
  FileText,
  MessageSquare,
  Layers,
  RotateCcw,
  Weight,
  TrendingUp,
  Repeat,
  AlertTriangle,
} from "lucide-react";
import { getTrainingStyleConfig } from "@/lib/program-builder-v2/trainingStyles";
import { generateMethodNote } from "@/lib/program-builder-v2/athleteNoteGenerator";

// ── Helpers ──

const formatTime = (seconds: number): string => {
  if (!seconds) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h${remainingMins > 0 ? remainingMins.toString().padStart(2, "0") : "00"}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

// ── Sub-components ──

const SectionLabel = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5", className)}>
    {children}
  </div>
);

const VarBadge = ({ label, value, unit, highlight, danger }: { label: string; value: string | number; unit?: string; highlight?: boolean; danger?: boolean }) => (
  <Badge
    variant="secondary"
    className={cn(
      "text-[10px] px-1.5 py-0.5 font-medium",
      highlight && "bg-primary/15 text-primary border border-primary/25",
      danger && "bg-red-100 dark:bg-red-950/30 border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 font-bold"
    )}
  >
    {label}: {value}{unit ? ` ${unit}` : ""}
  </Badge>
);

// ── Drop Set Renderer ──

const DropSetDetail = ({ exercise }: { exercise: any }) => {
  const series = exercise.dropSetSeries;
  if (!series?.length) return null;

  return (
    <div className="space-y-1.5 p-2 rounded-md border bg-red-500/5 border-red-500/30">
      <SectionLabel>
        <Layers className="h-3 w-3 text-red-500" />
        <span className="text-red-600 dark:text-red-400">Structure Drop Set</span>
      </SectionLabel>
      {series.map((s: any, idx: number) => (
        <div key={idx} className="flex items-center gap-1.5 flex-wrap p-1.5 rounded border border-red-500/20 bg-background">
          <Badge variant="outline" className="text-[10px] font-medium px-1.5 py-0.5 bg-red-500/10 border-red-500/30 min-w-[60px] justify-center">
            {idx === 0 ? "Départ" : `Drop ${idx}`}
          </Badge>
          <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0.5 font-bold", s.reps === "MAX" && "bg-red-600 text-white")}>
            {s.reps === "MAX" ? "MAX" : `${s.reps} reps`}
          </Badge>
          {s.percentage && <VarBadge label="%1RM" value={s.percentage} unit="%" />}
          {s.load && <VarBadge label="Charge" value={s.load} unit="kg" />}
          {s.tempo && <VarBadge label="Tempo" value={s.tempo} />}
          {s.rpe && <VarBadge label="RPE" value={s.rpe} danger={s.reps === "MAX"} />}
          {s.pauseSeconds && s.pauseSeconds > 0 && (
            <VarBadge label="Pause" value={formatTime(s.pauseSeconds)} />
          )}
        </div>
      ))}
    </div>
  );
};

// ── Rest-Pause Renderer ──

const RestPauseDetail = ({ config }: { config: any }) => {
  if (!config?.series?.length) return null;

  return (
    <div className="space-y-1.5 p-2 rounded-md border bg-amber-500/5 border-amber-500/30">
      <SectionLabel>
        <Timer className="h-3 w-3 text-amber-500" />
        <span className="text-amber-600 dark:text-amber-400">Structure Rest-Pause</span>
      </SectionLabel>
      {config.series.map((s: any, sIdx: number) => (
        <div key={sIdx} className="space-y-1 p-1.5 rounded border border-amber-500/20 bg-background">
          <Badge variant="outline" className="text-[10px] font-medium px-1.5 py-0.5 bg-amber-500/10 border-amber-500/30">
            Série {sIdx + 1}
          </Badge>
          {/* Series-level variables */}
          <div className="flex items-center gap-1 flex-wrap">
            {s.percentage && <VarBadge label="%1RM" value={s.percentage} unit="%" />}
            {s.load && <VarBadge label="Charge" value={s.load} unit="kg" />}
            {s.tempo && <VarBadge label="Tempo" value={s.tempo} />}
            {s.rpe && <VarBadge label="RPE" value={s.rpe} danger />}
            {s.rir !== undefined && s.rir !== null && <VarBadge label="RIR" value={s.rir} danger />}
          </div>
          {/* Mini-sets */}
          <div className="space-y-0.5">
            {s.miniSets?.map((ms: any, mIdx: number) => (
              <div key={mIdx} className="flex items-center gap-1.5 flex-wrap">
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                  MS {mIdx + 1}
                </Badge>
                <Badge className="bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5">
                  MAX
                </Badge>
                {ms.pauseSeconds > 0 && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                    {formatTime(ms.pauseSeconds)} pause
                  </Badge>
                )}
              </div>
            ))}
          </div>
          {/* Recovery */}
          {s.recoverySeconds > 0 && (
            <div className="flex items-center gap-1.5 pt-1 border-t border-border/50">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">
                Récupération: {formatTime(s.recoverySeconds)}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// ── Cluster Renderer ──

const ClusterDetail = ({ config }: { config: any }) => {
  if (!config?.clusterSteps?.length) return null;

  const loadDisplay = config.loadType === "percentage"
    ? `${config.loadValue}% 1RM`
    : config.loadType === "weight_kg"
    ? `${config.loadValue}kg`
    : `RPE ${config.loadValue}`;

  return (
    <div className="space-y-1.5 p-2 rounded-md border bg-orange-500/5 border-orange-500/30">
      <SectionLabel>
        <Zap className="h-3 w-3 text-orange-500" />
        <span className="text-orange-600 dark:text-orange-400">Structure Cluster Set</span>
      </SectionLabel>
      <div className="flex items-center gap-1.5 flex-wrap">
        <VarBadge label="Séries" value={config.sets} highlight />
        <VarBadge label="Charge" value={loadDisplay} highlight />
        {config.targetRpe && <VarBadge label="RPE cible" value={config.targetRpe} />}
      </div>
      <div className="p-1.5 rounded border border-orange-500/20 bg-background">
        <span className="text-[10px] font-medium text-muted-foreground mb-1 block">Structure d'une série :</span>
        <div className="flex items-center gap-1 flex-wrap">
          {config.clusterSteps.map((step: any, idx: number) => (
            <React.Fragment key={idx}>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 font-medium">
                {step.reps === "max" ? "MAX" : `${step.reps} rep${step.reps > 1 ? "s" : ""}`}
              </Badge>
              {idx < config.clusterSteps.length - 1 && step.restAfterSeconds && (
                <span className="text-[10px] text-muted-foreground">
                  → {step.restAfterSeconds}s →
                </span>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <Clock className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground">
          Repos inter-séries: {formatTime(config.interSetRestSeconds)}
        </span>
      </div>
    </div>
  );
};

// ── Variable Sets Renderer ──

const VariableSetsDetail = ({ sets }: { sets: any[] }) => {
  if (!sets?.length) return null;

  // Check if there are actually variable values
  const hasVariables = sets.some((s: any) => 
    s.reps || s.percentage || s.load || s.tempo || s.rpe || s.rir
  );
  if (!hasVariables) return null;

  return (
    <div className="space-y-1 p-2 rounded-md border bg-secondary/30">
      <SectionLabel>
        <Layers className="h-3 w-3" />
        Détail par série
      </SectionLabel>
      <div className="space-y-0.5">
        {sets.map((s: any, idx: number) => (
          <div key={idx} className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 min-w-[40px] justify-center">
              S{idx + 1}
            </Badge>
            {s.reps && (
              <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0.5 font-bold", s.reps === "MAX" && "bg-red-600 text-white")}>
                {s.reps === "MAX" ? "MAX" : `${s.reps} reps`}
              </Badge>
            )}
            {s.percentage && <VarBadge label="%" value={s.percentage} unit="%" />}
            {s.load && <VarBadge label="Charge" value={s.load} unit="kg" />}
            {s.tempo && <VarBadge label="Tempo" value={s.tempo} />}
            {s.rpe && <VarBadge label="RPE" value={s.rpe} danger={s.reps === "MAX"} />}
            {s.rir !== undefined && s.rir !== null && <VarBadge label="RIR" value={s.rir} danger={s.reps === "MAX"} />}
            {s.restSeconds && <VarBadge label="Repos" value={formatTime(s.restSeconds)} />}
          </div>
        ))}
      </div>
    </div>
  );
};

// ── CrossFit Config Renderer ──

const CrossFitConfigDetail = ({ exercise }: { exercise: any }) => {
  const { emomConfig, tabataConfig, deathByConfig, timeCap, totalMinutes, repsPerRound, methodExercises } = exercise;
  
  const hasConfig = emomConfig || tabataConfig || deathByConfig || timeCap || totalMinutes || methodExercises?.length;
  if (!hasConfig) return null;

  const style = exercise.trainingStyle;
  const styleConfig = getTrainingStyleConfig(style);

  return (
    <div className="space-y-1.5 p-2 rounded-md border bg-secondary/30 border-border">
      <SectionLabel>
        <Target className="h-3 w-3 text-muted-foreground" />
        Paramètres
      </SectionLabel>

      <div className="flex items-center gap-1.5 flex-wrap">
        {timeCap && <VarBadge label="Time Cap" value={`${timeCap} min`} highlight />}
        {totalMinutes && <VarBadge label="Durée" value={`${totalMinutes} min`} highlight />}
        {repsPerRound && <VarBadge label="Reps/round" value={repsPerRound} />}
        
        {emomConfig && (
          <>
            <VarBadge label="Intervalle" value={`${emomConfig.intervalMinutes} min`} />
            <VarBadge label="Total" value={`${emomConfig.totalMinutes} min`} highlight />
          </>
        )}
        {tabataConfig && (
          <>
            <VarBadge label="Effort" value={`${tabataConfig.workSeconds}s`} highlight />
            <VarBadge label="Repos" value={`${tabataConfig.restSeconds}s`} />
            <VarBadge label="Rounds" value={tabataConfig.rounds} />
          </>
        )}
        {deathByConfig && (
          <>
            <VarBadge label="Départ" value={`${deathByConfig.startReps} reps`} />
            <VarBadge label="Incrément" value={`+${deathByConfig.incrementReps}/min`} />
          </>
        )}
      </div>

      {/* Method exercises list */}
      {methodExercises?.length > 0 && (
        <div className="space-y-0.5 pt-1">
          <span className="text-[10px] font-medium text-muted-foreground">Exercices du bloc :</span>
          {methodExercises.map((ex: any, idx: number) => (
            <div key={idx} className="p-1 rounded bg-secondary/30">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 min-w-[24px] justify-center">
                  {idx + 1}
                </Badge>
                <span className="text-xs font-medium">{ex.exerciseName}</span>
                {ex.reps && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {ex.reps} reps
                  </Badge>
                )}
                {ex.percentage && <VarBadge label="%" value={ex.percentage} unit="%" />}
                {ex.load && <VarBadge label="" value={`${ex.load}kg`} />}
                {getCardioBadges(ex).map((b) => (
                  <Badge key={b.key} variant="secondary" className="text-[10px] px-1.5 py-0">
                    {b.label}
                  </Badge>
                ))}

              </div>
              {ex.notes && String(ex.notes).trim() !== "" && (
                <p className="text-[11px] italic text-muted-foreground whitespace-pre-line mt-0.5 ml-[30px]">
                  💬 {String(ex.notes)}
                </p>
              )}
            </div>
          ))}

        </div>
      )}
    </div>
  );
};

// ── Intermittent Cardio Renderer ──

const IntermittentCardioDetail = ({ config }: { config: any }) => {
  if (!config) return null;

  const supportLabels: Record<string, string> = {
    running: "🏃 Course",
    cycling: "🚴 Vélo",
    swimming: "🏊 Natation",
  };

  return (
    <div className="space-y-1.5 p-2 rounded-md border bg-sky-500/5 border-sky-500/30">
      <SectionLabel>
        <Repeat className="h-3 w-3 text-sky-500" />
        <span className="text-sky-600 dark:text-sky-400">Intermittent Cardio</span>
      </SectionLabel>
      <div className="flex items-center gap-1.5 flex-wrap">
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
          {supportLabels[config.support] || config.support}
        </Badge>
        <VarBadge label="Répétitions" value={config.repetitions} highlight />
        {config.series > 1 && <VarBadge label="Séries" value={config.series} />}
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {config.effortMode === "duration" && config.effortDurationSeconds && (
          <VarBadge label="Effort" value={formatTime(config.effortDurationSeconds)} highlight />
        )}
        {config.effortMode === "distance" && config.effortDistanceMeters && (
          <VarBadge label="Effort" value={`${config.effortDistanceMeters}m`} highlight />
        )}
        {config.recoveryMode === "duration" && config.recoveryDurationSeconds && (
          <VarBadge label="Récup" value={formatTime(config.recoveryDurationSeconds)} />
        )}
        {config.recoveryMode === "distance" && config.recoveryDistanceMeters && (
          <VarBadge label="Récup" value={`${config.recoveryDistanceMeters}m`} />
        )}
        {config.intensityValue && (
          <VarBadge label="Intensité" value={config.intensityValue} unit={config.intensityType === "percentage" ? "%" : config.intensityType === "power" ? "W" : ""} />
        )}
      </div>
      {config.interSeriesRecoverySeconds > 0 && config.series > 1 && (
        <div className="flex items-center gap-1.5">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">
            Récup inter-séries: {formatTime(config.interSeriesRecoverySeconds)}
          </span>
        </div>
      )}
    </div>
  );
};

// ── Stato-Dynamique Renderer ──

const StatoDynamiqueDetail = ({ config }: { config: any }) => {
  if (!config) return null;

  return (
    <div className="space-y-1.5 p-2 rounded-md border bg-violet-500/5 border-violet-500/30">
      <SectionLabel>
        <Zap className="h-3 w-3 text-violet-500" />
        <span className="text-violet-600 dark:text-violet-400">Stato-Dynamique</span>
      </SectionLabel>
      <div className="flex items-center gap-1.5 flex-wrap">
        {config.staticDurationSeconds && (
          <VarBadge label="Phase statique" value={formatTime(config.staticDurationSeconds)} highlight />
        )}
        {config.dynamicReps && <VarBadge label="Reps dynamiques" value={config.dynamicReps} highlight />}
        {config.sets && <VarBadge label="Séries" value={config.sets} />}
        {config.restSeconds && <VarBadge label="Repos" value={formatTime(config.restSeconds)} />}
        {config.percentage && <VarBadge label="%1RM" value={config.percentage} unit="%" />}
        {config.load && <VarBadge label="Charge" value={config.load} unit="kg" />}
      </div>
    </div>
  );
};

// ── Fartlek Renderer ──

const FartlekDetail = ({ config }: { config: any }) => {
  if (!config) return null;

  return (
    <div className="space-y-1.5 p-2 rounded-md border bg-green-500/5 border-green-500/30">
      <SectionLabel>
        <TrendingUp className="h-3 w-3 text-green-500" />
        <span className="text-green-600 dark:text-green-400">Fartlek</span>
      </SectionLabel>
      {config.phases?.length > 0 && (
        <div className="space-y-0.5">
          {config.phases.map((phase: any, idx: number) => (
            <div key={idx} className="flex items-center gap-1.5 flex-wrap p-1 rounded bg-secondary/30">
              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                {idx + 1}
              </Badge>
              <Badge variant="secondary" className={cn(
                "text-[10px] px-1.5 py-0",
                phase.type === "effort" ? "bg-green-500/20 text-green-700" : "bg-blue-500/20 text-blue-700"
              )}>
                {phase.type === "effort" ? "Effort" : "Récup"}
              </Badge>
              {phase.durationSeconds && <VarBadge label="Durée" value={formatTime(phase.durationSeconds)} />}
              {phase.distanceMeters && <VarBadge label="Dist" value={`${phase.distanceMeters}m`} />}
              {phase.intensityLabel && (
                <span className="text-[10px] text-muted-foreground">{phase.intensityLabel}</span>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1.5 flex-wrap">
        {config.repetitions && <VarBadge label="Répétitions" value={config.repetitions} />}
        {config.totalDurationMinutes && <VarBadge label="Durée totale" value={`${config.totalDurationMinutes} min`} />}
      </div>
    </div>
  );
};

// ── Coach Precision Note ──

const CoachPrecisionNote = ({ note }: { note: string }) => {
  if (!note?.trim()) return null;

  return (
    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        <MessageSquare className="h-3 w-3 text-amber-600 dark:text-amber-400 flex-shrink-0" />
        <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">
          Précisions du coach
        </span>
      </div>
      <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
        {note}
      </p>
    </div>
  );
};

// ── Auto-generated Athlete Note ──

const AthleteAutoNote = ({ note }: { note: string }) => {
  if (!note?.trim()) return null;

  return (
    <Collapsible defaultOpen>
      <div className="rounded-lg border border-blue-500/20 bg-blue-500/5">
        <CollapsibleTrigger className="w-full flex items-center gap-1.5 p-2.5 hover:bg-blue-500/10 transition-colors rounded-t-lg">
          <FileText className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">
            Note pour l'athlète
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-blue-500 ml-auto transition-transform group-data-[state=closed]:rotate-[-90deg]" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-2.5 pb-2.5">
            <pre className="text-xs text-foreground whitespace-pre-wrap font-sans leading-relaxed">
              {note}
            </pre>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

// ── Main Export ──

interface MethodDetailRendererProps {
  exercise: any;
  /** Show the auto-generated athlete note */
  showAthleteNote?: boolean;
  /** Compact mode for tighter layouts */
  compact?: boolean;
}

/**
 * Renders the full method-specific detail for any exercise.
 * Covers: Drop Set, Rest-Pause, Cluster, CrossFit configs,
 * Intermittent Cardio, Fartlek, Stato-Dynamique, Variable Sets,
 * coach precision, and auto-generated athlete notes.
 */
export const MethodDetailRenderer: React.FC<MethodDetailRendererProps> = ({
  exercise,
  showAthleteNote = true,
  compact = false,
}) => {
  const style = exercise.trainingStyle || "normal";
  const isNormal = style === "normal";
  const styleConfig = getTrainingStyleConfig(style);

  // Determine what method-specific content to show
  const hasDropSet = style === "drop_set" && exercise.dropSetSeries?.length > 0;
  const hasRestPause = style === "rest_pause" && exercise.restPauseConfig?.series?.length > 0;
  const hasCluster = style === "cluster" && exercise.clusterConfig;
  const hasCrossFitConfig = ["emom", "amrap", "for_time", "death_by", "tabata", "circuit"].includes(style) &&
    (exercise.emomConfig || exercise.tabataConfig || exercise.deathByConfig || exercise.timeCap || exercise.totalMinutes || exercise.methodExercises?.length);
  const hasIntermittent = style === "intermittent_cardio" && exercise.intermittentCardioConfig;
  const hasFartlek = style === "fartlek" && exercise.fartlekConfig;
  const hasStatoDynamique = style === "stato_dynamique" && exercise.statoDynamiqueConfig;
  const hasVariableSets = exercise.variableSets?.length > 0 && exercise.useVariableSeries !== false;
  const hasCoachPrecision = !!exercise.coachPrecision?.trim();
  
  // Generate athlete note — prefer customAthleteNote if coach has set one
  let athleteNote = "";
  if (showAthleteNote && !isNormal) {
    // First check for coach's custom note (stored in session_data)
    const customNote = exercise.customAthleteNote || exercise.custom_athlete_note || "";
    if (customNote.trim()) {
      athleteNote = customNote;
    } else {
      try {
        athleteNote = generateMethodNote({
          methodType: style,
          exerciseName: exercise.exerciseName || exercise.name,
          series: exercise.dropSetSeries,
          visibleVariables: exercise.visibleVariables || [],
          setsCount: exercise.sets,
          timeCap: exercise.timeCap,
          totalMinutes: exercise.totalMinutes,
          repsPerRound: exercise.repsPerRound,
          tabataConfig: exercise.tabataConfig,
          emomConfig: exercise.emomConfig,
          deathByConfig: exercise.deathByConfig,
          methodExercises: exercise.methodExercises,
          restPauseConfig: exercise.restPauseConfig,
          clusterConfig: exercise.clusterConfig,
          fartlekConfig: exercise.fartlekConfig,
          statoDynamiqueConfig: exercise.statoDynamiqueConfig,
          intermittentCardioConfig: exercise.intermittentCardioConfig,
          circuitRecovery: exercise.circuitRecovery,
        });
      } catch {
        // Silently fail note generation
      }
    }
  }

  const hasAnyContent = hasDropSet || hasRestPause || hasCluster || hasCrossFitConfig ||
    hasIntermittent || hasFartlek || hasStatoDynamique || hasVariableSets ||
    hasCoachPrecision || athleteNote;

  if (!hasAnyContent) return null;

  return (
    <div className={cn("space-y-2", compact ? "mt-1.5" : "mt-2")}>
      {/* Method-specific structures */}
      {hasDropSet && <DropSetDetail exercise={exercise} />}
      {hasRestPause && <RestPauseDetail config={exercise.restPauseConfig} />}
      {hasCluster && <ClusterDetail config={exercise.clusterConfig} />}
      {hasCrossFitConfig && <CrossFitConfigDetail exercise={exercise} />}
      {hasIntermittent && <IntermittentCardioDetail config={exercise.intermittentCardioConfig} />}
      {hasFartlek && <FartlekDetail config={exercise.fartlekConfig} />}
      {hasStatoDynamique && <StatoDynamiqueDetail config={exercise.statoDynamiqueConfig} />}
      
      {/* Variable sets detail */}
      {hasVariableSets && <VariableSetsDetail sets={exercise.variableSets} />}

      {/* Coach precision */}
      {hasCoachPrecision && <CoachPrecisionNote note={exercise.coachPrecision} />}

      {/* Auto-generated athlete note */}
      {athleteNote && <AthleteAutoNote note={athleteNote} />}
    </div>
  );
};

export default MethodDetailRenderer;
