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
import { Copy, Loader2 } from "lucide-react";
import { useSessionNotifications } from "@/lib/hooks/useSessionNotifications";

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
  const qc = useQueryClient();
  const [mode, setMode] = useState<"single" | "recurring">("single");
  const [targetDate, setTargetDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [occurrences, setOccurrences] = useState(4);
  const [weekdays, setWeekdays] = useState<number[]>([]);

  useEffect(() => {
    if (!open || !session) return;
    // Default: next day, same times
    const base = parseISO(session.session_date);
    const next = addDays(base, 1);
    setTargetDate(format(next, "yyyy-MM-dd"));
    setStartTime(session.session_start_time?.slice(0, 5) || "");
    setEndTime(session.session_end_time?.slice(0, 5) || "");
    setMode("single");
    setOccurrences(4);
    setWeekdays([next.getDay()]);
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
      if (!session) throw new Error("Séance manquante");
      if (targetDates.length === 0) throw new Error("Aucune date sélectionnée");

      // 1) Load source session, blocks and participants once
      const { data: src, error: srcErr } = await supabase
        .from("training_sessions")
        .select("*")
        .eq("id", session.id)
        .single();
      if (srcErr) throw srcErr;

      const { data: blocks } = await supabase
        .from("training_session_blocks")
        .select("*")
        .eq("training_session_id", session.id)
        .order("block_order");

      const { data: parts } = await supabase
        .from("event_participants")
        .select("player_id")
        .eq("training_session_id", session.id);

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

      let created = 0;
      for (const d of targetDates) {
        const payload = {
          ...basePayload,
          session_date: d,
          session_start_time: startTime || null,
          session_end_time: endTime || null,
        };
        const { data: newSession, error: insErr } = await supabase
          .from("training_sessions")
          .insert(payload as any)
          .select("id")
          .single();
        if (insErr) throw insErr;
        const newId = newSession.id;

        if (blocks && blocks.length > 0) {
          const blockRows = blocks.map((b: any) => {
            const { id, created_at, updated_at, training_session_id, ...rest } = b;
            return { ...rest, training_session_id: newId };
          });
          const { error: bErr } = await supabase
            .from("training_session_blocks")
            .insert(blockRows);
          if (bErr) throw bErr;
        }

        if (parts && parts.length > 0) {
          const partRows = parts.map((p: any) => ({
            training_session_id: newId,
            player_id: p.player_id,
          }));
          const { error: pErr } = await supabase
            .from("event_participants")
            .insert(partRows);
          if (pErr) console.error(pErr);
        }
        created++;
      }
      return created;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ["training_sessions", categoryId] });
      qc.invalidateQueries({ queryKey: ["sessions", categoryId] });
      qc.invalidateQueries({ queryKey: ["today_sessions", categoryId] });
      toast.success(
        count > 1
          ? `${count} séances dupliquées ✅`
          : "Séance dupliquée ✅",
      );
      onOpenChange(false);
    },
    onError: (e: any) => {
      toast.error(e?.message || "Erreur lors de la duplication");
    },
  });

  const toggleWeekday = (v: number) => {
    setWeekdays((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  };

  const canSubmit = targetDates.length > 0 && !duplicateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" /> Dupliquer la séance
          </DialogTitle>
          <DialogDescription>
            Recrée la séance (blocs + athlètes) à une nouvelle date, avec une récurrence optionnelle.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>Date</Label>
              <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
            </div>
            <div>
              <Label>Début</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <Label>Fin</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Récurrence</Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as any)} className="mt-2 flex gap-4">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="single" id="dup-single" />
                <Label htmlFor="dup-single" className="cursor-pointer">Une seule fois</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="recurring" id="dup-recurring" />
                <Label htmlFor="dup-recurring" className="cursor-pointer">Récurrente</Label>
              </div>
            </RadioGroup>
          </div>

          {mode === "recurring" && (
            <div className="space-y-3 rounded-lg border p-3 bg-muted/30">
              <div>
                <Label className="text-xs">Jours de la semaine</Label>
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
                <Label htmlFor="dup-occ" className="text-xs">Nombre de semaines</Label>
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
            <span className="text-muted-foreground">Séances qui seront créées</span>
            <Badge variant="secondary">{targetDates.length}</Badge>
          </div>
          {targetDates.length > 0 && (
            <div className="max-h-32 overflow-y-auto text-xs text-muted-foreground border rounded p-2">
              {targetDates.map((d) => (
                <div key={d}>• {format(parseISO(d), "EEEE d MMMM yyyy")}</div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={() => duplicateMutation.mutate()} disabled={!canSubmit}>
            {duplicateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Dupliquer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
