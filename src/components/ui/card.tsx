import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// `relative` is load-bearing: a card is the containing block for anything it
// positions absolutely — overlays, badges, and the stretched link that makes the
// whole card clickable. Without it those resolve against the viewport instead
// and cover the page, swallowing clicks on unrelated UI.
const card = cva("relative bg-surface border border-line rounded-lg", {
  variants: {
    elevation: {
      flat: "",
      raised: "shadow-sm",
      floating: "shadow-md",
    },
    /** Adds hover lift — only for cards that are entirely clickable. */
    interactive: {
      true: "transition-[box-shadow,border-color,transform] duration-200 ease-[var(--ease-out-quick)] hover:shadow-lg hover:border-line-strong hover:-translate-y-0.5 focus-within:shadow-lg",
      false: "",
    },
  },
  defaultVariants: { elevation: "raised", interactive: false },
});

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof card> {}

export function Card({ className, elevation, interactive, ...props }: CardProps) {
  return (
    <div className={cn(card({ elevation, interactive }), className)} {...props} />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pb-0", className)} {...props} />;
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center gap-3 border-t border-line px-5 py-3.5", className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("font-display text-lg font-bold leading-snug", className)} {...props} />;
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-text-muted leading-relaxed", className)} {...props} />;
}
