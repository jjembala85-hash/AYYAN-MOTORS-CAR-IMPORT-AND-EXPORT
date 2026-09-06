import * as React from "react";
import { cn } from "@/lib/utils";

/** One documented block of the style guide. */
export function Spec({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-line pt-10">
      <h2 className="font-display text-2xl font-extrabold tracking-tight">{title}</h2>
      {description && (
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-muted">
          {description}
        </p>
      )}
      <div className="mt-7">{children}</div>
    </section>
  );
}

/** A labelled example, optionally with usage guidance. */
export function Demo({
  label,
  note,
  className,
  children,
}: {
  label?: string;
  note?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-7 last:mb-0">
      {label && <p className="eyebrow mb-3 text-text-subtle">{label}</p>}
      <div className={cn("flex flex-wrap items-center gap-3", className)}>{children}</div>
      {note && <p className="mt-3 text-xs leading-relaxed text-text-subtle">{note}</p>}
    </div>
  );
}

/** Colour chip with its token name and resolved value. */
export function Swatch({
  token,
  name,
  usage,
  border,
}: {
  token: string;
  name: string;
  usage?: string;
  border?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div
        className={cn(
          "h-16 w-full rounded-md",
          border ? "border border-line-strong" : "border border-line",
        )}
        style={{ backgroundColor: `var(${token})` }}
      />
      <p className="mt-2 truncate font-mono text-[0.6875rem] text-text">{name}</p>
      {usage && <p className="mt-0.5 text-[0.6875rem] leading-snug text-text-subtle">{usage}</p>}
    </div>
  );
}

export function SwatchGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">{children}</div>
  );
}

/** Do / Don't guidance pair. */
export function Rule({ kind, children }: { kind: "do" | "dont"; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-md border-l-2 bg-surface px-4 py-3 text-sm leading-relaxed",
        kind === "do" ? "border-l-success" : "border-l-brand",
      )}
    >
      <span
        className={cn(
          "eyebrow mr-2",
          kind === "do" ? "text-success" : "text-brand",
        )}
      >
        {kind === "do" ? "Do" : "Don't"}
      </span>
      <span className="text-text-muted">{children}</span>
    </div>
  );
}
