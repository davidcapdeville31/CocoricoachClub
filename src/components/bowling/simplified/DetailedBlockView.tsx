import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Target,
  Wrench,
  Circle,
  Clock,
  CircleDot,
  Droplet,
  CheckCircle2,
  XCircle,
  StickyNote,
  Trophy,
} from "lucide-react";
import {
  aggregateGamesStats,
  itemLabel,
  technicalThemeLabel,
  type SimplifiedBlock,
  type SimplifiedOilPattern,
} from "./types";
import { getOilCategory } from "@/lib/constants/bowlingOilPatterns";
import { useBallName } from "./SimplifiedBallPicker";

interface Props {
  block: SimplifiedBlock;
  index: number;
  categoryId: string;
  playerId?: string;
}

/**
 * Vue détaillée et exhaustive d'un bloc bowling pour la consultation coach.
 * Affiche TOUS les éléments saisis : items tactiques avec taux de réussite,
 * description et notes techniques, scores par partie, infos huilage complètes,
 * boule utilisée.
 */
export function DetailedBlockView({ block, index, categoryId, playerId }: Props) {
  const isTactical = block.type === "tactical";
  const isTechnical = block.type === "technical";
  const isGames = block.type === "games";
  const ballName = useBallName(playerId, categoryId, (block as any).ball_id ?? null);

  const iconBg = isTactical
    ? "bg-blue-500/10"
    : isTechnical
    ? "bg-emerald-500/10"
    : "bg-amber-500/10";
  const borderColor = isTactical
    ? "border-l-blue-500"
    : isTechnical
    ? "border-l-emerald-500"
    : "border-l-amber-500";
  const Icon = isTactical ? Target : isTechnical ? Wrench : Circle;
  const iconColor = isTactical
    ? "text-blue-600"
    : isTechnical
    ? "text-emerald-600"
    : "text-amber-600";
  const typeLabel = isTactical ? "Tactique" : isTechnical ? "Technique" : "Parties";

  const title =
    (block as any).title?.trim() ||
    (isTechnical ? technicalThemeLabel(block as any) : `${typeLabel} ${index + 1}`);
  const duration =
    "duration_min" in block && typeof (block as any).duration_min === "number"
      ? (block as any).duration_min
      : null;

  return (
    <Card className={`rounded-2xl border-l-4 ${borderColor} bg-surface p-4 shadow-sm`}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={`rounded-lg p-2 ${iconBg}`}>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Bloc {index + 1} · {typeLabel}
            </span>
            <Badge variant="secondary" className="gap-1 text-[10px]">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              Enregistré
            </Badge>
            {duration !== null && (
              <Badge variant="outline" className="gap-1 text-[10px]">
                <Clock className="h-3 w-3" />
                {duration} min
              </Badge>
            )}
            {ballName && (
              <Badge variant="outline" className="gap-1 text-[10px]">
                <CircleDot className="h-3 w-3" />
                {ballName}
              </Badge>
            )}
          </div>
          <p className="text-sm font-semibold">{title}</p>
        </div>
      </div>

      {/* Contenu spécifique */}
      <div className="mt-3 space-y-3">
        {isTactical && <TacticalDetail block={block as any} />}
        {isTechnical && <TechnicalDetail block={block as any} />}
        {isGames && <GamesDetail block={block as any} />}

        {(isTactical || isGames) && (
          <OilPatternDetail oil={(block as any).oil_pattern} />
        )}
      </div>
    </Card>
  );
}

/* ------------------------------ Tactique ------------------------------ */

function TacticalDetail({ block }: { block: Extract<SimplifiedBlock, { type: "tactical" }> }) {
  const total = block.items.reduce(
    (s, it) => ({ a: s.a + (it.attempts || 0), r: s.r + (it.success || 0) }),
    { a: 0, r: 0 },
  );
  const pct = total.a > 0 ? Math.round((total.r / total.a) * 100) : null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="outline">
          {block.items.length} situation{block.items.length > 1 ? "s" : ""}
        </Badge>
        {pct !== null && (
          <Badge variant="secondary" className="font-medium">
            Réussite globale : {total.r}/{total.a} ({pct}%)
          </Badge>
        )}
      </div>

      {block.items.length > 0 && (
        <div className="rounded-lg border bg-background/60 divide-y">
          {block.items.map((it, i) => {
            const itPct = it.attempts > 0 ? Math.round((it.success / it.attempts) * 100) : null;
            const ok = itPct !== null && itPct >= 60;
            return (
              <div key={it.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                <span className="w-5 text-muted-foreground">{i + 1}.</span>
                <span className="flex-1 font-medium">{itemLabel(it)}</span>
                <span className="text-muted-foreground">
                  {it.success}/{it.attempts}
                </span>
                {itPct !== null && (
                  <Badge
                    variant="outline"
                    className={
                      ok
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300"
                    }
                  >
                    {itPct}%
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      )}

      {block.notes?.trim() && <NoteBlock text={block.notes} />}
    </div>
  );
}

/* ------------------------------ Technique ------------------------------ */

function TechnicalDetail({
  block,
}: {
  block: Extract<SimplifiedBlock, { type: "technical" }>;
}) {
  return (
    <div className="space-y-2 text-xs">
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">Thème : {technicalThemeLabel(block)}</Badge>
      </div>
      {block.description?.trim() && (
        <div className="rounded-lg border bg-background/60 p-3">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Description
          </p>
          <p className="whitespace-pre-wrap text-sm">{block.description}</p>
        </div>
      )}
      {block.notes?.trim() && <NoteBlock text={block.notes} />}
    </div>
  );
}

/* ------------------------------ Parties ------------------------------ */

function GamesDetail({ block }: { block: Extract<SimplifiedBlock, { type: "games" }> }) {
  const agg = aggregateGamesStats(block);

  return (
    <div className="space-y-2">
      {agg && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Total" value={agg.totalScore} icon={<Trophy className="h-3 w-3" />} />
          <Stat label="Moyenne" value={agg.avgScore} />
          <Stat label="Strike" value={`${agg.strikePct}%`} sub={`${agg.strikes}`} />
          <Stat label="Spare" value={`${agg.sparePct}%`} sub={`${agg.spares}`} />
          {block.track_pockets && (
            <Stat label="Poche" value={`${agg.pocketPct}%`} sub={`${agg.pockets}`} />
          )}
          <Stat label="Splits" value={`${agg.splitsConv}/${agg.splits}`} />
          <Stat label="Quilles seules" value={`${agg.singlesConv}/${agg.singles}`} />
        </div>
      )}

      {block.parties.length > 0 && (
        <div className="rounded-lg border bg-background/60 divide-y text-xs">
          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Détail par partie
          </div>
          {block.parties.map((p, i) => (
            <PartyRow key={p.id} index={i} party={p} trackPockets={block.track_pockets} />
          ))}
        </div>
      )}
    </div>
  );
}

function PartyRow({
  index,
  party,
  trackPockets,
}: {
  index: number;
  party: import("./types").SimplifiedGameEntry;
  trackPockets: boolean;
}) {
  const s = party.stats;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
      <span className="font-semibold">Partie {index + 1}</span>
      {s ? (
        <>
          <span className="font-medium">{s.totalScore}</span>
          <span className="text-muted-foreground">Strikes {s.strikes}</span>
          <span className="text-muted-foreground">Spares {s.spares}</span>
          {trackPockets && (
            <span className="text-muted-foreground">
              Poche {s.pocketCount}/{s.totalThrows}
            </span>
          )}
          {s.splitCount > 0 && (
            <span className="text-muted-foreground">
              Splits {s.splitConverted}/{s.splitCount}
            </span>
          )}
        </>
      ) : (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <XCircle className="h-3 w-3" /> non saisie
        </span>
      )}
    </div>
  );
}

/* ------------------------------ Huilage ------------------------------ */

function OilPatternDetail({ oil }: { oil: SimplifiedOilPattern | undefined }) {
  if (!oil) return null;
  const cat = getOilCategory(oil.oil_ratio);
  const hasAny =
    oil.preset_name ||
    oil.length_feet ||
    oil.buff_distance_feet ||
    oil.width_boards ||
    oil.total_volume_ml ||
    oil.oil_ratio ||
    oil.profile_type ||
    oil.outside_friction;
  if (!hasAny) return null;

  return (
    <div className="rounded-lg border bg-background/60 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Droplet className="h-3.5 w-3.5 text-cyan-600" />
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Huilage
        </p>
        {cat && (
          <Badge variant="outline" className={`text-[10px] ${cat.color}`}>
            {cat.label}
          </Badge>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-3">
        {oil.preset_name && <Info label="Preset" value={oil.preset_name} />}
        {oil.length_feet != null && <Info label="Longueur" value={`${oil.length_feet} ft`} />}
        {oil.buff_distance_feet != null && (
          <Info label="Buff" value={`${oil.buff_distance_feet} ft`} />
        )}
        {oil.width_boards != null && <Info label="Largeur" value={`${oil.width_boards} planches`} />}
        {oil.total_volume_ml != null && (
          <Info label="Volume" value={`${oil.total_volume_ml} ml`} />
        )}
        {oil.oil_ratio && <Info label="Ratio" value={oil.oil_ratio} />}
        {oil.profile_type && <Info label="Profil" value={oil.profile_type} />}
        {oil.outside_friction && <Info label="Friction ext." value={oil.outside_friction} />}
        <Info label="Forward" value={oil.forward_oil ? "Oui" : "Non"} />
        <Info label="Reverse" value={oil.reverse_oil ? "Oui" : "Non"} />
      </div>
    </div>
  );
}

/* ------------------------------ Bricks ------------------------------ */

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-background/60 p-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-sm font-semibold">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function NoteBlock({ text }: { text: string }) {
  return (
    <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 text-xs">
      <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
      <p className="whitespace-pre-wrap italic text-foreground/90">{text}</p>
    </div>
  );
}
