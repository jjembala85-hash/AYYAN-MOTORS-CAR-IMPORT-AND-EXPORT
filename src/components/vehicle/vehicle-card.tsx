import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Fuel, Gauge, ImageOff, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Price, SpecItem } from "@/components/ui/spec";
import { formatMileage } from "@/lib/format";
import type { CatalogVehicle } from "@/lib/catalog";
import { cn } from "@/lib/utils";

export interface VehicleCardProps {
  vehicle: CatalogVehicle;
  /** `compact` drops the spec row — for sidebars and "related" rails. */
  variant?: "default" | "compact";
  /** Set on the first row of a grid so the LCP image isn't lazy-loaded. */
  priority?: boolean;
  className?: string;
}

export function VehicleCard({
  vehicle: v,
  variant = "default",
  priority = false,
  className,
}: VehicleCardProps) {
  const href = `/vehicles/${v.slug}`;
  const mileage = formatMileage(v.mileageKm);

  return (
    <Card
      interactive
      elevation="raised"
      className={cn("group flex flex-col overflow-hidden", className)}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-sunken">
        {/* A listing can exist before its photos are uploaded, so the empty
            state is real UI rather than a broken image. */}
        {v.cover ? (
          <Image
            src={v.cover.url}
            alt={v.cover.alt ?? `${v.title} — ${v.year}`}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            priority={priority}
            className={cn(
              "object-cover transition-transform duration-500 ease-[var(--ease-out-quick)] group-hover:scale-[1.04]",
              v.isSold && "opacity-60 saturate-50",
            )}
          />
        ) : (
          <div className="grid h-full place-items-center">
            <ImageOff aria-hidden className="size-8 text-text-subtle" />
            <span className="sr-only">Photo coming soon</span>
          </div>
        )}

        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {v.condition === "New" && <Badge variant="brand">New</Badge>}
          {v.isAuction && <Badge variant="overlay">Auction</Badge>}
        </div>

        {v.isSold && (
          <div className="absolute inset-0 grid place-items-center bg-graphite-950/45">
            <Badge variant="overlay" size="md" className="text-xs">
              Sold
            </Badge>
          </div>
        )}

        {v.bodyType && (
          <Badge variant="overlay" size="sm" className="absolute bottom-3 left-3">
            {v.bodyType}
          </Badge>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <p className="eyebrow text-text-subtle">
          {v.year} · {v.make}
        </p>
        <h3 className="mt-2 font-display text-lg font-bold leading-snug">
          {/* Stretched link: the whole card is the hit area, but only the
              title is announced as the link. */}
          <Link href={href} className="after:absolute after:inset-0 focus:outline-none">
            {v.title}
          </Link>
        </h3>

        {variant === "default" && (
          <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4">
            <SpecItem icon={<Gauge />} label="Mileage" value={mileage ?? "—"} />
            <SpecItem icon={<Settings2 />} label="Gearbox" value={v.transmission ?? "—"} />
            <SpecItem icon={<Fuel />} label="Fuel" value={v.fuelType ?? "—"} />
          </dl>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3.5">
        <Price value={v.price} size="sm" />
        <span className="inline-flex items-center gap-1.5 font-display text-sm font-semibold text-brand transition-transform duration-200 group-hover:translate-x-0.5">
          View
          <ArrowRight aria-hidden className="size-4" />
        </span>
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */

export function VehicleGrid({
  vehicles,
  className,
  /** How many leading images to preload. Set to 0 for a grid below the fold. */
  priorityCount = 3,
}: {
  vehicles: CatalogVehicle[];
  className?: string;
  priorityCount?: number;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {vehicles.map((v, i) => (
        <VehicleCard key={v.id} vehicle={v} priority={i < priorityCount} />
      ))}
    </div>
  );
}
