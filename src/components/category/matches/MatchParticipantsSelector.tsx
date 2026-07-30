import { useQuery } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchCategoryRosterPlayers } from "@/lib/categoryRoster";

interface Props {
  categoryId: string;
  value: string[];
  onChange: (ids: string[]) => void;
  /** Map player_id → attendance status, shown as a badge (edit mode). */
  statuses?: Record<string, string>;
  label?: string;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  present: {
    label: "Présent",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40",
  },
  absent: {
    label: "Absent",
    className: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40",
  },
  no_response: {
    label: "Sans réponse",
    className: "bg-muted text-muted-foreground border-border",
  },
};

export function MatchParticipantsSelector({
  categoryId,
  value,
  onChange,
  statuses,
  label = "Participants convoqués",
}: Props) {
  const { data: players } = useQuery({
    queryKey: ["match-participants-roster", categoryId],
    queryFn: () => fetchCategoryRosterPlayers(categoryId),
    enabled: !!categoryId,
  });

  const list = (players || []) as any[];
  const allSelected = list.length > 0 && list.every((p) => value.includes(p.id));

  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5" /> {label}
        </Label>
        <div
          className="flex items-center gap-2 cursor-pointer"
          role="checkbox"
          aria-checked={allSelected}
          onClick={() => onChange(allSelected ? [] : list.map((p) => p.id))}
        >
          <Checkbox checked={allSelected} className="pointer-events-none" />
          <span className="text-xs pointer-events-none">Tous</span>
        </div>
      </div>

      <div className="max-h-[220px] overflow-y-auto rounded-lg border border-border/70 bg-muted/20 p-2 dark:bg-muted/10">
        {list.length === 0 ? (
          <p className="p-2 text-xs text-muted-foreground">Aucun athlète dans cette catégorie.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {list.map((player) => {
              const isSelected = value.includes(player.id);
              const status = statuses?.[player.id];
              const badge = status ? STATUS_BADGE[status] : undefined;
              return (
                <div
                  key={player.id}
                  onClick={() => toggle(player.id)}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all",
                    isSelected
                      ? "bg-primary/10 border-2 border-primary"
                      : "bg-muted/50 border-2 border-transparent hover:bg-muted",
                  )}
                >
                  <div
                    className={cn(
                      "h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium shrink-0 pointer-events-none",
                      isSelected ? "bg-primary text-primary-foreground" : "bg-muted-foreground/20",
                    )}
                  >
                    {(player.first_name || player.name || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0 pointer-events-none">
                    <p className="text-sm font-medium truncate">
                      {player.first_name ? `${player.first_name} ${player.name}` : player.name}
                    </p>
                    {player.position && (
                      <p className="text-xs text-muted-foreground truncate">{player.position}</p>
                    )}
                  </div>
                  {badge && isSelected && (
                    <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px] shrink-0", badge.className)}>
                      {badge.label}
                    </Badge>
                  )}
                  {isSelected && !badge && (
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0 pointer-events-none" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {value.length > 0 && (
        <Badge variant="secondary" className="w-fit">
          {value.length} athlète{value.length > 1 ? "s" : ""} convoqué{value.length > 1 ? "s" : ""}
        </Badge>
      )}
    </div>
  );
}

/** Delta-sync convoked participants for a match (keeps existing answers). */
export async function syncMatchParticipants(
  supabaseClient: typeof import("@/integrations/supabase/client")["supabase"],
  matchId: string,
  selected: string[],
  previous: string[] = [],
) {
  const toAdd = selected.filter((id) => !previous.includes(id));
  const toRemove = previous.filter((id) => !selected.includes(id));

  if (toAdd.length > 0) {
    const { error } = await supabaseClient
      .from("match_participants")
      .insert(toAdd.map((player_id) => ({ match_id: matchId, player_id })));
    if (error) throw error;
  }
  if (toRemove.length > 0) {
    const { error } = await supabaseClient
      .from("match_participants")
      .delete()
      .eq("match_id", matchId)
      .in("player_id", toRemove);
    if (error) throw error;
  }
}
