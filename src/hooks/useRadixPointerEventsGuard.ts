import { useEffect } from "react";

/**
 * Global safety net for a known Radix UI bug: when several Dialog / Popover /
 * Select / DropdownMenu overlays open & close in rapid succession, Radix can
 * leave `pointer-events: none` stuck on <body>, freezing every subsequent click
 * until the user changes tab.
 *
 * We watch <body>'s inline style and clear the lock whenever there is no
 * actually-open Radix overlay left in the DOM. This keeps legitimate locks
 * (genuinely open modal) intact while recovering from the leak.
 */
export function useRadixPointerEventsGuard() {
  useEffect(() => {
    const isOverlayOpen = () =>
      !!document.querySelector(
        '[data-state="open"][role="dialog"], [data-state="open"][role="menu"], [data-state="open"][role="listbox"], [data-state="open"][role="alertdialog"]'
      );

    const release = () => {
      if (document.body.style.pointerEvents !== "none") return;
      if (!isOverlayOpen()) {
        document.body.style.pointerEvents = "";
        document.body.style.removeProperty("pointer-events");
      }
    };

    release();
    const observer = new MutationObserver(release);
    observer.observe(document.body, { attributes: true, attributeFilter: ["style"] });
    const interval = window.setInterval(release, 400);

    // Extra safety: any user gesture should re-evaluate the lock.
    const onPointer = () => release();
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("keydown", onPointer, true);

    return () => {
      observer.disconnect();
      window.clearInterval(interval);
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("keydown", onPointer, true);
    };
  }, []);
}
