import { createClient, type RedisClientType } from "redis";

/**
 * The Redis connection, and every raw operation the cache is allowed to make.
 *
 * Two rules govern this file, both of which follow from where it runs. The site
 * is deployed across several instances, so the cache is shared and a single
 * unhealthy Redis is visible to every request at once:
 *
 *   1. **Nothing here throws.** A cache is an optimisation. If Redis is down,
 *      slow or misconfigured the caller must still get its data from Postgres,
 *      so every operation resolves to `null`/`false` instead of rejecting.
 *   2. **Nothing here waits long.** An unreachable Redis that hangs until the
 *      TCP timeout would make every page slower than having no cache at all.
 *      Operations race a short deadline and give up.
 *
 * Deliberately free of `server-only` for the same reason as `db/client.ts`: the
 * CLI scripts run in plain Node, where that import throws. Application code
 * imports `./index`, which carries the guard.
 */

/** Redis is optional. With no URL the whole layer is a no-op. */
export const REDIS_URL = process.env.REDIS_URL ?? "";

/*
 * Off during `next build`. Prerendering runs each query once and bakes the
 * result into static HTML, so there is nothing to gain from caching it — and
 * two things to lose: the build's worker pool would open a Redis connection per
 * worker, and an open socket keeps Node from exiting once the build is done.
 */
export const cacheEnabled =
  REDIS_URL.length > 0 && process.env.NEXT_PHASE !== "phase-production-build";

/**
 * Bumped by hand when the *shape* of a cached value changes — a new field on
 * `CatalogVehicle`, a different sort. Entries written by the previous shape stay
 * in Redis until their TTL runs out, and code from the new deploy would happily
 * deserialize one into the wrong type. Changing the namespace orphans them all
 * at once instead, which is cheaper than reasoning about which are still valid.
 */
export const NAMESPACE = process.env.CACHE_NAMESPACE ?? "ayyan:v1";

/** How long any single Redis round trip may take before we go to Postgres. */
const TIMEOUT_MS = Number(process.env.CACHE_TIMEOUT_MS ?? 50);

/**
 * After a failure, stop calling Redis for this long. Without it, a Redis that is
 * down but still accepting connections adds `TIMEOUT_MS` to every request on
 * every instance — the cache would be a latency tax rather than a saving.
 */
const CIRCUIT_OPEN_MS = Number(process.env.CACHE_CIRCUIT_MS ?? 10_000);

declare global {
  var __ayyanRedis: RedisClientType | undefined;
}

let connecting: Promise<RedisClientType> | null = null;
let circuitOpenUntil = 0;
let lastReportedError = "";

function report(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  // One line per distinct fault, not one per request: a Redis outage would
  // otherwise bury everything else in the logs.
  if (message !== lastReportedError) {
    lastReportedError = message;
    console.warn(`[cache] Redis unavailable, serving from Postgres — ${message}`);
  }
  circuitOpenUntil = Date.now() + CIRCUIT_OPEN_MS;
}

function createRedisClient(): RedisClientType {
  const client: RedisClientType = createClient({
    url: REDIS_URL,
    socket: {
      connectTimeout: TIMEOUT_MS * 4,
      /*
       * Four attempts with a widening gap, then stop. node-redis retries
       * forever by default, which on a serverless instance means a background
       * loop that outlives the request that started it.
       */
      reconnectStrategy: (retries) => (retries > 3 ? false : Math.min(100 * 2 ** retries, 2_000)),
    },
  });

  // An 'error' listener is mandatory: without one node-redis emits on the
  // process, and an unhandled 'error' event terminates Node.
  client.on("error", report);
  return client;
}

/**
 * The connection, opened on first use and shared from then on.
 *
 * A serverless instance handles many requests over its lifetime, so the socket
 * is worth keeping; opening one per request would exhaust Redis' client limit
 * long before the traffic justified it. Cached on `globalThis` so `next dev`'s
 * module reloading reuses it across edits.
 */
async function connection(): Promise<RedisClientType | null> {
  if (!cacheEnabled || Date.now() < circuitOpenUntil) return null;

  const existing = globalThis.__ayyanRedis;
  if (existing?.isReady) return existing;

  if (!connecting) {
    const client = existing ?? createRedisClient();
    globalThis.__ayyanRedis = client;

    connecting = client
      .connect()
      .then(() => client)
      .finally(() => {
        connecting = null;
      });
  }

  try {
    return await connecting;
  } catch (error) {
    report(error);
    return null;
  }
}

/** Runs a Redis operation under the deadline, turning any failure into `null`. */
async function attempt<T>(operation: (client: RedisClientType) => Promise<T>): Promise<T | null> {
  const client = await connection();
  if (!client) return null;

  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation(client),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timed out after ${TIMEOUT_MS}ms`)), TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    report(error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* -------------------------------------------------------------------------- */
/* Operations                                                                  */
/* -------------------------------------------------------------------------- */

/** The stored value, or `null` for a miss, an expiry, or any kind of failure. */
export async function read<T>(key: string): Promise<T | null> {
  const raw = await attempt((client) => client.get(key));
  if (raw == null) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    // A value written by an older shape, or a truncated write. Treat it as a
    // miss and let the caller overwrite it.
    return null;
  }
}

/**
 * Stores a value under a TTL and files its key under each tag.
 *
 * The tag sets are what make targeted invalidation possible: Redis can match
 * keys by pattern, but `KEYS`/`SCAN` over a shared keyspace is the operation
 * that takes a production Redis down. A set per tag turns invalidation into two
 * O(n) commands over exactly the keys that are affected.
 */
export async function write(
  key: string,
  value: unknown,
  ttlSeconds: number,
  tags: readonly string[],
): Promise<void> {
  let payload: string;
  try {
    payload = JSON.stringify(value);
  } catch {
    return; // Not serializable — nothing to cache, and not worth an error.
  }

  await attempt(async (client) => {
    const multi = client.multi().set(key, payload, { EX: ttlSeconds });

    for (const tag of tags) {
      const set = tagKey(tag);
      multi.sAdd(set, key);
      // The set outlives its members so a stale tag set can't accumulate
      // forever; the extra headroom covers entries written late in the window.
      multi.expire(set, ttlSeconds * 2);
    }

    return multi.exec();
  });
}

/** Drops every entry filed under any of these tags. */
export async function dropTags(tags: readonly string[]): Promise<number> {
  if (!tags.length) return 0;

  const dropped = await attempt(async (client) => {
    const sets = tags.map(tagKey);
    const keys = await client.sUnion(sets);
    if (keys.length) await client.del(keys);
    await client.del(sets);
    return keys.length;
  });

  return dropped ?? 0;
}

export function tagKey(tag: string): string {
  return `${NAMESPACE}:tag:${tag}`;
}

/** Closes the connection. For CLI scripts, which otherwise never exit. */
export async function disconnect(): Promise<void> {
  const client = globalThis.__ayyanRedis;
  globalThis.__ayyanRedis = undefined;
  if (client?.isOpen) await client.quit().catch(() => {});
}
