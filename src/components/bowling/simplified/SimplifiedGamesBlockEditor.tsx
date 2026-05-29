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
}

export function SimplifiedGamesBlockEditor({
  value,
  index,
  categoryId,
  playerId,
  onChange,
  onRemove,
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

  return (
    <Card className="space-y-4 rounded-2xl border-l-4 border-l-amber-500 bg-surface p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="rounded-lg bg-amber-500/10 p-2">
            <Circle className="h-4 w-4 text-amber-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Bloc {index + 1} · Parties
            </p>
            <Input
              value={value.title}
              onChange={(e) => update({ title: e.target.value })}
              placeholder="Titre du bloc (optionnel)"
              className="mt-1 h-8 text-sm"
            />
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRemove}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      {/* Pocket toggle + global stats */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-surface-sunken p-3">
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

      {/* Oil pattern */}
      <SimplifiedOilPatternPicker
        value={value.oil_pattern}
        onChange={(op) => update({ oil_pattern: op })}
        categoryId={categoryId}
      />

      {/* Parties */}
      <div className="space-y-3">
        {value.parties.map((p, idx) => (
          <div
            key={p.id}
            className="space-y-2 rounded-xl border border-border/60 bg-surface-sunken p-3"
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
    </Card>
  );
}
