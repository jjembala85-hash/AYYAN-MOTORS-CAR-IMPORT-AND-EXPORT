/**
 * Catalog vocabulary shared by the server queries and the client filter bar:
 * types, sort keys and query parsing, with no database imports. The filter bar
 * is a client component, so anything it touches must not pull Drizzle or the
 * schema into the browser bundle.
 *
 * The queries that actually hit Postgres live in `@/server/catalog/queries`.
 */

export interface Money {
  /** Minor units — cents for USD. */
  minor: number;
  currency: string;
}

export interface CatalogPhoto {
  url: string;
  alt: string | null;
  width: number | null;
  height: number | null;
}

export interface CatalogVehicle {
  id: string;
  slug: string;
  title: string;
  year: number;
  make: string;
  model: string;
  modelFamily: string;
  bodyType: string | null;
  condition: string | null;
  transmission: string | null;
  fuelType: string | null;
  driveType: string | null;
  steering: string;
  mileageKm: number | null;
  price: Money | null;
  pricingType: string;
  status: string;
  isFeatured: boolean;
  isAuction: boolean;
  isSold: boolean;
  imageTier: string | null;
  description: string | null;
  cover: CatalogPhoto | null;
  gallery: CatalogPhoto[];
}

export interface CatalogVehicleDetail extends CatalogVehicle {
  chassisNumber: string | null;
  vin: string | null;
  exteriorColor: string | null;
  interiorColor: string | null;
  doors: number | null;
  seats: number | null;
  engine: {
    engineCode: string | null;
    displacementCc: number | null;
    cylinders: number | null;
    aspiration: string | null;
    powerHp: number | null;
    torqueNm: number | null;
  } | null;
  features: string[];
}

/* -------------------------------------------------------------------------- */

export const SORTS = {
  newest: "Newest first",
  oldest: "Oldest first",
  az: "A – Z",
} as const;

export type SortKey = keyof typeof SORTS;
export const DEFAULT_SORT: SortKey = "newest";

export function isSortKey(value: unknown): value is SortKey {
  return typeof value === "string" && value in SORTS;
}

export interface VehicleQuery {
  q?: string;
  /** Display values, as published in URLs: "Toyota", "SUV", "Used". */
  make?: string;
  model?: string;
  type?: string;
  condition?: string;
  from?: number;
  to?: number;
  sort?: SortKey;
}

export function hasActiveFilters(query: VehicleQuery): boolean {
  return Boolean(
    query.q || query.make || query.model || query.type || query.condition ||
      query.from || query.to,
  );
}

export interface Facet {
  value: string;
  count: number;
}

export interface ModelFacet extends Facet {
  make: string;
}

export interface YearRange {
  min: number;
  max: number;
}

export interface Facets {
  makes: Facet[];
  models: ModelFacet[];
  types: Facet[];
  conditions: Facet[];
  years: YearRange;
}

/**
 * Parses a year from a URL param, discarding anything outside the catalogue's
 * actual range — the bounds come from the data, so they are passed in rather
 * than hardcoded.
 */
export function parseYear(value: string | undefined, range: YearRange): number | undefined {
  if (!value) return undefined;
  const year = Number(value);
  if (!Number.isInteger(year)) return undefined;
  return year >= range.min && year <= range.max ? year : undefined;
}

/** Selectable years, newest first. */
export function yearOptions(range: YearRange): number[] {
  return Array.from({ length: range.max - range.min + 1 }, (_, i) => range.max - i);
}
