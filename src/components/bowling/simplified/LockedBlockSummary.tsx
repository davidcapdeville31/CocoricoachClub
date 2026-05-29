import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Pencil, Trash2, Target, Wrench, Clock } from "lucide-react";
import {
  technicalThemeLabel,
  type SimplifiedBlock,
} from "./types";

interface Props {
  block: SimplifiedBlock;
  index: number;
  onEdit: () => void;
  onRemove: () => void;
}

/**
 * Vue compacte d'un bloc verrouillé (enregistré).
 * Le bouton "Modifier" rebascule le bloc en édition.
 */
export function LockedBlockSummary({ block, index, onEdit, onRemove }: Props) {
  const isTactical = block.type === "tactical";

  return (
    <Card className="rounded-2xl border-l-4 border-l-emerald-500 bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className={`rounded-lg p-2 ${isTactical ? "bg-blue-500/10" : "bg-emerald-500/10"}`}>
            {isTactical ? (
              <Target className="h-4 w-4 text-blue-600" />
            ) : (
              <Wrench className="h-4 w-4 text-emerald-600" />
            )}
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Bloc {index + 1} · {isTactical ? "Tactique" : "Technique"}
              </span>
              <Badge variant="secondary" className="gap-1 text-[10px]">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                Enregistré
              </Badge>
            </div>

            {isTactical ? (
              <TacticalSummary block={block as Extract<SimplifiedBlock, { type: "tactical" }>} />
            ) : (
              <TechnicalSummary block={block as Extract<SimplifiedBlock, { type: "technical" }>} />
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onEdit}
            className="h-8 gap-1"
          >
            <Pencil className="h-3.5 w-3.5" />
            Modifier
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onRemove}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

function TacticalSummary({ block }: { block: Extract<SimplifiedBlock, { type: "tactical" }> }) {
  const totalAttempts = block.items.reduce((s, it) => s + (it.attempts || 0), 0);
  const totalSuccess = block.items.reduce((s, it) => s + (it.success || 0), 0);
  const pct = totalAttempts > 0 ? Math.round((totalSuccess / totalAttempts) * 100) : null;

  return (
    <div className="space-y-1">
      {block.title && <p className="text-sm font-medium">{block.title}</p>}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {block.duration_min} min
        </span>
        <span>
          {block.items.length} situation{block.items.length > 1 ? "s" : ""}
        </span>
        {pct !== null && (
          <span className="font-medium text-foreground">
            {totalSuccess}/{totalAttempts} ({pct}%)
          </span>
        )}
        {block.oil_pattern.preset_name && (
          <span>Huilage : {block.oil_pattern.preset_name}</span>
        )}
      </div>
    </div>
  );
}

function TechnicalSummary({ block }: { block: Extract<SimplifiedBlock, { type: "technical" }> }) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium">{technicalThemeLabel(block)}</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {block.duration_min} min
        </span>
      </div>
      {block.description?.trim() && (
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {block.description}
        </p>
      )}
    </div>
  );
}
