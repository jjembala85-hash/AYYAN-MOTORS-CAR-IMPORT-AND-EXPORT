/**
 * Drops cached catalogue entries from Redis.
 *
 *   npm run cache:clear            # everything
 *   npm run cache:clear -- facets  # one tag
 *
 * Run it after anything that writes to the catalogue — `npm run db:seed` is the
 * only such path today — so the site reflects the change immediately instead of
 * at the end of a TTL. A no-op when REDIS_URL is unset.
 *
 * Talks to `cache/client` rather than `@/server/cache`, which is guarded with
 * `server-only` and throws outside a React Server Component.
 */

import "./env";
import { REDIS_URL, disconnect, dropTags } from "../src/server/cache/client";

const ALL = ["vehicles", "facets"] as const;

async function main() {
  if (!REDIS_URL) {
    console.log("REDIS_URL is not set — no cache to clear.");
    return;
  }

  const requested = process.argv.slice(2);
  const unknown = requested.filter((tag) => !ALL.includes(tag as (typeof ALL)[number]));
  if (unknown.length) {
    console.error(`Unknown tag(s): ${unknown.join(", ")}. Known tags: ${ALL.join(", ")}.`);
    process.exit(1);
  }

  const tags = requested.length ? requested : [...ALL];
  const dropped = await dropTags(tags);
  console.log(`Cleared ${dropped} entr${dropped === 1 ? "y" : "ies"} under: ${tags.join(", ")}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  // The open socket would otherwise hold the process open after the work is done.
  .finally(disconnect);
