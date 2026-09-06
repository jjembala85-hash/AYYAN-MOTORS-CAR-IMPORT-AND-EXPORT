/**
 * End-to-end check of the data layer with no database to connect to: applies
 * every migration to an in-process Postgres, seeds it from the legacy export,
 * then asserts the catalog queries return what the site expects.
 *
 *   npm run db:verify
 */

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as catalog from "../src/server/catalog/queries";
import { seedCatalog } from "../src/server/db/seed";
import * as schema from "../src/server/db/schema";

let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `${ok ? "ok    " : "FAIL  "} ${label}` +
      (ok ? ` = ${JSON.stringify(actual)}` : ` got ${JSON.stringify(actual)} want ${JSON.stringify(expected)}`),
  );
}

function checkThat(label: string, condition: boolean, detail = "") {
  if (!condition) failures++;
  console.log(`${condition ? "ok    " : "FAIL  "} ${label}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  const client = new PGlite();
  const db = drizzle(client, { schema });

  /* --- migrate ---------------------------------------------------------- */
  const dir = path.join(process.cwd(), "drizzle");
  for (const file of (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort()) {
    const sql = await readFile(path.join(dir, file), "utf8");
    for (const statement of sql.split("--> statement-breakpoint").map((s) => s.trim())) {
      if (statement) await client.exec(statement);
    }
    console.log(`migrated ${file}`);
  }

  /* --- seed ------------------------------------------------------------- */
  const result = await seedCatalog(db);
  console.log("\nseeded", JSON.stringify(result), "\n");
  check("seed: vehicles", result.vehicles, 17);
  check("seed: makes", result.makes, 6);
  check("seed: media rows", result.media, 64);

  /* --- listing ---------------------------------------------------------- */
  console.log("\n== listing ==");
  check("all published", await catalog.countVehicles(db), 17);
  check("model=Hilux", await catalog.countVehicles(db, { model: "Hilux" }), 5);
  check("model=Fortuner", await catalog.countVehicles(db, { model: "Fortuner" }), 2);
  check("model=Ranger", await catalog.countVehicles(db, { model: "Ranger" }), 2);
  check("make=Toyota", await catalog.countVehicles(db, { make: "Toyota" }), 10);
  check("type=Pickup", await catalog.countVehicles(db, { type: "Pickup" }), 8);
  check("type=SUV", await catalog.countVehicles(db, { type: "SUV" }), 7);
  check("type=Van", await catalog.countVehicles(db, { type: "Van" }), 1);
  check("type=Sedan (none after fix)", await catalog.countVehicles(db, { type: "Sedan" }), 0);
  check("condition=New", await catalog.countVehicles(db, { condition: "New" }), 7);
  check("from=2025", await catalog.countVehicles(db, { from: 2025 }), 6);
  check("to=2018", await catalog.countVehicles(db, { to: 2018 }), 5);
  check("from=2020&to=2023", await catalog.countVehicles(db, { from: 2020, to: 2023 }), 4);
  check("model=Hilux&type=Pickup", await catalog.countVehicles(db, { model: "Hilux", type: "Pickup" }), 5);

  /* --- search ----------------------------------------------------------- */
  console.log("\n== full-text search ==");
  check("q=hilux", await catalog.countVehicles(db, { q: "hilux" }), 5);
  check("q=hilu (prefix)", await catalog.countVehicles(db, { q: "hilu" }), 5);
  check("q=toyota hilux", await catalog.countVehicles(db, { q: "toyota hilux" }), 5);
  check("q=2021", await catalog.countVehicles(db, { q: "2021" }), 1);
  check("q=nonsense", await catalog.countVehicles(db, { q: "zzzznope" }), 0);
  check("q with punctuation is safe", await catalog.countVehicles(db, { q: "!!! & |(" }), 17);
  check("q=<script>", await catalog.countVehicles(db, { q: "<script>alert(1)</script>" }), 0);

  /* --- sorting ---------------------------------------------------------- */
  console.log("\n== sorting ==");
  const newest = await catalog.listVehicles(db, { sort: "newest" });
  const oldest = await catalog.listVehicles(db, { sort: "oldest" });
  const az = await catalog.listVehicles(db, { sort: "az" });
  check("newest first year", newest[0].year, 2026);
  check("oldest first year", oldest[0].year, 2017);
  checkThat("az is alphabetical", az[0].title <= az[az.length - 1].title, `${az[0].title} … ${az[az.length - 1].title}`);

  /* --- detail ----------------------------------------------------------- */
  console.log("\n== detail ==");
  const raptor = await catalog.getVehicleBySlug(db, "ford-raptor-2025");
  checkThat("ford-raptor-2025 found", raptor !== null);
  check("  title", raptor?.title, "Ford RAPTOR");
  check("  body type label", raptor?.bodyType, "Pickup");
  check("  drive label", raptor?.driveType, "4WD");
  check("  gallery length", raptor?.gallery.length, 5);
  checkThat("  cover is set", Boolean(raptor?.cover?.url), raptor?.cover?.url ?? "");
  checkThat("  cover has dimensions from the audit", raptor?.cover?.width != null, `${raptor?.cover?.width}x${raptor?.cover?.height}`);
  check("  media rows with dimensions", (await catalog.listVehicles(db)).filter((v) => v.cover?.width != null).length, 17);
  check("  price is null (none in source)", raptor?.price, null);
  check("  exterior colour preserved verbatim", raptor?.exteriorColor, "BLUE");

  const hiace = await catalog.getVehicleBySlug(db, "toyota-hiace-commuter-2026");
  check("hiace body type corrected to Van", hiace?.bodyType, "Van");

  const brabus = await catalog.getVehicleBySlug(db, "brabus-g-wagon-2025");
  check("brabus engine cc parsed from '4.0 LTR TWIN TURBO V8'", brabus?.engine?.displacementCc, 4000);
  check("  aspiration", brabus?.engine?.aspiration, "twin_turbo");
  check("  cylinders", brabus?.engine?.cylinders, 8);
  check("  power", brabus?.engine?.powerHp, 800);

  const fortuner = await catalog.getVehicleBySlug(db, "toyota-fortuner-gr-sport-2026");
  check("fortuner body type corrected to SUV", fortuner?.bodyType, "SUV");
  check("fortuner engine cc from '2800 CC'", fortuner?.engine?.displacementCc, 2800);

  check("missing slug returns null", await catalog.getVehicleBySlug(db, "nope"), null);

  /* --- related & hero --------------------------------------------------- */
  console.log("\n== related / hero ==");
  const related = raptor ? await catalog.relatedVehicles(db, raptor) : [];
  check("related count", related.length, 3);
  checkThat("related excludes itself", related.every((r) => r.slug !== "ford-raptor-2025"));
  const hero = await catalog.heroGradeVehicles(db, 3);
  check("hero-grade count", hero.length, 3);
  checkThat("hero are all tier A", hero.every((h) => h.imageTier === "a"));

  /* --- facets ----------------------------------------------------------- */
  console.log("\n== facets ==");
  const f = await catalog.facets(db);
  check("make facets", f.makes.length, 6);
  check("top make", f.makes[0], { value: "Toyota", count: 10 });
  check("model facets include Hilux", f.models.find((m) => m.value === "Hilux"), { value: "Hilux", make: "Toyota", count: 5 });
  check("year range", f.years, { min: 2017, max: 2026 });
  checkThat("no Sedan facet remains", !f.types.some((t) => t.value === "Sedan"), f.types.map((t) => `${t.value}:${t.count}`).join(" "));

  /* --- constraints actually bite ---------------------------------------- */
  console.log("\n== constraints ==");
  const [{ id: anyVehicle }] = await db.select({ id: schema.vehicles.id }).from(schema.vehicles).limit(1);

  await expectReject("rejects a malformed VIN", () =>
    db.update(schema.vehicles).set({ vin: "IOQ0000000000000X" }).where(eq(schema.vehicles.id, anyVehicle)),
  );
  await expectReject("rejects price without currency", () =>
    db.update(schema.vehicles).set({ priceMinor: 1000, priceCurrency: null }).where(eq(schema.vehicles.id, anyVehicle)),
  );
  await expectReject("rejects a second cover photo", () =>
    db.insert(schema.vehicleMedia).values({ vehicleId: anyVehicle, url: "/x.jpg", isCover: true }),
  );
  await expectReject("rejects a spin_frame without spin_index", () =>
    db.insert(schema.vehicleMedia).values({ vehicleId: anyVehicle, url: "/y.jpg", kind: "spin_frame" }),
  );
  await expectReject("rejects negative mileage", () =>
    db.update(schema.vehicles).set({ mileageKm: -5 }).where(eq(schema.vehicles.id, anyVehicle)),
  );

  await client.close();

  console.log(failures === 0 ? "\nAll catalog checks passed." : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

async function expectReject(label: string, fn: () => Promise<unknown> | { execute(): Promise<unknown> }) {
  try {
    await (fn() as Promise<unknown>);
    failures++;
    console.log(`FAIL   ${label} — it was accepted`);
  } catch {
    console.log(`ok     ${label}`);
  }
}


main().catch((error) => {
  console.error(error);
  process.exit(1);
});
