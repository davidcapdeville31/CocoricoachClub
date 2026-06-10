import { CalendarCheck } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useSeasonRosterFilter } from "@/contexts/SeasonRosterFilterContext";

interface Props {
  className?: string;
}

export function SeasonRosterFilterToggle({ className }: Props) {
  const { available, activeSeasonOnly, setActiveSeasonOnly, activeSeasonName } = useSeasonRosterFilter();

  if (!available) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface-elevated px-3 py-1.5 shadow-sm ${className ?? ""}`}
          >
            <CalendarCheck className="h-4 w-4 text-primary" />
            <Label htmlFor="season-roster-filter" className="text-xs font-medium cursor-pointer whitespace-nowrap">
              Saison active uniquement
            </Label>
            <Switch
              id="season-roster-filter"
              checked={activeSeasonOnly}
              onCheckedChange={setActiveSeasonOnly}
              className="scale-90"
            />
            {activeSeasonOnly && activeSeasonName && (
              <Badge variant="secondary" className="text-[10px] h-5">
                {activeSeasonName}
              </Badge>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          Affiche uniquement les athlètes rattachés à la saison active (configurée dans Admin&nbsp;club&nbsp;›&nbsp;Saisons). Désactivé&nbsp;= effectif complet.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
