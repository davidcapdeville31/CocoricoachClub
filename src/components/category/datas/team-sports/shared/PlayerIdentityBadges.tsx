import { useAthleteAttributes } from "@/hooks/useAthleteAttributes";
import { Badge } from "@/components/ui/badge";

interface Props {
  playerId: string;
  compact?: boolean;
  max?: number;
}

export function PlayerIdentityBadges({ playerId, compact = false, max = 4 }: Props) {
  const { data: attrs = [] } = useAthleteAttributes(playerId);
  if (!attrs.length) return null;
  const items = attrs.slice(0, max);
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((a) => (
        <Badge
          key={a.id}
          variant={a.is_primary ? "default" : "secondary"}
          className={compact ? "text-[9px] py-0 h-4 px-1.5" : "text-[10px]"}
        >
          {a.is_primary && "⭐ "}{a.value}
        </Badge>
      ))}
    </div>
  );
}
