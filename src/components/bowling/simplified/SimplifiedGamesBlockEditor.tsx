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
    <Card className="space-y-4 rounded-[20px] border-0 bg-card p-5 shadow-[0_2px_12px_-4px_hsl(var(--foreground)/0.08)]">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="rounded-xl bg-warning/10 p-2.5">
            <Circle className="h-5 w-5 text-warning" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-primary">Parties #{index + 1}</p>
            <Input
              value={value.title}
              onChange={(e) => update({ title: e.target.value })}
              placeholder="Titre (facultatif)"
              className="mt-1 h-9 rounded-xl border-0 bg-bowling-canvas text-sm"
            />
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRemove}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {([
          ["quick", "Saisie rapide", "Juste les scores"],
          ["detailed", "Saisie détaillée", "Poches, spares, statistiques"],
        ] as const).map(([m, t, h]) => (
          <button
            key={m}
            type="button"
            onClick={() => update({ entry_mode: m })}
            className={`rounded-xl px-3 py-2.5 text-center transition-colors ${mode === m ? "bg-primary text-primary-foreground" : "bg-bowling-canvas text-foreground "}`}
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
                  className={`h-11 rounded-xl text-sm font-semibold transition-colors ${value.parties.length === n ? "bg-primary text-primary-foreground" : "bg-bowling-canvas "}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
            <div className="space-y-2">
              {value.parties.map((p, idx) => (
                <div key={p.id} className="flex items-center gap-3">
                  <span className="w-16 shrink-0 text-sm text-muted-foreground">Partie {idx + 1}</span>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={300}
                    placeholder="Score"
                    value={p.stats ? p.stats.totalScore : ""}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === "") return updateParty(p.id, { stats: null, frames: null });
                      const v = Math.max(0, Math.min(300, parseInt(raw, 10) || 0));
                      updateParty(p.id, { stats: quickScoreStats(v), frames: null });
                    }}
                    className="h-12 rounded-xl border-0 bg-bowling-canvas text-base"
                  />
                  {value.parties.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Supprimer la partie" onClick={() => {
                      if (p.stats && !window.confirm("Supprimer cette partie ?")) return;
                      removeParty(p.id);
                    }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addParty} className="gap-1">
                <Plus className="h-3.5 w-3.5" /> Ajouter une partie
              </Button>
            </div>
            <div className="flex flex-row sm:flex-col justify-around gap-2 rounded-2xl bg-bowling-accent/10 p-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Moyenne</p>
                <p className="text-2xl font-bold text-foreground">{agg ? agg.avgScore.toLocaleString("fr-FR") : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Meilleure partie</p>
                <p className="text-2xl font-bold text-foreground">{agg ? best : "—"}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {mode === "detailed" && (<>
      {/* Pocket toggle + global stats */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-bowling-canvas p-3">
        <div className="flex items-center gap-3">
          <Switch
            id={`pockets-${value.id}`}
            checked={value.track_pockets}
            onCheckedChange={(b) => update({ track_pockets: b })}
          />
          <Label htmlFor={`pockets-${value.id}`} className="text-sm cursor-pointer">
            Statistiques de poches
          </Label>
          <Badge variant="outline" className="text-[10px]">
            {value.track_pockets ? "Activé" : "Désactivé"}
          </Badge>
        </div>
        {agg && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              {agg.count} partie{agg.count > 1 ? "s" : ""} · Moy. {agg.avgScore}
            </Badge>
            <Badge variant="outline">Strike {agg.strikePct}%</Badge>
            <Badge variant="outline">Spare {agg.sparePct}%</Badge>
            {value.track_pockets && (
              <Badge variant="outline">Poche {agg.pocketPct}%</Badge>
            )}
          </div>
        )}
      </div>

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
            className="space-y-2 rounded-xl border border-border/60 bg-bowling-canvas p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Partie {idx + 1}</span>
                {p.stats && (
                  <Badge variant="outline" className="border-emerald-500 text-emerald-600">
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
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
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
    </Card>
  );
}
