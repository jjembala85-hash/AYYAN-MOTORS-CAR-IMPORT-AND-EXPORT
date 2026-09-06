import * as z from "zod";
import {
  aspirationEnum,
  bodyTypeEnum,
  conditionEnum,
  driveTypeEnum,
  fuelTypeEnum,
  listingStatusEnum,
  pricingTypeEnum,
  steeringEnum,
  transmissionEnum,
} from "@/server/db/schema";

/**
 * Validation for the vehicle form.
 *
 * Enum members are read from the Drizzle table definitions rather than retyped,
 * so adding a body type to the database automatically offers it in the form and
 * a removed one becomes a type error here instead of a runtime constraint
 * violation on save.
 *
 * This mirrors — deliberately, not redundantly — the CHECK constraints in the
 * schema. The database is the thing that must never hold a bad row; this layer
 * exists so the operator gets "Model year looks wrong" next to the field rather
 * than a Postgres error, and so the rules that *can't* be immutable SQL (the
 * "no more than two model years ahead" note in schema.ts) live somewhere.
 */

/** `<input>` sends "" for every untouched field; the database wants null. */
const blankToNull = z
  .string()
  .transform((v) => v.trim())
  .transform((v) => (v === "" ? null : v));

const optionalText = blankToNull.pipe(z.string().min(1).max(500).nullable());

/** Checkboxes are absent when unticked and "on" when ticked. */
const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal(""), z.undefined(), z.null()])
  .transform((v) => v === "on" || v === "true");

function optionalEnum<T extends readonly [string, ...string[]]>(values: T) {
  return blankToNull.pipe(z.enum(values).nullable());
}

/**
 * `z.coerce.number()` can't be piped from a string: its declared input is
 * `unknown`, so the chain fails to typecheck. Converting explicitly is also
 * clearer about the one case that matters — `Number("")` is 0, not NaN, which
 * would silently turn a blank mileage into "0 km".
 */
const toNumber = (v: string | null) => (v === null ? null : Number(v));

const optionalInt = (label: string, max: number) =>
  blankToNull.transform(toNumber).pipe(
    z
      .number({ error: `${label} must be a number.` })
      .int(`${label} must be a whole number.`)
      .min(0, `${label} cannot be negative.`)
      .max(max, `${label} looks too large.`)
      .nullable(),
  );

/**
 * Two model years ahead is the real-world ceiling — dealers list a 2027 in late
 * 2026 — and this is the check schema.ts explicitly deferred to the application
 * so it could explain itself instead of being a static SQL range.
 */
const MAX_MODEL_YEAR = new Date().getFullYear() + 2;

export const vehicleFormSchema = z
  .object({
    /* identity ----------------------------------------------------------- */
    title: z
      .string()
      .trim()
      .min(3, "Give the listing a title, e.g. “Toyota Hilux Revo”.")
      .max(160, "That title is too long for a listing heading."),
    slug: blankToNull.pipe(
      z
        .string()
        .regex(
          /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
          "The web address may only use lower-case letters, numbers and hyphens.",
        )
        .max(120)
        .nullable(),
    ),
    make: z.string().trim().min(1, "Make is required, e.g. “Toyota”.").max(60),
    model: z.string().trim().min(1, "Model is required, e.g. “Hilux Revo”.").max(80),
    modelYear: z.coerce
      .number({ error: "Model year is required." })
      .int("Model year must be a whole number.")
      .min(1950, "Model year looks too early — the catalogue starts at 1950.")
      .max(MAX_MODEL_YEAR, `Model year cannot be later than ${MAX_MODEL_YEAR}.`),

    chassisNumber: optionalText,
    vin: blankToNull.pipe(
      z
        .string()
        .toUpperCase()
        .regex(
          /^[A-HJ-NPR-Z0-9]{17}$/,
          "A VIN is exactly 17 characters and never contains I, O or Q. Leave it blank for an import that only has a chassis number.",
        )
        .nullable(),
    ),
    engineNumber: optionalText,
    registrationNumber: optionalText,

    /* classification ------------------------------------------------------ */
    bodyType: optionalEnum(bodyTypeEnum.enumValues),
    condition: z.enum(conditionEnum.enumValues),
    steering: z.enum(steeringEnum.enumValues),
    transmission: optionalEnum(transmissionEnum.enumValues),
    driveType: optionalEnum(driveTypeEnum.enumValues),
    fuelType: optionalEnum(fuelTypeEnum.enumValues),

    /* condition ----------------------------------------------------------- */
    mileageKm: optionalInt("Mileage", 2_000_000),
    mileageVerified: checkbox,
    exteriorColor: optionalText,
    interiorColor: optionalText,
    doors: optionalInt("Doors", 10),
    seats: optionalInt("Seats", 100),

    /* commercial ---------------------------------------------------------- */
    // Taken in major units ("25000.50") because that is what a person types;
    // converted to integer minor units in `toVehicleValues` so the money never
    // exists as a float anywhere near the database.
    price: blankToNull.transform(toNumber).pipe(
      z
        .number({ error: "Price must be a number." })
        .min(0, "Price cannot be negative.")
        .max(1_000_000_000, "That price looks like a typo.")
        .nullable(),
    ),
    priceCurrency: blankToNull.pipe(
      z
        .string()
        .toUpperCase()
        .regex(/^[A-Z]{3}$/, "Use a three-letter currency code such as USD or UGX.")
        .nullable(),
    ),
    pricingType: z.enum(pricingTypeEnum.enumValues),
    status: z.enum(listingStatusEnum.enumValues),
    isFeatured: checkbox,
    isAuction: checkbox,

    description: blankToNull.pipe(z.string().max(8000).nullable()),

    /* engine -------------------------------------------------------------- */
    engineCode: optionalText,
    displacementCc: optionalInt("Engine size", 20_000),
    cylinders: optionalInt("Cylinders", 20),
    aspiration: optionalEnum(aspirationEnum.enumValues),
    powerHp: optionalInt("Power", 3000),
    torqueNm: optionalInt("Torque", 10_000),
  })
  /* Cross-field rules ---------------------------------------------------- */
  .refine((v) => v.price === null || v.priceCurrency !== null, {
    path: ["priceCurrency"],
    error: "Choose a currency — a price without one cannot be displayed.",
  })
  .refine((v) => v.pricingType === "on_request" || v.price !== null, {
    path: ["price"],
    error: "This pricing type needs a price. Switch to “On request” to leave it blank.",
  })
  .refine((v) => v.chassisNumber !== null || v.vin !== null, {
    path: ["chassisNumber"],
    error:
      "Enter a chassis number or a VIN — without one this unit cannot be told apart from another of the same model.",
  })
  .refine((v) => v.status !== "active" || v.title.length > 0, {
    path: ["status"],
    error: "A listing needs a title before it can go live.",
  });

export type VehicleFormInput = z.input<typeof vehicleFormSchema>;
export type VehicleFormValues = z.output<typeof vehicleFormSchema>;

/* -------------------------------------------------------------------------- */

/** Field-keyed errors, the shape `useActionState` hands back to the form. */
export type FieldErrors = Partial<Record<string, string[]>>;

export interface FormState {
  ok?: boolean;
  message?: string;
  errors?: FieldErrors;
  /** Echoed back so a rejected form re-renders with what was typed. */
  values?: Record<string, string>;
}

/**
 * Parses a submitted form, keeping the raw values so a validation failure can
 * re-render the fields instead of blanking them — retyping twenty fields
 * because one year was wrong is how data entry gets abandoned.
 */
export function parseVehicleForm(
  formData: FormData,
): { ok: true; data: VehicleFormValues } | { ok: false; state: FormState } {
  const raw: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") raw[key] = value;
  }

  const result = vehicleFormSchema.safeParse(raw);
  if (result.success) return { ok: true, data: result.data };

  return {
    ok: false,
    state: {
      ok: false,
      message: "Some fields need attention before this can be saved.",
      errors: z.flattenError(result.error).fieldErrors as FieldErrors,
      values: raw,
    },
  };
}

/** URL-safe slug, matching the one the seed produced so old and new agree. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
