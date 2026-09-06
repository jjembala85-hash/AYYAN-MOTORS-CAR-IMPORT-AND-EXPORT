/**
 * Loads the catalogue into the database named by DATABASE_URL.
 *
 *   npm run db:seed
 *
 * Destructive: it truncates the catalog tables before loading. Run migrations
 * first (`npm run db:migrate`).
 *
 * Builds its own connection rather than importing `@/server/db`, which is
 * guarded with `server-only` and throws outside a React Server Component.
 */

import "./env";
import { createDbClient } from "../src/server/db/client";
import { seedCatalog } from "../src/server/db/seed";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set — copy .env.example to .env.local first.");
    process.exit(1);
  }

  // Say where this is going before deleting anything, without leaking the password.
  const host = (() => {
    try {
      return new URL(url).host;
    } catch {
      return "(unparseable URL)";
    }
  })();
  console.log(`Seeding catalogue into ${host} — existing catalog rows will be replaced.`);

  const result = await seedCatalog(createDbClient(url));
  console.log("Done:", result);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
