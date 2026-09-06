import "server-only";

import { eq, sql } from "drizzle-orm";
import { requireAdminPage } from "@/admin/auth";
import {
  type Db,
  db,
  makes,
  models,
  vehicleEngines,
  vehicleMedia,
  vehicles,
} from "@/server/db";

/**
 * Reads for the admin screens.
 *
 * Deliberately NOT in `actions/vehicles.ts`. Every export of a `"use server"`
 * module becomes a callable endpoint with its own action id, reachable by POST
 * from anywhere — so putting a read there publishes it as a mutation endpoint
 * for no reason. These are plain server functions, only reachable by rendering
 * a page that imports them.
 *
 * They also bypass `server/catalog/cached`: the panel must show what is in
 * Postgres this instant, including drafts, which the public read model
 * deliberately hides.
 */

const database: Db = db;

/** Every listing, newest edits first. */
export async function listAllVehicles() {
  await requireAdminPage();

  return database
    .select({
      id: vehicles.id,
      slug: vehicles.slug,
      title: vehicles.title,
      modelYear: vehicles.modelYear,
      status: vehicles.status,
      isFeatured: vehicles.isFeatured,
      priceMinor: vehicles.priceMinor,
      priceCurrency: vehicles.priceCurrency,
      updatedAt: vehicles.updatedAt,
      makeName: makes.name,
      // Qualified explicitly — Drizzle only auto-qualifies a column inside a raw
      // `sql` fragment in some positions. See the note in `(panel)/page.tsx`.
      photoCount: sql<number>`(
        select count(*)::int from "vehicle_media"
        where "vehicle_media"."vehicle_id" = "vehicles"."id"
      )`,
    })
    .from(vehicles)
    .innerJoin(makes, eq(vehicles.makeId, makes.id))
    .orderBy(sql`${vehicles.updatedAt} desc`);
}

/** One listing, with the joins and media the edit form needs. */
export async function getVehicleForEdit(slug: string) {
  await requireAdminPage();

  const [row] = await database
    .select({
      vehicle: vehicles,
      engine: vehicleEngines,
      makeName: makes.name,
      modelName: models.name,
    })
    .from(vehicles)
    .innerJoin(makes, eq(vehicles.makeId, makes.id))
    .innerJoin(models, eq(vehicles.modelId, models.id))
    .leftJoin(vehicleEngines, eq(vehicleEngines.vehicleId, vehicles.id))
    .where(eq(vehicles.slug, slug))
    .limit(1);

  if (!row) return null;

  const media = await database
    .select()
    .from(vehicleMedia)
    .where(eq(vehicleMedia.vehicleId, row.vehicle.id))
    .orderBy(vehicleMedia.position);

  return { ...row, media };
}
