import "server-only";

import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { createDbClient } from "./client";
import type * as schema from "./schema";

export * from "./schema";
export type { Database } from "./client";

/**
 * The driver-agnostic view of a connection.
 *
 * `Database` is a union — Neon's HTTP client or postgres.js — and TypeScript
 * cannot resolve an overloaded method like `.returning()` across a union, so
 * calling one on `db` directly fails to typecheck. Every query works on either
 * driver, so callers should take this supertype instead. It is also what a
 * transaction handle satisfies, which is what lets a helper accept both `db`
 * and a `tx` without a cast.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and point it at your Neon, Supabase or local Postgres.",
    );
  }
  return url;
}

declare global {
  var __ayyanDb: ReturnType<typeof createDbClient> | undefined;
}

/*
 * Cached on globalThis so `next dev`'s module reloading doesn't open a new pool
 * on every edit. In production the module is evaluated once anyway.
 */
export const db = globalThis.__ayyanDb ?? createDbClient(connectionString());

if (process.env.NODE_ENV !== "production") globalThis.__ayyanDb = db;
