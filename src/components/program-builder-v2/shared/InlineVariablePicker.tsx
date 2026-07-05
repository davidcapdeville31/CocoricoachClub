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
  width = "w-48",
  heading = "Ajouter une variable",
}: Props) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left?: number; right?: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const update = () => {
      const rect = btnRef.current!.getBoundingClientRect();
      const menuWidth = menuRef.current?.offsetWidth ?? 192;
      const menuHeight = menuRef.current?.offsetHeight ?? 200;
      const margin = 8;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const maxHorizontalOffset = Math.max(margin, viewportWidth - menuWidth - margin);
      const horizontal = align === "end"
        ? { right: Math.max(margin, Math.min(viewportWidth - rect.right, maxHorizontalOffset)) }
        : { left: Math.max(margin, Math.min(rect.left, maxHorizontalOffset)) };

      let top = rect.bottom + 4;
      if (top + menuHeight > viewportHeight - margin) {
        top = Math.max(margin, rect.top - menuHeight - 4);
      }
      setPos({ top, ...horizontal });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, align]);

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
      {open && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 2147483647, pointerEvents: "none" }}>
          <div
            style={{ position: "absolute", inset: 0, pointerEvents: "auto" }}
            onPointerDown={(e) => { e.stopPropagation(); setOpen(false); }}
            onClick={(e) => { e.stopPropagation(); setOpen(false); }}
          />
          <div
            ref={menuRef}
            style={{
              position: "absolute",
              top: pos?.top ?? -9999,
              left: pos?.left,
              right: pos?.right,
              visibility: pos ? "visible" : "hidden",
              pointerEvents: "auto",
              maxWidth: "calc(100vw - 16px)",
              maxHeight: "min(320px, calc(100vh - 16px))",
              overflowY: "auto",
            }}
            className={cn(
              "rounded-lg border bg-popover text-popover-foreground shadow-2xl p-1",
              width,
            )}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >

            <p className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {heading}
            </p>
            <div className="flex flex-col">
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
                  className="w-full rounded-md px-2 py-1.5 text-xs text-left text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
};

