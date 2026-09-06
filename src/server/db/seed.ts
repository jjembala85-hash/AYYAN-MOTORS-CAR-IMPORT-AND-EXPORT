/**
 * Loads the legacy `src/data/vehicles.json` export into the catalog schema.
 *
 * Exported as a function taking a Drizzle instance so it can run against a real
 * database (scripts/seed.ts) or an in-process one (scripts/verify-seed.ts)
 * without two copies of the mapping.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import legacy from "@/data/vehicles.json";
import * as schema from "./schema";

type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

/* -------------------------------------------------------------------------- */
/* Value mapping                                                               */
/* -------------------------------------------------------------------------- */

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * The legacy CMS defaulted `bodyType` to "Sedan" whenever the field was blank,
 * mislabelling seven listings. `specs.body_type` wins where the seller filled it
 * in; these two are corrected by hand.
 */
const BODY_TYPE_OVERRIDES: Record<string, string> = {
  "toyota-fortuner-gr-sport-2026": "SUV",
  "toyota-fortuner-legender-2026": "SUV",
};

const MODEL_FAMILIES = [
  "Land Cruiser Prado",
  "Land Cruiser",
  "Hilux",
  "Fortuner",
  "Ranger",
  "Hiace",
  "RAV4",
  "G-Wagon",
  "Gladiator",
  "Raptor",
  "CX-5",
  "C180",
].sort((a, b) => b.length - a.length);

export function deriveFamily(model: string): string {
  const lower = model.toLowerCase();
  return (
    MODEL_FAMILIES.find((f) => lower.startsWith(f.toLowerCase())) ??
    model.split(/\s+/)[0]
  );
}

const BODY_TYPES: Record<string, (typeof schema.bodyTypeEnum.enumValues)[number]> = {
  suv: "suv",
  pickup: "pickup",
  van: "van",
  bus: "bus",
  truck: "truck",
  sedan: "sedan",
  hatchback: "hatchback",
  wagon: "wagon",
  coupe: "coupe",
  convertible: "convertible",
};

const TRANSMISSIONS: Record<string, (typeof schema.transmissionEnum.enumValues)[number]> =
  { manual: "manual", automatic: "automatic", cvt: "cvt", amt: "amt", dct: "dct" };

const FUEL_TYPES: Record<string, (typeof schema.fuelTypeEnum.enumValues)[number]> = {
  petrol: "petrol",
  diesel: "diesel",
  hybrid: "hybrid",
  electric: "electric",
  lpg: "lpg",
};

const DRIVE_TYPES: Record<string, (typeof schema.driveTypeEnum.enumValues)[number]> = {
  fwd: "fwd",
  rwd: "rwd",
  awd: "awd",
  "4wd": "4wd",
  "2wd": "2wd",
};

/**
 * Displacement arrives as free text in at least six shapes: "2800 CC", "1600cc",
 * "2.8 L", "4.0 LTR TWIN TURBO V8", "3.6". Read the first number and treat
 * anything fractional or under 100 as litres.
 */
export function parseEngine(raw: string | undefined): {
  displacementCc: number | null;
  aspiration: (typeof schema.aspirationEnum.enumValues)[number] | null;
  cylinders: number | null;
} {
  if (!raw) return { displacementCc: null, aspiration: null, cylinders: null };

  const number = raw.match(/(\d+(?:\.\d+)?)/);
  let displacementCc: number | null = null;
  if (number) {
    const value = Number(number[1]);
    displacementCc = value < 100 ? Math.round(value * 1000) : Math.round(value);
  }

  const aspiration = /twin[\s-]*turbo/i.test(raw)
    ? "twin_turbo"
    : /super[\s-]*charg/i.test(raw)
      ? "supercharged"
      : /turbo/i.test(raw)
        ? "turbo"
        : null;

  const vee = raw.match(/\bV(\d{1,2})\b/i);
  return { displacementCc, aspiration, cylinders: vee ? Number(vee[1]) : null };
}

interface CuratedManifest {
  curated: {
    vehicle: string;
    tier: string;
    images: { file: string; from: string }[];
  }[];
}

/**
 * Photo dimensions and weights from the asset audit, keyed by the *shipped*
 * filename ("ford-raptor-2025/ford-raptor-2025-cover.jpeg").
 *
 * Two hops are needed: `image-grades.csv` was measured against the original
 * library and is keyed by the original names ("...-01.jpeg"), while curation
 * renamed the survivors ("...-cover.jpeg"). `curated.json` records that rename
 * as `{ file, from }`, so it is the bridge between the two.
 */
function loadImageGrades(): Map<string, { w: number; h: number; bytes: number }> {
  const shipped = new Map<string, { w: number; h: number; bytes: number }>();

  let csv: string;
  let manifest: CuratedManifest;
  try {
    csv = readFileSync(path.join(process.cwd(), "assets/data/image-grades.csv"), "utf8");
    manifest = JSON.parse(
      readFileSync(path.join(process.cwd(), "assets/images/curated/curated.json"), "utf8"),
    ) as CuratedManifest;
  } catch {
    // Neither file is required to seed — media just lands without dimensions.
    return shipped;
  }

  const byOriginal = new Map<string, { w: number; h: number; bytes: number }>();
  for (const line of csv.trim().split(/\r?\n/).slice(1)) {
    const [folder, file, w, h, , kb] = line.split(",");
    if (!folder || !file) continue;
    byOriginal.set(`${folder}/${file}`, {
      w: Number(w),
      h: Number(h),
      bytes: Math.round(Number(kb) * 1024),
    });
  }

  for (const entry of manifest.curated ?? []) {
    for (const image of entry.images) {
      const grade = byOriginal.get(`${entry.vehicle}/${image.from}`);
      if (grade) shipped.set(`${entry.vehicle}/${image.file}`, grade);
    }
  }

  return shipped;
}

/* -------------------------------------------------------------------------- */
/* Seed                                                                        */
/* -------------------------------------------------------------------------- */

interface LegacyVehicle {
  id: string;
  slug: string;
  make: string;
  model: string;
  title: string;
  year: number;
  price: number | null;
  pricingType: string;
  mileage: number | null;
  transmission: string | null;
  fuelType: string | null;
  driveType: string | null;
  bodyType: string | null;
  condition: string | null;
  featured: boolean;
  isAuction: boolean;
  isSold: boolean;
  status: string;
  description: string | null;
  specs: Record<string, unknown> | null;
  imageTier: string;
  cover: string;
  gallery: string[];
}

export interface SeedResult {
  makes: number;
  models: number;
  vehicles: number;
  media: number;
  engines: number;
  features: number;
}

export async function seedCatalog(db: Db): Promise<SeedResult> {
  const rows = legacy as LegacyVehicle[];
  const grades = loadImageGrades();

  return db.transaction(async (tx) => {
    // Truncate rather than upsert: this is a load from a fixed export, and a
    // partial re-run should not leave orphaned media from a previous shape.
    // CASCADE follows the FKs down to media/engines/features.
    await tx.execute(
      sql`truncate table ${schema.vehicles}, ${schema.models}, ${schema.makes}, ${schema.features} restart identity cascade`,
    );

    /* --- makes ------------------------------------------------------------ */
    const makeNames = [...new Set(rows.map((r) => r.make))];
    const insertedMakes = await tx
      .insert(schema.makes)
      .values(makeNames.map((name) => ({ name, slug: slugify(name) })))
      .returning({ id: schema.makes.id, slug: schema.makes.slug });
    const makeId = new Map(insertedMakes.map((m) => [m.slug, m.id]));

    /* --- models ----------------------------------------------------------- */
    const modelKeys = new Map<string, { make: string; name: string; family: string }>();
    for (const r of rows) {
      const key = `${slugify(r.make)}/${slugify(r.model)}`;
      if (!modelKeys.has(key)) {
        modelKeys.set(key, {
          make: slugify(r.make),
          name: r.model,
          family: deriveFamily(r.model),
        });
      }
    }
    const insertedModels = await tx
      .insert(schema.models)
      .values(
        [...modelKeys.values()].map((m) => ({
          makeId: makeId.get(m.make)!,
          name: m.name,
          family: m.family,
          slug: slugify(m.name),
        })),
      )
      .returning({
        id: schema.models.id,
        slug: schema.models.slug,
        makeId: schema.models.makeId,
      });
    const modelId = new Map(insertedModels.map((m) => [`${m.makeId}/${m.slug}`, m.id]));

    /* --- features --------------------------------------------------------- */
    // Stored as one comma-separated string per listing, with inconsistent casing
    // ("Leather Seats" / "Leather seats"), so dedupe on the slug.
    const featureNames = new Map<string, string>();
    for (const r of rows) {
      const raw = r.specs?.features;
      if (typeof raw !== "string") continue;
      for (const name of raw.split(",").map((f) => f.trim()).filter(Boolean)) {
        const slug = slugify(name);
        if (!featureNames.has(slug)) featureNames.set(slug, name);
      }
    }
    const insertedFeatures = featureNames.size
      ? await tx
          .insert(schema.features)
          .values(
            [...featureNames.entries()].map(([slug, name]) => ({ name, slug })),
          )
          .returning({ id: schema.features.id, slug: schema.features.slug })
      : [];
    const featureId = new Map(insertedFeatures.map((f) => [f.slug, f.id]));

    /* --- vehicles --------------------------------------------------------- */
    let mediaCount = 0;
    let engineCount = 0;
    let featureLinks = 0;

    for (const r of rows) {
      const mk = makeId.get(slugify(r.make))!;
      const md = modelId.get(`${mk}/${slugify(r.model)}`)!;

      const specBody =
        typeof r.specs?.body_type === "string" ? r.specs.body_type : undefined;
      const bodyRaw = BODY_TYPE_OVERRIDES[r.slug] ?? specBody ?? r.bodyType ?? "";

      const engineRaw =
        typeof r.specs?.engine === "string" ? r.specs.engine : undefined;
      const engine = parseEngine(engineRaw);

      const [vehicle] = await tx
        .insert(schema.vehicles)
        .values({
          slug: r.slug,
          makeId: mk,
          modelId: md,
          title: r.title,
          modelYear: r.year,
          bodyType: BODY_TYPES[bodyRaw.toLowerCase()] ?? null,
          condition: r.condition?.toLowerCase() === "new" ? "new" : "used",
          // Uganda is right-hand drive and every unit here is an RHD import.
          steering: "right",
          transmission: TRANSMISSIONS[r.transmission?.toLowerCase() ?? ""] ?? null,
          driveType: DRIVE_TYPES[r.driveType?.toLowerCase() ?? ""] ?? null,
          fuelType: FUEL_TYPES[r.fuelType?.toLowerCase() ?? ""] ?? null,
          mileageKm: r.mileage ?? null,
          mileageVerified: false,
          exteriorColor:
            typeof r.specs?.exterior_color === "string" ? r.specs.exterior_color : null,
          interiorColor:
            typeof r.specs?.interior_color === "string" ? r.specs.interior_color : null,
          doors: r.specs?.doors ? Number(r.specs.doors) : null,
          seats: r.specs?.seats ? Number(r.specs.seats) : null,
          // Every legacy listing has a null price, so nothing to convert yet.
          priceMinor: r.price != null ? Math.round(r.price * 100) : null,
          priceCurrency: r.price != null ? "USD" : null,
          pricingType:
            r.price == null
              ? "on_request"
              : r.pricingType === "fixed"
                ? "fixed"
                : "negotiable",
          status: r.isSold ? "sold" : r.status === "active" ? "active" : "draft",
          isFeatured: r.featured,
          isAuction: r.isAuction,
          description: r.description,
          // Keep anything the schema doesn't model rather than dropping it —
          // including the legacy pricing flag, which has no column of its own.
          extra: {
            legacyId: r.id,
            legacyPricingType: r.pricingType,
            legacyBodyType: r.bodyType,
            ...(engineRaw ? { legacyEngine: engineRaw } : {}),
          },
          publishedAt: r.status === "active" ? new Date() : null,
          soldAt: r.isSold ? new Date() : null,
        })
        .returning({ id: schema.vehicles.id });

      /* engine */
      if (engine.displacementCc || engine.aspiration || r.specs?.horsepower) {
        await tx.insert(schema.vehicleEngines).values({
          vehicleId: vehicle.id,
          displacementCc: engine.displacementCc,
          aspiration: engine.aspiration,
          cylinders: engine.cylinders,
          powerHp: r.specs?.horsepower ? Number(r.specs.horsepower) : null,
        });
        engineCount++;
      }

      /* media */
      const tier: "a" | "b" = r.imageTier.toLowerCase() === "a" ? "a" : "b";
      const photos = [
        { url: r.cover, isCover: true },
        ...r.gallery.map((url) => ({ url, isCover: false })),
      ];
      await tx.insert(schema.vehicleMedia).values(
        photos.map((p, i) => {
          // "/vehicles/<folder>/<file>" -> "<folder>/<file>", the grade CSV key.
          const key = p.url.replace(/^\/vehicles\//, "");
          const grade = grades.get(key);
          return {
            vehicleId: vehicle.id,
            kind: "photo" as const,
            url: p.url,
            alt: `${r.title} — ${r.year}`,
            position: i,
            isCover: p.isCover,
            width: grade?.w ?? null,
            height: grade?.h ?? null,
            bytes: grade?.bytes ?? null,
            tier,
          };
        }),
      );
      mediaCount += photos.length;

      /* features */
      const rawFeatures = r.specs?.features;
      if (typeof rawFeatures === "string") {
        const slugs = [
          ...new Set(
            rawFeatures
              .split(",")
              .map((f) => slugify(f.trim()))
              .filter(Boolean),
          ),
        ];
        if (slugs.length) {
          await tx
            .insert(schema.vehicleFeatures)
            .values(slugs.map((s) => ({ vehicleId: vehicle.id, featureId: featureId.get(s)! })));
          featureLinks += slugs.length;
        }
      }
    }

    return {
      makes: insertedMakes.length,
      models: insertedModels.length,
      vehicles: rows.length,
      media: mediaCount,
      engines: engineCount,
      features: featureLinks,
    };
  });
}
