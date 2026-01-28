import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80 hover:shadow-[0_0_12px_hsl(var(--primary)/0.5)]",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:shadow-[0_0_10px_hsl(var(--primary)/0.2)]",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80 hover:shadow-[0_0_12px_hsl(var(--destructive)/0.5)]",
        outline: "text-foreground hover:border-primary/50 hover:shadow-[0_0_10px_hsl(var(--primary)/0.2)]",
        neon: "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 hover:shadow-[0_0_15px_hsl(var(--primary)/0.5)]",
        success: "border-transparent bg-success text-success-foreground hover:bg-success/80 hover:shadow-[0_0_12px_hsl(var(--success)/0.5)]",
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
