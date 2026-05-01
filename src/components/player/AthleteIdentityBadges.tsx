import { Badge } from "@/components/ui/badge";
import { Star } from "lucide-react";
import { useAthleteAttributes } from "@/hooks/useAthleteAttributes";

interface Props {
  playerId: string;
  /** Limiter aux dimensions affichées (par défaut : position + discipline) */
  dimensions?: string[];
  /** Afficher uniquement la valeur principale */
  primaryOnly?: boolean;
  className?: string;
}

/**
 * Affichage compact de l'identité athlète (postes, disciplines, styles…)
 * avec ⭐ sur la valeur principale.
 */
export function AthleteIdentityBadges({
  playerId,
  dimensions = ["position", "discipline", "style"],
  primaryOnly = false,
  className = "",
}: Props) {
  const { data: attrs = [] } = useAthleteAttributes(playerId);

  const filtered = attrs
    .filter((a) => dimensions.includes(a.dimension))
    .filter((a) => (primaryOnly ? a.is_primary : true));

  if (filtered.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {filtered.map((a) => (
        <Badge
          key={a.id}
          variant={a.is_primary ? "default" : "secondary"}
          className="gap-1 text-[10px] py-0 px-1.5 h-5"
        >
          {a.is_primary && <Star className="h-2.5 w-2.5 fill-current" />}
          {a.value}
        </Badge>
      ))}
    </div>
  );
}
