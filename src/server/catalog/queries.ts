/**
 * Catalog read model. Everything the site and the GraphQL API need to read
 * vehicles lives here, so there is one place where filtering, sorting and the
 * row-to-view-model mapping are defined.
 */

import { and, asc, desc, eq, gte, inArray, lte, ne, sql, type SQL } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type {
  CatalogVehicle,
  CatalogVehicleDetail,
  Facet,
  Facets,
  SortKey,
  VehicleQuery,
} from "@/lib/catalog";
import { DEFAULT_SORT } from "@/lib/catalog";
import * as schema from "@/server/db/schema";

/*
 * Structural rather than the concrete client type, so these run against the
 * neon-http driver, postgres.js and the WASM database in the verify scripts
 * alike. Exported for `./cached`, which mirrors these signatures.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

// Query vocabulary and view-model types live in @/lib/catalog so client
// components can share them without importing Drizzle.

/* -------------------------------------------------------------------------- */
/* Display <-> storage mapping                                                 */
/* -------------------------------------------------------------------------- */

/*
 * The database stores lowercase enum values; the URLs the site already publishes
 * use display casing ("/vehicles?type=SUV" is linked from the footer). Mapping
 * here keeps those links working rather than breaking every published URL.
 */
const BODY_TYPE_LABELS: Record<string, string> = {
  suv: "SUV",
  pickup: "Pickup",
  van: "Van",
  bus: "Bus",
  truck: "Truck",
  sedan: "Sedan",
  hatchback: "Hatchback",
  wagon: "Wagon",
  coupe: "Coupe",
  convertible: "Convertible",
};

const TRANSMISSION_LABELS: Record<string, string> = {
  manual: "Manual",
  automatic: "Automatic",
  cvt: "CVT",
  amt: "AMT",
  dct: "DCT",
};

const FUEL_LABELS: Record<string, string> = {
  petrol: "Petrol",
  diesel: "Diesel",
  hybrid: "Hybrid",
  plugin_hybrid: "Plug-in hybrid",
  electric: "Electric",
  lpg: "LPG",
};

const DRIVE_LABELS: Record<string, string> = {
  fwd: "FWD",
  rwd: "RWD",
  awd: "AWD",
  "4wd": "4WD",
  "2wd": "2WD",
};

const CONDITION_LABELS: Record<string, string> = { new: "New", used: "Used" };

function label(map: Record<string, string>, value: string | null): string | null {
  if (!value) return null;
  return map[value] ?? value;
}

function toEnum(map: Record<string, string>, display: string | undefined): string | undefined {
  if (!display) return undefined;
  const needle = display.toLowerCase();
  const hit = Object.entries(map).find(
    ([key, text]) => key === needle || text.toLowerCase() === needle,
  );
  return hit?.[0];
}

/* -------------------------------------------------------------------------- */
/* Filtering                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Builds a prefix tsquery so a half-typed "hilu" still matches, which
 * `plainto_tsquery` would not. Terms are stripped to alphanumerics first —
 * tsquery has its own operator syntax and would otherwise raise on user input.
 */
function searchCondition(q: string): SQL | undefined {
  const terms = q
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z0-9]/g, ""))
    .filter(Boolean);

  if (!terms.length) return undefined;
  const query = terms.map((t) => `${t}:*`).join(" & ");
  return sql`${schema.vehicles.searchDocument} @@ to_tsquery('simple', ${query})`;
}

function conditions(query: VehicleQuery): SQL[] {
  const parts: SQL[] = [
    // Drafts and archived listings are never public.
    inArray(schema.vehicles.status, ["active", "reserved", "sold"]),
  ];

  const bodyType = toEnum(BODY_TYPE_LABELS, query.type);
  if (bodyType) parts.push(eq(schema.vehicles.bodyType, bodyType as "suv"));

  const condition = toEnum(CONDITION_LABELS, query.condition);
  if (condition) parts.push(eq(schema.vehicles.condition, condition as "new"));

  if (query.make) parts.push(sql`lower(${schema.makes.name}) = lower(${query.make})`);
  if (query.model) parts.push(sql`lower(${schema.models.family}) = lower(${query.model})`);
  if (query.from) parts.push(gte(schema.vehicles.modelYear, query.from));
  if (query.to) parts.push(lte(schema.vehicles.modelYear, query.to));

  const search = query.q ? searchCondition(query.q) : undefined;
  if (search) parts.push(search);

  return parts;
}

function orderBy(sort: SortKey) {
  switch (sort) {
    case "oldest":
      return [asc(schema.vehicles.modelYear), asc(schema.vehicles.title)];
    case "az":
      return [asc(schema.vehicles.title)];
    default:
      return [desc(schema.vehicles.modelYear), asc(schema.vehicles.title)];
  }
}

/* -------------------------------------------------------------------------- */
/* Row mapping                                                                 */
/* -------------------------------------------------------------------------- */

type JoinedRow = {
  vehicle: typeof schema.vehicles.$inferSelect;
  make: typeof schema.makes.$inferSelect;
  model: typeof schema.models.$inferSelect;
};

function toCatalogVehicle(row: JoinedRow, media: (typeof schema.vehicleMedia.$inferSelect)[]): CatalogVehicle {
  const v = row.vehicle;
  const photos = media
    .filter((m) => m.kind === "photo")
    .sort((a, b) => Number(b.isCover) - Number(a.isCover) || a.position - b.position);
  const cover = photos.find((p) => p.isCover) ?? photos[0] ?? null;

  return {
    id: v.id,
    slug: v.slug,
    title: v.title,
    year: v.modelYear,
    make: row.make.name,
    model: row.model.name,
    modelFamily: row.model.family,
    bodyType: label(BODY_TYPE_LABELS, v.bodyType),
    condition: label(CONDITION_LABELS, v.condition),
    transmission: label(TRANSMISSION_LABELS, v.transmission),
    fuelType: label(FUEL_LABELS, v.fuelType),
    driveType: label(DRIVE_LABELS, v.driveType),
    steering: v.steering,
    mileageKm: v.mileageKm,
    price:
      v.priceMinor != null && v.priceCurrency
        ? { minor: Number(v.priceMinor), currency: v.priceCurrency }
        : null,
    pricingType: v.pricingType,
    status: v.status,
    isFeatured: v.isFeatured,
    isAuction: v.isAuction,
    isSold: v.status === "sold",
    imageTier: cover?.tier ?? null,
    description: v.description,
    cover: cover
      ? { url: cover.url, alt: cover.alt, width: cover.width, height: cover.height }
      : null,
    gallery: photos
      .filter((p) => p.id !== cover?.id)
      .map((p) => ({ url: p.url, alt: p.alt, width: p.width, height: p.height })),
  };
}

/** One query for the media of many vehicles — avoids a round trip per card. */
async function mediaFor(db: Db, vehicleIds: string[]) {
  if (!vehicleIds.length) return new Map<string, (typeof schema.vehicleMedia.$inferSelect)[]>();

  const rows = await db
    .select()
    .from(schema.vehicleMedia)
    .where(inArray(schema.vehicleMedia.vehicleId, vehicleIds));

  const grouped = new Map<string, (typeof schema.vehicleMedia.$inferSelect)[]>();
  for (const row of rows) {
    const list = grouped.get(row.vehicleId);
    if (list) list.push(row);
    else grouped.set(row.vehicleId, [row]);
  }
  return grouped;
}

/* -------------------------------------------------------------------------- */
/* Public queries                                                              */
/* -------------------------------------------------------------------------- */

export async function listVehicles(
  db: Db,
  query: VehicleQuery = {},
  limit?: number,
): Promise<CatalogVehicle[]> {
  const base = db
    .select({
      vehicle: schema.vehicles,
      make: schema.makes,
      model: schema.models,
    })
    .from(schema.vehicles)
    .innerJoin(schema.makes, eq(schema.vehicles.makeId, schema.makes.id))
    .innerJoin(schema.models, eq(schema.vehicles.modelId, schema.models.id))
    .where(and(...conditions(query)))
    .orderBy(...orderBy(query.sort ?? DEFAULT_SORT));

  const rows = await (limit ? base.limit(limit) : base);
  const media = await mediaFor(db, rows.map((r) => r.vehicle.id));

  return rows.map((r) => toCatalogVehicle(r, media.get(r.vehicle.id) ?? []));
}

export async function countVehicles(db: Db, query: VehicleQuery = {}): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.vehicles)
    .innerJoin(schema.makes, eq(schema.vehicles.makeId, schema.makes.id))
    .innerJoin(schema.models, eq(schema.vehicles.modelId, schema.models.id))
    .where(and(...conditions(query)));

  return row?.count ?? 0;
}

export async function getVehicleBySlug(
  db: Db,
  slug: string,
): Promise<CatalogVehicleDetail | null> {
  const [row] = await db
    .select({
      vehicle: schema.vehicles,
      make: schema.makes,
      model: schema.models,
      engine: schema.vehicleEngines,
    })
    .from(schema.vehicles)
    .innerJoin(schema.makes, eq(schema.vehicles.makeId, schema.makes.id))
    .innerJoin(schema.models, eq(schema.vehicles.modelId, schema.models.id))
    .leftJoin(schema.vehicleEngines, eq(schema.vehicleEngines.vehicleId, schema.vehicles.id))
    .where(
      and(
        eq(schema.vehicles.slug, slug),
        inArray(schema.vehicles.status, ["active", "reserved", "sold"]),
      ),
    )
    .limit(1);

  if (!row) return null;

  const media = await mediaFor(db, [row.vehicle.id]);
  const featureRows = await db
    .select({ name: schema.features.name })
    .from(schema.vehicleFeatures)
    .innerJoin(schema.features, eq(schema.vehicleFeatures.featureId, schema.features.id))
    .where(eq(schema.vehicleFeatures.vehicleId, row.vehicle.id))
    .orderBy(asc(schema.features.name));

  const v = row.vehicle;
  return {
    ...toCatalogVehicle(row, media.get(v.id) ?? []),
    chassisNumber: v.chassisNumber,
    vin: v.vin,
    exteriorColor: v.exteriorColor,
    interiorColor: v.interiorColor,
    doors: v.doors,
    seats: v.seats,
    engine: row.engine
      ? {
          engineCode: row.engine.engineCode,
          displacementCc: row.engine.displacementCc,
          cylinders: row.engine.cylinders,
          aspiration: row.engine.aspiration,
          powerHp: row.engine.powerHp,
          torqueNm: row.engine.torqueNm,
        }
      : null,
    features: featureRows.map((f) => f.name),
  };
}

export async function listVehicleSlugs(db: Db): Promise<string[]> {
  const rows = await db
    .select({ slug: schema.vehicles.slug })
    .from(schema.vehicles)
    .where(inArray(schema.vehicles.status, ["active", "reserved", "sold"]));
  return rows.map((r) => r.slug);
}

/**
 * Same body type first, then anything else from the same make, so a detail page
 * always fills its rail even for a one-off like the Brabus.
 */
export async function relatedVehicles(
  db: Db,
  vehicle: CatalogVehicle,
  limit = 3,
): Promise<CatalogVehicle[]> {
  const bodyType = toEnum(BODY_TYPE_LABELS, vehicle.bodyType ?? undefined);

  const rows = await db
    .select({
      vehicle: schema.vehicles,
      make: schema.makes,
      model: schema.models,
      score: sql<number>`
        (case when ${schema.vehicles.bodyType}::text = ${bodyType ?? null} then 2 else 0 end)
      + (case when ${schema.makes.name} = ${vehicle.make} then 1 else 0 end)`.as("score"),
    })
    .from(schema.vehicles)
    .innerJoin(schema.makes, eq(schema.vehicles.makeId, schema.makes.id))
    .innerJoin(schema.models, eq(schema.vehicles.modelId, schema.models.id))
    .where(
      and(
        ne(schema.vehicles.id, vehicle.id),
        inArray(schema.vehicles.status, ["active", "reserved"]),
      ),
    )
    .orderBy(desc(sql`score`), desc(schema.vehicles.modelYear))
    .limit(limit);

  const media = await mediaFor(db, rows.map((r) => r.vehicle.id));
  return rows.map((r) => toCatalogVehicle(r, media.get(r.vehicle.id) ?? []));
}

/** Photo sets clean enough to lead a page. */
export async function heroGradeVehicles(db: Db, limit = 3): Promise<CatalogVehicle[]> {
  const rows = await db
    .select({ vehicle: schema.vehicles, make: schema.makes, model: schema.models })
    .from(schema.vehicles)
    .innerJoin(schema.makes, eq(schema.vehicles.makeId, schema.makes.id))
    .innerJoin(schema.models, eq(schema.vehicles.modelId, schema.models.id))
    .innerJoin(
      schema.vehicleMedia,
      and(
        eq(schema.vehicleMedia.vehicleId, schema.vehicles.id),
        eq(schema.vehicleMedia.isCover, true),
        eq(schema.vehicleMedia.tier, "a"),
      ),
    )
    .where(inArray(schema.vehicles.status, ["active", "reserved"]))
    .orderBy(desc(schema.vehicles.modelYear))
    .limit(limit);

  const media = await mediaFor(db, rows.map((r) => r.vehicle.id));
  return rows.map((r) => toCatalogVehicle(r, media.get(r.vehicle.id) ?? []));
}

/* -------------------------------------------------------------------------- */
/* Facets                                                                      */
/* -------------------------------------------------------------------------- */

/** Counts are over the whole public catalogue, not the current result set. */
export async function facets(db: Db): Promise<Facets> {
  const published = inArray(schema.vehicles.status, ["active", "reserved", "sold"]);

  const [makeRows, modelRows, typeRows, conditionRows, yearRow] = await Promise.all([
    db
      .select({ value: schema.makes.name, count: sql<number>`count(*)::int` })
      .from(schema.vehicles)
      .innerJoin(schema.makes, eq(schema.vehicles.makeId, schema.makes.id))
      .where(published)
      .groupBy(schema.makes.name),

    db
      .select({
        value: schema.models.family,
        make: schema.makes.name,
        count: sql<number>`count(*)::int`,
      })
      .from(schema.vehicles)
      .innerJoin(schema.models, eq(schema.vehicles.modelId, schema.models.id))
      .innerJoin(schema.makes, eq(schema.vehicles.makeId, schema.makes.id))
      .where(published)
      .groupBy(schema.models.family, schema.makes.name),

    db
      .select({ value: schema.vehicles.bodyType, count: sql<number>`count(*)::int` })
      .from(schema.vehicles)
      .where(and(published, sql`${schema.vehicles.bodyType} is not null`))
      .groupBy(schema.vehicles.bodyType),

    db
      .select({ value: schema.vehicles.condition, count: sql<number>`count(*)::int` })
      .from(schema.vehicles)
      .where(published)
      .groupBy(schema.vehicles.condition),

    db
      .select({
        min: sql<number>`min(${schema.vehicles.modelYear})::int`,
        max: sql<number>`max(${schema.vehicles.modelYear})::int`,
      })
      .from(schema.vehicles)
      .where(published),
  ]);

  const byCount = <T extends Facet>(a: T, b: T) =>
    b.count - a.count || a.value.localeCompare(b.value);

  return {
    makes: makeRows.sort(byCount),
    models: modelRows.sort(byCount),
    types: typeRows
      .map((r) => ({ value: BODY_TYPE_LABELS[r.value!] ?? r.value!, count: r.count }))
      .sort(byCount),
    conditions: conditionRows
      .map((r) => ({ value: CONDITION_LABELS[r.value] ?? r.value, count: r.count }))
      .sort(byCount),
    years: {
      min: yearRow[0]?.min ?? new Date().getFullYear(),
      max: yearRow[0]?.max ?? new Date().getFullYear(),
    },
  };
}
