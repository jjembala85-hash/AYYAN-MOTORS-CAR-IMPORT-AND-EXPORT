/**
 * A throwaway Postgres for local work, with nothing to install.
 *
 *   npm run db:local
 *
 * Boots PGlite (Postgres compiled to WASM) behind a real wire-protocol socket,
 * applies the migrations and seeds the catalogue, then stays up. Point the app
 * at it with:
 *
 *   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/postgres
 *
 * Data lives in ./.pglite so it survives a restart; delete that directory for a
 * clean slate. This is a development convenience — production is Neon/Supabase.
 */

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../src/server/db/schema";
import { seedCatalog } from "../src/server/db/seed";

const PORT = Number(process.env.LOCAL_DB_PORT ?? 5433);
const DATA_DIR = path.join(process.cwd(), ".pglite");

async function main() {
  const client = await PGlite.create({ dataDir: DATA_DIR });

  // `applied` is this script's own bookkeeping — drizzle-kit's migrate command
  // talks to a real server, and this file is the thing that starts one.
  await client.exec(
    `create table if not exists _local_migrations (name text primary key, applied_at timestamptz not null default now())`,
  );
  const { rows: done } = await client.query<{ name: string }>(
    "select name from _local_migrations",
  );
  const already = new Set(done.map((r) => r.name));

  const dir = path.join(process.cwd(), "drizzle");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

  let applied = 0;
  for (const file of files) {
    if (already.has(file)) continue;
    const sql = await readFile(path.join(dir, file), "utf8");
    for (const statement of sql.split("--> statement-breakpoint").map((s) => s.trim())) {
      if (statement) await client.exec(statement);
    }
    await client.query("insert into _local_migrations (name) values ($1)", [file]);
    console.log(`applied ${file}`);
    applied++;
  }
  if (!applied) console.log(`migrations already applied (${files.length})`);

  const result = await seedCatalog(drizzle(client, { schema }));
  console.log("seeded", result);

  const server = new PGLiteSocketServer({
    db: client,
    port: PORT,
    host: "127.0.0.1",
    // Defaults to 1, which is not enough: `next build` prerenders with a pool of
    // workers and each one opens its own connection, so the extras are reset
    // mid-query. PGlite still executes serially behind this — it just queues.
    maxConnections: 24,
  });
  await server.start();

  console.log(`\nPostgres listening on 127.0.0.1:${PORT}`);
  console.log(`DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres\n`);

  const shutdown = async () => {
    await server.stop();
    await client.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
