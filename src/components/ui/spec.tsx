import * as React from "react";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import type { Money } from "@/lib/catalog";

/* -------------------------------------------------------------------------- */

export interface SpecItemProps {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
  className?: string;
}

/** A single key/value fact. Values use tabular figures so columns line up. */
export function SpecItem({ icon, label, value, className }: SpecItemProps) {
  return (
    <div className={cn("flex items-start gap-2.5", className)}>
      {icon && (
        <span aria-hidden className="mt-0.5 text-text-subtle [&_svg]:size-4">
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <dt className="eyebrow text-text-subtle">{label}</dt>
        <dd className="tabular mt-1 truncate text-sm font-medium text-text">
          {value ?? "—"}
        </dd>
      </div>
    </div>
  );
}

export function SpecGrid({
  className,
  columns = 2,
  ...props
}: React.HTMLAttributes<HTMLDListElement> & { columns?: 2 | 3 | 4 }) {
  return (
    <dl
      className={cn(
        "grid gap-x-4 gap-y-4",
        columns === 2 && "grid-cols-2",
        columns === 3 && "grid-cols-2 sm:grid-cols-3",
        columns === 4 && "grid-cols-2 sm:grid-cols-4",
        className,
      )}
      {...props}
    />
  );
}

/* -------------------------------------------------------------------------- */

export interface PriceProps {
  value?: Money | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Most listings have no published price, so the "on request" state is styled
 * deliberately — muted and normal-weight — rather than left looking broken.
 */
export function Price({ value, size = "md", className }: PriceProps) {
  const { label, isOnRequest } = formatPrice(value);
  return (
    <span
      className={cn(
        "font-display leading-none",
        isOnRequest
          ? "font-medium text-text-muted"
          : "tabular font-extrabold text-text",
        size === "sm" && (isOnRequest ? "text-sm" : "text-base"),
        size === "md" && (isOnRequest ? "text-base" : "text-xl"),
        size === "lg" && (isOnRequest ? "text-lg" : "text-3xl"),
        className,
      )}
    >
      {label}
    </span>
  );
}
