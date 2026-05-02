import * as React from "react";
import { NAV_COLORS, type NavColorKey } from "@/components/ui/colored-nav-tabs";
import { cn } from "@/lib/utils";

interface NavThemedSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  colorKey: NavColorKey;
  children: React.ReactNode;
}

/**
 * Wraps a tab's content area and exposes the active tab color as CSS
 * variables so descendant primary / destructive buttons can be repainted
 * via global rules in index.css (look for `.nav-themed` selectors).
 *
 * The goal: when the user is on a coloured tab (e.g. Académie = blue), all
 * call-to-action buttons inside that tab adopt the same hue instead of the
 * default red / brand colour — for visual coherence.
 */
export const NavThemedSection = React.forwardRef<HTMLDivElement, NavThemedSectionProps>(
  ({ colorKey, className, style, children, ...props }, ref) => {
    const colors = NAV_COLORS[colorKey];
    const match = colors.base.match(/hsl\((\d+)\s+(\d+)%\s+(\d+)%\)/);
    const h = match ? Number(match[1]) : 232;
    const s = match ? Number(match[2]) : 70;
    const l = match ? Number(match[3]) : 56;

    // Compute readable foreground for that hue (yellow-ish needs dark fg)
    const prefersDarkForeground = l > 64 || (h >= 32 && h <= 84 && l > 44);
    const fg = prefersDarkForeground ? "0 0% 10%" : "0 0% 100%";

    return (
      <div
        ref={ref}
        data-nav-color={colorKey}
        className={cn("nav-themed", className)}
        style={{
          ["--nav-color" as string]: `${h} ${s}% ${l}%`,
          ["--nav-color-hover" as string]: `${h} ${s}% ${Math.max(l - 8, 8)}%`,
          ["--nav-color-soft" as string]: `${h} ${s}% ${Math.min(l + 30, 95)}%`,
          ["--nav-color-fg" as string]: fg,
          ...style,
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
);
NavThemedSection.displayName = "NavThemedSection";
