"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/admin/auth";
import type { FormState } from "@/admin/schemas/vehicle";
import { storeImage } from "@/admin/storage";
import { TAGS, invalidate } from "@/server/cache";
import { type Db, db, vehicleMedia, vehicles } from "@/server/db";

/**
 * `db` is a union of the two driver clients, and TypeScript cannot resolve an
 * overloaded method like `.returning()` across a union. `Db` is the supertype
 * both satisfy.
 */
const database: Db = db;

/**
 * Photo management for a listing.
 *
 * The database owns the two invariants that matter — at most one cover per
 * vehicle (a partial unique index) and `spin_index` only on spin frames (a
 * CHECK) — so these actions are free to be simple. Where an operation could
 * transiently break one, it runs in a transaction and orders its statements so
 * the constraint is never violated even momentarily.
 */

async function republish(vehicleId: string): Promise<void> {
  const [row] = await database
    .select({ slug: vehicles.slug })
    .from(vehicles)
    .where(eq(vehicles.id, vehicleId))
    .limit(1);

  await invalidate(TAGS.vehicles);
  revalidatePath("/");
  revalidatePath("/vehicles");
  if (row) {
    revalidatePath(`/vehicles/${row.slug}`);
    revalidatePath(`/admin/vehicles/${row.slug}/edit`);
  }
}

/* -------------------------------------------------------------------------- */
/* Upload                                                                      */
/* -------------------------------------------------------------------------- */

export async function uploadPhotos(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const vehicleId = String(formData.get("vehicleId") ?? "");
  if (!vehicleId) return { ok: false, message: "That listing could not be identified." };

  const [vehicle] = await database
    .select({ id: vehicles.id, slug: vehicles.slug, title: vehicles.title, modelYear: vehicles.modelYear })
    .from(vehicles)
    .where(eq(vehicles.id, vehicleId))
    .limit(1);

  if (!vehicle) return { ok: false, message: "That listing no longer exists." };

  const files = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { ok: false, message: "Choose at least one image." };
  if (files.length > 20) {
    return { ok: false, message: "Upload at most 20 images at a time." };
  }

  const [{ nextPosition, hasCover }] = await database
    .select({
      nextPosition: sql<number>`coalesce(max(${vehicleMedia.position}), -1)::int + 1`,
      hasCover: sql<boolean>`bool_or(${vehicleMedia.isCover})`,
    })
    .from(vehicleMedia)
    .where(eq(vehicleMedia.vehicleId, vehicleId));

  const stored: { url: string; bytes: number }[] = [];
  const failures: string[] = [];

  // Sequential, not Promise.all: twenty concurrent multi-megabyte uploads from
  // one request is how a small instance runs out of memory, and the operator
  // would rather have nineteen photos and one clear error than a dead request.
  for (const file of files) {
    try {
      const result = await storeImage(file, vehicle.slug);
      stored.push({ url: result.url, bytes: result.bytes });
    } catch (error) {
      failures.push(`${file.name}: ${error instanceof Error ? error.message : "upload failed"}`);
    }
  }

  if (stored.length > 0) {
    await database.insert(vehicleMedia).values(
      stored.map((file, index) => ({
        vehicleId,
        kind: "photo" as const,
        url: file.url,
        alt: `${vehicle.title} — ${vehicle.modelYear}`,
        position: nextPosition + index,
        // The first photo on a listing with none becomes the cover, so a
        // listing is never left without one by an operator who didn't know to
        // set it. Later uploads never steal the cover.
        isCover: !hasCover && index === 0,
        bytes: file.bytes,
      })),
    );
    await republish(vehicleId);
  }

  if (failures.length > 0) {
    return {
      ok: stored.length > 0,
      message:
        stored.length > 0
          ? `Uploaded ${stored.length}. ${failures.length} failed — ${failures.join("; ")}`
          : failures.join("; "),
    };
  }

  return { ok: true, message: `Uploaded ${stored.length} photo${stored.length === 1 ? "" : "s"}.` };
}

/* -------------------------------------------------------------------------- */
/* Cover, order, deletion                                                      */
/* -------------------------------------------------------------------------- */

export async function setCoverPhoto(formData: FormData): Promise<void> {
  await requireAdmin();

  const mediaId = String(formData.get("mediaId") ?? "");
  const vehicleId = String(formData.get("vehicleId") ?? "");
  if (!mediaId || !vehicleId) return;

  await database.transaction(async (tx) => {
    // Clear first, then set. The unique index allows one true per vehicle and
    // is checked per statement, so setting the new cover before clearing the
    // old one would fail.
    await tx
      .update(vehicleMedia)
      .set({ isCover: false })
      .where(and(eq(vehicleMedia.vehicleId, vehicleId), ne(vehicleMedia.id, mediaId)));

    await tx
      .update(vehicleMedia)
      .set({ isCover: true })
      .where(and(eq(vehicleMedia.id, mediaId), eq(vehicleMedia.vehicleId, vehicleId)));
  });

  await republish(vehicleId);
}

/** Moves one photo up or down in the gallery by swapping positions. */
export async function movePhoto(formData: FormData): Promise<void> {
  await requireAdmin();

  const mediaId = String(formData.get("mediaId") ?? "");
  const vehicleId = String(formData.get("vehicleId") ?? "");
  const direction = String(formData.get("direction") ?? "");
  if (!mediaId || !vehicleId || (direction !== "up" && direction !== "down")) return;

  const rows = await database
    .select({ id: vehicleMedia.id, position: vehicleMedia.position })
    .from(vehicleMedia)
    .where(eq(vehicleMedia.vehicleId, vehicleId))
    .orderBy(vehicleMedia.position);

  const index = rows.findIndex((r) => r.id === mediaId);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || target < 0 || target >= rows.length) return;

  await database.transaction(async (tx) => {
    // Renumber the whole gallery from scratch rather than swapping two values.
    // Seeded rows can share a position, and a swap between two rows that are
    // both `3` silently does nothing.
    const reordered = [...rows];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];

    for (const [position, row] of reordered.entries()) {
      await tx
        .update(vehicleMedia)
        .set({ position })
        .where(eq(vehicleMedia.id, row.id));
    }
  });

  await republish(vehicleId);
}

/**
 * Removes a photo from the listing.
 *
 * The stored object is deliberately left in place. Deleting it would make this
 * irreversible for a misclick, and object storage is cheap next to a re-shoot —
 * orphans can be swept later against the `vehicle_media` URLs.
 */
export async function deletePhoto(formData: FormData): Promise<void> {
  await requireAdmin();

  const mediaId = String(formData.get("mediaId") ?? "");
  const vehicleId = String(formData.get("vehicleId") ?? "");
  if (!mediaId || !vehicleId) return;

  const [removed] = await database
    .delete(vehicleMedia)
    .where(and(eq(vehicleMedia.id, mediaId), eq(vehicleMedia.vehicleId, vehicleId)))
    .returning({ wasCover: vehicleMedia.isCover });

  // Promote the next photo so deleting the cover doesn't leave the listing
  // showing a placeholder on the public grid.
  if (removed?.wasCover) {
    const [next] = await database
      .select({ id: vehicleMedia.id })
      .from(vehicleMedia)
      .where(eq(vehicleMedia.vehicleId, vehicleId))
      .orderBy(vehicleMedia.position)
      .limit(1);

    if (next) {
      await database.update(vehicleMedia).set({ isCover: true }).where(eq(vehicleMedia.id, next.id));
    }
  }

  await republish(vehicleId);
}
