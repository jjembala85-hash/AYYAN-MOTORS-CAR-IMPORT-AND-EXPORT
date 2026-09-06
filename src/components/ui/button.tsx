import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const button = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "font-display font-semibold tracking-tight",
    "rounded-md border border-transparent",
    "transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-[var(--ease-out-quick)]",
    "active:translate-y-px",
    "disabled:pointer-events-none disabled:opacity-45",
    "[&_svg]:shrink-0 [&_svg]:size-[1.15em]",
  ],
  {
    variants: {
      variant: {
        /** The one red button on a screen. Reserve it for the primary action. */
        primary:
          "bg-brand text-text-on-brand hover:bg-brand-hover active:bg-brand-active shadow-sm",
        /** Default action. Carries most of the UI. */
        secondary:
          "bg-surface text-text border-line-strong hover:bg-surface-sunken hover:border-graphite-400 shadow-sm",
        /** Low emphasis, sits inside dense areas like card footers. */
        ghost:
          "bg-transparent text-text-muted hover:bg-surface-sunken hover:text-text",
        /** For dark photo overlays and the inverse header. */
        inverse:
          "bg-surface-inverse text-text-inverse hover:opacity-90 shadow-sm",
        /** Destructive — visually distinct from `primary` despite both being red. */
        danger:
          "bg-transparent text-brand border-line-strong hover:bg-brand-subtle hover:border-brand",
        link: "bg-transparent text-brand underline underline-offset-4 hover:text-brand-hover px-0 h-auto",
      },
      size: {
        sm: "h-8 px-3 text-[0.8125rem]",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-base",
        /** Square, for icon-only actions. Always pair with an aria-label. */
        icon: "size-10 px-0",
        "icon-sm": "size-8 px-0",
      },
      full: { true: "w-full", false: "" },
    },
    compoundVariants: [{ variant: "link", size: ["sm", "md", "lg"], class: "h-auto p-0" }],
    defaultVariants: { variant: "secondary", size: "md", full: false },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {
  /** Render the child element instead of a <button> — e.g. wrapping a <Link>. */
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, full, asChild, children, ...props }, ref) => {
    const classes = cn(button({ variant, size, full }), className);

    // Minimal asChild: clone a single element child rather than pulling in Radix.
    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<{ className?: string }>;
      return React.cloneElement(child, {
        className: cn(classes, child.props.className),
      });
    }

    return (
      <button ref={ref} className={classes} {...props}>
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

export { button as buttonVariants };
