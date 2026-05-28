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
    // Only true modal overlays should keep <body> pointer-events locked.
    // Tooltips, menus, popovers and listboxes never need a body lock and
    // are the main source of stuck pointer-events after rapid tab switches.
    const isOverlayOpen = () =>
      !!document.querySelector(
        '[data-state="open"][role="dialog"][aria-modal="true"], [data-state="open"][role="alertdialog"]'
      );


    const release = () => {
      if (document.body.style.pointerEvents !== "none") return;
      if (isOverlayOpen()) return;
      document.body.style.pointerEvents = "";
      document.body.style.removeProperty("pointer-events");
    };

    release();

    const observer = new MutationObserver(release);
    observer.observe(document.body, { attributes: true, attributeFilter: ["style"] });

    const interval = window.setInterval(release, 80);

    // These fire on the document even when <body> has pointer-events:none.
    document.addEventListener("animationend", release, true);
    document.addEventListener("transitionend", release, true);

    // <html> is never locked by Radix, so pointer events here always reach us.
    const html = document.documentElement;
    html.addEventListener("pointerdown", release, true);
    html.addEventListener("keydown", release, true);

    return () => {
      observer.disconnect();
      window.clearInterval(interval);
      document.removeEventListener("animationend", release, true);
      document.removeEventListener("transitionend", release, true);
      html.removeEventListener("pointerdown", release, true);
      html.removeEventListener("keydown", release, true);
    };
  }, []);
}
