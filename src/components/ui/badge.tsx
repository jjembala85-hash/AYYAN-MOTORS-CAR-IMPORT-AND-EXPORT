import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badge = cva(
  "inline-flex items-center gap-1.5 rounded-sm font-display font-semibold uppercase tracking-[0.08em] leading-none whitespace-nowrap [&_svg]:size-[1.1em] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        neutral: "bg-surface-sunken text-text-muted",
        brand: "bg-brand text-text-on-brand",
        "brand-subtle": "bg-brand-subtle text-brand-on-subtle",
        success: "bg-success-subtle text-success",
        warning: "bg-warning-subtle text-warning",
        info: "bg-info-subtle text-info",
        outline: "border border-line-strong text-text-muted",
        /** For placing over a photo. */
        overlay: "bg-graphite-950/75 text-graphite-0 backdrop-blur-sm",
      },
      size: {
        sm: "h-5 px-1.5 text-[0.625rem]",
        md: "h-6 px-2 text-[0.6875rem]",
      },
    },
    defaultVariants: { variant: "neutral", size: "md" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badge> {}

export function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <span className={cn(badge({ variant, size }), className)} {...props} />;
}

export { badge as badgeVariants };
