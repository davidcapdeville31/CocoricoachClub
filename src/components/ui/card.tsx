import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const cardVariants = cva(
  "rounded-2xl border text-card-foreground transition-all duration-300 relative",
  {
    variants: {
      variant: {
        // Default: layered gradient + deeper shadow + lift on hover
        default:
          "border-border/60 bg-gradient-to-b from-card to-[hsl(var(--surface-elevated))] shadow-[var(--shadow-md)] hover:shadow-[var(--shadow-lg)] hover:-translate-y-0.5",
        // Elevated: lifted card for important sections / KPIs
        elevated:
          "border-border/60 bg-[hsl(var(--surface-elevated))] shadow-[var(--shadow-lg)] hover:shadow-[var(--shadow-xl)]",
        // Sunken: looks "inset" — for inputs/wells inside cards
        sunken: "border-border/40 bg-[hsl(var(--surface-sunken))] shadow-inner",
        // Flat: minimal border, no shadow
        flat: "border-border/50 bg-card shadow-none",
        // Interactive: clickable card with strong hover & brand glow
        interactive:
          "border-border/60 bg-gradient-to-b from-card to-[hsl(var(--surface-elevated))] shadow-[var(--shadow-md)] hover:shadow-[var(--shadow-glow)] hover:border-primary/40 hover:-translate-y-1 cursor-pointer",
        // Accent: branded vivid gradient card
        accent:
          "border-primary/30 bg-gradient-to-br from-[hsl(var(--brand-50))] via-card to-[hsl(var(--accent-50))] shadow-[var(--shadow-md)] hover:shadow-[var(--shadow-glow)] dark:from-[hsl(var(--brand-900)/0.5)] dark:via-card dark:to-[hsl(var(--brand-800)/0.3)]",
        // Premium: hero card with top accent line
        premium:
          "border-primary/20 bg-gradient-to-br from-card via-[hsl(var(--surface-elevated))] to-card shadow-[var(--shadow-xl)] overflow-hidden before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-primary/50 before:to-transparent",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(({ className, variant, ...props }, ref) => (
  <div ref={ref} className={cn(cardVariants({ variant }), className)} {...props} />
));
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-2xl font-semibold leading-none tracking-tight", className)} {...props} />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />,
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, cardVariants };
