import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlayerGroups } from "@/hooks/usePlayerGroups";

interface Props {
  categoryId?: string | null;
  /** Currently selected player ids. */
  value: string[];
  onChange: (ids: string[]) => void;
  /** Ids visible in the surrounding list (groups are intersected with it). */
  availableIds?: string[];
  className?: string;
}

/**
 * Barre de pastilles de groupes d'athlètes : un clic coche tous les membres
 * du groupe, un second clic les décoche. Générique toutes disciplines.
 */
export function PlayerGroupChips({ categoryId, value, onChange, availableIds, className }: Props) {
  const { data: groups = [] } = usePlayerGroups(categoryId);

  if (!categoryId || groups.length === 0) return null;

  const allowed = availableIds ? new Set(availableIds) : null;

  const visibleGroups = groups
    .map((g) => ({
      ...g,
      memberIds: allowed ? g.playerIds.filter((id) => allowed.has(id)) : g.playerIds,
    }))
    .filter((g) => g.memberIds.length > 0);

  if (visibleGroups.length === 0) return null;

  /**
   * Un clic sélectionne EXACTEMENT les athlètes du groupe (les autres sont
   * décochés). Un second clic sur le même groupe vide la sélection.
   */
  const toggleGroup = (memberIds: string[], exclusive: boolean) => {
    if (exclusive) {
      onChange(value.filter((id) => (allowed ? !allowed.has(id) : false)));
    } else {
      const outsideList = allowed ? value.filter((id) => !allowed.has(id)) : [];
      onChange(Array.from(new Set([...outsideList, ...memberIds])));
    }
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Users className="h-3.5 w-3.5" /> Groupes
      </span>
      {visibleGroups.map((g) => {
        const active = g.memberIds.every((id) => value.includes(id));
        return (
          <Badge
            key={g.id}
            variant="outline"
            role="button"
            tabIndex={0}
            onClick={() => toggleGroup(g.memberIds, active)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggleGroup(g.memberIds, active);
              }
            }}
            className={cn(
              "cursor-pointer select-none gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors",
              active ? "text-primary-foreground" : "hover:bg-muted",
            )}
            style={
              active
                ? { backgroundColor: g.color, borderColor: g.color, color: "#fff" }
                : { borderColor: g.color, color: g.color }
            }
          >
            {g.name}
            <span className="opacity-80">{g.memberIds.length}</span>
          </Badge>
        );
      })}
    </div>
  );
}
