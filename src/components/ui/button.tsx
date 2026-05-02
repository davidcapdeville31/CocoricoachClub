import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Button — Stripe / Linear style: couleurs pleines, contraste fort, pas de glow par défaut.
 * - default (primary): couleur pleine, hover plus sombre
 * - secondary: neutre
 * - ghost: discret
 * - outline: bordure subtile
 * - destructive / success / accent: feedback fonctionnel
 * - premium: cas exceptionnel (gradient + glow), à n'utiliser que pour CTA hero
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-xs hover:bg-[hsl(var(--primary-hover))] active:bg-[hsl(var(--primary-hover))]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90",
        outline:
          "border border-border bg-card text-foreground shadow-xs hover:bg-secondary hover:border-border-strong",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[hsl(var(--secondary-hover))]",
        ghost:
          "text-foreground hover:bg-secondary",
        link: "text-primary underline-offset-4 hover:underline",
        success:
          "bg-success text-success-foreground shadow-xs hover:bg-success/90",
        accent:
          "bg-accent text-accent-foreground shadow-xs hover:bg-[hsl(var(--accent-hover))]",
        premium:
          "bg-[linear-gradient(135deg,hsl(var(--brand-500)),hsl(var(--brand-600))_50%,hsl(var(--accent-500)))] text-white shadow-[var(--shadow-glow)] hover:shadow-[0_8px_20px_-6px_hsl(var(--primary)/0.45)] active:scale-[0.98]",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-11 rounded-lg px-6",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
