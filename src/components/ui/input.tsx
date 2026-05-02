import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // Base — sunken surface for clear "input affordance" in both themes
          "flex h-10 w-full rounded-xl border border-border bg-[hsl(var(--surface-sunken))] px-3.5 py-2 text-base text-foreground shadow-xs ring-offset-background transition-all duration-150",
          // File input
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          // Placeholder
          "placeholder:text-muted-foreground/80",
          // Focus — primary ring + lift to surface
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary focus-visible:bg-surface focus-visible:shadow-sm",
          // Hover (when not focused)
          "hover:border-border-strong",
          // Disabled
          "disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-muted",
          // Aria invalid
          "aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive/30",
          "md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
