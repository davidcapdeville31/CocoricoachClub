import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-[hsl(var(--primary-hover))]",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-[hsl(var(--secondary-hover))]",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border-border text-foreground bg-transparent hover:bg-secondary",
        // Soft variants — tinted backgrounds, AA-compliant in both themes
        success:
          "border-transparent bg-success/15 text-[hsl(var(--success))] dark:bg-success/20 dark:text-[hsl(var(--success))]",
        warning:
          "border-transparent bg-warning/15 text-[hsl(var(--warning))] dark:bg-warning/20 dark:text-[hsl(var(--warning))]",
        info:
          "border-transparent bg-info/15 text-[hsl(var(--info))] dark:bg-info/20 dark:text-[hsl(var(--info))]",
        accent:
          "border-transparent bg-accent/15 text-[hsl(var(--accent))] dark:bg-accent/20 dark:text-[hsl(var(--accent))]",
        // Solid variants
        "solid-success": "border-transparent bg-success text-success-foreground hover:bg-success/90",
        "solid-warning": "border-transparent bg-warning text-warning-foreground hover:bg-warning/90",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
