import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Container, Section } from "@/components/ui/layout";
import { VehicleGrid } from "@/components/vehicle/vehicle-card";
import {
  DEFAULT_SORT,
  hasActiveFilters,
  isSortKey,
  parseYear,
  type VehicleQuery,
} from "@/lib/catalog";
import { db } from "@/server/db";
import { countVehicles, facets, listVehicles } from "@/server/catalog/cached";
import { StockFilters } from "./_components/stock-filters";

export const metadata: Metadata = {
  title: "Stock",
  description:
    "Every vehicle currently available from Ayyan Motors Ltd in Kampala — pickups, SUVs, vans and saloons, new and used.",
};

/** Search params arrive as `string | string[]`; take the first value only. */
function one(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v?.trim() ? v.trim() : undefined;
}

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;

  // Facets first: the year bounds come from the data, and validating `from`/`to`
  // against them stops a hand-edited URL reaching the query layer.
  const available = await facets(db);
  const sortParam = one(sp.sort);

  const query: VehicleQuery = {
    q: one(sp.q),
    make: one(sp.make),
    model: one(sp.model),
    type: one(sp.type),
    condition: one(sp.condition),
    from: parseYear(one(sp.from), available.years),
    to: parseYear(one(sp.to), available.years),
    sort: isSortKey(sortParam) ? sortParam : DEFAULT_SORT,
  };

  const [results, total] = await Promise.all([
    listVehicles(db, query),
    countVehicles(db),
  ]);
  const filtered = hasActiveFilters(query);

  return (
    <div className="min-h-dvh bg-canvas">
      <SiteHeader />

      <Section spacing="sm" tone="surface" className="border-b border-line">
        <Container>
          <p className="eyebrow flex items-center gap-2 text-brand">
            <span aria-hidden className="h-px w-6 bg-brand" />
            Available now
          </p>
          <h1 className="mt-4 font-display text-4xl font-extrabold leading-[1.05] sm:text-5xl">
            Stock
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-text-muted">
            {total} vehicles on the yard in Kampala. Prices are quoted on request —
            call or message us and we&apos;ll come back with a figure the same day.
          </p>
        </Container>
      </Section>

      <Section spacing="md">
        <Container>
          <StockFilters values={query} facets={available} showClear={filtered} />

          <div className="mt-8 flex items-baseline justify-between gap-4">
            <p aria-live="polite" className="text-sm text-text-muted">
              <span className="tabular font-semibold text-text">{results.length}</span>{" "}
              {results.length === 1 ? "vehicle" : "vehicles"}
              {filtered && ` of ${total}`}
            </p>
          </div>

          {results.length > 0 ? (
            <VehicleGrid vehicles={results} className="mt-6" />
          ) : (
            <EmptyState />
          )}
        </Container>
      </Section>

      <SiteFooter />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-6 rounded-lg border border-dashed border-line-strong bg-surface px-6 py-16 text-center">
      <h2 className="font-display text-xl font-bold">Nothing matches that</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-text-muted">
        We turn stock over quickly and can source to order. Clear the filters to see
        everything on the yard, or tell us what you&apos;re after.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button variant="secondary" asChild>
          <Link href="/vehicles">Clear filters</Link>
        </Button>
        <Button variant="primary" asChild>
          <Link href="/import">Source a vehicle</Link>
        </Button>
      </div>
    </div>
  );
}
