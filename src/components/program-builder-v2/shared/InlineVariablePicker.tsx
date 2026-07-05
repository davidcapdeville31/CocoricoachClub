import { useState, useRef, useLayoutEffect, useEffect, ReactNode } from "react";
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
 *
 * Rendu via un Portal directement dans <body> avec `position: fixed` et un
 * z-index maximal (2147483647) — impossible d'être masqué par une carte,
 * une méthode ou un stacking context parent (transform, filter, sticky…).
 *
 * Aucun overlay plein écran : les clics extérieurs ferment le menu via un
 * listener document (capture), ce qui évite tout conflit de pointer-events
 * avec des Dialogs/Sheets Radix modaux.
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

  // Position calculation
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const update = () => {
      const rect = btnRef.current!.getBoundingClientRect();
      const menuWidth = menuRef.current?.offsetWidth ?? 192;
      const menuHeight = menuRef.current?.offsetHeight ?? 200;
      const margin = 8;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const horizontal = align === "end"
        ? { right: Math.max(margin, Math.min(vw - rect.right, vw - menuWidth - margin)) }
        : { left: Math.max(margin, Math.min(rect.left, vw - menuWidth - margin)) };

      let top = rect.bottom + 4;
      if (top + menuHeight > vh - margin) {
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

  // Outside click / Escape to close
  useEffect(() => {
    if (!open) return;
    const onDocPointer = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (menuRef.current?.contains(target)) return;
      if (btnRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDocPointer, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDocPointer, true);
      document.removeEventListener("keydown", onKey);
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
      {open && createPortal(
        <div
          ref={menuRef}
          style={{
            position: "fixed",
            top: pos?.top ?? -9999,
            left: pos?.left,
            right: pos?.right,
            zIndex: 2147483647,
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
        </div>,
        document.body,
      )}
    </>
  );
};
