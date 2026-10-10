import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Circle, CheckCircle2 } from "lucide-react";
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

  return (
    <div className="space-y-4">
      <Input value={value.title} onChange={(e) => update({ title: e.target.value })} placeholder="Titre (facultatif)" className="h-10 rounded-xl border-0 bg-bowling-canvas text-sm" />

      <div className="grid grid-cols-2 gap-2">
        {([
          ["quick", "Saisie rapide", "Juste les scores"],
          ["detailed", "Saisie détaillée", "Poches, spares, statistiques"],
        ] as const).map(([m, t, h]) => (
          <button
            key={m}
            type="button"
            onClick={() => update({ entry_mode: m })}
            className={`rounded-xl px-3 py-2 text-center transition-colors ${mode === m ? "bg-bowling-ink text-card" : "bg-bowling-canvas text-foreground "}`}
          >
            <span className="block text-sm font-semibold">{t}</span>
            <span className={`block text-[11px] ${mode === m ? "opacity-80" : "text-muted-foreground"}`}>{h}</span>
          </button>
        ))}
      </div>

      {mode === "quick" && (
        <div className="space-y-3">
          <div>
            <Label className="text-sm font-semibold">Nombre de parties</Label>
            <div className="mt-2 grid grid-cols-6 gap-2">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCount(n)}
                  className={`h-10 rounded-xl text-sm font-semibold transition-colors ${value.parties.length === n ? "bg-bowling-ink text-card" : "bg-bowling-canvas "}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
            <div className="space-y-2">
              {value.parties.map((p, idx) => {
                const isBest = !!p.stats && agg !== null && agg.count > 1 && p.stats.totalScore === best;
                return (
                <div key={p.id} className="flex items-center gap-3">
                  <span className="w-16 shrink-0 text-sm text-muted-foreground">Partie {idx + 1}</span>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={300}
                    placeholder="Score"
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
                    className={`h-11 max-w-[140px] rounded-xl border-0 bg-bowling-canvas text-base font-semibold ${isBest ? "ring-2 ring-bowling-games" : ""}`}
                  />
                  {isBest && <span className="rounded-full bg-bowling-games/15 px-2 py-0.5 text-xs font-semibold text-bowling-games">Meilleure</span>}
                  <span className="flex-1" />
                  {value.parties.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Supprimer la partie" onClick={() => {
                      if (p.stats && !window.confirm("Supprimer cette partie ?")) return;
                      removeParty(p.id);
                    }}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                </div>
                );
              })}
              <Button type="button" variant="outline" size="sm" onClick={addParty} className="gap-1">
                <Plus className="h-3.5 w-3.5" /> Ajouter une partie
              </Button>
            </div>
            <div className="flex flex-row sm:flex-col justify-around gap-2 rounded-2xl bg-bowling-games/10 p-3 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Moyenne</p>
                <p className="text-2xl font-bold text-bowling-ink">{agg ? agg.avgScore.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Meilleure partie</p>
                <p className="text-2xl font-bold text-bowling-games">{agg ? best : "—"}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {mode === "detailed" && (<>
      {/* Résumé + statistiques avancées repliables */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold text-bowling-ink">{agg ? `${agg.count} partie${agg.count > 1 ? "s" : ""} · Moyenne ${agg.avgScore.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}` : "Aucune partie enregistrée"}</span>
        {agg && <span className="text-muted-foreground">· Meilleure {best}</span>}
      </div>
      <details className="rounded-xl bg-bowling-canvas px-3 py-2">
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

      {/* Oil pattern (masqué quand défini au niveau de la séance) */}
      {!hideOilPicker && (
        <SimplifiedOilPatternPicker
          value={value.oil_pattern}
          onChange={(op) => update({ oil_pattern: op })}
          categoryId={categoryId}
        />
      )}


      {/* Parties */}
      <div className="space-y-3">
        {value.parties.map((p, idx) => (
          <div
            key={p.id}
            className="space-y-2 rounded-xl bg-bowling-canvas p-2 sm:p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Partie {idx + 1}</span>
                {p.stats && (
                  <Badge variant="outline" className="border-bowling-games text-bowling-games">
                    {p.stats.totalScore}
                  </Badge>
                )}
              </div>
              {value.parties.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => removeParty(p.id)}
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              )}
            </div>

            <BowlingScoreSheet
              key={`${p.id}-${value.track_pockets}`}
              initialFrames={p.frames ?? undefined}
              playerId={playerId}
              categoryId={categoryId}
              trackPockets={value.track_pockets}
              onSave={(stats, frames, ballData) =>
                updateParty(p.id, {
                  stats,
                  frames,
                  ball_id: ballData?.ballId ?? p.ball_id ?? null,
                })
              }
            />
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addParty}
          className="gap-1"
        >
          <Plus className="h-3.5 w-3.5" />
          Ajouter une partie
        </Button>
      </div>
      </>)}

      {mode === "quick" && !hideOilPicker && (
        <SimplifiedOilPatternPicker
          value={value.oil_pattern}
          onChange={(op) => update({ oil_pattern: op })}
          categoryId={categoryId}
        />
      )}
    </div>
  );
}
