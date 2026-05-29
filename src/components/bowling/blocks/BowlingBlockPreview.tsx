import { Badge } from "@/components/ui/badge";
import { getParamLabel } from "@/lib/constants/bowlingTechnicalParameters";
import { outcomeLabel } from "@/lib/constants/bowlingTargetOutcomes";
import { zoneShort } from "@/lib/constants/bowlingTacticalZones";
import type { BowlingBlockDraft } from "./types";

interface Props {
  block: BowlingBlockDraft;
}

const BLOCK_LABEL: Record<string, string> = {
  warmup: "Échauffement",
  technical: "Technique",
  tactical: "Tactique",
  games: "Parties",
};

/** Génère un titre auto si vide. */
export function buildAutoTitle(block: BowlingBlockDraft): string {
  if (block.title.trim()) return block.title.trim();
  const parts: string[] = [BLOCK_LABEL[block.block_type] || block.block_type];
  if (block.block_type === "technical" && block.config.parameters?.length) {
    parts.push(getParamLabel(block.config.parameters[0]));
  }
  if (block.block_type === "tactical" && block.config.zones?.length) {
    parts.push(block.config.zones.map(zoneShort).slice(0, 3).join("/"));
  }
  if (block.block_type === "games" && block.config.games_count) {
    parts.push(`${block.config.games_count} parties`);
  }
  if (block.planned_throws) parts.push(`${block.planned_throws} lancers`);
  return parts.join(" — ");
}

export function BowlingBlockPreview({ block }: Props) {
  const auto = buildAutoTitle(block);
  return (
    <div className="rounded-xl border bg-gradient-to-br from-primary/8 to-primary/2 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{auto}</p>
        <Badge variant="outline" className="text-[10px]">{BLOCK_LABEL[block.block_type]}</Badge>
      </div>
      <div className="flex flex-wrap gap-1">
        {block.config.parameters?.map((p) => (
          <Badge key={p} variant="secondary" className="text-[10px]">{getParamLabel(p)}</Badge>
        ))}
        {block.config.zones?.map((z) => (
          <Badge key={z} variant="secondary" className="text-[10px]">{zoneShort(z)}</Badge>
        ))}
        {block.objectives.map((o) => (
          <Badge key={o} className="text-[10px] bg-primary/15 text-primary border-primary/30">
            🎯 {outcomeLabel(o)}
          </Badge>
        ))}
      </div>
      <div className="text-[11px] text-muted-foreground flex flex-wrap gap-3">
        <span>⏱ {block.duration_min} min</span>
        <span>🎳 {block.planned_throws} lancers</span>
        <span>⚡ Priorité {block.priority === "high" ? "élevée" : block.priority === "low" ? "faible" : "moyenne"}</span>
      </div>
    </div>
  );
}
