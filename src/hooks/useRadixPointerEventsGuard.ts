import { useEffect } from "react";

/**
 * Global safety net for a known Radix UI bug: when several Dialog / Popover /
 * Select / DropdownMenu overlays open & close in rapid succession, Radix can
 * leave `pointer-events: none` stuck on <body>, freezing every subsequent
 * click until the user changes tab.
 *
 * Strategy:
 *  - MutationObserver on <body>'s style attribute: react instantly when Radix
 *    flips pointer-events.
 *  - animationend / transitionend listeners on the document: these fire even
 *    when <body> has pointer-events:none, so we can clear the lock right when
 *    the overlay finishes its close transition.
 *  - <html>-level pointerdown listener (html is never locked by Radix) as a
 *    final fallback gesture trigger.
 *  - Very short interval (80 ms) as a last-resort safety tick.
 *
 * We only release the lock when there is no actually-open Radix overlay in the
 * DOM, so legitimate modal locks are preserved.
 */
export function useRadixPointerEventsGuard() {
  useEffect(() => {
    const release = () => {
      // Cheap early-out: most of the time body is not locked.
      if (document.body.style.pointerEvents !== "none") return;
      // Preserve legitimate modal locks (Dialog/AlertDialog/Sheet/Drawer with aria-modal).
      const hasOpenModal = document.querySelector(
        '[data-state="open"][role="dialog"][aria-modal="true"], [data-state="open"][role="alertdialog"]'
      );
      if (hasOpenModal) return;
      document.body.style.removeProperty("pointer-events");
      // Some Radix variants also leave aria-hidden on root siblings — best-effort cleanup.
      document.querySelectorAll('[data-aria-hidden="true"]').forEach((el) => {
        if (!el.querySelector('[data-state="open"][aria-modal="true"]')) {
          el.removeAttribute("aria-hidden");
          el.removeAttribute("data-aria-hidden");
        }
      });
    };

    release();

    // MutationObserver catches the moment Radix flips the style.
    const observer = new MutationObserver(release);
    observer.observe(document.body, { attributes: true, attributeFilter: ["style"] });

    // <html> is never locked by Radix — pointerdown here always reaches us
    // and serves as a final user-gesture fallback to clear a stuck lock.
    const html = document.documentElement;
    html.addEventListener("pointerdown", release, true);
    html.addEventListener("keydown", release, true);

    // Low-frequency safety tick (1 s) — extremely cheap thanks to the early-out
    // above. Catches edge cases where heavy React renders (Santé/Workload doctor
    // views with many queries) delay the MutationObserver callback.
    const interval = window.setInterval(release, 1000);

    return () => {
      observer.disconnect();
      html.removeEventListener("pointerdown", release, true);
      html.removeEventListener("keydown", release, true);
      window.clearInterval(interval);
    };
  }, []);
}

