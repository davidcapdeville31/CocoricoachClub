import { useState } from "react";
import { Settings2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

export interface CategoryVisibilityItem {
  value: string;
  label: string;
}

interface CategoryVisibilityManagerProps {
  items: CategoryVisibilityItem[];
  visibleValues: Set<string>;
  onChange: (next: Set<string>) => void;
}

export function CategoryVisibilityManager({
  items,
  visibleValues,
  onChange,
}: CategoryVisibilityManagerProps) {
  const [open, setOpen] = useState(false);

  const toggle = (value: string) => {
    const next = new Set(visibleValues);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange(next);
  };

  const showAll = () => onChange(new Set(items.map((i) => i.value)));
  const hideAll = () => onChange(new Set());

  const visibleCount = items.filter((i) => visibleValues.has(i.value)).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 rounded-xl">
          <Settings2 className="h-4 w-4" />
          Gérer les onglets
          <span className="text-xs text-muted-foreground">
            ({visibleCount}/{items.length})
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-72 p-0 rounded-2xl backdrop-blur-xl bg-background/95 border-border/60 shadow-xl"
      >
        <div className="p-3 flex items-center justify-between gap-2">
          <p className="text-sm font-medium">Catégories visibles</p>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={showAll}>
              <Eye className="h-3.5 w-3.5 mr-1" /> Tout
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={hideAll}>
              <EyeOff className="h-3.5 w-3.5 mr-1" /> Rien
            </Button>
          </div>
        </div>
        <Separator />
        <ScrollArea className="h-[60vh] max-h-[400px]">
          <div className="p-2 space-y-1">
            {items.map((item) => {
              const checked = visibleValues.has(item.value);
              return (
                <label
                  key={item.value}
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-muted/60 cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggle(item.value)}
                  />
                  <span className="text-sm">{item.label}</span>
                </label>
              );
            })}
            {items.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                Aucune catégorie disponible
              </p>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
