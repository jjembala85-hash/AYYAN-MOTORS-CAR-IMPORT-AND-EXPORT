import * as React from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn("shimmer rounded-sm bg-surface-sunken", className)}
      {...props}
    />
  );
}

/** Matches VehicleCard's geometry so the grid doesn't reflow when data lands. */
export function VehicleCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm">
      <Skeleton className="aspect-[4/3] rounded-none" />
      <div className="space-y-3 p-5">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-5 w-3/4" />
        <div className="grid grid-cols-3 gap-3 pt-1">
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-line px-5 py-3.5">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-8 w-20" />
      </div>
    </div>
  );
}
