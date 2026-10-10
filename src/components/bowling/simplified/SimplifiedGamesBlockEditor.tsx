import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, BarChart3, ChevronDown, TrendingUp } from "lucide-react";
import { SimplifiedOilPatternPicker } from "./SimplifiedOilPatternPicker";
import { BowlingScoreSheet } from "@/components/athlete-portal/BowlingScoreSheet";
import {
  aggregateGamesStats,
  newGameEntry,
  quickScoreStats,
  type SimplifiedGameEntry,
  type SimplifiedGamesBlock,
} from "./types";

interface Props {
  value: SimplifiedGamesBlock;
  index: number;
  categoryId: string;
  playerId?: string;
  onChange: (next: SimplifiedGamesBlock) => void;
  onRemove: () => void;
  /** Si true, le sélecteur de huilage par bloc est masqué (le huilage est défini au niveau de la séance). */
  hideOilPicker?: boolean;
  /** Mise en page en cartes (étape Parties). */
  premium?: boolean;
}

export function SimplifiedGamesBlockEditor({
  value,
  index,
  categoryId,
  playerId,
  onChange,
  onRemove,
  hideOilPicker,
}: Props) {
  const card = "rounded-[20px] border border-border/40 bg-card p-4 sm:p-5 shadow-[0_6px_20px_-10px_hsl(var(--bowling-ink)/0.18)]";

  const update = (patch: Partial<SimplifiedGamesBlock>) =>
    onChange({ ...value, ...patch });

  const updateParty = (id: string, patch: Partial<SimplifiedGameEntry>) =>
    update({
      parties: value.parties.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    });

  const addParty = () =>
    update({ parties: [...value.parties, newGameEntry()] });

  const removeParty = (id: string) => {
    if (value.parties.length <= 1) return;
    update({ parties: value.parties.filter((p) => p.id !== id) });
  };

  const agg = aggregateGamesStats(value);
  const mode = value.entry_mode ?? "detailed";
  const best = Math.max(0, ...value.parties.map((p) => p.stats?.totalScore || 0));

  const setCount = (n: number) => {
    const cur = value.parties;
    if (n === cur.length) return;
    if (n > cur.length) update({ parties: [...cur, ...Array.from({ length: n - cur.length }, newGameEntry)] });
    else {
      const dropped = cur.slice(n).some((p) => p.stats);
      if (dropped && !window.confirm("Supprimer les dernières parties déjà saisies ?")) return;
      update({ parties: cur.slice(0, n) });
    }
  };

  const avgFmt = agg ? agg.avgScore.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) : null;
  const firstScore = value.parties.find((p) => p.stats)?.stats?.totalScore ?? null;
  const trend = agg && agg.count > 1 && firstScore !== null ? Math.round((agg.avgScore - firstScore) * 10) / 10 : null;
  const pinIcon = <span className="text-lg leading-none" aria-hidden>🎳</span>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 rounded-[20px] border border-border/40 bg-card p-1.5 shadow-[0_6px_20px_-10px_hsl(var(--bowling-ink)/0.18)]">
        {([
          ["quick", "Saisie rapide", "Juste les scores"],
          ["detailed", "Saisie détaillée", "Poches, spares, statistiques"],
        ] as const).map(([m, t, h]) => (
          <button key={m} type="button" onClick={() => update({ entry_mode: m })} aria-pressed={mode === m}
            className={`rounded-2xl px-3 py-3 text-center transition-all duration-200 ${mode === m ? "bg-bowling-ink text-card shadow-md" : "text-bowling-ink hover:bg-bowling-field"}`}>
            <span className="block text-sm font-semibold">{t}</span>
            <span className={`block text-[11px] sm:text-xs ${mode === m ? "text-card/75" : "text-muted-foreground"}`}>{h}</span>
          </button>
        ))}
      </div>

      {mode === "quick" && (<>
        <div className={card}>
          <p className="mb-3 flex items-center gap-2.5 text-base font-semibold text-bowling-ink">{pinIcon}Nombre de parties</p>
          <div className="grid grid-cols-6 gap-2">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <button key={n} type="button" onClick={() => setCount(n)}
                className={`h-11 rounded-xl text-base font-semibold transition-all active:scale-[0.97] ${value.parties.length === n ? "bg-bowling-ink text-card shadow-md" : "border border-border/70 bg-card text-bowling-ink hover:bg-bowling-field"}`}>{n}</button>
            ))}
          </div>
        </div>

        <div className={card}>
          <div className="mb-3 flex items-center justify-between">
            <p className="flex items-center gap-2.5 text-base font-semibold text-bowling-ink"><BarChart3 className="h-5 w-5 text-bowling-accent" />Scores</p>
            {value.parties.length > 1 && value.parties.some((p) => p.stats) && (
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Effacer tous les scores" onClick={() => {
                if (!window.confirm("Effacer tous les scores saisis ?")) return;
                update({ parties: value.parties.map((p) => ({ ...p, stats: null, frames: null })) });
              }}><Trash2 className="h-4 w-4 text-bowling-coral" /></Button>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_170px]">
            <div className="space-y-2.5">
              {value.parties.map((p, idx) => {
                const isBest = !!p.stats && agg !== null && agg.count > 1 && p.stats.totalScore === best;
                return (
                  <div key={p.id} className="flex items-center gap-3">
                    <span className="w-16 shrink-0 text-[15px] text-bowling-ink">Partie {idx + 1}</span>
                    <Input type="number" inputMode="numeric" min={0} max={300} placeholder="Score"
                      data-quick-score={value.id}
                      enterKeyHint={idx < value.parties.length - 1 ? "next" : "done"}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        const all = Array.from(document.querySelectorAll<HTMLInputElement>(`input[data-quick-score="${value.id}"]`));
                        const next = all[idx + 1];
                        if (next) { next.focus(); next.select(); } else (e.target as HTMLInputElement).blur();
                      }}
                      value={p.stats ? p.stats.totalScore : ""}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === "") return updateParty(p.id, { stats: null, frames: null });
                        const v = Math.max(0, Math.min(300, parseInt(raw, 10) || 0));
                        updateParty(p.id, { stats: quickScoreStats(v), frames: null });
                      }}
                      className={`h-12 max-w-[150px] rounded-xl border-border/70 bg-card text-base font-semibold text-bowling-ink ${isBest ? "ring-2 ring-bowling-games" : ""}`} />
                    {isBest && <span className="rounded-full bg-bowling-games/15 px-2 py-0.5 text-xs font-semibold text-bowling-games">Meilleure</span>}
                    <span className="flex-1" />
                    {value.parties.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Supprimer la partie" onClick={() => {
                        if (p.stats && !window.confirm("Supprimer cette partie ?")) return;
                        removeParty(p.id);
                      }}><Trash2 className="h-4 w-4 text-muted-foreground" /></Button>
                    )}
                  </div>
                );
              })}
              <Button type="button" variant="outline" size="sm" onClick={addParty} className="gap-1 rounded-xl"><Plus className="h-3.5 w-3.5" /> Ajouter une partie</Button>
            </div>
            <div className="flex flex-row items-center justify-around gap-2 rounded-2xl bg-bowling-accent/10 p-4 text-center sm:flex-col sm:justify-center">
              <div>
                <p className="text-xs text-muted-foreground">Moyenne</p>
                <p className="text-[26px] font-bold leading-tight text-bowling-ink">{avgFmt ?? "—"}</p>
                {trend !== null && trend !== 0 && (
                  <p className={`flex items-center justify-center gap-0.5 text-xs font-semibold ${trend > 0 ? "text-bowling-success" : "text-bowling-coral"}`}><TrendingUp className={`h-3.5 w-3.5 ${trend < 0 ? "rotate-180" : ""}`} />{trend > 0 ? "+" : ""}{trend.toLocaleString("fr-FR")}</p>
                )}
              </div>
              <div className="sm:mt-2">
                <p className="text-xs text-muted-foreground">Meilleure partie</p>
                <p className="text-[22px] font-bold leading-tight text-bowling-games">{agg ? best : "—"}</p>
              </div>
            </div>
          </div>
        </div>

        <details className={`${card} group`}>
          <summary className="flex cursor-pointer list-none items-center gap-2.5 text-base font-semibold text-bowling-ink">
            {pinIcon}Détails des lancers <span className="font-normal text-muted-foreground">(optionnel)</span>
            <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="gap-1 rounded-xl" onClick={() => update({ entry_mode: "detailed", track_pockets: true })}><Plus className="h-3.5 w-3.5" />Ajouter les poches</Button>
            <Button type="button" variant="outline" size="sm" className="gap-1 rounded-xl" onClick={() => update({ entry_mode: "detailed" })}><Plus className="h-3.5 w-3.5" />Feuille de score complète</Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Passe en saisie détaillée pour noter strikes, spares et poches frame par frame.</p>
        </details>
      </>)}

      {mode === "detailed" && (<>
        <div className={card}>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <BarChart3 className="h-5 w-5 text-bowling-accent" />
            <span className="font-semibold text-bowling-ink">{agg ? `${agg.count} partie${agg.count > 1 ? "s" : ""} · Moyenne ${avgFmt}` : "Aucune partie enregistrée"}</span>
            {agg && <span className="text-muted-foreground">· Meilleure {best}</span>}
          </div>
          <details className="mt-3 rounded-xl bg-bowling-field px-3 py-2">
            <summary className="cursor-pointer list-none text-sm font-medium text-muted-foreground hover:text-foreground">+ Statistiques avancées</summary>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch id={`pockets-${value.id}`} checked={value.track_pockets} onCheckedChange={(b) => update({ track_pockets: b })} />
                <Label htmlFor={`pockets-${value.id}`} className="cursor-pointer text-sm">Statistiques de poches</Label>
              </div>
              {agg ? (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="outline">Strike {agg.strikePct}%</Badge>
                  <Badge variant="outline">Spare {agg.sparePct}%</Badge>
                  {value.track_pockets && <Badge variant="outline">Poche {agg.pocketPct}%</Badge>}
                </div>
              ) : <span className="text-xs text-muted-foreground">Disponibles après la première partie enregistrée.</span>}
            </div>
          </details>
        </div>

        {!hideOilPicker && (
          <SimplifiedOilPatternPicker value={value.oil_pattern} onChange={(op) => update({ oil_pattern: op })} categoryId={categoryId} />
        )}

        {value.parties.map((p, idx) => (
          <div key={p.id} className={`${card} space-y-2 !p-2 sm:!p-4`}>
            <div className="flex items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-bowling-ink">Partie {idx + 1}</span>
                {p.stats && <Badge variant="outline" className="border-bowling-games text-bowling-games">{p.stats.totalScore}</Badge>}
              </div>
              {value.parties.length > 1 && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeParty(p.id)}><Trash2 className="h-3.5 w-3.5 text-muted-foreground" /></Button>
              )}
            </div>
            <BowlingScoreSheet
              key={`${p.id}-${value.track_pockets}`}
              initialFrames={p.frames ?? undefined}
              playerId={playerId}
              categoryId={categoryId}
              trackPockets={value.track_pockets}
              onSave={(stats, frames, ballData) => updateParty(p.id, { stats, frames, ball_id: ballData?.ballId ?? p.ball_id ?? null })}
            />
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addParty} className="gap-1 rounded-xl"><Plus className="h-3.5 w-3.5" /> Ajouter une partie</Button>
      </>)}

      {mode === "quick" && !hideOilPicker && (
        <SimplifiedOilPatternPicker value={value.oil_pattern} onChange={(op) => update({ oil_pattern: op })} categoryId={categoryId} />
      )}
    </div>
  );
}
