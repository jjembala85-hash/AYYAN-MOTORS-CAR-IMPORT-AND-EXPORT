import type { Metadata } from "next";
import Link from "next/link";
import { CirclePlus, ImageOff, Pencil, SquareArrowOutUpRight } from "lucide-react";
import { listAllVehicles } from "@/admin/queries";
import { StatusSelect } from "@/admin/components/status-select";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Vehicles" };

/**
 * Every listing, drafts included.
 *
 * Reads through `listAllVehicles`, which goes straight to Postgres rather than
 * through the cached public read model — the panel must show the row that was
 * saved a second ago, and the public model deliberately hides anything that
 * isn't active.
 */

function money(minor: number | null, currency: string | null): string {
  if (minor === null || currency === null) return "On request";
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(minor / 100);
}

function when(date: Date): string {
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  const { deleted } = await searchParams;
  const rows = await listAllVehicles();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-archivo)] text-2xl font-extrabold tracking-tight">
            Vehicles
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            {rows.length} listing{rows.length === 1 ? "" : "s"}, newest edits first.
          </p>
        </div>

        <Button asChild variant="primary" className="ml-auto">
          <Link href="/admin/vehicles/new">
            <CirclePlus aria-hidden className="size-4" />
            Add a vehicle
          </Link>
        </Button>
      </div>

      {deleted ? (
        <p role="status" className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-text-muted">
          Listing deleted.
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="rounded-lg border border-line bg-surface px-4 py-12 text-center text-sm text-text-subtle">
          No vehicles yet. Add the first one to get started.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-3xl text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="eyebrow px-4 py-3 text-text-muted">Listing</th>
                <th className="eyebrow px-4 py-3 text-text-muted">Status</th>
                <th className="eyebrow px-4 py-3 text-text-muted">Price</th>
                <th className="eyebrow px-4 py-3 text-text-muted">Photos</th>
                <th className="eyebrow px-4 py-3 text-text-muted">Edited</th>
                <th className="px-4 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {rows.map((v) => (
                <tr key={v.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/vehicles/${v.slug}/edit`}
                      className="font-medium text-text underline-offset-2 hover:text-brand hover:underline"
                    >
                      {v.title}
                    </Link>
                    <p className="text-xs text-text-subtle">
                      {v.makeName} · {v.modelYear}
                      {v.isFeatured ? " · featured" : ""}
                    </p>
                  </td>

                  <td className="px-4 py-3">
                    <StatusSelect vehicleId={v.id} title={v.title} status={v.status} />
                  </td>

                  <td className="px-4 py-3 tabular-nums text-text-muted">
                    {money(v.priceMinor, v.priceCurrency)}
                  </td>

                  <td className="px-4 py-3">
                    {v.photoCount === 0 ? (
                      <span className="inline-flex items-center gap-1 text-brand">
                        <ImageOff aria-hidden className="size-3.5" />
                        none
                      </span>
                    ) : (
                      <span className="tabular-nums text-text-muted">{v.photoCount}</span>
                    )}
                  </td>

                  <td className="px-4 py-3 text-text-subtle">{when(v.updatedAt)}</td>

                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button asChild variant="ghost" size="icon-sm">
                        <Link href={`/admin/vehicles/${v.slug}/edit`} aria-label={`Edit ${v.title}`}>
                          <Pencil aria-hidden className="size-3.5" />
                        </Link>
                      </Button>
                      <Button asChild variant="ghost" size="icon-sm">
                        <Link
                          href={`/vehicles/${v.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`View ${v.title} on the site`}
                        >
                          <SquareArrowOutUpRight aria-hidden className="size-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
