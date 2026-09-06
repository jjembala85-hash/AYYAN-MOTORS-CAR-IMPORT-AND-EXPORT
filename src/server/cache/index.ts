import "server-only";

import { NAMESPACE, cacheEnabled, dropTags, read, write } from "./client";

export { cacheEnabled, disconnect } from "./client";

/**
 * A read-through cache in front of Postgres.
 *
 * Every entry is a plain JSON value under a TTL, filed against one or more tags
 * so a write to the catalogue can drop exactly what it invalidated. Callers use
 * `cached()` and never touch Redis directly; if Redis is missing or unhealthy
 * `cached()` simply calls through, so the site behaves identically without it.
 *
 * What is worth caching here is narrower than it first looks. The home page and
 * the vehicle detail pages are prerendered by `next build`, so they never query
 * Postgres per visitor. The request-time load is the stock page — which reads
 * `searchParams` and so renders dynamically — and `/api/graphql`. Those are the
 * call sites wired up in `@/server/catalog/cached`.
 */

/* -------------------------------------------------------------------------- */
/* Policy                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * TTLs, in seconds.
 *
 * The catalogue is edited by hand a few times a day, not continuously, so these
 * are generous: a listing appearing a minute late costs nothing, and a short TTL
 * would spend most of its budget re-running the same query. Correctness on an
 * edit comes from `invalidate()`, not from waiting for a TTL to lapse.
 */
export const TTL = {
  /** Filtered result sets. Short: the long tail of filter combinations is wide. */
  search: 60,
  /** Facets, counts, hero picks — one value each, shared by every visitor. */
  catalog: 300,
} as const;

/**
 * Tags group entries by what would invalidate them.
 *
 * `vehicles` covers anything derived from a listing row; `facets` covers the
 * aggregate counts, which change on any insert or delete but not on an edit to
 * a single vehicle's description.
 */
export const TAGS = {
  vehicles: "vehicles",
  facets: "facets",
} as const;

export type Tag = (typeof TAGS)[keyof typeof TAGS];

/* -------------------------------------------------------------------------- */
/* Keys                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Builds a stable key from a name and its arguments.
 *
 * Object keys are sorted before serialization, so `{make, sort}` and
 * `{sort, make}` describe the same query and hit the same entry — without this
 * the hit rate would depend on the order the caller happened to build its
 * filter object in. `undefined` values are dropped for the same reason: an
 * absent filter and an explicitly-undefined one are the same query.
 */
export function cacheKey(name: string, args: unknown = null): string {
  return `${NAMESPACE}:${name}:${stable(args)}`;
}

function stable(value: unknown): string {
  if (value === null || value === undefined) return "_";
  if (typeof value !== "object") return String(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${stable(v)}`);

  return `(${entries.join(",")})`;
}

/* -------------------------------------------------------------------------- */
/* Read-through                                                                */
/* -------------------------------------------------------------------------- */

/**
 * In-flight reads, so concurrent callers on one instance share a single query.
 *
 * This is the cheap half of stampede protection. When a popular entry expires,
 * every request that arrives before the first one finishes would otherwise run
 * the same query; this collapses them within the instance. It does not
 * coordinate *between* instances — with a handful of instances that leaves a
 * handful of queries per expiry, which Postgres can absorb. A distributed lock
 * would be the fix if that ever stops being true.
 */
const inFlight = new Map<string, Promise<unknown>>();

interface CacheOptions {
  ttl: number;
  tags: readonly Tag[];
}

/**
 * Returns the cached value for `key`, or runs `load()` and caches its result.
 *
 * `load()` is always called on a miss and its result is always returned, so a
 * failure anywhere in the cache is invisible to the caller apart from the
 * latency it saved. The write is not awaited: the caller has its value, and
 * making it wait on Redis to store a copy would undo the point.
 */
export async function cached<T>(
  key: string,
  { ttl, tags }: CacheOptions,
  load: () => Promise<T>,
): Promise<T> {
  if (!cacheEnabled) return load();

  const hit = await read<T>(key);
  if (hit !== null) return hit;

  const pending = inFlight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const promise = load()
    .then((value) => {
      // `null` is indistinguishable from a miss once it is in Redis, so it is
      // not stored — a genuinely absent vehicle re-queries. That costs one
      // indexed lookup and keeps "missing" from being cached as "present".
      if (value !== null) void write(key, value, ttl, tags);
      return value;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, promise);
  return promise;
}

/**
 * Drops every entry under these tags. Call it from whatever writes to the
 * catalogue — an admin action, an import script — so an edit is visible
 * immediately rather than at the end of a TTL.
 */
export async function invalidate(...tags: Tag[]): Promise<number> {
  inFlight.clear();
  return dropTags(tags);
}
