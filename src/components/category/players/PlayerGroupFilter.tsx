import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlayerGroups } from "@/hooks/usePlayerGroups";

export const ALL_GROUPS = "__all__";

interface Props {
  categoryId?: string | null;
  /** Group id or ALL_GROUPS */
  value: string;
  onChange: (groupId: string) => void;
  className?: string;
}

/**
 * Sélecteur de groupe d'athlètes (générique toutes disciplines).
 * Retourne l'id du groupe sélectionné, ou ALL_GROUPS.
 */
export function PlayerGroupFilter({ categoryId, value, onChange, className }: Props) {
  const { data: groups = [] } = usePlayerGroups(categoryId);
  if (!categoryId || groups.length === 0) return null;

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn("h-9 w-[200px]", className)}>
        <div className="flex items-center gap-2 truncate">
          <Users className="h-4 w-4 text-muted-foreground shrink-0" />
          <SelectValue placeholder="Tous les athlètes" />
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_GROUPS}>Tous les athlètes</SelectItem>
        {groups.map((g) => (
          <SelectItem key={g.id} value={g.id}>
            <span className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: g.color }}
              />
              {g.name} ({g.playerIds.length})
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Ensemble des ids du groupe sélectionné, ou null si "tous". */
export function useGroupPlayerIds(categoryId?: string | null, groupId?: string) {
  const { data: groups = [] } = usePlayerGroups(categoryId);
  if (!groupId || groupId === ALL_GROUPS) return null;
  const group = groups.find((g) => g.id === groupId);
  return group ? new Set(group.playerIds) : null;
}
