"use client";

import * as React from "react";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

const control = [
  "w-full bg-surface text-text placeholder:text-text-subtle",
  "border border-line-strong rounded-md",
  "transition-[border-color,box-shadow] duration-150",
  "hover:border-graphite-400",
  "focus:outline-none focus:border-brand focus:ring-2 focus:ring-[var(--brand-ring)]",
  "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-surface-sunken",
].join(" ");

/* -------------------------------------------------------------------------- */

export interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  /** Visually hide the label but keep it for screen readers. */
  srOnlyLabel?: boolean;
  className?: string;
  children: React.ReactNode;
}

/** Label + control + hint/error, so spacing and error colour stay consistent. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  srOnlyLabel,
  className,
  children,
}: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className={cn("eyebrow text-text-muted", srOnlyLabel && "sr-only")}
      >
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-brand">{error}</p>
      ) : hint ? (
        <p className="text-xs text-text-subtle">{hint}</p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        control,
        "h-10 px-3 text-sm",
        invalid && "border-brand focus:border-brand",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

/* -------------------------------------------------------------------------- */

export const SearchInput = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <div className="relative">
      <Search
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-subtle"
      />
      <Input ref={ref} type="search" className={cn("pl-9", className)} {...props} />
    </div>
  ),
);
SearchInput.displayName = "SearchInput";

/* -------------------------------------------------------------------------- */

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, invalid, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          control,
          "h-10 appearance-none pl-3 pr-9 text-sm",
          invalid && "border-brand",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-text-subtle"
      />
    </div>
  ),
);
Select.displayName = "Select";

/* -------------------------------------------------------------------------- */

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(({ className, invalid, ...props }, ref) => (
  <textarea
    ref={ref}
    aria-invalid={invalid || undefined}
    className={cn(control, "min-h-24 px-3 py-2.5 text-sm resize-y", invalid && "border-brand", className)}
    {...props}
  />
));
Textarea.displayName = "Textarea";
