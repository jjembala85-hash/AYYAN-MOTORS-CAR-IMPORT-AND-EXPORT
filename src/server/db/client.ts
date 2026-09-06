import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Builds a Drizzle client for a connection string.
 *
 * Deliberately free of `server-only`: this module is imported by CLI scripts
 * (seeding, verification) that run in plain Node, where `server-only` throws.
 * The guard lives in `./index.ts`, which is what application code imports.
 *
 * Neon's HTTP driver is a good fit for serverless — no pool to exhaust between
 * invocations — but it only speaks to Neon. Supabase, Docker and any other
 * Postgres get postgres.js over TCP, so the same code deploys to either without
 * a rewrite. The choice is made from the URL rather than a second env var,
 * because a mismatch between the two would only surface at runtime.
 */
export function createDbClient(url: string) {
  if (/\.neon\.tech|neon\.database|\bneondb\b/.test(url)) {
    return drizzleNeon(neon(url), { schema });
  }

  // `prepare: false` is required behind Supabase's transaction pooler, which
  // does not support prepared statements. The pool size is tunable because the
  // right value differs sharply by environment — a serverless function wants 1,
  // a long-lived container more.
  const client = postgres(url, {
    prepare: false,
    max: Number(process.env.PG_POOL_MAX ?? 5),
    // postgres.js dumps NOTICEs to stderr with a stack-trace-like shape, so a
    // routine "truncate cascades to ..." reads as a failure. Set PG_NOTICES=1
    // when you actually want them.
    onnotice: process.env.PG_NOTICES === "1" ? undefined : () => {},
  });
  return drizzlePostgres(client, { schema });
}

export type Database = ReturnType<typeof createDbClient>;
