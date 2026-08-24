import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addDays, addWeeks, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Copy, Loader2 } from "lucide-react";
import { useSessionNotifications } from "@/lib/hooks/useSessionNotifications";
import { useTranslation } from "react-i18next";

const MAX_DUPLICATED_SESSIONS = 80;
const DB_TIMEOUT_MS = 25_000;
const SESSION_INSERT_CHUNK_SIZE = 25;
const CHILD_INSERT_CHUNK_SIZE = 300;

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

async function withTimeout<T>(promise: PromiseLike<T>, label: string, timeoutMs = DB_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${label} prend trop de temps. Réessaie avec moins de récurrences.`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function runWithConcurrency<T>(items: T[], concurrency: number, task: (item: T) => Promise<void>) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) continue;
      await task(item);
    }
  });
  await Promise.all(workers);
}

interface Session {
  id: string;
  session_date: string;
  session_start_time: string | null;
  session_end_time: string | null;
  training_type: string;
  notes: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  session: Session | null;
  categoryId: string;
}

const WEEKDAYS = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mer" },
  { value: 4, label: "Jeu" },
  { value: 5, label: "Ven" },
  { value: 6, label: "Sam" },
  { value: 0, label: "Dim" },
];

export function DuplicateSessionDialog({ open, onOpenChange, session, categoryId }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { notify } = useSessionNotifications();
  const [mode, setMode] = useState<"single" | "recurring">("single");
  const [targetDate, setTargetDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [occurrences, setOccurrences] = useState(4);
  const [weekdays, setWeekdays] = useState<number[]>([]);

  useEffect(() => {
    if (!open || !session) return;
    // Reset any stale mutation state from a previous run
    duplicateMutation.reset();
    // Default: next day, same times
    const base = parseISO(session.session_date);
    const next = addDays(base, 1);
    setTargetDate(format(next, "yyyy-MM-dd"));
    setStartTime(session.session_start_time?.slice(0, 5) || "");
    setEndTime(session.session_end_time?.slice(0, 5) || "");
    setMode("single");
    setOccurrences(4);
    setWeekdays([next.getDay()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, session]);

  const targetDates = useMemo(() => {
    if (!targetDate) return [] as string[];
    if (mode === "single") return [targetDate];
    if (weekdays.length === 0) return [];
    const start = parseISO(targetDate);
    const dates: string[] = [];
    for (let w = 0; w < occurrences; w++) {
      const weekStart = addWeeks(start, w);
      for (const wd of weekdays) {
        // Compute offset from weekStart (which is aligned on the picked date's weekday)
        // We instead iterate the 7 days of that week starting from weekStart
        for (let d = 0; d < 7; d++) {
          const candidate = addDays(weekStart, d);
          if (candidate.getDay() === wd && candidate >= start) {
            dates.push(format(candidate, "yyyy-MM-dd"));
            break;
          }
        }
      }
    }
    // Deduplicate & sort
    return Array.from(new Set(dates)).sort();
  }, [targetDate, mode, occurrences, weekdays]);

  const duplicateMutation = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error(t("planning.calendarDialogs.duplicateSession.toasts.sessionMissing"));
      if (targetDates.length === 0) throw new Error(t("planning.calendarDialogs.duplicateSession.toasts.noDateSelected"));
      if (targetDates.length > MAX_DUPLICATED_SESSIONS) {
        throw new Error(t("planning.calendarDialogs.duplicateSession.toasts.recurrenceLimit", { max: MAX_DUPLICATED_SESSIONS }));
      }

      // 1) Load source session, blocks and participants once
      const { data: src, error: srcErr } = await withTimeout(
        supabase
          .from("training_sessions")
          .select("*")
          .eq("id", session.id)
          .single(),
        t("planning.calendarDialogs.duplicateSession.toasts.loadingSource")
      );
      if (srcErr) throw srcErr;

      const [{ data: blocks, error: blocksErr }, { data: parts, error: partsErr }, { data: cat }] = await Promise.all([
        withTimeout(
          supabase
            .from("training_session_blocks")
            .select("*")
            .eq("training_session_id", session.id)
            .order("block_order"),
          t("planning.calendarDialogs.duplicateSession.toasts.loadingBlocks")
        ),
        withTimeout(
          supabase
            .from("event_participants")
            .select("player_id")
            .eq("training_session_id", session.id),
          t("planning.calendarDialogs.duplicateSession.toasts.loadingParticipants")
        ),
        withTimeout(
          supabase
            .from("categories")
            .select("club_id")
            .eq("id", categoryId)
            .maybeSingle(),
          t("planning.calendarDialogs.duplicateSession.toasts.loadingCategory")
        ),
      ]);
      if (blocksErr) throw blocksErr;
      if (partsErr) throw partsErr;

      const participantIds = Array.from(
        new Set((parts ?? []).map((p: any) => p.player_id).filter(Boolean))
      );

      const excluded = new Set([
        "id",
        "created_at",
        "updated_at",
        "created_by",
        "created_by_player_id",
        "session_date",
        "session_start_time",
        "session_end_time",
      ]);
      const basePayload: Record<string, any> = {};
      for (const [k, v] of Object.entries(src as Record<string, any>)) {
        if (!excluded.has(k)) basePayload[k] = v;
      }
      basePayload.category_id = categoryId;

      // 1) Insert sessions by chunks to avoid a huge request on long recurrences
      const sessionPayloads = targetDates.map((d) => ({
        ...basePayload,
        session_date: d,
        session_start_time: startTime || null,
        session_end_time: endTime || null,
      }));
      const newSessions: { id: string; session_date: string }[] = [];
      for (const payloadChunk of chunkArray(sessionPayloads, SESSION_INSERT_CHUNK_SIZE)) {
        const { data, error } = await withTimeout(
          supabase
            .from("training_sessions")
            .insert(payloadChunk as any)
            .select("id, session_date"),
          t("planning.calendarDialogs.duplicateSession.toasts.creatingSessions")
        );
        if (error) throw error;
        if (data) newSessions.push(...data);
      }
      if (!newSessions || newSessions.length === 0) throw new Error(t("planning.calendarDialogs.duplicateSession.toasts.noSessionCreated"));

      // 2) Bulk insert blocks & participants in parallel (single insert each)
      const allBlockRows: any[] = [];
      const allPartRows: any[] = [];
      for (const ns of newSessions) {
        if (blocks && blocks.length > 0) {
          for (const b of blocks as any[]) {
            const { id, created_at, updated_at, training_session_id, ...rest } = b;
            allBlockRows.push({ ...rest, training_session_id: ns.id });
          }
        }
        if (participantIds.length > 0) {
          for (const playerId of participantIds) {
            allPartRows.push({ training_session_id: ns.id, player_id: playerId });
          }
        }
      }

      for (const blockChunk of chunkArray(allBlockRows, CHILD_INSERT_CHUNK_SIZE)) {
        const { error } = await withTimeout(
          supabase.from("training_session_blocks").insert(blockChunk),
          t("planning.calendarDialogs.duplicateSession.toasts.duplicatingBlocks")
        );
        if (error) throw error;
      }
      for (const participantChunk of chunkArray(allPartRows, CHILD_INSERT_CHUNK_SIZE)) {
        const { error } = await withTimeout(
          supabase.from("event_participants").insert(participantChunk),
          t("planning.calendarDialogs.duplicateSession.toasts.duplicatingParticipants")
        );
        if (error) throw error;
      }

      // 3) Fire-and-forget notifications with limited concurrency (don't block UI)
      if (participantIds.length > 0) {
        const sessionType = (src as any).training_type;
        window.setTimeout(() => {
          runWithConcurrency(newSessions, 2, (ns) =>
            notify({
              action: "created",
              sessionId: ns.id,
              categoryId,
              clubId: (cat as any)?.club_id,
              sessionDate: ns.session_date,
              sessionStartTime: startTime || null,
              sessionType,
              participantPlayerIds: participantIds,
            }).catch((e) => console.error("[Duplicate] notify failed", e))
          ).catch((e) => console.error("[Duplicate] notification queue failed", e));
        }, 0);
      }

      return newSessions.length;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ["training_sessions", categoryId] });
      qc.invalidateQueries({ queryKey: ["sessions", categoryId] });
      qc.invalidateQueries({ queryKey: ["today_sessions", categoryId] });
      toast.success(
        count > 1
          ? t("planning.calendarDialogs.duplicateSession.toasts.multipleDuplicated", { count })
          : t("planning.calendarDialogs.duplicateSession.toasts.singleDuplicated"),
      );
      onOpenChange(false);
    },
    onError: (e: any) => {
      toast.error(e?.message || t("planning.calendarDialogs.duplicateSession.toasts.duplicateError"));
    },
  });

  const toggleWeekday = (v: number) => {
    setWeekdays((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  };

  const handleSubmit = () => {
    if (duplicateMutation.isPending) return;
    if (targetDates.length === 0) {
      toast.error(t("planning.calendarDialogs.duplicateSession.toasts.selectAtLeastOneDate"));
      return;
    }
    if (targetDates.length > MAX_DUPLICATED_SESSIONS) {
      toast.error(t("planning.calendarDialogs.duplicateSession.toasts.maxLimitReached", { max: MAX_DUPLICATED_SESSIONS }));
      return;
    }
    duplicateMutation.mutate();
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) duplicateMutation.reset();
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">

        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" /> {t("planning.calendarDialogs.duplicateSession.title")}
          </DialogTitle>
          <DialogDescription>
            {t("planning.calendarDialogs.duplicateSession.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>{t("planning.calendarDialogs.duplicateSession.date")}</Label>
              <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
            </div>
            <div>
              <Label>{t("planning.calendarDialogs.duplicateSession.start")}</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <Label>{t("planning.calendarDialogs.duplicateSession.end")}</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>{t("planning.calendarDialogs.duplicateSession.recurrence")}</Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as any)} className="mt-2 flex gap-4">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="single" id="dup-single" />
                <Label htmlFor="dup-single" className="cursor-pointer">{t("planning.calendarDialogs.duplicateSession.once")}</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="recurring" id="dup-recurring" />
                <Label htmlFor="dup-recurring" className="cursor-pointer">{t("planning.calendarDialogs.duplicateSession.recurring")}</Label>
              </div>
            </RadioGroup>
          </div>

          {mode === "recurring" && (
            <div className="space-y-3 rounded-lg border p-3 bg-muted/30">
              <div>
                <Label className="text-xs">{t("planning.calendarDialogs.duplicateSession.weekdaysLabel")}</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {WEEKDAYS.map((w) => (
                    <button
                      key={w.value}
                      type="button"
                      onClick={() => toggleWeekday(w.value)}
                      className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                        weekdays.includes(w.value)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background hover:bg-muted"
                      }`}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="dup-occ" className="text-xs">{t("planning.calendarDialogs.duplicateSession.weeksCount")}</Label>
                <Input
                  id="dup-occ"
                  type="number"
                  min={1}
                  max={52}
                  value={occurrences}
                  onChange={(e) => setOccurrences(Math.max(1, Math.min(52, Number(e.target.value) || 1)))}
                  className="mt-1 w-32"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t("planning.calendarDialogs.duplicateSession.sessionsToCreate")}</span>
            <Badge variant="secondary">{targetDates.length}</Badge>
          </div>
          {targetDates.length > 0 && (
            <div className="max-h-32 overflow-y-auto text-xs text-muted-foreground border rounded p-2">
              {targetDates.map((d) => (
                <div key={d}>• {format(parseISO(d), "EEEE d MMMM yyyy", { locale: fr })}</div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("planning.calendarDialogs.duplicateSession.cancel")}</Button>
          <Button onClick={handleSubmit}>
            {duplicateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("planning.calendarDialogs.duplicateSession.duplicate")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
