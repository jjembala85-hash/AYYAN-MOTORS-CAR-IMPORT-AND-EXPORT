import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const container = cva("mx-auto w-full px-4 sm:px-6 lg:px-8", {
  variants: {
    width: {
      /** Reading width — long-form copy, forms. */
      prose: "max-w-3xl",
      /** Default page width. */
      default: "max-w-7xl",
      /** Edge-to-edge with gutters, for wide image grids. */
      wide: "max-w-[96rem]",
    },
  },
  defaultVariants: { width: "default" },
});

export interface ContainerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof container> {}

export function Container({ className, width, ...props }: ContainerProps) {
  return <div className={cn(container({ width }), className)} {...props} />;
}

/* -------------------------------------------------------------------------- */

const section = cva("", {
  variants: {
    spacing: {
      sm: "py-10",
      md: "py-16",
      lg: "py-24",
    },
    tone: {
      canvas: "bg-canvas",
      surface: "bg-surface",
      /**
       * Dark band — used to break up a long light page.
       *
       * The band is dark in *both* themes, so it has to re-point every token a
       * child might use, not just text and border. Without the surface flips a
       * `Button variant="inverse"` resolves to graphite-950 on a graphite-950
       * band (invisible in light mode), and `ghost`'s hover lands on the light
       * `surface-sunken`. Overriding here fixes it once for every child instead
       * of patching each call site.
       */
      inverse: [
        "bg-graphite-950 text-graphite-50",
        "[--text:var(--graphite-50)] [--text-muted:var(--graphite-400)] [--text-subtle:var(--graphite-500)]",
        "[--border:#2a2b2f] [--border-strong:#3a3b40]",
        "[--surface:#1a1b1e] [--surface-sunken:#26272b]",
        "[--surface-inverse:var(--graphite-0)] [--text-inverse:var(--graphite-950)]",
        "[--brand:var(--red-500)] [--brand-hover:var(--red-400)]",
      ].join(" "),
    },
  },
  defaultVariants: { spacing: "md", tone: "canvas" },
});

export interface SectionProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof section> {}

export function Section({ className, spacing, tone, ...props }: SectionProps) {
  return <section className={cn(section({ spacing, tone }), className)} {...props} />;
}

/* -------------------------------------------------------------------------- */

export interface SectionHeadingProps {
  /** Small uppercase kicker above the title. */
  eyebrow?: string;
  title: string;
  description?: string;
  /** Right-aligned action, e.g. a "View all" link. */
  action?: React.ReactNode;
  align?: "start" | "center";
  as?: "h1" | "h2" | "h3";
  className?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  align = "start",
  as: Tag = "h2",
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "flex gap-6",
        align === "center"
          ? "flex-col items-center text-center"
          : "flex-col items-start sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className={cn("max-w-2xl", align === "center" && "mx-auto")}>
        {eyebrow && (
          <p className="eyebrow mb-3 flex items-center gap-2 text-brand">
            {align === "start" && <span aria-hidden className="h-px w-6 bg-brand" />}
            {eyebrow}
          </p>
        )}
        <Tag
          className={cn(
            "font-display font-extrabold leading-[1.1]",
            Tag === "h1" ? "text-4xl sm:text-5xl" : "text-2xl sm:text-3xl",
          )}
        >
          {title}
        </Tag>
        {description && (
          <p className="mt-3 text-base leading-relaxed text-text-muted">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export function Divider({ className, ...props }: React.HTMLAttributes<HTMLHRElement>) {
  return <hr className={cn("border-0 border-t border-line", className)} {...props} />;
}
