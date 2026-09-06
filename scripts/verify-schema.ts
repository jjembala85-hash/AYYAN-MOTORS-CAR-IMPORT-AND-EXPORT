/**
 * Runs every generated migration against an in-process Postgres (PGlite/WASM)
 * so the DDL is proven valid without needing a database to connect to. Cheap
 * enough for CI, and it catches the things that only fail at execution time —
 * non-immutable functions in CHECK constraints, bad index predicates, enum
 * values referenced before they exist.
 *
 *   npm run db:verify
 */

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

const MIGRATIONS_DIR = path.join(process.cwd(), "drizzle");

async function main() {
  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.error("No migrations found in ./drizzle — run `npm run db:generate` first.");
    process.exit(1);
  }

  const db = new PGlite();
  let statements = 0;

  for (const file of files) {
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    // Drizzle separates statements with this marker rather than a bare
    // semicolon, which would split function bodies and dollar-quoted strings.
    const chunks = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    for (const [i, statement] of chunks.entries()) {
      try {
        await db.exec(statement);
        statements++;
      } catch (error) {
        console.error(`\n✗ ${file} — statement ${i + 1} failed:\n`);
        console.error(statement.slice(0, 600));
        console.error(`\n${(error as Error).message}\n`);
        process.exit(1);
      }
    }
    console.log(`✓ ${file} (${chunks.length} statements)`);
  }

  // Prove the objects actually landed, not just that the DDL parsed.
  const tables = await db.query<{ table_name: string }>(
    `select table_name from information_schema.tables
      where table_schema = 'public' order by table_name`,
  );
  const indexes = await db.query<{ count: number }>(
    `select count(*)::int as count from pg_indexes where schemaname = 'public'`,
  );
  const checks = await db.query<{ count: number }>(
    `select count(*)::int as count from pg_constraint where contype = 'c'
       and connamespace = 'public'::regnamespace`,
  );

  console.log(
    `\n${statements} statements · ${tables.rows.length} tables · ` +
      `${indexes.rows[0].count} indexes · ${checks.rows[0].count} check constraints`,
  );
  console.log(tables.rows.map((r) => `  ${r.table_name}`).join("\n"));

  await db.close();
  console.log("\nSchema is valid.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
