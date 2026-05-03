import { useState, useEffect, useRef, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  TARGET_INTENSITIES,
  VOLUME_OPTIONS,
} from "@/lib/constants/sessionBlockOptions";
import { SessionEditorSheet } from "./SessionEditorSheet";
import { SessionDayEditor, type SessionDayEditorHandle } from "./SessionDayEditor";
import { V2ExerciseBankSidebar, type PickedExerciseRich } from "./V2ExerciseBankSidebar";
import type { V2BlockExercise, V2BlockWithExercises } from "./hooks/useSaveProgramV2";

interface SessionEditorV2Props {
  open: boolean;
  onClose: () => void;
  categoryId: string;
  defaultDate?: string;
  editSession?: {
    id: string;
    session_date: string;
    session_start_time: string | null;
    session_end_time: string | null;
    training_type: string;
    intensity?: number | null;
    planned_intensity?: number | null;
    notes?: string | null;
  } | null;
}

const SESSION_KIND_OPTIONS = [
  { value: "musculation", label: "Musculation" },
  { value: "course", label: "Course" },
  { value: "fractionne", label: "Fractionné" },
  { value: "endurance", label: "Endurance" },
  { value: "vitesse", label: "Vitesse" },
  { value: "puissance", label: "Puissance" },
  { value: "mobilite", label: "Mobilité" },
  { value: "recuperation", label: "Récupération" },
  { value: "cardio", label: "Cardio" },
  { value: "crossfit", label: "CrossFit" },
] as const;

const SESSION_THEME_LABEL: Record<string, string> = SESSION_KIND_OPTIONS.reduce(
  (acc, o) => ({ ...acc, [o.value]: o.label }),
  {} as Record<string, string>,
);

const todayIso = () => format(new Date(), "yyyy-MM-dd");

/**
 * V2 session editor — single-session creation with the new block + method UX.
 * Mirrors the program builder V2 experience but persists directly into
 * `training_sessions` + `gym_session_exercises` for one team-wide session.
 */
export function SessionEditorV2({ open, onClose, categoryId, defaultDate, editSession }: SessionEditorV2Props) {
  const queryClient = useQueryClient();

  const [weekNumber] = useState(1);
  const [dayName, setDayName] = useState("Séance 1");
  const [dayOfWeek, setDayOfWeek] = useState<string>("");
  const [sessionDate, setSessionDate] = useState<string>(todayIso());
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  const [sessionKind, setSessionKind] = useState<string>("musculation");
  const [targetIntensity, setTargetIntensity] = useState<string>("moderee");
  const [volume, setVolume] = useState<string>("moyen");
  const [plannedRpe, setPlannedRpe] = useState<number>(6);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [blocks, setBlocks] = useState<V2BlockWithExercises[]>([]);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const activeBlockIdRef = useRef<string | null>(null);
  const dayEditorRef = useRef<SessionDayEditorHandle | null>(null);
  const isEditing = !!editSession;

  // Fetch players for participant selection
  const { data: categoryPlayers } = useQuery({
    queryKey: ["players-list", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, name, first_name")
        .eq("category_id", categoryId)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!categoryId,
  });

  const { data: existingExercises } = useQuery({
    queryKey: ["v2-session-exercises", editSession?.id],
    queryFn: async () => {
      if (!editSession?.id) return [];
      const { data, error } = await supabase
        .from("gym_session_exercises")
        .select("id, exercise_name, library_exercise_id, sets, reps, rest_seconds, tempo, percentage_1rm, method, notes, group_id, group_order, order_index")
        .eq("training_session_id", editSession.id)
        .order("order_index", { ascending: true })
        .order("group_order", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!editSession?.id,
  });

  const { data: existingParticipants } = useQuery({
    queryKey: ["v2-session-participants", editSession?.id],
    queryFn: async () => {
      if (!editSession?.id) return [] as string[];
      const { data, error } = await supabase
        .from("event_participants")
        .select("player_id")
        .eq("training_session_id", editSession.id);
      if (error) throw error;
      return (data || []).map((row) => row.player_id);
    },
    enabled: open && !!editSession?.id,
  });

  const parsedExistingBlocks = useMemo<V2BlockWithExercises[]>(() => {
    if (!existingExercises?.length) return [];

    // Dedupe: same session has 1 row per (player × exercise). Keep one logical
    // exercise per (block, group_id, group_order, order_index, exercise_name).
    const seen = new Set<string>();
    const dedupedExercises = existingExercises.filter((ex) => {
      const key = `${ex.notes || ""}::${ex.group_id || "single"}::${ex.group_order ?? "_"}::${ex.order_index ?? "_"}::${ex.exercise_name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const blocksMap = new Map<string, V2BlockWithExercises>();
    const groupedIndexes = new Map<string, number>();

    dedupedExercises.forEach((ex, idx) => {
      const rawNotes = ex.notes || "";
      const blockMatch = rawNotes.match(/<!--\s*v2-block:([^:]+):([^>]+?)\s*-->/);
      const blockType = (blockMatch?.[1]?.trim() || "musculation") as V2BlockWithExercises["type"];
      const blockName = blockMatch?.[2]?.trim() || "Bloc";
      const blockKey = `${blockType}::${blockName}`;

      if (!blocksMap.has(blockKey)) {
        blocksMap.set(blockKey, {
          id: `block-${idx}-${Math.random().toString(36).slice(2, 7)}`,
          type: blockType,
          name: blockName,
          isOpen: true,
          exercises: [],
        });
      }

      const block = blocksMap.get(blockKey)!;
      const cleanNotes = rawNotes
        .replace(/<!--\s*v2-block:[^>]+-->/g, "")
        .replace(/<!--\s*v2-test:[^>]+-->/g, "")
        .trim();
      const groupId = ex.group_id || undefined;
      const groupKey = `${blockKey}::${groupId || "single"}`;
      const groupOrder = groupId ? (groupedIndexes.get(groupKey) ?? 0) : undefined;
      if (groupId) groupedIndexes.set(groupKey, (groupOrder ?? 0) + 1);

      block.exercises!.push({
        id: ex.id,
        exerciseId: ex.library_exercise_id || undefined,
        exerciseName: ex.exercise_name,
        sets: ex.sets ?? 3,
        reps: ex.reps != null ? String(ex.reps) : "10",
        percentage: ex.percentage_1rm ?? undefined,
        tempo: ex.tempo ?? undefined,
        restSeconds: ex.rest_seconds ?? 90,
        method: ex.method ?? "normal",
        groupId,
        notes: cleanNotes || undefined,
        ...(typeof groupOrder === "number" ? { groupOrder } : {}),
      } as any);
    });

    return Array.from(blocksMap.values());
  }, [existingExercises]);

  const setActiveBlock = (id: string | null) => {
    activeBlockIdRef.current = id;
    setActiveBlockId(id);
  };
  const activeBlockType = blocks.find((b) => b.id === activeBlockId)?.type ?? null;

  // Reset state every time the editor is reopened
  useEffect(() => {
    if (!open) return;

    if (editSession) {
      const metaMatch = editSession.notes?.match(/<!--v2-meta:(.*?)-->/);
      let meta: any = null;
      if (metaMatch) {
        try {
          meta = JSON.parse(metaMatch[1]);
        } catch {
          meta = null;
        }
      }

      setDayName(meta?.dayName || "Séance 1");
      setDayOfWeek(meta?.dayOfWeek || "");
      setSessionDate(editSession.session_date || defaultDate || todayIso());
      setStartTime(editSession.session_start_time || "");
      setEndTime(editSession.session_end_time || "");
      setSessionKind(editSession.training_type || "musculation");
      setTargetIntensity("moderee");
      setVolume("moyen");
      setPlannedRpe(editSession.planned_intensity || editSession.intensity || 6);
      setSavedSnapshot(null);
      setActiveBlock(null);
      return;
    }

    setDayName("Séance 1");
    setDayOfWeek("");
    setSessionDate(defaultDate || todayIso());
    setStartTime("");
    setEndTime("");
    setSessionKind("musculation");
    setTargetIntensity("moderee");
    setVolume("moyen");
    setPlannedRpe(6);
    setSelectedPlayers([]);
    setBlocks([]);
    setSavedSnapshot(null);
    setActiveBlock(null);
  }, [open, editSession, defaultDate]);

  useEffect(() => {
    if (!open || !editSession) return;
    setBlocks(parsedExistingBlocks);
  }, [open, editSession, parsedExistingBlocks]);

  useEffect(() => {
    if (!open || !editSession) return;
    setSelectedPlayers(existingParticipants || []);
  }, [open, editSession, existingParticipants]);

  // Keep activeBlock synced when blocks change externally
  useEffect(() => {
    if (!blocks.length) {
      setActiveBlock(null);
      return;
    }
    if (!activeBlockIdRef.current || !blocks.find((b) => b.id === activeBlockIdRef.current)) {
      setActiveBlock(blocks[blocks.length - 1].id);
    }
  }, [blocks]);

  const handlePickFromBank = (picked: PickedExerciseRich) => {
    const targetId = activeBlockIdRef.current ?? blocks[blocks.length - 1]?.id;
    if (!targetId) {
      toast.error("Ajoute d'abord un bloc de travail à gauche.");
      return;
    }
    // Délègue à SessionDayEditor : si une méthode liée (Biset/Superset/...) est en
    // cours d'édition sur ce bloc, l'exercice ira dans le prochain slot vide.
    // Sinon il sera ajouté comme exercice normal au bloc.
    const handle = dayEditorRef.current;
    if (handle) {
      const isLinked = handle.hasActiveLinkedDraft(targetId);
      handle.insertExternalExercise(targetId, { id: picked.id, name: picked.exercise_name });
      setActiveBlock(targetId);
      toast.success(
        isLinked
          ? `« ${picked.exercise_name} » ajouté au slot`
          : `« ${picked.exercise_name} » ajouté`,
      );
      return;
    }
    // Fallback (should not happen) : insertion directe en exercice normal
    const newExercise: V2BlockExercise = {
      id: `ex-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      exerciseId: picked.id,
      exerciseName: picked.exercise_name,
      sets: 3,
      reps: "10",
      restSeconds: 90,
      method: "normal",
    };
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === targetId
          ? { ...b, exercises: [...(b.exercises ?? []), newExercise], isOpen: true }
          : b,
      ),
    );
    setActiveBlock(targetId);
    toast.success(`« ${picked.exercise_name} » ajouté`);
  };

  const handleBlocksChange = (next: V2BlockWithExercises[]) => {
    if (next.length > blocks.length) {
      setActiveBlock(next[next.length - 1].id);
    }
    setBlocks(next);
  };

  // Drag & Drop : capteur souris/touch avec petite distance d'activation pour ne pas
  // entrer en conflit avec les clics et les boutons d'action de la sidebar.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const data = active.data.current as
      | { type?: string; exercise?: PickedExerciseRich }
      | undefined;
    if (data?.type !== "library-exercise" || !data.exercise) return;

    const overData = over.data.current as
      | { type?: string; slotIndex?: number }
      | undefined;
    const overId = String(over.id);
    const handle = dayEditorRef.current;
    if (!handle) return;

    // 1) Drop sur un slot lié (Biset/Superset/Triset/Giant Set/Bulgarian/Combiné Haltéro)
    //    ID format : `linked-slot-${blockId}-${slotIndex}`
    if (overData?.type === "linked-slot" && typeof overData.slotIndex === "number") {
      // Récupère le blockId à partir de l'ID du slot
      const m = overId.match(/^linked-slot-(.+)-(\d+)$/);
      const blockId = m?.[1] ?? activeBlockIdRef.current;
      if (!blockId) return;
      handle.insertExternalExerciseAtSlot(blockId, overData.slotIndex, {
        id: data.exercise.id,
        name: data.exercise.exercise_name,
      });
      setActiveBlock(blockId);
      toast.success(`« ${data.exercise.exercise_name} » ajouté au slot`);
      return;
    }

    // 2) Drop sur un bloc (zone "drop-${blockId}")
    if (overId.startsWith("drop-")) {
      const blockId = overId.replace(/^drop-/, "");
      handle.insertExternalExercise(blockId, {
        id: data.exercise.id,
        name: data.exercise.exercise_name,
      });
      setActiveBlock(blockId);
      toast.success(`« ${data.exercise.exercise_name} » ajouté`);
      return;
    }

    // 3) Fallback : on tente le bloc actif
    const fallbackId = activeBlockIdRef.current ?? blocks[blocks.length - 1]?.id;
    if (fallbackId) {
      handle.insertExternalExercise(fallbackId, {
        id: data.exercise.id,
        name: data.exercise.exercise_name,
      });
      toast.success(`« ${data.exercise.exercise_name} » ajouté`);
    }
  };

  const currentSnapshot = JSON.stringify({ dayName, dayOfWeek, sessionDate, startTime, endTime, sessionKind, targetIntensity, volume, plannedRpe, selectedPlayers, blocks });
  const isSavedUpToDate = savedSnapshot !== null && savedSnapshot === currentSnapshot;

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Flatten blocks → ordered exercises with hidden block context in notes
      const flat = blocks.flatMap((b) =>
        (b.exercises ?? []).map((ex) => ({ block: b, ex })),
      );

      if (!sessionDate) throw new Error("Choisis une date pour la séance.");

      // 1. Determine target athletes
      let targetPlayers: { id: string }[];
      if (selectedPlayers.length > 0) {
        // Use exactly the selected players (works across multi-category)
        targetPlayers = selectedPlayers.map((id) => ({ id }));
      } else {
        const { data: allPlayers, error: pErr } = await supabase
          .from("players")
          .select("id")
          .eq("category_id", categoryId);
        if (pErr) throw pErr;
        if (!allPlayers || allPlayers.length === 0) {
          throw new Error("Aucun athlète dans cette catégorie.");
        }
        targetPlayers = allPlayers;
      }

      // 2. Create or update the training session shell
      const sessionMeta = JSON.stringify({
        v2: true,
        dayName,
        dayOfWeek: dayOfWeek || null,
        weekNumber,
      });
      let sessionId = editSession?.id;

      if (editSession?.id) {
        const { error: updateErr } = await supabase
          .from("training_sessions")
          .update({
            session_date: sessionDate,
            session_start_time: startTime || null,
            session_end_time: endTime || null,
            training_type: sessionKind,
            intensity: plannedRpe ? Math.max(1, Math.min(10, plannedRpe)) : 1,
            planned_intensity: plannedRpe || null,
            notes: `<!--v2-meta:${sessionMeta}-->${dayName}`,
          })
          .eq("id", editSession.id);
        if (updateErr) throw updateErr;

        await supabase.from("event_participants").delete().eq("training_session_id", editSession.id);
        await supabase.from("training_session_blocks").delete().eq("training_session_id", editSession.id);
        await supabase.from("gym_session_exercises").delete().eq("training_session_id", editSession.id);
      } else {
        const { data: session, error: sErr } = await supabase
          .from("training_sessions")
          .insert({
            category_id: categoryId,
            session_date: sessionDate,
            session_start_time: startTime || null,
            session_end_time: endTime || null,
            training_type: sessionKind,
            intensity: plannedRpe ? Math.max(1, Math.min(10, plannedRpe)) : 1,
            planned_intensity: plannedRpe || null,
            notes: `<!--v2-meta:${sessionMeta}-->${dayName}`,
          })
          .select("id")
          .single();
        if (sErr) throw sErr;
        sessionId = session.id;
      }

      if (!sessionId) throw new Error("Impossible d'identifier la séance.");

      // 2b. If specific participants selected, persist them in event_participants
      if (selectedPlayers.length > 0) {
        const { error: epErr } = await supabase
          .from("event_participants")
          .insert(
            selectedPlayers.map((pid) => ({
              training_session_id: sessionId,
              player_id: pid,
            })),
          );
        if (epErr) console.error("[SessionEditorV2] event_participants insert failed", epErr);
      }

      // 2c. Insert a training_session_blocks row to feed Workload "Répartition".
      try {
        const dur =
          startTime && endTime
            ? Math.max(
                0,
                Math.round(
                  (new Date(`1970-01-01T${endTime}:00`).getTime() -
                    new Date(`1970-01-01T${startTime}:00`).getTime()) /
                    60000,
                ),
              )
            : null;
        await supabase.from("training_session_blocks").insert({
          training_session_id: sessionId,
          block_order: 0,
          training_type: sessionKind,
          theme: SESSION_THEME_LABEL[sessionKind] || dayName || "Séance",
          duration_minutes: dur,
          intensity: plannedRpe || null,
          target_intensity: targetIntensity || null,
          volume: volume || null,
          contact_charge: "aucun",
        });
      } catch (e) {
        console.error("[SessionEditorV2] training_session_blocks insert failed", e);
      }

      // 3. Insert one gym_session_exercises row per (player × exercise),
      //    preserving block context inside `notes` via the agreed pattern.
      const rows = targetPlayers.flatMap((player) =>
        flat.map(({ block, ex }, idx) => {
          const blockTag = `<!-- v2-block:${block.type}:${block.name} -->`;
          const isTestRef = typeof ex.exerciseId === "string" && ex.exerciseId.startsWith("test:");
          const testTag = isTestRef ? `<!-- v2-test:${ex.exerciseId.slice(5)} -->` : "";
          const userNote = ex.notes ? `\n${ex.notes}` : "";
          const repsNum = ex.reps ? Number(String(ex.reps).replace(/[^0-9]/g, "")) : null;
          const groupOrder = ex.groupId
            ? Math.max(0, (block.exercises ?? []).filter((candidate: any) => candidate.groupId === ex.groupId).findIndex((candidate: any) => candidate.id === ex.id))
            : null;
          const methodValue = ex.method && ex.method !== "normal" ? ex.method : null;
          return {
            training_session_id: sessionId,
            player_id: player.id,
            category_id: categoryId,
            library_exercise_id: isTestRef ? null : (ex.exerciseId || null),
            exercise_name: ex.exerciseName,
            sets: ex.sets ?? 1,
            reps: repsNum && !Number.isNaN(repsNum) ? repsNum : null,
            rest_seconds: ex.restSeconds ?? null,
            tempo: ex.tempo ?? null,
            percentage_1rm: ex.percentage ?? null,
            order_index: idx,
            method: methodValue,
            set_type: methodValue ?? "normal",
            group_id: ex.groupId || null,
            group_order: groupOrder,
            notes: `${blockTag}${testTag}${userNote}`,
          };
        }),
      );

      if (rows.length > 0) {
        const { error: eErr } = await supabase.from("gym_session_exercises").insert(rows);
        if (eErr) throw eErr;
      }

      return sessionId;
    },
    onSuccess: () => {
      setSavedSnapshot(currentSnapshot);
      toast.success(isEditing ? "Séance mise à jour ✅" : "Séance enregistrée ✅");
      queryClient.invalidateQueries({ queryKey: ["training_sessions"] });
      queryClient.invalidateQueries({ queryKey: ["training-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: ["gym-session-exercises"] });
      queryClient.invalidateQueries({ queryKey: ["today_sessions", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["today_session_exercises"] });
      queryClient.invalidateQueries({ queryKey: ["athlete-calendar-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["athlete-calendar-exercises-v3"] });
      onClose();
    },
    onError: (e: Error) => {
      toast.error(e.message ?? "Erreur lors de l'enregistrement");
    },
  });

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <SessionEditorSheet
        open={open}
        onClose={onClose}
        weekNumber={weekNumber}
        dayName={dayName}
        dayOfWeek={dayOfWeek}
        dayId="v2-day-1"
        weekId="v2-week-1"
        onUpdateDayName={(_w, _d, name) => setDayName(name)}
        onUpdateDayOfWeek={(_w, _d, dow) => setDayOfWeek(dow)}
        onSave={() => saveMutation.mutate()}
        saving={saveMutation.isPending}
        isSavedUpToDate={isSavedUpToDate}
        renderSessionContent={() => (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-muted/40 p-3">
              <div className="space-y-1">
                <Label htmlFor="v2-session-date" className="text-xs">Date de la séance</Label>
                <Input
                  id="v2-session-date"
                  type="date"
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                  className="h-9 w-44"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="v2-session-start" className="text-xs">Heure de début</Label>
                <Input
                  id="v2-session-start"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="h-9 w-28"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="v2-session-end" className="text-xs">Heure de fin</Label>
                <Input
                  id="v2-session-end"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="h-9 w-28"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Thématique</Label>
                <Select value={sessionKind} onValueChange={setSessionKind}>
                  <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SESSION_KIND_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Intensité</Label>
                <Select value={targetIntensity} onValueChange={setTargetIntensity}>
                  <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TARGET_INTENSITIES.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Volume</Label>
                <Select value={volume} onValueChange={setVolume}>
                  <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VOLUME_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="v2-planned-rpe" className="text-xs">RPE prévu (staff)</Label>
                <Input
                  id="v2-planned-rpe"
                  type="number"
                  min={1}
                  max={10}
                  value={plannedRpe}
                  onChange={(e) => setPlannedRpe(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                  className="h-9 w-24"
                  title="RPE prévu — non visible par l'athlète, alimente RPE prévu/réel"
                />
              </div>
            </div>

            <div className="rounded-2xl border bg-muted/40 p-3">
              <div className="mb-2 flex items-center justify-between">
                <Label className="flex items-center gap-1.5 text-xs">
                  <Users className="h-3.5 w-3.5" />
                  Participants
                  <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                    {selectedPlayers.length === 0
                      ? "(toute la catégorie)"
                      : `(${selectedPlayers.length} sélectionné${selectedPlayers.length > 1 ? "s" : ""})`}
                  </span>
                </Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="text-[11px] text-primary hover:underline"
                    onClick={() => setSelectedPlayers((categoryPlayers || []).map((p) => p.id))}
                  >
                    Tout sélectionner
                  </button>
                  <button
                    type="button"
                    className="text-[11px] text-muted-foreground hover:underline"
                    onClick={() => setSelectedPlayers([])}
                  >
                    Tout désélectionner
                  </button>
                </div>
              </div>
              <ScrollArea className="h-32 pr-2">
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {(categoryPlayers || []).map((p) => {
                    const checked = selectedPlayers.includes(p.id);
                    const label = p.first_name ? `${p.first_name} ${p.name}` : p.name;
                    return (
                      <label
                        key={p.id}
                        className="flex cursor-pointer items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-xs hover:bg-accent/50"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            setSelectedPlayers((prev) =>
                              v ? [...prev, p.id] : prev.filter((id) => id !== p.id),
                            );
                          }}
                        />
                        <span className="truncate">{label}</span>
                      </label>
                    );
                  })}
                </div>
              </ScrollArea>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Si aucun athlète n'est sélectionné, la séance est créée pour toute la catégorie.
              </p>
            </div>

            <SessionDayEditor ref={dayEditorRef} blocks={blocks} onChange={handleBlocksChange} />
          </div>
        )}
        renderExerciseLibrary={() => (
          <V2ExerciseBankSidebar
            onClickInsert={handlePickFromBank}
            mode={activeBlockType === "tests" ? "tests" : "exercises"}
            categoryId={categoryId}
          />
        )}
      />
    </DndContext>
  );
}
