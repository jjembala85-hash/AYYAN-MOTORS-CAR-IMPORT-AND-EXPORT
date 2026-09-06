/**
 * Vehicle Catalog Service — PostgreSQL schema.
 *
 * Modelled around the fact that Ayyan trades imported stock: a unit arrives with
 * a Japanese or Thai auction sheet, gets its own inspection on landing, and
 * carries a history that starts before Ayyan ever owned it. So the "vehicle" row
 * is deliberately thin — identity, classification and commercial state — and the
 * evidence about it (auction sheets, condition reports, history events, media)
 * hangs off it in tables that can each hold more than one row per vehicle.
 */

import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  char,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/** Drizzle has no first-class tsvector, so declare it once here. */
const tsvector = customType<{ data: string; driverData: string }>({
  dataType: () => "tsvector",
});

/* -------------------------------------------------------------------------- */
/* Enumerations                                                                */
/* -------------------------------------------------------------------------- */

export const listingStatusEnum = pgEnum("listing_status", [
  "draft",
  "active",
  "reserved",
  "sold",
  "archived",
]);

export const conditionEnum = pgEnum("vehicle_condition", ["new", "used"]);

export const pricingTypeEnum = pgEnum("pricing_type", [
  "fixed",
  "negotiable",
  "on_request",
  "auction",
]);

export const bodyTypeEnum = pgEnum("body_type", [
  "suv",
  "pickup",
  "van",
  "bus",
  "truck",
  "sedan",
  "hatchback",
  "wagon",
  "coupe",
  "convertible",
]);

export const fuelTypeEnum = pgEnum("fuel_type", [
  "petrol",
  "diesel",
  "hybrid",
  "plugin_hybrid",
  "electric",
  "lpg",
]);

export const transmissionEnum = pgEnum("transmission", [
  "manual",
  "automatic",
  "cvt",
  "amt",
  "dct",
]);

/**
 * "2wd" is not a synonym for fwd or rwd — a lot of legacy listings say only
 * "2WD" and which axle drives is genuinely unrecorded. Guessing it (pickups are
 * usually rwd) would put invented data in the catalogue, so it gets its own
 * value and can be narrowed later when someone checks the vehicle.
 */
export const driveTypeEnum = pgEnum("drive_type", ["fwd", "rwd", "awd", "4wd", "2wd"]);

/** Right-hand drive is the default in Uganda; export markets differ, so it filters. */
export const steeringEnum = pgEnum("steering", ["left", "right"]);

export const aspirationEnum = pgEnum("aspiration", [
  "natural",
  "turbo",
  "twin_turbo",
  "supercharged",
]);

export const mediaKindEnum = pgEnum("media_kind", [
  "photo",
  /** One frame of a 360° turntable sequence; ordered by `spin_index`. */
  "spin_frame",
  "video",
  "document",
]);

/**
 * Photo-quality grade from the asset audit. "A" sets can lead a page, "B" sets
 * are fine in a grid, "C" is a placeholder that should be reshot.
 */
export const mediaTierEnum = pgEnum("media_tier", ["a", "b", "c"]);

export const historyEventEnum = pgEnum("history_event_type", [
  "manufactured",
  "first_registration",
  "ownership_change",
  "odometer_reading",
  "service",
  "accident",
  "inspection",
  "auction_sale",
  "import",
  "export",
  "deregistration",
]);

export const defectSeverityEnum = pgEnum("defect_severity", [
  "none",
  "minor",
  "moderate",
  "major",
]);

/**
 * "owner" may manage other admin accounts; "editor" may only touch inventory.
 * Deliberately two values — a dealership of this size does not need a
 * permission matrix, and inventing one now would be guessing at a workflow.
 */
export const adminRoleEnum = pgEnum("admin_role", ["owner", "editor"]);

/* -------------------------------------------------------------------------- */
/* Admin accounts                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Staff who can sign in to the admin panel. Separate from any future customer
 * account table on purpose: these rows grant write access to the catalogue, and
 * mixing them with public sign-ups is how an authorization bug becomes a
 * privilege escalation.
 *
 * The hash is scrypt (see `src/admin/auth.ts`) rather than bcrypt — it ships in
 * Node's standard library, so there is no native module to rebuild per platform.
 */
export const adminUsers = pgTable(
  "admin_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    /** "scrypt:<N>:<r>:<p>:<salt-b64>:<hash-b64>" — parameters travel with it. */
    passwordHash: text("password_hash").notNull(),
    role: adminRoleEnum("role").notNull().default("editor"),
    /** Revoke access without deleting the row, so past edits keep their author. */
    isActive: boolean("is_active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Lower-cased: "Sam@ayyan.com" and "sam@ayyan.com" are one person, and
    // letting both exist would make "which account did I just lock out?" a real
    // question. Login looks the address up the same way.
    uniqueIndex("admin_users_email_key").on(sql`lower(${t.email})`),
    check("admin_users_email_shape", sql`${t.email} ~ '^[^@[:space:]]+@[^@[:space:]]+$'`),
  ],
);

/* -------------------------------------------------------------------------- */
/* Classification                                                              */
/* -------------------------------------------------------------------------- */

export const makes = pgTable(
  "makes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    countryCode: char("country_code", { length: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("makes_slug_key").on(t.slug)],
);

/**
 * `family` is what buyers actually shop by. Every model *name* in the legacy data
 * is unique ("Hilux Revo", "Hilux Revo Double Cab", "Hilux Rocco"), so filtering
 * on the name alone yields one option per vehicle and narrows nothing; the family
 * collapses those three to "Hilux".
 */
export const models = pgTable(
  "models",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    makeId: uuid("make_id")
      .notNull()
      .references(() => makes.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    family: text("family").notNull(),
    slug: text("slug").notNull(),
    defaultBodyType: bodyTypeEnum("default_body_type"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("models_make_slug_key").on(t.makeId, t.slug),
    index("models_family_idx").on(t.makeId, t.family),
  ],
);

/* -------------------------------------------------------------------------- */
/* Vehicles                                                                    */
/* -------------------------------------------------------------------------- */

export const vehicles = pgTable(
  "vehicles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),

    makeId: uuid("make_id")
      .notNull()
      .references(() => makes.id, { onDelete: "restrict" }),
    modelId: uuid("model_id")
      .notNull()
      .references(() => models.id, { onDelete: "restrict" }),

    /** Denormalised for display and full-text search; "Toyota Hilux Revo". */
    title: text("title").notNull(),
    modelYear: smallint("model_year").notNull(),

    /*
     * Identity. Japanese and Thai imports are identified by a chassis number
     * ("KDH201-0123456") and frequently have no 17-character VIN at all, so both
     * are nullable and independently unique. Enforcing one over the other would
     * make most of the real inventory unenterable.
     */
    chassisNumber: text("chassis_number"),
    vin: char("vin", { length: 17 }),
    engineNumber: text("engine_number"),
    registrationNumber: text("registration_number"),

    bodyType: bodyTypeEnum("body_type"),
    condition: conditionEnum("condition").notNull().default("used"),
    steering: steeringEnum("steering").notNull().default("right"),
    transmission: transmissionEnum("transmission"),
    driveType: driveTypeEnum("drive_type"),
    fuelType: fuelTypeEnum("fuel_type"),

    mileageKm: integer("mileage_km"),
    /** False when the odometer is unverified — common on auction stock. */
    mileageVerified: boolean("mileage_verified").notNull().default(false),

    exteriorColor: text("exterior_color"),
    interiorColor: text("interior_color"),
    doors: smallint("doors"),
    seats: smallint("seats"),

    /*
     * Money as integer minor units plus an explicit currency. Never floats —
     * 1_250_000 UGX and 1250.00 USD must not round differently.
     */
    priceMinor: bigint("price_minor", { mode: "number" }),
    priceCurrency: char("price_currency", { length: 3 }),
    pricingType: pricingTypeEnum("pricing_type").notNull().default("on_request"),

    status: listingStatusEnum("status").notNull().default("draft"),
    isFeatured: boolean("is_featured").notNull().default(false),
    isAuction: boolean("is_auction").notNull().default(false),

    description: text("description"),
    /** Long tail of legacy CMS spec keys that don't deserve a column yet. */
    extra: jsonb("extra").$type<Record<string, unknown>>(),

    publishedAt: timestamp("published_at", { withTimezone: true }),
    soldAt: timestamp("sold_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),

    /*
     * Who last saved this row from the admin panel. `set null` rather than
     * `restrict`: removing a staff account should not be blocked by, nor erase,
     * the listings they touched — the edit still happened, the author is just
     * no longer resolvable. Null on every seeded row, which is honest: the
     * import had no author.
     */
    updatedBy: uuid("updated_by").references(() => adminUsers.id, {
      onDelete: "set null",
    }),

    /*
     * Postgres does the searching. A stored generated tsvector plus a GIN index
     * replaces substring matching in JavaScript, and stays correct as the
     * catalogue grows past what's reasonable to hold in memory.
     */
    searchDocument: tsvector("search_document").generatedAlwaysAs(
      // Bare column names, not table-qualified references: this expression is
      // part of the table's own DDL, so qualifying it would be circular.
      sql`to_tsvector('simple', coalesce(title, '') || ' ' || model_year::text || ' ' || coalesce(chassis_number, '') || ' ' || coalesce(vin, ''))`,
    ),
  },
  (t) => [
    uniqueIndex("vehicles_slug_key").on(t.slug),
    // Partial uniques: many rows legitimately have no VIN or no chassis number,
    // and a plain UNIQUE would collapse them all into one allowed NULL-free row.
    uniqueIndex("vehicles_vin_key").on(t.vin).where(sql`${t.vin} is not null`),
    uniqueIndex("vehicles_chassis_key")
      .on(t.chassisNumber)
      .where(sql`${t.chassisNumber} is not null`),
    index("vehicles_browse_idx").on(t.status, t.modelYear.desc()),
    index("vehicles_make_model_idx").on(t.makeId, t.modelId),
    index("vehicles_body_type_idx").on(t.bodyType),
    index("vehicles_search_idx").using("gin", t.searchDocument),
    check(
      "vehicles_vin_format",
      // 17 chars, and I/O/Q are excluded from the VIN alphabet by ISO 3779.
      sql`${t.vin} is null or ${t.vin} ~ '^[A-HJ-NPR-Z0-9]{17}$'`,
    ),
    check("vehicles_mileage_nonneg", sql`${t.mileageKm} is null or ${t.mileageKm} >= 0`),
    check("vehicles_price_nonneg", sql`${t.priceMinor} is null or ${t.priceMinor} >= 0`),
    // A price is meaningless without a currency, and vice versa.
    check(
      "vehicles_price_currency_paired",
      sql`(${t.priceMinor} is null) = (${t.priceCurrency} is null)`,
    ),
    /*
     * Deliberately static rather than `extract(year from now()) + 2`. Postgres
     * accepts a non-immutable CHECK, but its meaning then drifts with the clock
     * and it is re-validated on dump/restore. This catches the typos that
     * actually occur (1200, 20260); the tighter "no more than two model years
     * ahead" rule belongs in application validation, where it can explain itself.
     */
    check("vehicles_model_year_sane", sql`${t.modelYear} between 1950 and 2100`),
  ],
);

/**
 * 1:1 with `vehicles`. Split out because engine detail is bulky, frequently
 * unknown on used stock, and not needed by list queries.
 */
export const vehicleEngines = pgTable("vehicle_engines", {
  vehicleId: uuid("vehicle_id")
    .primaryKey()
    .references(() => vehicles.id, { onDelete: "cascade" }),
  /** Manufacturer code, e.g. "2GD-FTV". */
  engineCode: text("engine_code"),
  displacementCc: integer("displacement_cc"),
  cylinders: smallint("cylinders"),
  aspiration: aspirationEnum("aspiration"),
  powerHp: integer("power_hp"),
  torqueNm: integer("torque_nm"),
  emissionStandard: text("emission_standard"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* -------------------------------------------------------------------------- */
/* Features                                                                    */
/* -------------------------------------------------------------------------- */

export const features = pgTable(
  "features",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    category: text("category"),
  },
  (t) => [uniqueIndex("features_slug_key").on(t.slug)],
);

export const vehicleFeatures = pgTable(
  "vehicle_features",
  {
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    featureId: uuid("feature_id")
      .notNull()
      .references(() => features.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.vehicleId, t.featureId] }),
    index("vehicle_features_feature_idx").on(t.featureId),
  ],
);

/* -------------------------------------------------------------------------- */
/* Media                                                                       */
/* -------------------------------------------------------------------------- */

export const vehicleMedia = pgTable(
  "vehicle_media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    kind: mediaKindEnum("kind").notNull().default("photo"),
    url: text("url").notNull(),
    alt: text("alt"),
    position: integer("position").notNull().default(0),
    isCover: boolean("is_cover").notNull().default(false),
    width: integer("width"),
    height: integer("height"),
    bytes: integer("bytes"),
    tier: mediaTierEnum("tier"),
    /** Frame order within a 360° sequence; null for everything else. */
    spinIndex: integer("spin_index"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("vehicle_media_order_idx").on(t.vehicleId, t.kind, t.position),
    // At most one cover per vehicle, enforced by the database rather than by
    // whichever code path happens to be writing.
    uniqueIndex("vehicle_media_one_cover")
      .on(t.vehicleId)
      .where(sql`${t.isCover}`),
    uniqueIndex("vehicle_media_spin_frame_key")
      .on(t.vehicleId, t.spinIndex)
      .where(sql`${t.spinIndex} is not null`),
    check(
      "vehicle_media_spin_index_only_on_frames",
      sql`(${t.kind} = 'spin_frame') = (${t.spinIndex} is not null)`,
    ),
  ],
);

/* -------------------------------------------------------------------------- */
/* History                                                                     */
/* -------------------------------------------------------------------------- */

export const vehicleHistoryEvents = pgTable(
  "vehicle_history_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    eventType: historyEventEnum("event_type").notNull(),
    occurredOn: date("occurred_on"),
    odometerKm: integer("odometer_km"),
    countryCode: char("country_code", { length: 2 }),
    description: text("description"),
    /** Where the claim came from — "auction sheet", "JEVIC", "seller". */
    source: text("source"),
    documentUrl: text("document_url"),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("vehicle_history_timeline_idx").on(t.vehicleId, t.occurredOn),
    check(
      "vehicle_history_odometer_nonneg",
      sql`${t.odometerKm} is null or ${t.odometerKm} >= 0`,
    ),
  ],
);

/* -------------------------------------------------------------------------- */
/* Condition reports — Ayyan's own inspection, done on landing                 */
/* -------------------------------------------------------------------------- */

export const conditionReports = pgTable(
  "condition_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    inspectedBy: text("inspected_by"),
    inspectedAt: timestamp("inspected_at", { withTimezone: true }).notNull(),
    /** Ayyan's own 1–5 scale, distinct from any auction house grade. */
    overallScore: smallint("overall_score"),
    exteriorScore: smallint("exterior_score"),
    interiorScore: smallint("interior_score"),
    mechanicalScore: smallint("mechanical_score"),
    hasAccidentHistory: boolean("has_accident_history"),
    hasStructuralDamage: boolean("has_structural_damage"),
    hasFloodDamage: boolean("has_flood_damage"),
    summary: text("summary"),
    documentUrl: text("document_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("condition_reports_vehicle_idx").on(t.vehicleId, t.inspectedAt.desc()),
    check(
      "condition_reports_scores_range",
      sql`(${t.overallScore} is null or ${t.overallScore} between 1 and 5)
          and (${t.exteriorScore} is null or ${t.exteriorScore} between 1 and 5)
          and (${t.interiorScore} is null or ${t.interiorScore} between 1 and 5)
          and (${t.mechanicalScore} is null or ${t.mechanicalScore} between 1 and 5)`,
    ),
  ],
);

/** The panel-by-panel map on a real inspection sheet: one row per noted defect. */
export const conditionReportItems = pgTable(
  "condition_report_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reportId: uuid("report_id")
      .notNull()
      .references(() => conditionReports.id, { onDelete: "cascade" }),
    /** Panel or system: "front_bumper", "nearside_door", "gearbox". */
    area: text("area").notNull(),
    defectType: text("defect_type"),
    severity: defectSeverityEnum("severity").notNull().default("minor"),
    note: text("note"),
    photoUrl: text("photo_url"),
  },
  (t) => [index("condition_report_items_report_idx").on(t.reportId)],
);

/* -------------------------------------------------------------------------- */
/* Auction sheets — the source document from the exporting auction house       */
/* -------------------------------------------------------------------------- */

/**
 * Kept separate from `condition_reports` on purpose: an auction sheet is a
 * third-party document with its own grading vocabulary that Ayyan cannot change,
 * only translate and verify. Grades are text, not numbers, because Japanese
 * houses issue "4.5", "R" (repaired), "RA", "S" and "***" alongside 1–6.
 */
export const auctionSheets = pgTable(
  "auction_sheets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    auctionHouse: text("auction_house").notNull(),
    auctionSite: text("auction_site"),
    lotNumber: text("lot_number"),
    auctionDate: date("auction_date"),

    gradeOverall: text("grade_overall"),
    gradeExterior: text("grade_exterior"),
    gradeInterior: text("grade_interior"),

    /** Odometer as printed on the sheet — often disagrees with the seller. */
    odometerKm: integer("odometer_km"),
    startingPriceMinor: bigint("starting_price_minor", { mode: "number" }),
    soldPriceMinor: bigint("sold_price_minor", { mode: "number" }),
    priceCurrency: char("price_currency", { length: 3 }),

    sheetImageUrl: text("sheet_image_url"),
    inspectorNotes: text("inspector_notes"),
    translatedNotes: text("translated_notes"),

    /** Null until someone has actually checked the sheet against the car. */
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    verifiedBy: text("verified_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("auction_sheets_vehicle_idx").on(t.vehicleId),
    uniqueIndex("auction_sheets_lot_key")
      .on(t.auctionHouse, t.lotNumber, t.auctionDate)
      .where(sql`${t.lotNumber} is not null and ${t.auctionDate} is not null`),
    check(
      "auction_sheets_prices_need_currency",
      sql`(${t.startingPriceMinor} is null and ${t.soldPriceMinor} is null)
          or ${t.priceCurrency} is not null`,
    ),
  ],
);

/* -------------------------------------------------------------------------- */
/* Relations                                                                   */
/* -------------------------------------------------------------------------- */

export const makesRelations = relations(makes, ({ many }) => ({
  models: many(models),
  vehicles: many(vehicles),
}));

export const modelsRelations = relations(models, ({ one, many }) => ({
  make: one(makes, { fields: [models.makeId], references: [makes.id] }),
  vehicles: many(vehicles),
}));

export const adminUsersRelations = relations(adminUsers, ({ many }) => ({
  editedVehicles: many(vehicles),
}));

export const vehiclesRelations = relations(vehicles, ({ one, many }) => ({
  make: one(makes, { fields: [vehicles.makeId], references: [makes.id] }),
  model: one(models, { fields: [vehicles.modelId], references: [models.id] }),
  editor: one(adminUsers, {
    fields: [vehicles.updatedBy],
    references: [adminUsers.id],
  }),
  engine: one(vehicleEngines, {
    fields: [vehicles.id],
    references: [vehicleEngines.vehicleId],
  }),
  media: many(vehicleMedia),
  historyEvents: many(vehicleHistoryEvents),
  conditionReports: many(conditionReports),
  auctionSheets: many(auctionSheets),
  features: many(vehicleFeatures),
}));

export const vehicleEnginesRelations = relations(vehicleEngines, ({ one }) => ({
  vehicle: one(vehicles, {
    fields: [vehicleEngines.vehicleId],
    references: [vehicles.id],
  }),
}));

export const vehicleMediaRelations = relations(vehicleMedia, ({ one }) => ({
  vehicle: one(vehicles, { fields: [vehicleMedia.vehicleId], references: [vehicles.id] }),
}));

export const vehicleHistoryEventsRelations = relations(vehicleHistoryEvents, ({ one }) => ({
  vehicle: one(vehicles, {
    fields: [vehicleHistoryEvents.vehicleId],
    references: [vehicles.id],
  }),
}));

export const conditionReportsRelations = relations(conditionReports, ({ one, many }) => ({
  vehicle: one(vehicles, {
    fields: [conditionReports.vehicleId],
    references: [vehicles.id],
  }),
  items: many(conditionReportItems),
}));

export const conditionReportItemsRelations = relations(conditionReportItems, ({ one }) => ({
  report: one(conditionReports, {
    fields: [conditionReportItems.reportId],
    references: [conditionReports.id],
  }),
}));

export const auctionSheetsRelations = relations(auctionSheets, ({ one }) => ({
  vehicle: one(vehicles, { fields: [auctionSheets.vehicleId], references: [vehicles.id] }),
}));

export const featuresRelations = relations(features, ({ many }) => ({
  vehicles: many(vehicleFeatures),
}));

export const vehicleFeaturesRelations = relations(vehicleFeatures, ({ one }) => ({
  vehicle: one(vehicles, { fields: [vehicleFeatures.vehicleId], references: [vehicles.id] }),
  feature: one(features, { fields: [vehicleFeatures.featureId], references: [features.id] }),
}));

/* -------------------------------------------------------------------------- */

export type AdminUserRow = typeof adminUsers.$inferSelect;
export type VehicleRow = typeof vehicles.$inferSelect;
export type NewVehicleRow = typeof vehicles.$inferInsert;
export type MediaRow = typeof vehicleMedia.$inferSelect;
export type AuctionSheetRow = typeof auctionSheets.$inferSelect;
export type ConditionReportRow = typeof conditionReports.$inferSelect;
