import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Card — Stripe / Linear style: surface uniforme, border subtle, lift léger au hover.
 * Variantes minimales :
 *  - default     : sobre (border + shadow-sm), léger lift au hover
 *  - highlight   : accent border (pour mettre en avant ponctuellement)
 *  - interactive : clickable (cursor + lift + border accent au hover)
 *  - flat        : sans shadow (à plat dans une page déjà chargée)
 *  - sunken      : "inset" (pour groupes de champs)
 *  - elevated    : alias historique (= default avec shadow-md)
 *  - accent / premium : gardés pour rétro-compat mais sobres (sans gradient envahissant)
 */
const cardVariants = cva(
  "rounded-2xl border bg-card text-card-foreground transition-[box-shadow,transform,border-color] duration-200",
  {
    variants: {
      variant: {
        default:
          "border-border shadow-sm hover:shadow-md hover:-translate-y-px",
        highlight:
          "border-primary/30 shadow-sm hover:shadow-md hover:border-primary/50",
        interactive:
          "border-border shadow-sm cursor-pointer hover:shadow-md hover:-translate-y-0.5 hover:border-border-strong",
        flat: "border-border shadow-none hover:bg-secondary/30",
        sunken: "border-border/60 bg-[hsl(var(--surface-sunken))] shadow-none",
        elevated: "border-border shadow-md hover:shadow-lg",
        // Rétro-compat — alias sobres
        accent:
          "border-primary/30 shadow-sm hover:shadow-md hover:border-primary/50",
        premium:
          "border-border shadow-md hover:shadow-lg",
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
    <h3 ref={ref} className={cn("text-xl font-semibold leading-none tracking-tight", className)} {...props} />
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
