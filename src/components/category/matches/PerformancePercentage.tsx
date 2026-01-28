import { useActiveReference, calculatePercentageOfReference } from "@/hooks/use-performance-references";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TrendingUp, TrendingDown, Minus, Target } from "lucide-react";

interface PerformancePercentageProps {
  categoryId: string;
  playerId: string;
  currentVmax?: number | null;
  currentAccelerations?: number | null;
  currentPlayerLoad?: number | null;
  currentDurationMinutes?: number | null;
  currentHsDistance?: number | null;
  compact?: boolean;
}

export function PerformancePercentage({
  categoryId,
  playerId,
  currentVmax,
  currentAccelerations,
  currentPlayerLoad,
  currentDurationMinutes,
  currentHsDistance,
  compact = false,
}: PerformancePercentageProps) {
  const { data: reference, isLoading } = useActiveReference(categoryId, playerId);

  if (isLoading || !reference) {
    return null;
  }

  const vmaxPercent = calculatePercentageOfReference(currentVmax, reference.ref_vmax_ms);
  
  // Calculate per-minute values for comparison
  const duration = currentDurationMinutes || 1;
  const currentLoadPerMin = currentPlayerLoad ? currentPlayerLoad / duration : null;
  const currentHsPerMin = currentHsDistance ? currentHsDistance / duration : null;
  
  const loadPercent = calculatePercentageOfReference(currentLoadPerMin, reference.ref_player_load_per_min);
  const hsPercent = calculatePercentageOfReference(currentHsPerMin, reference.ref_high_intensity_distance_per_min);

  const getPercentBadge = (percent: number | null, label: string, refValue: string) => {
    if (percent === null) return null;

    let variant: "default" | "secondary" | "destructive" | "outline" = "secondary";
    let Icon = Minus;
    
    if (percent >= 95) {
      variant = "default";
      Icon = TrendingUp;
    } else if (percent >= 80) {
      variant = "secondary";
      Icon = Minus;
    } else {
      variant = "outline";
      Icon = TrendingDown;
    }

    return (
      <TooltipProvider key={label}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant={variant} className="text-xs gap-1">
              <Icon className="h-3 w-3" />
              {percent}% {compact ? "" : label}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">
              {label}: {percent}% de la référence
              <br />
              <span className="text-muted-foreground">Ref: {refValue}</span>
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const badges = [
    vmaxPercent !== null && getPercentBadge(
      vmaxPercent, 
      "Vmax", 
      `${reference.ref_vmax_kmh?.toFixed(1) || "-"} km/h`
    ),
    loadPercent !== null && getPercentBadge(
      loadPercent, 
      "Charge", 
      `${reference.ref_player_load_per_min?.toFixed(1) || "-"}/min`
    ),
    hsPercent !== null && getPercentBadge(
      hsPercent, 
      "HSR", 
      `${reference.ref_high_intensity_distance_per_min?.toFixed(0) || "-"}m/min`
    ),
  ].filter(Boolean);

  if (badges.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      <Target className="h-3 w-3 text-muted-foreground" />
      {badges}
    </div>
  );
}

// Simplified version showing just Vmax percentage
export function VmaxPercentageBadge({
  categoryId,
  playerId,
  currentVmax,
}: {
  categoryId: string;
  playerId: string;
  currentVmax: number | null;
}) {
  const { data: reference } = useActiveReference(categoryId, playerId);

  if (!reference?.ref_vmax_ms || !currentVmax) {
    return null;
  }

  const percent = calculatePercentageOfReference(currentVmax, reference.ref_vmax_ms);
  if (percent === null) return null;

  let colorClass = "text-muted-foreground";
  if (percent >= 95) colorClass = "text-primary font-medium";
  else if (percent >= 85) colorClass = "text-foreground";
  else if (percent < 75) colorClass = "text-destructive";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`text-xs ${colorClass}`}>
            ({percent}% Vmax)
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">
            {percent}% de la Vmax de référence
            <br />
            <span className="text-muted-foreground">
              Ref: {(reference.ref_vmax_ms * 3.6).toFixed(1)} km/h (test du {reference.test_date})
            </span>
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
