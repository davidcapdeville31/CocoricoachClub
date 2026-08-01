import { Label } from "@/components/ui/label";
import { COMPETITION_TAGS, CompetitionTag } from "@/lib/constants/competitionTags";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface CompetitionTagSelectorProps {
  value: CompetitionTag | null;
  onChange: (value: CompetitionTag | null) => void;
  label?: string;
}

export function CompetitionTagSelector({
  value,
  onChange,
  label = "Couleur / type de compétition",
}: CompetitionTagSelectorProps) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {COMPETITION_TAGS.map((tag) => {
          const active = value === tag.value;
          return (
            <button
              key={tag.value}
              type="button"
              onClick={() => onChange(active ? null : tag.value)}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors",
                active ? tag.badge : "border-border bg-surface-sunken hover:bg-muted"
              )}
            >
              <span className={cn("h-3 w-3 rounded-full", tag.dot)} />
              {tag.label}
              {active && <Check className="h-3.5 w-3.5" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
