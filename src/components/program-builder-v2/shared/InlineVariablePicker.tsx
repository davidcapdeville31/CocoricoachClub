import { useState, useRef, useLayoutEffect, ReactNode } from "react";
import { createPortal } from "react-dom";
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
 * Rendu via un Portal pour éviter que le menu soit caché par les cards
 * frères (stacking contexts, overflow:hidden, transform).
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
  const [pos, setPos] = useState<{ top: number; left: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const update = () => {
      const rect = btnRef.current!.getBoundingClientRect();
      setPos({
        top: rect.bottom + 4,
        left: rect.left,
        right: window.innerWidth - rect.right,
      });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  if (items.length === 0) return null;

  return (
    <>
      <Button
        ref={btnRef}
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
      {open && pos && createPortal(
        <>
          <div
            className="fixed inset-0 z-[9998]"
            onPointerDown={(e) => { e.stopPropagation(); setOpen(false); }}
            onClick={(e) => { e.stopPropagation(); setOpen(false); }}
          />
          <div
            style={
              align === "end"
                ? { position: "fixed", top: pos.top, right: pos.right }
                : { position: "fixed", top: pos.top, left: pos.left }
            }
            className={cn(
              "rounded-md border bg-popover text-popover-foreground shadow-md z-[9999] p-1",
              width,
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
        </>,
        document.body,
      )}
    </>
  );
};
