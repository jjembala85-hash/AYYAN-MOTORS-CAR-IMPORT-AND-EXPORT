import "server-only";

import type { CatalogVehicle, CatalogVehicleDetail, Facets, VehicleQuery } from "@/lib/catalog";
import { TAGS, TTL, cacheKey, cached } from "@/server/cache";
import * as queries from "./queries";
import type { Db } from "./queries";

/**
 * The catalog read model, behind the cache.
 *
 * Same signatures as `./queries`, so a call site switches over by changing its
 * import. Pages and resolvers should import from here; `./queries` stays the
 * uncached truth, used by the seed and verification scripts and by anything
 * that must see a write immediately.
 *
 * Only the queries that run at request time are wrapped. `listVehicleSlugs` is
 * deliberately absent: it is called once per build by `generateStaticParams`,
 * where a cache has nothing to save and could serve a slug list from before the
 * newest listing was added.
 */

export async function listVehicles(
  db: Db,
  query: VehicleQuery = {},
  limit?: number,
): Promise<CatalogVehicle[]> {
  return cached(
    cacheKey("vehicles.list", { query, limit }),
    { ttl: TTL.search, tags: [TAGS.vehicles] },
    () => queries.listVehicles(db, query, limit),
  );
}

export async function countVehicles(db: Db, query: VehicleQuery = {}): Promise<number> {
  return cached(
    cacheKey("vehicles.count", query),
    { ttl: TTL.catalog, tags: [TAGS.vehicles, TAGS.facets] },
    () => queries.countVehicles(db, query),
  );
}

export async function getVehicleBySlug(
  db: Db,
  slug: string,
): Promise<CatalogVehicleDetail | null> {
  return cached(
    cacheKey("vehicles.bySlug", slug),
    { ttl: TTL.catalog, tags: [TAGS.vehicles] },
    () => queries.getVehicleBySlug(db, slug),
  );
}

/**
 * Keyed on the three columns the ranking actually reads, not on the whole
 * vehicle. Every other field — description, mileage, the gallery — can change
 * without altering which vehicles come back, and including them would miss the
 * cache on every edit for no gain.
 */
export async function relatedVehicles(
  db: Db,
  vehicle: CatalogVehicle,
  limit = 3,
): Promise<CatalogVehicle[]> {
  return cached(
    cacheKey("vehicles.related", {
      id: vehicle.id,
      bodyType: vehicle.bodyType,
      make: vehicle.make,
      limit,
    }),
    { ttl: TTL.catalog, tags: [TAGS.vehicles] },
    () => queries.relatedVehicles(db, vehicle, limit),
  );
}

export async function heroGradeVehicles(db: Db, limit = 3): Promise<CatalogVehicle[]> {
  return cached(
    cacheKey("vehicles.heroGrade", limit),
    { ttl: TTL.catalog, tags: [TAGS.vehicles] },
    () => queries.heroGradeVehicles(db, limit),
  );
}

/**
 * The most valuable entry here: five aggregates over the whole catalogue,
 * rendered on every stock page load to build the filter bar, and identical for
 * every visitor.
 */
export async function facets(db: Db): Promise<Facets> {
  return cached(
    cacheKey("catalog.facets"),
    { ttl: TTL.catalog, tags: [TAGS.vehicles, TAGS.facets] },
    () => queries.facets(db),
  );
}
