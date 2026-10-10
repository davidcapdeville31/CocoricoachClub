import { Check, Smile, ThumbsUp, Meh, Frown, BatteryLow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FeelingChoices({ options, value, onChange }: { options: Array<{ value: number; label: string; emoji: string }>; value: number; onChange: (value: number) => void }) {
  const icons = [Smile, ThumbsUp, Meh, Frown, BatteryLow];
  return <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" role="group" aria-label="Mon ressenti">
    {options.map((option, index) => { const Icon = icons[index] || Meh; return <Button key={option.value} type="button" variant="outline" aria-pressed={value === option.value}
      onClick={() => onChange(option.value)} className={cn("relative h-auto min-h-20 min-w-0 flex-col whitespace-normal gap-1 px-2 py-3 text-xs leading-tight", value === option.value && "border-primary bg-primary/10 text-primary ring-1 ring-primary")}>
      <Icon aria-hidden="true" className="h-5 w-5" /><span className="break-words">{option.label}</span>
      {value === option.value && <Check aria-hidden="true" className="absolute right-1 top-1 h-3 w-3" />}
    </Button>; })}
  </div>;
}