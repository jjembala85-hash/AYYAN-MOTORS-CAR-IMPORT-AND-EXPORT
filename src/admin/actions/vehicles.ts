"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/admin/auth";
import {
  type FormState,
  parseVehicleForm,
  slugify,
  type VehicleFormValues,
} from "@/admin/schemas/vehicle";
import { TAGS, invalidate } from "@/server/cache";
import {
  type Db,
  db,
  makes,
  models,
  vehicleEngines,
  vehicles,
} from "@/server/db";

/**
 * `db` is a union of the two driver clients, and TypeScript cannot resolve an
 * overloaded method across a union. `Db` is the supertype both satisfy — and
 * the one a transaction handle satisfies too, so helpers below take either.
 */
const database: Db = db;

/**
 * Vehicle mutations.
 *
 * Every export here starts with `requireAdmin()`. That is not belt-and-braces
 * over the route guard in `proxy.ts` — Next's docs are explicit that Server
 * Actions are reachable by direct POST to their action id, without ever loading
 * the page. The proxy protects the screen; this protects the database.
 */

/* -------------------------------------------------------------------------- */
/* Shared helpers                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Finds or creates the make and model rows for a listing.
 *
 * Classification is entered as free text in the form rather than picked from a
 * dropdown, because a dealer takes delivery of a model the catalogue has never
 * held and must not be blocked by a missing option. The cost is that "Toyota"
 * and "toyota " would become two makes, so both sides are matched on the slug.
 */
async function resolveClassification(
  tx: Db,
  makeName: string,
  modelName: string,
): Promise<{ makeId: string; modelId: string }> {
  const makeSlug = slugify(makeName);
  const modelSlug = slugify(modelName);

  const [existingMake] = await tx
    .select({ id: makes.id })
    .from(makes)
    .where(eq(makes.slug, makeSlug))
    .limit(1);

  const makeId =
    existingMake?.id ??
    (
      await tx
        .insert(makes)
        .values({ name: makeName.trim(), slug: makeSlug })
        .returning({ id: makes.id })
    )[0].id;

  const [existingModel] = await tx
    .select({ id: models.id })
    .from(models)
    .where(and(eq(models.makeId, makeId), eq(models.slug, modelSlug)))
    .limit(1);

  if (existingModel) return { makeId, modelId: existingModel.id };

  // `family` is what the public filters group by. Derived from the first word
  // of the model, which is right for "Hilux Revo" -> "Hilux" and for almost
  // every name in the current data; it is a plain column, so a wrong guess is
  // one UPDATE to fix rather than a re-import.
  const family = modelName.trim().split(/\s+/)[0];
  const [created] = await tx
    .insert(models)
    .values({ makeId, name: modelName.trim(), family, slug: modelSlug })
    .returning({ id: models.id });

  return { makeId, modelId: created.id };
}

/**
 * A slug that is unique across the catalogue.
 *
 * The database has a UNIQUE index on `vehicles.slug`, so a collision would
 * otherwise surface as a constraint violation on save — technically safe, but
 * it presents as "something went wrong" after the operator has filled in
 * twenty fields. Two 2021 Hiluxes is an ordinary situation, not an error.
 */
async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const root = base || "vehicle";

  for (let suffix = 0; suffix < 100; suffix++) {
    const candidate = suffix === 0 ? root : `${root}-${suffix + 1}`;
    const clash = await database
      .select({ id: vehicles.id })
      .from(vehicles)
      .where(
        excludeId
          ? and(eq(vehicles.slug, candidate), ne(vehicles.id, excludeId))
          : eq(vehicles.slug, candidate),
      )
      .limit(1);

    if (clash.length === 0) return candidate;
  }

  // 100 identical slugs means something is wrong upstream, not that we need a
  // 101st. Fall back to something guaranteed free rather than looping forever.
  return `${root}-${Date.now()}`;
}

/** Form values -> the `vehicles` column set. Money becomes integer minor units. */
function toVehicleValues(data: VehicleFormValues, slug: string, userId: string) {
  return {
    slug,
    title: data.title,
    modelYear: data.modelYear,
    chassisNumber: data.chassisNumber,
    vin: data.vin,
    engineNumber: data.engineNumber,
    registrationNumber: data.registrationNumber,
    bodyType: data.bodyType,
    condition: data.condition,
    steering: data.steering,
    transmission: data.transmission,
    driveType: data.driveType,
    fuelType: data.fuelType,
    mileageKm: data.mileageKm,
    mileageVerified: data.mileageVerified,
    exteriorColor: data.exteriorColor,
    interiorColor: data.interiorColor,
    doors: data.doors,
    seats: data.seats,
    // Math.round, not truncation: 25000.555 * 100 is 2500055.4999 in binary
    // floating point, and flooring it would quietly lose a cent per edit.
    priceMinor: data.price === null ? null : Math.round(data.price * 100),
    priceCurrency: data.price === null ? null : data.priceCurrency,
    pricingType: data.pricingType,
    status: data.status,
    isFeatured: data.isFeatured,
    isAuction: data.isAuction,
    description: data.description,
    updatedBy: userId,
  };
}

/** Engine detail is a separate 1:1 row and is only written when there is any. */
function toEngineValues(data: VehicleFormValues) {
  const hasAny =
    data.engineCode !== null ||
    data.displacementCc !== null ||
    data.cylinders !== null ||
    data.aspiration !== null ||
    data.powerHp !== null ||
    data.torqueNm !== null;

  if (!hasAny) return null;

  return {
    engineCode: data.engineCode,
    displacementCc: data.displacementCc,
    cylinders: data.cylinders,
    aspiration: data.aspiration,
    powerHp: data.powerHp,
    torqueNm: data.torqueNm,
  };
}

/**
 * Drops every cached read that could now be stale, then re-renders the public
 * pages. Both are needed: `invalidate` clears Redis, `revalidatePath` clears
 * Next's own full-route cache. Skipping either leaves an edit invisible on the
 * live site while looking saved in the panel — the single most confusing
 * failure a CMS can have.
 */
async function publishChanges(slug?: string): Promise<void> {
  await invalidate(TAGS.vehicles, TAGS.facets);
  revalidatePath("/");
  revalidatePath("/vehicles");
  if (slug) revalidatePath(`/vehicles/${slug}`);
  revalidatePath("/admin/vehicles");
}

/** Postgres error codes that mean "a human typed a duplicate", not "a bug". */
function friendlyDbError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (/vehicles_vin_key/.test(message)) {
    return "Another listing already has that VIN.";
  }
  if (/vehicles_chassis_key/.test(message)) {
    return "Another listing already has that chassis number.";
  }
  if (/vehicles_slug_key/.test(message)) {
    return "That web address is already taken by another listing.";
  }
  return message;
}

/* -------------------------------------------------------------------------- */
/* Create                                                                      */
/* -------------------------------------------------------------------------- */

export async function createVehicle(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireAdmin();

  const parsed = parseVehicleForm(formData);
  if (!parsed.ok) return parsed.state;
  const data = parsed.data;

  let slug: string;
  try {
    slug = await uniqueSlug(
      data.slug ?? slugify(`${data.title}-${data.modelYear}`),
    );

    await database.transaction(async (tx) => {
      const { makeId, modelId } = await resolveClassification(tx, data.make, data.model);

      const [created] = await tx
        .insert(vehicles)
        .values({
          ...toVehicleValues(data, slug, session.id),
          makeId,
          modelId,
          publishedAt: data.status === "active" ? new Date() : null,
          soldAt: data.status === "sold" ? new Date() : null,
        })
        .returning({ id: vehicles.id });

      const engine = toEngineValues(data);
      if (engine) {
        await tx.insert(vehicleEngines).values({ vehicleId: created.id, ...engine });
      }
    });
  } catch (error) {
    return {
      ok: false,
      message: friendlyDbError(error),
      values: Object.fromEntries(
        [...formData.entries()].filter(([, v]) => typeof v === "string"),
      ) as Record<string, string>,
    };
  }

  await publishChanges(slug);
  // Straight to the edit screen: a new listing has no photos yet, and the
  // uploader only exists once there is a row to attach them to.
  redirect(`/admin/vehicles/${slug}/edit?created=1`);
}

/* -------------------------------------------------------------------------- */
/* Update                                                                      */
/* -------------------------------------------------------------------------- */

export async function updateVehicle(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, message: "That listing could not be identified." };

  const parsed = parseVehicleForm(formData);
  if (!parsed.ok) return parsed.state;
  const data = parsed.data;

  const [existing] = await database
    .select({ slug: vehicles.slug, status: vehicles.status, publishedAt: vehicles.publishedAt })
    .from(vehicles)
    .where(eq(vehicles.id, id))
    .limit(1);

  if (!existing) return { ok: false, message: "That listing no longer exists." };

  let slug: string;
  try {
    slug = await uniqueSlug(data.slug ?? existing.slug, id);

    await database.transaction(async (tx) => {
      const { makeId, modelId } = await resolveClassification(tx, data.make, data.model);

      await tx
        .update(vehicles)
        .set({
          ...toVehicleValues(data, slug, session.id),
          makeId,
          modelId,
          // Stamp publishedAt the first time it goes live and never again, so
          // "listed on" keeps meaning the original date through later edits.
          publishedAt:
            data.status === "active"
              ? (existing.publishedAt ?? new Date())
              : existing.publishedAt,
          soldAt: data.status === "sold" ? new Date() : null,
        })
        .where(eq(vehicles.id, id));

      const engine = toEngineValues(data);
      if (engine) {
        await tx
          .insert(vehicleEngines)
          .values({ vehicleId: id, ...engine })
          .onConflictDoUpdate({ target: vehicleEngines.vehicleId, set: engine });
      } else {
        // Every engine field was cleared — remove the row rather than leaving
        // one holding nothing but a foreign key.
        await tx.delete(vehicleEngines).where(eq(vehicleEngines.vehicleId, id));
      }
    });
  } catch (error) {
    return {
      ok: false,
      message: friendlyDbError(error),
      values: Object.fromEntries(
        [...formData.entries()].filter(([, v]) => typeof v === "string"),
      ) as Record<string, string>,
    };
  }

  // The old detail page must be re-rendered too when the slug changed, or the
  // previous URL keeps serving a stale copy until its cache expires.
  await publishChanges(slug);
  if (existing.slug !== slug) revalidatePath(`/vehicles/${existing.slug}`);

  return { ok: true, message: "Saved." };
}

/* -------------------------------------------------------------------------- */
/* Status changes and deletion                                                 */
/* -------------------------------------------------------------------------- */

/** Quick status toggle from the list, without opening the full form. */
export async function setVehicleStatus(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const allowed = ["draft", "active", "reserved", "sold", "archived"] as const;

  if (!id || !allowed.includes(status as (typeof allowed)[number])) return;
  const next = status as (typeof allowed)[number];

  const [row] = await database
    .select({ slug: vehicles.slug, publishedAt: vehicles.publishedAt })
    .from(vehicles)
    .where(eq(vehicles.id, id))
    .limit(1);
  if (!row) return;

  await database
    .update(vehicles)
    .set({
      status: next,
      publishedAt: next === "active" ? (row.publishedAt ?? new Date()) : row.publishedAt,
      soldAt: next === "sold" ? new Date() : null,
    })
    .where(eq(vehicles.id, id));

  await publishChanges(row.slug);
}

/**
 * Permanently deletes a listing and everything hanging off it.
 *
 * Offered because a mistyped duplicate should not be un-removable, but the
 * panel steers hard towards Archive: the FKs cascade, so this also destroys the
 * media rows, the auction sheet and any inspection report — evidence that
 * cannot be re-entered from memory. Archiving hides a listing just as well.
 */
export async function deleteVehicle(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const [row] = await database
    .select({ slug: vehicles.slug })
    .from(vehicles)
    .where(eq(vehicles.id, id))
    .limit(1);
  if (!row) return;

  await database.delete(vehicles).where(eq(vehicles.id, id));
  await publishChanges(row.slug);

  redirect("/admin/vehicles?deleted=1");
}
