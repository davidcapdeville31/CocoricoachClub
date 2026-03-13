import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Heart, ChevronDown, ChevronUp, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

export interface HrvData {
  hrv_ms: string;
  resting_hr_bpm: string;
  avg_hr_bpm: string;
  max_hr_bpm: string;
  zone1_minutes: string;
  zone2_minutes: string;
  zone3_minutes: string;
  zone4_minutes: string;
  zone5_minutes: string;
}

export const emptyHrvData: HrvData = {
  hrv_ms: "",
  resting_hr_bpm: "",
  avg_hr_bpm: "",
  max_hr_bpm: "",
  zone1_minutes: "",
  zone2_minutes: "",
  zone3_minutes: "",
  zone4_minutes: "",
  zone5_minutes: "",
};

interface HrvInputSectionProps {
  data: HrvData;
  onChange: (data: HrvData) => void;
  compact?: boolean;
}

const ZONE_COLORS = [
  "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700",
  "bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700",
  "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700",
  "bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700",
  "bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700",
];

const ZONE_LABELS = [
  { label: "Z1 - Récupération", description: "50-60% FCmax" },
  { label: "Z2 - Endurance", description: "60-70% FCmax" },
  { label: "Z3 - Tempo", description: "70-80% FCmax" },
  { label: "Z4 - Seuil", description: "80-90% FCmax" },
  { label: "Z5 - VO2max", description: "90-100% FCmax" },
];

export function HrvInputSection({ data, onChange, compact = false }: HrvInputSectionProps) {
  const [isOpen, setIsOpen] = useState(false);

  const hasAnyData = Object.values(data).some((v) => v !== "");
  const totalZoneMinutes = [data.zone1_minutes, data.zone2_minutes, data.zone3_minutes, data.zone4_minutes, data.zone5_minutes]
    .filter(Boolean)
    .reduce((sum, val) => sum + (parseFloat(val) || 0), 0);

  const handleChange = (field: keyof HrvData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn(
            "w-full flex items-center justify-between p-3 rounded-lg border transition-colors",
            "hover:bg-accent/50",
            hasAnyData
              ? "bg-primary/5 border-primary/20"
              : "bg-muted/30 border-border"
          )}
        >
          <div className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-destructive" />
            <span className="text-sm font-medium">
              HRV & Zones cardiaques
            </span>
            {hasAnyData && (
              <Badge variant="secondary" className="text-xs">
                {data.hrv_ms && `HRV: ${data.hrv_ms}ms`}
                {data.hrv_ms && totalZoneMinutes > 0 && " · "}
                {totalZoneMinutes > 0 && `${totalZoneMinutes}min`}
              </Badge>
            )}
          </div>
          {isOpen ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-3 space-y-4">
        {/* HRV & HR metrics */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="hrv_ms" className="text-xs flex items-center gap-1">
              <Activity className="h-3 w-3" /> HRV (ms)
            </Label>
            <Input
              id="hrv_ms"
              type="number"
              min="0"
              max="300"
              placeholder="Ex: 65"
              value={data.hrv_ms}
              onChange={(e) => handleChange("hrv_ms", e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="resting_hr" className="text-xs">
              FC repos (bpm)
            </Label>
            <Input
              id="resting_hr"
              type="number"
              min="30"
              max="120"
              placeholder="Ex: 55"
              value={data.resting_hr_bpm}
              onChange={(e) => handleChange("resting_hr_bpm", e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="avg_hr" className="text-xs">
              FC moyenne (bpm)
            </Label>
            <Input
              id="avg_hr"
              type="number"
              min="40"
              max="220"
              placeholder="Ex: 145"
              value={data.avg_hr_bpm}
              onChange={(e) => handleChange("avg_hr_bpm", e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="max_hr" className="text-xs">
              FC max (bpm)
            </Label>
            <Input
              id="max_hr"
              type="number"
              min="60"
              max="230"
              placeholder="Ex: 185"
              value={data.max_hr_bpm}
              onChange={(e) => handleChange("max_hr_bpm", e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        </div>

        {/* Heart Rate Zones */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Temps par zone cardiaque (minutes)</Label>
          <div className="space-y-2">
            {ZONE_LABELS.map((zone, index) => (
              <div
                key={index}
                className={cn(
                  "flex items-center gap-2 p-2 rounded border",
                  ZONE_COLORS[index]
                )}
              >
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium block">{zone.label}</span>
                  <span className="text-[10px] text-muted-foreground">{zone.description}</span>
                </div>
                <Input
                  type="number"
                  min="0"
                  placeholder="min"
                  value={data[`zone${index + 1}_minutes` as keyof HrvData]}
                  onChange={(e) =>
                    handleChange(`zone${index + 1}_minutes` as keyof HrvData, e.target.value)
                  }
                  className="w-20 h-7 text-sm text-right bg-background"
                />
              </div>
            ))}
          </div>
          {totalZoneMinutes > 0 && (
            <p className="text-xs text-muted-foreground text-right">
              Total : {totalZoneMinutes} min
            </p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
