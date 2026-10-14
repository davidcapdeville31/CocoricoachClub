import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, ListChecks, PenLine } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useSeasonGuard } from "@/hooks/use-season-guard";
import { useSessionNotifications } from "@/lib/hooks/useSessionNotifications";
import { cn } from "@/lib/utils";
import { JudoSessionDialog } from "./JudoSessionDialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  categoryId: string;
  athletePlayerId?: string;
}

const DURATIONS = [30, 45, 60, 90, 120];

const addMin = (hhmm: string, m: number) => {
  const [h, mm] = hhmm.split(":").map(Number);
  const t = Math.min(23 * 60 + 59, h * 60 + mm + m);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

/** Point d'entrée « Séance judo » : choix entre séance simplifiée et séance avancée. */
export function JudoSessionEntry(props: Props) {
  const { open, onOpenChange } = props;
  const [mode, setMode] = useState<null | "simple" | "advanced">(null);
  useEffect(() => {
    if (!open) setMode(null);
  }, [open]);

  return (
    <>
      <Dialog open={open && mode === null} onOpenChange={(o) => !o && onOpenChange(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Séance judo</DialogTitle>
            <DialogDescription>Choisis le type de saisie.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <button type="button" onClick={() => setMode("simple")} className="flex items-start gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:bg-muted">
              <PenLine className="mt-0.5 h-5 w-5 text-primary" />
              <span>
                <span className="block font-semibold">Séance simplifiée</span>
                <span className="block text-sm text-muted-foreground">Description libre, durée et RPE.</span>
              </span>
            </button>
            <button type="button" onClick={() => setMode("advanced")} className="flex items-start gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:bg-muted">
              <ListChecks className="mt-0.5 h-5 w-5 text-primary" />
              <span>
                <span className="block font-semibold">Séance avancée</span>
                <span className="block text-sm text-muted-foreground">Création détaillée en trois étapes avec blocs.</span>
              </span>
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <JudoSessionDialog {...props} open={open && mode === "advanced"} />
      <JudoSimplifiedDialog {...props} open={open && mode === "simple"} onBack={() => setMode(null)} />
    </>
  );
}

function JudoSimplifiedDialog({ open, onOpenChange, date, categoryId, athletePlayerId, onBack }: Props & { onBack: () => void }) {
  const isAthlete = !!athletePlayerId;
  const qc = useQueryClient();
  const guard = useSeasonGuard(categoryId);
  const { notify } = useSessionNotifications();
  const [dateStr, setDateStr] = useState(format(date, "yyyy-MM-dd"));
  const [start, setStart] = useState("18:00");
  const [duration, setDuration] = useState<number>(60);
  const [rpe, setRpe] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setDateStr(format(date, "yyyy-MM-dd"));
    setStart("18:00");
    setDuration(60);
    setRpe(null);
    setText("");
    setSelected([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const { data: playersRaw = [] } = useQuery({
    queryKey: ["judo_session_players", categoryId],
    enabled: open && !isAthlete,
    queryFn: async () => {
      const { data, error } = await supabase.from("players").select("id, name, first_name").eq("category_id", categoryId).order("name");
      if (error) throw error;
      return (data || []) as Array<{ id: string; name: string; first_name: string | null }>;
    },
  });
  const players = useMemo(() => playersRaw.filter((p) => guard.isPlayerAllowed(p.id)), [playersRaw, guard]);

  const save = useMutation({
    mutationFn: async () => {
      if (!text.trim()) throw new Error("Décris le contenu de la séance");
      if (!duration || duration <= 0) throw new Error("Indique la durée de la séance");
      if (!rpe) throw new Error(isAthlete ? "Indique ton RPE" : "Indique le RPE prévu");
      if (!guard.assertDate(new Date(`${dateStr}T12:00:00`))) throw new Error("guard:date");
      if (!isAthlete && selected.length === 0) throw new Error("Sélectionne au moins un athlète");
      if (!isAthlete && !guard.assertPlayers(selected)) throw new Error("guard:players");
      const end = addMin(start, duration);
      const notes = `Séance judo simplifiée\n\n${text.trim()}`;

      if (isAthlete) {
        const { data, error } = await supabase.functions.invoke("athlete-create-session", {
          body: {
            category_id: categoryId,
            player_id: athletePlayerId,
            session_date: dateStr,
            training_type: "terrain",
            session_start_time: start,
            session_end_time: end,
            intensity: rpe,
            session_kind: "training",
            notes,
          },
        });
        if (error) throw new Error(error.message);
        if (!(data as any)?.success) throw new Error((data as any)?.error || "Erreur lors de l'enregistrement");
        return { sessionId: (data as any).session_id as string, end };
      }

      const { data: session, error } = await supabase
        .from("training_sessions")
        .insert({
          category_id: categoryId,
          session_date: dateStr,
          session_start_time: start,
          session_end_time: end,
          training_type: "terrain",
          session_kind: "training",
          notes,
          intensity: rpe,
          planned_intensity: rpe,
        } as any)
        .select("id")
        .single();
      if (error) throw error;
      const { error: pErr } = await supabase.from("event_participants").insert(selected.map((pid) => ({ training_session_id: session.id, player_id: pid })));
      if (pErr) throw pErr;
      return { sessionId: session.id as string, end };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["training_sessions", categoryId] });
      qc.invalidateQueries({ queryKey: ["sessions", categoryId] });
      qc.invalidateQueries({ queryKey: ["today_sessions", categoryId] });
      if (isAthlete) {
        qc.invalidateQueries({ queryKey: ["athlete-calendar-sessions", categoryId, athletePlayerId] });
        qc.invalidateQueries({ queryKey: ["athlete-space-upcoming-sessions", categoryId, athletePlayerId] });
        qc.invalidateQueries({ queryKey: ["athlete-space-rpes"] });
        toast.success("Séance judo enregistrée");
      } else {
        toast.success(`Séance judo attribuée à ${selected.length} athlète${selected.length > 1 ? "s" : ""}`);
        notify({
          action: "created",
          sessionId: res.sessionId,
          categoryId,
          sessionDate: dateStr,
          sessionStartTime: start,
          sessionType: "judo",
          location: null,
          participantPlayerIds: selected,
        } as any).catch((e: unknown) => console.warn("[JudoSimplified] notify failed:", e));
      }
      onOpenChange(false);
    },
    onError: (e: Error) => {
      if (e?.message?.startsWith("guard:")) return;
      toast.error(e.message || "Erreur lors de l'enregistrement");
    },
  });

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onOpenChange(false)}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Séance judo simplifiée</DialogTitle>
          <DialogDescription>{isAthlete ? "Décris ta séance, sa durée et ton RPE." : "Décris la séance, sa durée et le RPE prévu."}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="judo-simple-date">Date</Label>
              <Input id="judo-simple-date" type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="judo-simple-start">Début</Label>
              <Input id="judo-simple-start" type="time" value={start} onChange={(e) => setStart(e.target.value || "18:00")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="judo-simple-text">Contenu de la séance</Label>
            <Textarea id="judo-simple-text" rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ex. : échauffement, uchi-komi, randori debout 6 × 4 min…" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="judo-simple-duration">Durée (min)</Label>
            <div className="flex flex-wrap items-center gap-2">
              {DURATIONS.map((m) => (
                <Button key={m} type="button" size="sm" variant={duration === m ? "default" : "outline"} onClick={() => setDuration(m)}>
                  {m} min
                </Button>
              ))}
              <Input id="judo-simple-duration" type="number" min={1} className="w-24" value={duration || ""} onChange={(e) => setDuration(Number(e.target.value))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{isAthlete ? "RPE (1 à 10)" : "RPE prévu (1 à 10)"}</Label>
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
                <button
                  key={v}
                  type="button"
                  data-rpe={v}
                  aria-pressed={rpe === v}
                  onClick={() => setRpe(v)}
                  className={cn("h-10 rounded-lg border text-sm font-semibold transition-colors", rpe === v ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          {!isAthlete && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Athlètes ({selected.length})</Label>
                <Button type="button" size="sm" variant="ghost" onClick={() => setSelected(selected.length === players.length ? [] : players.map((p) => p.id))}>
                  {selected.length === players.length && players.length > 0 ? "Tout retirer" : "Tout sélectionner"}
                </Button>
              </div>
              <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto">
                {players.map((p) => (
                  <Button key={p.id} type="button" size="sm" variant={selected.includes(p.id) ? "default" : "outline"} onClick={() => toggle(p.id)}>
                    {[p.first_name, p.name].filter(Boolean).join(" ")}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-between gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onBack}>Retour</Button>
          <Button type="button" onClick={() => save.mutate()}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enregistrer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
