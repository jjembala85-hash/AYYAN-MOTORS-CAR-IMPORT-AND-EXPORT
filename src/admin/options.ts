/**
 * Human labels for the database enums, for the form's dropdowns.
 *
 * A plain module with no server imports, so the Client Component that renders
 * the form can use it without pulling Drizzle's table definitions into the
 * browser bundle. The values must stay in step with `server/db/schema.ts` —
 * `scripts/verify-options.ts` fails the build if they drift, so this is checked
 * rather than merely intended.
 */

export interface Option {
  value: string;
  label: string;
}

export const BODY_TYPES: Option[] = [
  { value: "suv", label: "SUV" },
  { value: "pickup", label: "Pickup" },
  { value: "van", label: "Van" },
  { value: "bus", label: "Bus" },
  { value: "truck", label: "Truck" },
  { value: "sedan", label: "Sedan" },
  { value: "hatchback", label: "Hatchback" },
  { value: "wagon", label: "Wagon" },
  { value: "coupe", label: "Coupé" },
  { value: "convertible", label: "Convertible" },
];

export const CONDITIONS: Option[] = [
  { value: "used", label: "Used" },
  { value: "new", label: "New" },
];

export const STEERING: Option[] = [
  { value: "right", label: "Right-hand drive" },
  { value: "left", label: "Left-hand drive" },
];

export const TRANSMISSIONS: Option[] = [
  { value: "automatic", label: "Automatic" },
  { value: "manual", label: "Manual" },
  { value: "cvt", label: "CVT" },
  { value: "amt", label: "AMT" },
  { value: "dct", label: "DCT" },
];

export const DRIVE_TYPES: Option[] = [
  { value: "4wd", label: "4WD" },
  { value: "awd", label: "AWD" },
  { value: "rwd", label: "RWD" },
  { value: "fwd", label: "FWD" },
  // Kept distinct from RWD on purpose: a lot of legacy stock genuinely records
  // only "2WD" and which axle drives is unknown. See the note in schema.ts.
  { value: "2wd", label: "2WD (axle unrecorded)" },
];

export const FUEL_TYPES: Option[] = [
  { value: "diesel", label: "Diesel" },
  { value: "petrol", label: "Petrol" },
  { value: "hybrid", label: "Hybrid" },
  { value: "plugin_hybrid", label: "Plug-in hybrid" },
  { value: "electric", label: "Electric" },
  { value: "lpg", label: "LPG" },
];

export const ASPIRATIONS: Option[] = [
  { value: "natural", label: "Naturally aspirated" },
  { value: "turbo", label: "Turbo" },
  { value: "twin_turbo", label: "Twin turbo" },
  { value: "supercharged", label: "Supercharged" },
];

export const PRICING_TYPES: Option[] = [
  { value: "on_request", label: "Price on request" },
  { value: "fixed", label: "Fixed price" },
  { value: "negotiable", label: "Negotiable" },
  { value: "auction", label: "Auction" },
];

export const STATUSES: Option[] = [
  { value: "draft", label: "Draft — not on the site" },
  { value: "active", label: "Active — live on the site" },
  { value: "reserved", label: "Reserved" },
  { value: "sold", label: "Sold" },
  { value: "archived", label: "Archived — hidden, kept for records" },
];

/** Currencies the dealership actually quotes in. */
export const CURRENCIES: Option[] = [
  { value: "USD", label: "USD — US dollar" },
  { value: "UGX", label: "UGX — Ugandan shilling" },
  { value: "KES", label: "KES — Kenyan shilling" },
  { value: "JPY", label: "JPY — Japanese yen" },
  { value: "AED", label: "AED — UAE dirham" },
  { value: "GBP", label: "GBP — Pound sterling" },
  { value: "EUR", label: "EUR — Euro" },
];

export const STATUS_TONE: Record<string, string> = {
  draft: "bg-graphite-100 text-graphite-700 dark:bg-graphite-800 dark:text-graphite-200",
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  reserved: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  sold: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  archived: "bg-graphite-100 text-graphite-500 dark:bg-graphite-900 dark:text-graphite-400",
};
