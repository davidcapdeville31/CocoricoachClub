import { useState, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface PickerItem {
  key: string;
  label: string;
}

interface Props {
  items: PickerItem[];
  onPick: (key: string) => void;
  buttonLabel?: ReactNode;
  buttonClassName?: string;
  align?: "start" | "end";
  title?: string;
  width?: string;
  heading?: string;
}

/**
 * Sélecteur de variable inline robuste (utilisé dans le program builder).
 * Évite les DropdownMenu Radix qui peuvent ne pas s'afficher dans
 * certains contextes (drag-and-drop, dialogs imbriqués, overflow:hidden parents).
 */
export const InlineVariablePicker = ({
  items,
  onPick,
  buttonLabel = "Variable",
  buttonClassName = "h-5 text-[10px] border-dashed px-1.5 gap-0.5",
  align = "end",
  title,
  width = "w-44",
  heading = "Ajouter une variable",
}: Props) => {
  const [open, setOpen] = useState(false);

  if (items.length === 0) return null;

  return (
    <div className="relative inline-block">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={buttonClassName}
        title={title}
      >
        <Plus className="h-2.5 w-2.5" />
        {buttonLabel}
      </Button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-[998]"
            onPointerDown={(e) => { e.stopPropagation(); setOpen(false); }}
            onClick={(e) => { e.stopPropagation(); setOpen(false); }}
          />
          <div
            className={cn(
              "absolute top-full mt-1 rounded-md border bg-popover text-popover-foreground shadow-md z-[999] p-1",
              width,
              align === "end" ? "right-0" : "left-0",
            )}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="px-2 py-1 text-[10px] text-muted-foreground">{heading}</p>
            {items.map((item) => (
              <button
                key={item.key}
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onPick(item.key);
                  setOpen(false);
                }}
                className="w-full rounded-sm px-2 py-1.5 text-xs text-left hover:bg-accent"
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
