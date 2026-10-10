import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Trophy, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FrameData, ThrowData, BowlingStats } from "@/components/athlete-portal/BowlingScoreSheet";
import { confirmedScore, hasThrow, isFirstBall, isFrameComplete, isGameComplete, nextThrowIndex, remainingPins } from "@/lib/bowling/scoreRules";
import pins from "@/assets/bowling/hero-pins.png";
import { cn } from "@/lib/utils";

interface Props {
  frames: FrameData[];
  stats: BowlingStats;
  gameNumber: number;
  readOnly: boolean;
  trackPockets: boolean;
  onThrow: (frame: number, roll: number, value: string) => FrameData[] | null;
  onObservation: (frame: number, roll: number, field: keyof ThrowData, value: boolean | undefined) => void;
}

export function MobileBowlingFrames({ frames, stats, gameNumber, readOnly, trackPockets, onThrow, onObservation }: Props) {
  const [active, setActive] = useState(() => Math.max(0, frames.findIndex((f, i) => !isFrameComplete(f, i))));
  const [roll, setRoll] = useState(() => nextThrowIndex(frames[active], active));
  const frame = frames[active];
  const complete = isGameComplete(frames);
  const completed = frames.filter(isFrameComplete).length;
  const standing = remainingPins(frame, active, roll);
  const last = frames.map((f, i) => ({ f, i })).filter(({ f }) => f.throws.some(hasThrow)).at(-1);
  const pending = frames.some((f, i) => isFrameComplete(f, i) && f.score === null);
  const select = (index: number) => { setActive(index); setRoll(nextThrowIndex(frames[index], index)); };
  const freshRack = isFirstBall(active, roll, frame);
  const enter = (value: number) => {
    const updated = onThrow(active, roll, String(value));
    if (!updated) return;
    if (isFrameComplete(updated[active], active)) {
      // Do not jump over already recorded frames while correcting an earlier frame.
      if (active < 9 && !updated[active + 1].throws.some(hasThrow)) { setActive(active + 1); setRoll(0); }
      else setRoll(nextThrowIndex(updated[active], active));
    } else setRoll(nextThrowIndex(updated[active], active));
  };

  return <section aria-label={`Saisie de la partie ${gameNumber}`} className="min-w-0 space-y-4 rounded-2xl bg-bowling-field p-3 text-foreground">
    <header>
      <div className="flex items-center justify-between gap-2">
        <div><h3 className="text-lg font-bold text-bowling-ink">Partie {gameNumber}</h3><p className="text-sm text-muted-foreground">Frame {active + 1} / 10</p></div>
        <img src={pins} alt="" className="h-12 w-12 shrink-0 object-contain" />
      </div>
      <div className="mt-3 grid grid-cols-10 gap-1" aria-label={`${completed} frames terminées sur 10`}>
        {frames.map((f, i) => <Button key={i} variant="ghost" size="icon" className="h-6 w-full min-w-0 rounded-sm p-0" aria-label={`Sélectionner frame ${i + 1}`} aria-current={i === active ? "step" : undefined} onClick={() => select(i)}>
          <span className={cn("h-1.5 w-full rounded-full", isFrameComplete(f, i) ? "bg-bowling-success" : i === active ? "bg-bowling-accent" : "bg-border")} />
        </Button>)}
      </div>
      <div className="mt-2 flex items-end justify-between gap-2 border-b border-border pb-3">
        <div><p className="text-xs text-muted-foreground">{pending ? "Score provisoire · Bonus en attente" : "Score cumulé confirmé"}</p><p className="text-3xl font-bold tabular-nums text-bowling-ink">{confirmedScore(frames)}</p></div>
        <div className="text-right text-xs text-muted-foreground"><p>{completed} / 10 terminées</p><p className="mt-1">Dernière : {last ? `F${last.i + 1} · ${last.f.throws.filter(hasThrow).map(t => t.value).join(" ")}` : "—"}</p></div>
      </div>
    </header>

    {complete && <div role="status" className="flex items-center gap-3 rounded-xl border border-bowling-success/30 bg-bowling-success/10 p-3"><Trophy className="h-6 w-6 shrink-0 text-bowling-success" /><div><p className="font-semibold">Partie {gameNumber} terminée</p><p className="text-sm">Score : {stats.totalScore}</p></div></div>}

    <div key={active} className="space-y-3 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150">
      <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-base font-semibold">Frame {active + 1}</h4>{isFrameComplete(frame, active) && <span className="flex items-center gap-1 text-xs text-bowling-success"><Check className="h-3.5 w-3.5" />Terminée</span>}</div>
      <div className="flex gap-2" role="group" aria-label="Lancers de la frame">
        {Array.from({ length: active === 9 ? 3 : 2 }, (_, t) => {
          if (remainingPins(frame, active, t) === null) return null;
          return <Button key={t} variant="outline" aria-label={`Modifier lancer ${t + 1}`} aria-pressed={roll === t} className={cn("h-12 min-w-0 flex-1 gap-1", roll === t && "border-bowling-accent bg-bowling-accent/10")} onClick={() => setRoll(t)}><span className="text-xs text-muted-foreground">L{t + 1}</span><span className="text-lg font-bold">{frame.throws[t]?.value || "·"}</span></Button>;
        })}
      </div>
      {!readOnly && <>
        <p className="text-sm font-medium">{roll === 0 ? "Premier lancer" : roll === 1 ? "Deuxième lancer" : "Lancer bonus"}<span className="ml-2 text-xs font-normal text-muted-foreground">{standing ?? 0} quilles restantes</span></p>
        <div className="grid grid-cols-4 gap-2" role="group" aria-label="Quilles tombées">
          {Array.from({ length: 11 }, (_, n) => n).filter(n => standing !== null && n <= standing).map(n => <Button key={n} variant="outline" aria-label={n === 10 && freshRack ? "Strike X" : n === 0 ? "0 · Gouttière" : `${n} quilles`} className={cn("h-14 min-w-0 rounded-xl border-border bg-card p-0 text-xl font-semibold motion-safe:transition-transform motion-safe:active:scale-95", n === 10 && freshRack && "border-bowling-accent bg-bowling-accent text-primary-foreground", n === standing && !freshRack && "border-bowling-success text-bowling-success")} onClick={() => enter(n)}>{n === 10 && freshRack ? <span className="flex flex-col text-base leading-tight">X<span className="text-[10px]">Strike</span></span> : n === standing && !freshRack ? <span>{n}<span className="ml-1">/</span></span> : n}</Button>)}
        </div>
      </>}
    </div>

    <details className="group border-y border-border py-3" key={`details-${active}`}>
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-bowling-ink"><Plus className="h-4 w-4" />Détails du lancer<ChevronDown className="ml-auto h-4 w-4 group-open:rotate-180" /></summary>
      <div className="mt-3 space-y-4">{frame.throws.map((t, ti) => hasThrow(t) && <div key={ti} className="space-y-2"><p className="text-xs font-semibold text-muted-foreground">Lancer {ti + 1} · {t.value}</p>{([
        ...(trackPockets && isFirstBall(active, ti, frame) ? [["isPocket", "Poche"]] : []),
        ...(t.value !== "X" && t.value !== "/" ? [["isSplit", "Split"]] : []),
        ...(isFirstBall(active, ti, frame) && t.pins === 9 ? [["isSinglePin", "Quille seule"], ["isSinglePinConverted", "Quille seule convertie"]] : []),
      ] as Array<["isPocket" | "isSplit" | "isSinglePin" | "isSinglePinConverted", string]>).map(([field, label]) => {
    const observed = t.observed === undefined || t.observed.includes(field);
        return <div key={field} className="space-y-1"><p className="text-xs">{label}</p><div className="grid grid-cols-3 gap-1" role="group" aria-label={`${label} lancer ${ti + 1}`}>
          {([undefined, true, false] as const).map((v, i) => <Button key={i} variant="outline" size="sm" className={cn("h-10 min-w-0 px-1 text-xs", (v === undefined ? !observed : observed && t[field] === v) && "border-bowling-accent bg-bowling-accent/10")} aria-pressed={v === undefined ? !observed : observed && t[field] === v} onClick={() => { if (!readOnly) onObservation(active, ti, field, v); }}>{i === 0 ? "Non saisi" : v ? "Oui" : "Non"}</Button>)}
        </div></div>;
      })}</div>)}</div>
    </details>

    <nav className="grid grid-cols-2 gap-2" aria-label="Navigation des frames"><Button variant="outline" className="h-12 min-w-0 gap-1 px-2 text-xs" onClick={() => select(Math.max(0, active - 1))}><ArrowLeft className="h-4 w-4 shrink-0" />Frame précédente</Button><Button variant="outline" className="h-12 min-w-0 gap-1 px-2 text-xs" onClick={() => select(Math.min(9, active + 1))}>Frame suivante<ArrowRight className="h-4 w-4 shrink-0" /></Button></nav>

    <details className="group border-t border-border pt-3"><summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-bowling-ink">Voir ma feuille de score<ChevronDown className="ml-auto h-4 w-4 group-open:rotate-180" /></summary><div className="mt-3 grid grid-cols-2 gap-2">{frames.map((f, i) => <Button key={i} variant="outline" className={cn("h-auto min-h-20 min-w-0 flex-col items-start gap-1 whitespace-normal bg-card p-3", i === active && "border-bowling-accent")} onClick={() => select(i)} aria-label={`Ouvrir frame ${i + 1}`}><span className="flex w-full items-center justify-between text-xs text-muted-foreground">Frame {i + 1}<Pencil className="h-3 w-3" /></span><span className="font-bold">{f.throws.filter(hasThrow).map(t => t.value).join("  ") || "—"}</span><span className="text-xs text-muted-foreground">{f.cumulativeScore !== null ? `Cumul ${f.cumulativeScore}` : isFrameComplete(f, i) ? "Bonus en attente" : "À compléter"}</span></Button>)}</div></details>
  </section>;
}