import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, CalendarDays, Check, ChevronDown, Clock, Copy, Loader2, MoreHorizontal, Pencil, Search, Trash2, Trophy, Users, X, ArrowUp, ArrowDown, AlertTriangle,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { getDateLocale } from "@/lib/i18n/dateLocale";
import { cn } from "@/lib/utils";
import { usePlayerGroups } from "@/hooks/usePlayerGroups";
import { useSeasonGuard } from "@/hooks/use-season-guard";
import { useSessionNotifications } from "@/lib/hooks/useSessionNotifications";
import { SESSION_OBJECTIVES, labelOf } from "@/lib/judo/nomenclature";
import {
  BLOCK_META, BLOCK_ORDER, addMinutes, blockDuration, blockSummary, blockTitle, durationFromTimes, encodeSessionNotes, newBlock, sumBlocks, toBlockRow, uid,
  type JudoBlock, type JudoBlockKind,
} from "@/lib/judo/sessionModel";
import { JudoBlockEditor } from "./JudoBlockEditor";
import { AutoText, Chip, IntensityPicker, TextField, cardCls, inputCls } from "./JudoFields";
import heroJudokas from "@/assets/judo/hero-judokas.png";

const STEPS = ["Informations", "Contenu", "Récapitulatif"];
const DURATION_PRESETS = [30, 60, 90, 120];
const OBJECTIVE_EMOJI: Record<string, string> = { technique: "🥋", tactique: "🎯", randori: "⚡", physique: "💪", mental: "🧠", recuperation: "🔄" };
const fmtMin = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, "0")}` : ""}`);

const KIND_STYLE: Record<JudoBlockKind, { ring: string; badge: string }> = {
  technique: { ring: "border-l-judo-technique", badge: "bg-judo-technique/10" },
  tactic: { ring: "border-l-judo-tactic", badge: "bg-judo-tactic/10" },
  randori: { ring: "border-l-judo-randori", badge: "bg-judo-randori/10" },
  physical: { ring: "border-l-judo-physical", badge: "bg-judo-physical/10" },
  warmup: { ring: "border-l-judo-tactic", badge: "bg-judo-tactic/10" },
  cooldown: { ring: "border-l-judo-mental", badge: "bg-judo-mental/10" },
};

interface Draft {
  step: number;
  dateStr: string;
  startTime: string;
  endTime: string;
  duration: number | null;
  customDuration: boolean;
  kind: "training" | "competition" | null;
  objective: string | null;
  secondary: string[];
  competition: { name: string; location: string; category: string; level: string; observations: string };
  location: string;
  selected: string[];
  blocks: JudoBlock[];
  sessionIntensity: number | null;
}

/** Brouillons gardés en mémoire uniquement (jamais dans le navigateur), par catégorie et compte. */
const drafts = new Map<string, Draft>();

const emptyDraft = (date: Date): Draft => ({
  step: 0, dateStr: format(date, "yyyy-MM-dd"), startTime: "", endTime: "", duration: null, customDuration: false,
  kind: null, objective: null, secondary: [], competition: { name: "", location: "", category: "", level: "", observations: "" },
  location: "", selected: [], blocks: [], sessionIntensity: null,
});

const hasContent = (d: Draft) => d.blocks.length > 0 || !!d.objective || !!d.kind || d.selected.length > 0 || !!d.startTime;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  categoryId: string;
  /** Mode athlète : la séance est associée automatiquement au joueur connecté. */
  athletePlayerId?: string;
}

export function JudoSessionDialog({ open, onOpenChange, date, categoryId, athletePlayerId }: Props) {
  const isAthlete = !!athletePlayerId;
  const draftKey = `${categoryId}:${athletePlayerId ?? "staff"}`;
  const qc = useQueryClient();
  const guard = useSeasonGuard(categoryId);
  const { notify } = useSessionNotifications();
  const [d, setD] = useState<Draft>(() => emptyDraft(date));
  const [openBlockId, setOpenBlockId] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [athleteQuery, setAthleteQuery] = useState("");
  const [athletesOpen, setAthletesOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const savedRef = useRef(false);
  const patch = (p: Partial<Draft>) => setD((prev) => ({ ...prev, ...p }));

  useEffect(() => {
    if (!open) return;
    savedRef.current = false;
    const existing = drafts.get(draftKey);
    if (existing) {
      setD(existing);
      toast.info("Brouillon restauré");
    } else setD(emptyDraft(date));
    setOpenBlockId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [d.step]);

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
  const { data: groups = [] } = usePlayerGroups(open && !isAthlete ? categoryId : null);
  const playerName = (p: { name: string; first_name: string | null }) => [p.first_name, p.name].filter(Boolean).join(" ");
  const filteredPlayers = players.filter((p) => playerName(p).toLowerCase().includes(athleteQuery.trim().toLowerCase()));

  const timesDuration = durationFromTimes(d.startTime, d.endTime);
  const plannedDuration = d.duration ?? timesDuration;
  const sums = sumBlocks(d.blocks);
  const durationGap = plannedDuration && sums.total > 0 && sums.total !== plannedDuration ? sums.total - plannedDuration : null;
  const timesConflict = d.duration && timesDuration && d.duration !== timesDuration;

  const close = () => {
    setConfirmClose(false);
    onOpenChange(false);
  };
  const requestClose = () => {
    if (!savedRef.current && hasContent(d)) setConfirmClose(true);
    else close();
  };

  const updateBlock = (id: string, next: JudoBlock) => patch({ blocks: d.blocks.map((b) => (b.id === id ? next : b)) });
  const addBlock = (kind: JudoBlockKind) => {
    const b = newBlock(kind);
    patch({ blocks: [...d.blocks, b] });
    setOpenBlockId(b.id);
    setTimeout(() => document.getElementById(`judo-block-${b.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };
  const duplicate = (b: JudoBlock) => {
    const i = d.blocks.findIndex((x) => x.id === b.id);
    const copy = { ...structuredClone(b), id: uid() };
    const next = [...d.blocks];
    next.splice(i + 1, 0, copy);
    patch({ blocks: next });
    setOpenBlockId(copy.id);
  };
  const move = (b: JudoBlock, dir: -1 | 1) => {
    const i = d.blocks.findIndex((x) => x.id === b.id);
    const j = i + dir;
    if (j < 0 || j >= d.blocks.length) return;
    const next = [...d.blocks];
    [next[i], next[j]] = [next[j], next[i]];
    patch({ blocks: next });
  };
  const remove = (b: JudoBlock) => {
    patch({ blocks: d.blocks.filter((x) => x.id !== b.id) });
    if (openBlockId === b.id) setOpenBlockId(null);
  };

  const goStep = (s: number) => {
    if (s > 0 && !d.kind) {
      toast.error("Choisis le type de séance : Entraînement ou Compétition");
      return patch({ step: 0 });
    }
    patch({ step: Math.max(0, Math.min(2, s)) });
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!d.kind) throw new Error("Choisis le type de séance");
      if (d.blocks.length === 0) throw new Error("Ajoute au moins un bloc à la séance");
      const sessionDate = new Date(`${d.dateStr}T12:00:00`);
      if (!guard.assertDate(sessionDate)) throw new Error("guard:date");
      if (!isAthlete && d.selected.length === 0) throw new Error("Sélectionne au moins un athlète");
      if (!isAthlete && !guard.assertPlayers(d.selected)) throw new Error("guard:players");

      const objectiveLabel = d.objective ? labelOf(SESSION_OBJECTIVES, d.objective) : null;
      const title = d.kind === "competition" && d.competition.name.trim()
        ? `Compétition judo — ${d.competition.name.trim()}`
        : `Séance judo${objectiveLabel ? ` — ${objectiveLabel}` : ""}`;
      const notes = encodeSessionNotes(title, {
        objective: d.objective,
        secondary_objectives: d.secondary,
        competition: d.kind === "competition" ? d.competition : null,
      });
      const start = d.startTime || null;
      const end = d.endTime || (start && plannedDuration ? addMinutes(start, plannedDuration) : null);
      const rows = d.blocks.map(toBlockRow);
      const location = (d.kind === "competition" ? d.competition.location : d.location).trim() || null;

      if (isAthlete) {
        const { data, error } = await supabase.functions.invoke("athlete-create-session", {
          body: {
            category_id: categoryId,
            player_id: athletePlayerId,
            session_date: d.dateStr,
            training_type: "terrain",
            session_start_time: start,
            session_end_time: end,
            intensity: d.sessionIntensity,
            session_kind: d.kind,
            notes,
            session_blocks: rows,
          },
        });
        if (error) throw new Error(error.message);
        if (!(data as any)?.success) throw new Error((data as any)?.error || "Erreur lors de l'enregistrement");
        return { sessionId: (data as any).session_id as string, count: 1 };
      }

      const { data: session, error } = await supabase
        .from("training_sessions")
        .insert({
          category_id: categoryId,
          session_date: d.dateStr,
          session_start_time: start,
          session_end_time: end,
          training_type: "terrain",
          session_kind: d.kind,
          location,
          notes,
          intensity: d.sessionIntensity ?? 1,
          planned_intensity: d.sessionIntensity,
        } as any)
        .select("id")
        .single();
      if (error) throw error;
      const { error: bErr } = await supabase.from("training_session_blocks").insert(rows.map((r) => ({ ...r, training_session_id: session.id })) as any);
      if (bErr) throw bErr;
      const { error: pErr } = await supabase.from("event_participants").insert(d.selected.map((pid) => ({ training_session_id: session.id, player_id: pid })));
      if (pErr) throw pErr;
      return { sessionId: session.id as string, count: d.selected.length, start, location };
    },
    onSuccess: (res: any) => {
      savedRef.current = true;
      drafts.delete(draftKey);
      qc.invalidateQueries({ queryKey: ["training_sessions", categoryId] });
      qc.invalidateQueries({ queryKey: ["sessions", categoryId] });
      qc.invalidateQueries({ queryKey: ["today_sessions", categoryId] });
      if (isAthlete) {
        qc.invalidateQueries({ queryKey: ["athlete-calendar-sessions", categoryId, athletePlayerId] });
        qc.invalidateQueries({ queryKey: ["athlete-space-upcoming-sessions", categoryId, athletePlayerId] });
        toast.success("Séance judo enregistrée");
      } else {
        toast.success(`Séance judo attribuée à ${res.count} athlète${res.count > 1 ? "s" : ""}`);
        notify({
          action: "created",
          sessionId: res.sessionId,
          categoryId,
          sessionDate: d.dateStr,
          sessionStartTime: res.start,
          sessionType: "judo",
          location: res.location,
          participantPlayerIds: d.selected,
        }).catch((e) => console.warn("[JudoSession] notify failed:", e));
      }
      onOpenChange(false);
    },
    onError: (e: Error) => {
      if (e?.message?.startsWith("guard:")) return;
      toast.error(e.message || "Erreur lors de l'enregistrement");
    },
  });

  const dateObj = new Date(`${d.dateStr}T12:00:00`);
  const saveLabel = isAthlete ? "Enregistrer la séance" : d.selected.length > 0 ? `Enregistrer et attribuer à ${d.selected.length} athlète${d.selected.length > 1 ? "s" : ""}` : "Enregistrer et attribuer";

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : requestClose())}>
        <DialogContent
          hideClose
          className="fixed inset-0 flex h-[100dvh] max-h-[100dvh] w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 bg-judo-canvas p-0 sm:relative sm:inset-auto sm:h-[92vh] sm:max-h-[92vh] sm:w-[94vw] sm:max-w-[1000px] sm:rounded-3xl sm:p-0"
        >
          {/* En-tête */}
          <div className="shrink-0 bg-gradient-to-b from-card to-judo-canvas px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8 sm:pt-6">
            <div className="flex items-start gap-3">
              <button type="button" onClick={() => (d.step > 0 ? goStep(d.step - 1) : requestClose())} className="mt-1 shrink-0 rounded-full p-2 text-foreground hover:bg-card" aria-label={d.step > 0 ? "Retour" : "Fermer"}>
                {d.step > 0 ? <ArrowLeft className="h-5 w-5" /> : <X className="h-5 w-5" />}
              </button>
              <div className="flex min-w-0 flex-1 items-start">
                {STEPS.map((label, i) => {
                  const done = i < d.step;
                  const active = i === d.step;
                  return (
                    <div key={label} className="flex flex-1 items-start last:flex-none">
                      <button type="button" onClick={() => goStep(i)} className="flex min-w-[64px] flex-col items-center gap-1 sm:min-w-[90px]">
                        <span className={cn("flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors", done && "bg-judo-technique text-card", active && "bg-judo-ink text-card", !done && !active && "bg-muted text-muted-foreground")}>
                          {done ? <Check className="h-4 w-4" /> : i + 1}
                        </span>
                        <span className={cn("whitespace-nowrap text-[11px] sm:text-xs", active ? "font-semibold text-foreground" : "text-muted-foreground")}>{label}</span>
                      </button>
                      {i < STEPS.length - 1 && <div className={cn("mt-4 h-0.5 flex-1 rounded-full", i < d.step ? "bg-judo-technique" : "bg-border")} />}
                    </div>
                  );
                })}
              </div>
              <button type="button" onClick={requestClose} className="mt-1.5 shrink-0 text-sm text-muted-foreground hover:text-foreground">Annuler</button>
            </div>
            <DialogHeader className={cn("relative mt-4 text-left", d.step === 0 ? "pr-28 sm:pr-44" : "pr-14")}>
              <DialogTitle className="text-[24px] font-bold leading-tight tracking-tight text-judo-ink sm:text-[28px]">
                {d.step === 0 ? "Nouvelle séance judo" : d.step === 1 ? "Contenu de la séance" : "Récapitulatif de la séance"}
              </DialogTitle>
              <p className="mt-1 text-sm text-muted-foreground sm:text-[15px]">
                {d.step === 0 ? "Prépare et organise ton entraînement en quelques étapes." : d.step === 1 ? "Ajoute les situations et exercices réalisés sur le tatami." : "Vérifie la séance avant de l'enregistrer."}
              </p>
              {d.step === 0 ? (
                <img src={heroJudokas} alt="" aria-hidden width={1024} height={1024} className="pointer-events-none absolute -top-6 right-0 h-28 w-28 select-none object-contain drop-shadow-[0_12px_18px_hsl(var(--judo-ink)/0.18)] sm:-top-10 sm:h-40 sm:w-40" />
              ) : (
                <span aria-hidden className="absolute right-0 top-0 flex h-12 w-12 items-center justify-center rounded-2xl bg-card text-2xl shadow-sm">{d.step === 1 ? "🥋" : "📊"}</span>
              )}
            </DialogHeader>
          </div>

          {/* Contenu */}
          <div ref={scrollRef} key={d.step} className="min-h-0 flex-1 overflow-y-auto px-4 py-4 animate-in fade-in-0 slide-in-from-bottom-1 duration-200 sm:px-8">
            {d.step === 0 && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className={cn(cardCls, "flex items-center gap-4")}>
                  <span className="rounded-xl bg-judo-technique/10 p-2.5"><CalendarDays className="h-5 w-5 text-judo-technique" /></span>
                  <label className="min-w-0 flex-1">
                    <span className="text-xs font-medium text-muted-foreground">Date</span>
                    <input type="date" value={d.dateStr} onChange={(e) => e.target.value && patch({ dateStr: e.target.value })} className={inputCls} />
                    <span className="mt-1 block text-xs capitalize text-muted-foreground">{format(dateObj, "EEEE d MMMM yyyy", { locale: getDateLocale() })}</span>
                  </label>
                </div>

                <div className={cn(cardCls, "space-y-3")}>
                  <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-judo-technique" /><p className="text-sm font-semibold text-judo-ink">Horaires et durée</p></div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="min-w-0"><span className="text-xs text-muted-foreground">Début</span><input type="time" value={d.startTime} onChange={(e) => patch({ startTime: e.target.value })} className={inputCls} /></label>
                    <label className="min-w-0"><span className="text-xs text-muted-foreground">Fin</span><input type="time" value={d.endTime} onChange={(e) => patch({ endTime: e.target.value })} className={inputCls} /></label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {DURATION_PRESETS.map((m) => (
                      <Chip key={m} active={!d.customDuration && d.duration === m} onClick={() => patch({ duration: d.duration === m && !d.customDuration ? null : m, customDuration: false })}>{fmtMin(m)}</Chip>
                    ))}
                    <Chip active={d.customDuration} onClick={() => patch({ customDuration: !d.customDuration })}>Autre</Chip>
                  </div>
                  {d.customDuration && (
                    <input type="number" inputMode="numeric" min={1} placeholder="Durée en minutes" value={d.duration ?? ""} onChange={(e) => patch({ duration: e.target.value ? Math.max(1, Number(e.target.value)) : null })} className={inputCls} />
                  )}
                  {timesDuration && !d.duration && <p className="text-xs text-muted-foreground">Durée calculée : {fmtMin(timesDuration)}</p>}
                  {timesConflict && (
                    <p className="flex items-start gap-1.5 rounded-lg bg-judo-tactic/10 p-2 text-xs text-judo-ink"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-judo-tactic" />Les horaires ({fmtMin(timesDuration!)}) et la durée choisie ({fmtMin(d.duration!)}) ne correspondent pas. Rien n'est modifié automatiquement.</p>
                  )}
                </div>

                <div className={cn(cardCls, "space-y-3 md:col-span-2")}>
                  <p className="text-sm font-semibold text-judo-ink">Type de séance</p>
                  <div className="grid grid-cols-2 gap-3">
                    {([["training", "🥋", "Entraînement", "Séance de développement et de progression."], ["competition", "🏆", "Compétition", "Tournoi, championnat, rencontre ou opposition officielle."]] as const).map(([k, e, l, h]) => (
                      <button key={k} type="button" aria-pressed={d.kind === k} onClick={() => patch({ kind: k })}
                        className={cn("rounded-2xl border-2 p-3 text-left transition-all active:scale-[0.98] sm:p-4", d.kind === k ? "border-judo-ink bg-judo-soft" : "border-border/50 bg-card hover:border-judo-ink/30")}>
                        <span className="text-2xl" aria-hidden>{e}</span>
                        <p className="mt-1 text-sm font-bold uppercase tracking-wide text-judo-ink">{l}</p>
                        <p className="text-xs leading-snug text-muted-foreground">{h}</p>
                      </button>
                    ))}
                  </div>
                  {d.kind === "competition" && (
                    <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2 animate-in fade-in-0 duration-200">
                      <TextField label="Nom de la compétition" value={d.competition.name} onChange={(v) => patch({ competition: { ...d.competition, name: v } })} />
                      <TextField label="Lieu" value={d.competition.location} onChange={(v) => patch({ competition: { ...d.competition, location: v } })} />
                      <TextField label="Catégorie" value={d.competition.category} onChange={(v) => patch({ competition: { ...d.competition, category: v } })} placeholder="Ex. -57 kg" />
                      <TextField label="Niveau" value={d.competition.level} onChange={(v) => patch({ competition: { ...d.competition, level: v } })} placeholder="Ex. régional, national" />
                      <div className="sm:col-span-2"><AutoText label="Observations" value={d.competition.observations} onChange={(v) => patch({ competition: { ...d.competition, observations: v } })} /></div>
                    </div>
                  )}
                  {d.kind === "training" && <TextField label="Lieu (facultatif)" value={d.location} onChange={(v) => patch({ location: v })} placeholder="Ex. Dojo principal" />}
                </div>

                <div className={cn(cardCls, "space-y-3 md:col-span-2")}>
                  <p className="text-sm font-semibold text-judo-ink">Objectif principal</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {SESSION_OBJECTIVES.map((o) => (
                      <button key={o.key} type="button" aria-pressed={d.objective === o.key} onClick={() => patch({ objective: d.objective === o.key ? null : o.key, secondary: d.secondary.filter((s) => s !== o.key) })}
                        className={cn("flex min-h-12 items-center gap-2 rounded-xl border px-3 text-left text-sm font-medium transition-all active:scale-[0.98]", d.objective === o.key ? "border-judo-ink bg-judo-ink text-card" : "border-border/60 bg-card text-judo-ink hover:border-judo-ink/30")}>
                        <span aria-hidden>{OBJECTIVE_EMOJI[o.key]}</span><span className="min-w-0">{o.label}</span>
                      </button>
                    ))}
                  </div>
                  {d.objective && (
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground">Objectifs secondaires (facultatif)</p>
                      <div className="flex flex-wrap gap-2">
                        {SESSION_OBJECTIVES.filter((o) => o.key !== d.objective).map((o) => (
                          <Chip key={o.key} active={d.secondary.includes(o.key)} onClick={() => patch({ secondary: d.secondary.includes(o.key) ? d.secondary.filter((s) => s !== o.key) : [...d.secondary, o.key] })}>{o.label}</Chip>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {!isAthlete && (
                  <div className={cn(cardCls, "space-y-3 md:col-span-2")}>
                    <button type="button" onClick={() => setAthletesOpen((v) => !v)} className="flex min-h-11 w-full items-center justify-between gap-2 text-left">
                      <span className="flex items-center gap-2 text-sm font-semibold text-judo-ink"><Users className="h-4 w-4 text-judo-technique" />Athlètes</span>
                      <span className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="rounded-full bg-judo-soft px-2.5 py-0.5 font-semibold text-judo-ink">{d.selected.length} sélectionné{d.selected.length > 1 ? "s" : ""}</span>
                        <ChevronDown className={cn("h-4 w-4 transition-transform", athletesOpen && "rotate-180")} />
                      </span>
                    </button>
                    {athletesOpen && (
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                          <Chip active={players.length > 0 && d.selected.length === players.length} onClick={() => patch({ selected: d.selected.length === players.length ? [] : players.map((p) => p.id) })}>Tout l'effectif</Chip>
                          {groups.map((g) => {
                            const ids = g.playerIds.filter((id) => players.some((p) => p.id === id));
                            const all = ids.length > 0 && ids.every((id) => d.selected.includes(id));
                            return (
                              <Chip key={g.id} active={all} onClick={() => patch({ selected: all ? d.selected.filter((id) => !ids.includes(id)) : Array.from(new Set([...d.selected, ...ids])) })}>
                                {g.name} <span className="text-xs opacity-70">({ids.length})</span>
                              </Chip>
                            );
                          })}
                        </div>
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <input value={athleteQuery} onChange={(e) => setAthleteQuery(e.target.value)} placeholder="Rechercher un athlète" className={cn(inputCls, "pl-9")} aria-label="Rechercher un athlète" />
                        </div>
                        <div className="grid max-h-64 grid-cols-1 gap-1 overflow-y-auto min-[420px]:grid-cols-2 sm:grid-cols-3">
                          {filteredPlayers.map((p) => {
                            const on = d.selected.includes(p.id);
                            return (
                              <button key={p.id} type="button" aria-pressed={on} onClick={() => patch({ selected: on ? d.selected.filter((x) => x !== p.id) : [...d.selected, p.id] })}
                                className={cn("flex min-h-11 items-center gap-2 rounded-lg border px-3 text-left text-sm", on ? "border-judo-technique bg-judo-technique/10 font-semibold text-judo-ink" : "border-transparent hover:bg-muted/60")}>
                                <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-md border", on ? "border-judo-technique bg-judo-technique text-card" : "border-border")}>{on && <Check className="h-3.5 w-3.5" />}</span>
                                <span className="min-w-0 truncate">{playerName(p)}</span>
                              </button>
                            );
                          })}
                          {filteredPlayers.length === 0 && <p className="p-2 text-sm text-muted-foreground">Aucun athlète trouvé.</p>}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {d.step === 1 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  {BLOCK_ORDER.map((k) => (
                    <button key={k} type="button" onClick={() => addBlock(k)}
                      className={cn(cardCls, "flex min-h-[72px] flex-col items-start justify-center gap-1 p-3 text-left transition-all hover:-translate-y-0.5 active:scale-[0.98] sm:p-3")}>
                      <span className="text-xl" aria-hidden>{BLOCK_META[k].emoji}</span>
                      <span className="text-sm font-semibold text-judo-ink">+ {BLOCK_META[k].label}</span>
                    </button>
                  ))}
                </div>

                {d.blocks.length === 0 ? (
                  <div className="rounded-[20px] border border-dashed border-border bg-card/60 p-8 text-center">
                    <p className="text-3xl" aria-hidden>🥋</p>
                    <p className="mt-2 text-sm font-medium text-judo-ink">Aucun bloc pour l'instant</p>
                    <p className="text-xs text-muted-foreground">Choisis un type de travail ci-dessus pour commencer.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {d.blocks.map((b, i) => {
                      const isOpen = openBlockId === b.id;
                      const dur = blockDuration(b);
                      const summary = blockSummary(b);
                      return (
                        <div key={b.id} id={`judo-block-${b.id}`} className={cn(cardCls, "scroll-mt-4 border-l-4 p-0 sm:p-0 animate-in fade-in-0 slide-in-from-bottom-2 duration-200", KIND_STYLE[b.kind].ring)}>
                          <div className="flex items-center gap-2 p-3 sm:p-4">
                            <button type="button" onClick={() => setOpenBlockId(isOpen ? null : b.id)} className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left" aria-expanded={isOpen}>
                              <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg", KIND_STYLE[b.kind].badge)} aria-hidden>{BLOCK_META[b.kind].emoji}</span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[15px] font-semibold text-judo-ink">{blockTitle(b)}{dur != null && <span className="font-normal text-muted-foreground"> — {dur} min</span>}</span>
                                <span className="block truncate text-xs text-muted-foreground">{summary || (isOpen ? "En cours de saisie" : "À compléter")}</span>
                              </span>
                              <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                            </button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button type="button" className="rounded-full p-2.5 text-muted-foreground hover:bg-muted" aria-label="Actions du bloc"><MoreHorizontal className="h-4 w-4" /></button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => duplicate(b)}><Copy className="mr-2 h-4 w-4" />Dupliquer</DropdownMenuItem>
                                <DropdownMenuItem disabled={i === 0} onClick={() => move(b, -1)}><ArrowUp className="mr-2 h-4 w-4" />Monter</DropdownMenuItem>
                                <DropdownMenuItem disabled={i === d.blocks.length - 1} onClick={() => move(b, 1)}><ArrowDown className="mr-2 h-4 w-4" />Descendre</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive" onClick={() => remove(b)}><Trash2 className="mr-2 h-4 w-4" />Supprimer</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          {isOpen && (
                            <div className="space-y-4 border-t border-border/40 p-3 sm:p-5">
                              <TextField label="Titre du bloc (facultatif)" value={b.title} onChange={(v) => updateBlock(b.id, { ...b, title: v })} placeholder={BLOCK_META[b.kind].label} />
                              <JudoBlockEditor block={b} onChange={(next) => updateBlock(b.id, next)} />
                              <button type="button" onClick={() => setOpenBlockId(null)} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-judo-soft text-sm font-semibold text-judo-ink hover:bg-judo-soft/70">
                                <Check className="h-4 w-4" /> Valider et replier
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div className="flex items-center justify-between rounded-xl bg-card px-4 py-3 text-sm">
                      <span className="text-muted-foreground">Somme des blocs</span>
                      <span className="font-semibold text-judo-ink">{fmtMin(sums.total)}{sums.missing > 0 && <span className="font-normal text-muted-foreground"> · {sums.missing} sans durée</span>}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {d.step === 2 && (
              <div className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
                <div className={cn(cardCls, "space-y-3 self-start")}>
                  <div className="flex items-center gap-3">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-judo-soft text-2xl" aria-hidden>{d.kind === "competition" ? "🏆" : "🥋"}</span>
                    <div className="min-w-0">
                      <p className="text-lg font-bold text-judo-ink">Judo · {d.kind === "competition" ? "Compétition" : "Entraînement"}</p>
                      <p className="text-sm capitalize text-muted-foreground">{format(dateObj, "EEEE d MMMM yyyy", { locale: getDateLocale() })}{d.startTime && ` · ${d.startTime}`}</p>
                    </div>
                  </div>
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-xl bg-judo-canvas p-3"><dt className="text-xs text-muted-foreground">⏱️ Durée prévue</dt><dd className="font-semibold text-judo-ink">{plannedDuration ? fmtMin(plannedDuration) : "Non renseignée"}</dd></div>
                    <div className="rounded-xl bg-judo-canvas p-3"><dt className="text-xs text-muted-foreground">Somme des blocs</dt><dd className="font-semibold text-judo-ink">{fmtMin(sums.total)}</dd></div>
                    <div className="rounded-xl bg-judo-canvas p-3"><dt className="text-xs text-muted-foreground">Objectif</dt><dd className="font-semibold text-judo-ink">{d.objective ? `${OBJECTIVE_EMOJI[d.objective]} ${labelOf(SESSION_OBJECTIVES, d.objective)}` : "—"}</dd></div>
                    <div className="rounded-xl bg-judo-canvas p-3"><dt className="text-xs text-muted-foreground">Athlètes</dt><dd className="font-semibold text-judo-ink">{isAthlete ? "Moi" : d.selected.length}</dd></div>
                  </dl>
                  {d.kind === "competition" && d.competition.name && <p className="text-sm text-judo-ink">🏆 {d.competition.name}{d.competition.location && ` · ${d.competition.location}`}</p>}
                  {durationGap != null && (
                    <p className="flex items-start gap-1.5 rounded-lg bg-judo-tactic/10 p-2.5 text-xs text-judo-ink"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-judo-tactic" />Écart de {Math.abs(durationGap)} min entre la durée prévue et la somme des blocs ({durationGap > 0 ? "blocs plus longs" : "blocs plus courts"}).</p>
                  )}
                  {sums.missing > 0 && <p className="text-xs text-muted-foreground">{sums.missing} bloc{sums.missing > 1 ? "s" : ""} sans durée : non compté{sums.missing > 1 ? "s" : ""} dans la somme.</p>}
                  <div className="space-y-2 border-t border-border/40 pt-3">
                    <IntensityPicker label={isAthlete ? "RPE ressenti de la séance" : "RPE prévu de la séance"} value={d.sessionIntensity} onChange={(v) => patch({ sessionIntensity: v })} />
                    {d.sessionIntensity && (plannedDuration || sums.total) ? (
                      <p className="text-xs text-muted-foreground">Charge {isAthlete ? "interne" : "prévue"} : {plannedDuration || sums.total} min × RPE {d.sessionIntensity} = <span className="font-semibold text-judo-ink">{(plannedDuration || sums.total) * d.sessionIntensity} UA</span></p>
                    ) : null}
                    {!isAthlete && <p className="text-xs text-muted-foreground">La charge réelle viendra du RPE saisi par chaque athlète après la séance.</p>}
                  </div>
                </div>

                <div className={cn(cardCls, "space-y-1")}>
                  <p className="mb-2 text-sm font-semibold text-judo-ink">Chronologie</p>
                  {d.blocks.length === 0 && <p className="text-sm text-muted-foreground">Aucun bloc ajouté.</p>}
                  <ol className="relative space-y-1">
                    {d.blocks.map((b) => {
                      const dur = blockDuration(b);
                      const s = blockSummary(b);
                      return (
                        <li key={b.id} className="flex items-start gap-3 rounded-xl p-2 hover:bg-judo-canvas">
                          <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", KIND_STYLE[b.kind].badge)} aria-hidden>{BLOCK_META[b.kind].emoji}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-judo-ink">{blockTitle(b)} <span className="font-normal text-muted-foreground">— {dur != null ? `${dur} min` : "durée non renseignée"}</span></p>
                            {s && <p className="text-xs text-muted-foreground">{s}</p>}
                          </div>
                          <button type="button" onClick={() => { patch({ step: 1 }); setOpenBlockId(b.id); setTimeout(() => document.getElementById(`judo-block-${b.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 120); }}
                            className="flex min-h-10 shrink-0 items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-judo-technique hover:bg-judo-soft" aria-label={`Modifier ${blockTitle(b)}`}>
                            <Pencil className="h-3.5 w-3.5" /> Modifier
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                  {d.blocks.length > 0 && <p className="border-t border-border/40 pt-3 text-right text-sm font-bold text-judo-ink">Total : {fmtMin(sums.total)}</p>}
                </div>
              </div>
            )}
          </div>

          {/* Barre fixe */}
          <div className="flex shrink-0 items-center gap-2 border-t border-border/40 bg-card px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-8">
            <button type="button" onClick={() => (d.step > 0 ? goStep(d.step - 1) : requestClose())} className="flex min-h-12 items-center gap-1.5 rounded-xl px-4 text-sm font-medium text-judo-ink hover:bg-judo-soft">
              <ArrowLeft className="h-4 w-4" /> {d.step > 0 ? "Retour" : "Fermer"}
            </button>
            <div className="flex-1" />
            {d.step < 2 ? (
              <button type="button" onClick={() => goStep(d.step + 1)} className="flex min-h-12 items-center gap-1.5 rounded-xl bg-judo-ink px-6 text-sm font-semibold text-card shadow-sm active:scale-[0.98]">
                Suivant <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button type="button" onClick={() => save.mutate()} disabled={save.isPending} className="flex min-h-12 min-w-0 items-center gap-1.5 rounded-xl bg-judo-physical px-4 text-sm font-semibold text-card shadow-sm active:scale-[0.98] sm:px-6">
                {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 shrink-0" />}<span className="truncate">{saveLabel}</span>
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conserver le brouillon ?</AlertDialogTitle>
            <AlertDialogDescription>La séance n'est pas enregistrée. Le brouillon reste disponible tant que l'application est ouverte.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { drafts.delete(draftKey); close(); }}>Abandonner</AlertDialogCancel>
            <AlertDialogAction onClick={() => { drafts.set(draftKey, d); close(); }}>Conserver le brouillon</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
