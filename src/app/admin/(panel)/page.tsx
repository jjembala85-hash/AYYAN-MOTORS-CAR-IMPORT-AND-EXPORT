import Link from "next/link";
import { sql } from "drizzle-orm";
import { CirclePlus, ImageOff, TriangleAlert } from "lucide-react";
import { requireAdminPage } from "@/admin/auth";
import { Button } from "@/components/ui/button";
import { db, vehicleMedia, vehicles } from "@/server/db";

/**
 * The dashboard.
 *
 * Counts rather than charts, and the counts chosen are the ones that represent
 * work: how many listings are unpublished, and how many are missing the two
 * things that stop a listing being useful — a photo and a price. A "total
 * vehicles" tile would look busier and tell nobody what to do next.
 */

async function stats() {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${vehicles.status} = 'active')::int`,
      draft: sql<number>`count(*) filter (where ${vehicles.status} = 'draft')::int`,
      sold: sql<number>`count(*) filter (where ${vehicles.status} = 'sold')::int`,
      featured: sql<number>`count(*) filter (where ${vehicles.isFeatured})::int`,
      noPrice: sql<number>`count(*) filter (where ${vehicles.priceMinor} is null)::int`,
      /*
       * Table names written out rather than interpolated as `${vehicleMedia.vehicleId}`.
       * Drizzle's qualification of a column inside a raw `sql` fragment depends on
       * where the fragment sits: in a `.where()`, or in any query with a join, it
       * emits "vehicle_media"."vehicle_id"; in a select field of a single-table
       * query it emits a bare "vehicle_id". Unqualified, this correlation becomes
       * `where "vehicle_id" = "id"` — both resolve to vehicle_media's own columns,
       * so it is always false, `not exists` is always true, and the tile reports
       * every listing as missing photos. No error, just a wrong number, which is
       * the worst way for a query to fail.
       */
      noPhotos: sql<number>`count(*) filter (where not exists (
        select 1 from "vehicle_media"
        where "vehicle_media"."vehicle_id" = "vehicles"."id"
      ))::int`,
    })
    .from(vehicles);

  return row;
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "warn";
}) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <p className="eyebrow text-text-muted">{label}</p>
      <p
        className={
          "mt-1 font-[family-name:var(--font-archivo)] text-3xl font-extrabold tabular-nums " +
          (tone === "warn" && value > 0 ? "text-brand" : "text-text")
        }
      >
        {value}
      </p>
    </div>
  );
}

export default async function AdminDashboard() {
  const session = await requireAdminPage();
  const s = await stats();

  const needsPhotos = await db
    .select({ slug: vehicles.slug, title: vehicles.title, modelYear: vehicles.modelYear })
    .from(vehicles)
    .where(
      sql`not exists (select 1 from ${vehicleMedia} where ${vehicleMedia.vehicleId} = ${vehicles.id})`,
    )
    .limit(6);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-archivo)] text-2xl font-extrabold tracking-tight">
            Good to see you, {session.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            {s.active} of {s.total} listings are live on the site.
          </p>
        </div>

        <Button asChild className="ml-auto">
          <Link href="/admin/vehicles/new">
            <CirclePlus aria-hidden className="size-4" />
            Add a vehicle
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Live" value={s.active} />
        <Tile label="Drafts" value={s.draft} />
        <Tile label="Sold" value={s.sold} />
        <Tile label="Featured" value={s.featured} />
      </div>

      <section>
        <h2 className="font-[family-name:var(--font-archivo)] text-sm font-bold tracking-tight">
          Needs attention
        </h2>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-line bg-surface p-4">
            <div className="flex items-center gap-2">
              <ImageOff aria-hidden className="size-4 text-text-muted" />
              <p className="text-sm font-medium">No photos</p>
              <span className="ml-auto font-[family-name:var(--font-archivo)] text-xl font-extrabold tabular-nums">
                {s.noPhotos}
              </span>
            </div>

            {needsPhotos.length > 0 ? (
              <ul className="mt-3 flex flex-col gap-1">
                {needsPhotos.map((v) => (
                  <li key={v.slug}>
                    <Link
                      href={`/admin/vehicles/${v.slug}/edit`}
                      className="text-sm text-text-muted underline-offset-2 hover:text-brand hover:underline"
                    >
                      {v.title} · {v.modelYear}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-text-subtle">Every listing has at least one photo.</p>
            )}
          </div>

          <div className="rounded-lg border border-line bg-surface p-4">
            <div className="flex items-center gap-2">
              <TriangleAlert aria-hidden className="size-4 text-text-muted" />
              <p className="text-sm font-medium">No price</p>
              <span className="ml-auto font-[family-name:var(--font-archivo)] text-xl font-extrabold tabular-nums">
                {s.noPrice}
              </span>
            </div>
            <p className="mt-2 text-sm text-text-subtle">
              These show as “Price on request”. The public price filter stays hidden until
              real figures are entered — a filter that narrows nothing is worse than none.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
