import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Define navigation color mappings
export const NAV_COLORS = {
  overview: {
    base: "hsl(222 78% 56%)",
    text: "text-[hsl(222_78%_56%)]",
    bg: "bg-[hsl(222_78%_56%)]",
    hover: "hover:bg-[hsl(222_78%_56%)/10]",
  },
  admin: {
    base: "hsl(286 70% 56%)",
    text: "text-[hsl(286_70%_56%)]",
    bg: "bg-[hsl(286_70%_56%)]",
    hover: "hover:bg-[hsl(286_70%_56%)/10]",
  },
  effectif: {
    base: "hsl(198 82% 48%)",
    text: "text-[hsl(198_82%_48%)]",
    bg: "bg-[hsl(198_82%_48%)]",
    hover: "hover:bg-[hsl(198_82%_48%)/10]",
  },
  planification: {
    base: "hsl(28 88% 56%)",
    text: "text-[hsl(28_88%_56%)]",
    bg: "bg-[hsl(28_88%_56%)]",
    hover: "hover:bg-[hsl(28_88%_56%)/10]",
  },
  programmation: {
    base: "hsl(258 74% 60%)",
    text: "text-[hsl(258_74%_60%)]",
    bg: "bg-[hsl(258_74%_60%)]",
    hover: "hover:bg-[hsl(258_74%_60%)/10]",
  },
  performance: {
    base: "hsl(332 78% 54%)",
    text: "text-[hsl(332_78%_54%)]",
    bg: "bg-[hsl(332_78%_54%)]",
    hover: "hover:bg-[hsl(332_78%_54%)/10]",
  },
  sante: {
    base: "hsl(148 68% 42%)",
    text: "text-[hsl(148_68%_42%)]",
    bg: "bg-[hsl(148_68%_42%)]",
    hover: "hover:bg-[hsl(148_68%_42%)/10]",
  },
  competition: {
    base: "hsl(46 96% 50%)",
    text: "text-[hsl(46_96%_48%)]",
    bg: "bg-[hsl(46_96%_50%)]",
    hover: "hover:bg-[hsl(46_96%_50%)/10]",
  },
  gps: {
    base: "hsl(178 72% 40%)",
    text: "text-[hsl(178_72%_40%)]",
    bg: "bg-[hsl(178_72%_40%)]",
    hover: "hover:bg-[hsl(178_72%_40%)/10]",
  },
  video: {
    base: "hsl(2 78% 58%)",
    text: "text-[hsl(2_78%_58%)]",
    bg: "bg-[hsl(2_78%_58%)]",
    hover: "hover:bg-[hsl(2_78%_58%)/10]",
  },
  communication: {
    base: "hsl(14 72% 56%)",
    text: "text-[hsl(14_72%_56%)]",
    bg: "bg-[hsl(14_72%_56%)]",
    hover: "hover:bg-[hsl(14_72%_56%)/10]",
  },
  academy: {
    base: "hsl(86 62% 44%)",
    text: "text-[hsl(86_62%_44%)]",
    bg: "bg-[hsl(86_62%_44%)]",
    hover: "hover:bg-[hsl(86_62%_44%)/10]",
  },
  settings: {
    base: "hsl(220 20% 64%)",
    text: "text-[hsl(220_15%_50%)]",
    bg: "bg-[hsl(220_15%_50%)]",
    hover: "hover:bg-[hsl(220_15%_50%)/10]",
  },
} as const;

export type NavColorKey = keyof typeof NAV_COLORS;

interface ColoredNavTabsListProps extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> {
  children: React.ReactNode;
}

const ColoredNavTabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  ColoredNavTabsListProps
>(({ className, children, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex items-center gap-2 p-2 rounded-xl shadow-sm border border-border/50",
      "bg-card",
      "field-mode:bg-[hsl(215_25%_14%)] field-mode:border-[hsl(215_25%_25%)]",
      className
    )}
    {...props}
  >
    {children}
  </TabsPrimitive.List>
));
ColoredNavTabsList.displayName = "ColoredNavTabsList";

interface ColoredNavTabsTriggerProps extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> {
  colorKey: NavColorKey;
  icon?: React.ReactNode;
}

const ColoredNavTabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  ColoredNavTabsTriggerProps
>(({ className, colorKey, icon, children, ...props }, ref) => {
  const colors = NAV_COLORS[colorKey];
  
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "group relative inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm",
        "transition-all duration-200 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        colors.text,
        colors.hover,
        "data-[state=active]:text-white data-[state=active]:shadow-md",
        className
      )}
      style={{}}
      {...props}
    >
      <span 
        className="absolute inset-0 rounded-lg opacity-0 transition-opacity duration-200 data-[state=active]:opacity-100 -z-10"
        style={{ backgroundColor: colors.base }}
        data-state={props["data-state"]}
      />
      {icon && (
        <span className="shrink-0 transition-colors duration-200">
          {icon}
        </span>
      )}
      <span className="whitespace-nowrap">{children}</span>
    </TabsPrimitive.Trigger>
  );
});
ColoredNavTabsTrigger.displayName = "ColoredNavTabsTrigger";

// Wrapper component that handles the active state styling
interface ColoredTabTriggerProps extends Omit<ColoredNavTabsTriggerProps, "data-state"> {
  value: string;
  badge?: number;
  label?: string;
  shortLabel?: string;
  tooltip?: string;
}

const ColoredTabTrigger = React.forwardRef<
  HTMLButtonElement,
  ColoredTabTriggerProps
>(({ colorKey, icon, children, className, value, badge, label, shortLabel, tooltip, ...props }, ref) => {
  const colors = NAV_COLORS[colorKey];
  const tabHex = colors.base.match(/hsl\((\d+)\s+(\d+)%\s+(\d+)%\)/);
  const tabHsl = tabHex ? { h: Number(tabHex[1]), s: Number(tabHex[2]), l: Number(tabHex[3]) } : { h: 280, s: 70, l: 55 };
  const prefersDarkForeground = tabHsl.l > 64 || ((tabHsl.h >= 32 && tabHsl.h <= 84) && tabHsl.l > 44);
  const activeForeground = prefersDarkForeground ? "hsl(var(--foreground))" : "white";
  
  const trigger = (
    <TabsPrimitive.Trigger
      ref={ref}
      value={value}
      className={cn(
        "colored-tab-trigger relative inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm",
        "transition-all duration-200 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
      style={{
        ["--tab-color" as string]: colors.base,
        ["--tab-ink" as string]: `color-mix(in srgb, ${colors.base} 86%, white 14%)`,
        ["--tab-ink-dark" as string]: `color-mix(in srgb, ${colors.base} 22%, white 78%)`,
        ["--tab-soft-bg-dark" as string]: `color-mix(in srgb, ${colors.base} 16%, hsl(var(--surface-elevated)) 84%)`,
        ["--tab-active-foreground" as string]: activeForeground,
      }}
      {...props}
    >
      <span className="colored-tab-text relative z-10 flex items-center gap-2" style={{ color: 'var(--tab-color)' }}>
        {icon && <span className="shrink-0">{icon}</span>}
        <span className="whitespace-nowrap">
          {label ? (
            <>
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{shortLabel || label}</span>
            </>
          ) : children}
        </span>
        {badge != null && badge > 0 && (
          <span className="absolute -top-2 -right-3 h-4 min-w-[16px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </span>
    </TabsPrimitive.Trigger>
  );

  if (!tooltip) return trigger;

  return (
    <TooltipProvider delayDuration={400}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">{trigger}</span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs bg-background/95 backdrop-blur-sm border shadow-lg">
          <p className="text-[11px] leading-relaxed text-muted-foreground">{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});
ColoredTabTrigger.displayName = "ColoredTabTrigger";

export { ColoredNavTabsList, ColoredNavTabsTrigger, ColoredTabTrigger };
