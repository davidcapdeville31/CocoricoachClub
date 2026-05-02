import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const cardVariants = cva(
  "rounded-2xl border text-card-foreground transition-all duration-200",
  {
    variants: {
      variant: {
        // Default: surface (white in light, #161A22 in dark) with subtle shadow
        default: "border-border/70 bg-card shadow-sm hover:shadow-md",
        // Elevated: lifted card for important sections / KPIs
        elevated: "border-border/70 bg-[hsl(var(--surface-elevated))] shadow-md hover:shadow-lg",
        // Sunken: looks "inset" — for inputs/wells inside cards
        sunken: "border-border/50 bg-[hsl(var(--surface-sunken))] shadow-none",
        // Flat: minimal border, no shadow — for grouping inside dense layouts
        flat: "border-border/60 bg-card shadow-none",
        // Interactive: clickable card with strong hover
        interactive:
          "border-border/70 bg-card shadow-sm hover:shadow-lg hover:border-border-strong hover:-translate-y-0.5 cursor-pointer",
        // Accent: branded card with brand-tinted background
        accent:
          "border-primary/20 bg-gradient-to-br from-[hsl(var(--brand-50))] to-card shadow-sm hover:shadow-md dark:from-[hsl(var(--brand-900)/0.3)] dark:to-card",
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
