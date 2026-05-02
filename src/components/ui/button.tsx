import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-b from-primary to-[hsl(var(--primary-hover))] text-primary-foreground shadow-[0_4px_12px_-2px_hsl(var(--primary)/0.4),inset_0_1px_0_hsl(var(--primary-foreground)/0.15)] hover:shadow-[0_6px_20px_-4px_hsl(var(--primary)/0.5)] hover:brightness-110 active:scale-[0.98]",
        destructive:
          "bg-gradient-to-b from-destructive to-destructive/90 text-destructive-foreground shadow-[0_4px_12px_-2px_hsl(var(--destructive)/0.4)] hover:shadow-[0_6px_20px_-4px_hsl(var(--destructive)/0.5)] hover:brightness-110 active:scale-[0.98]",
        outline:
          "border-2 border-border bg-card/80 backdrop-blur text-foreground shadow-sm hover:bg-secondary hover:border-primary/50 hover:shadow-md active:scale-[0.98]",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-[hsl(var(--secondary-hover))] hover:shadow-md active:scale-[0.98]",
        ghost:
          "text-foreground hover:bg-secondary hover:text-foreground active:bg-[hsl(var(--secondary-hover))]",
        link: "text-primary underline-offset-4 hover:underline hover:text-[hsl(var(--primary-hover))]",
        success:
          "bg-gradient-to-b from-success to-success/90 text-success-foreground shadow-[0_4px_12px_-2px_hsl(var(--success)/0.4)] hover:shadow-[0_6px_20px_-4px_hsl(var(--success)/0.5)] hover:brightness-110 active:scale-[0.98]",
        accent:
          "bg-gradient-to-b from-accent to-[hsl(var(--accent-hover))] text-accent-foreground shadow-[0_4px_12px_-2px_hsl(var(--accent)/0.4)] hover:shadow-[0_6px_20px_-4px_hsl(var(--accent)/0.5)] hover:brightness-110 active:scale-[0.98]",
        premium:
          "bg-[linear-gradient(135deg,hsl(var(--brand-500)),hsl(var(--brand-600))_50%,hsl(var(--accent-500)))] bg-[length:200%_200%] text-white shadow-[var(--shadow-glow)] hover:shadow-[0_16px_40px_-8px_hsl(var(--primary)/0.6)] hover:bg-[position:100%_100%] active:scale-[0.98] transition-[background-position,box-shadow,transform] duration-500",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 rounded-lg px-4",
        lg: "h-12 rounded-xl px-8 text-base",
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
