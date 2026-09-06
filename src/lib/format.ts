/**
 * Formatting helpers. Ayyan trades in Kampala but imports and exports, so a
 * listing's currency travels with its price rather than being assumed.
 */

import type { Money } from "@/lib/catalog";

const NUM = new Intl.NumberFormat("en-US");

/**
 * How many minor units make one major unit, per currency. UGX and JPY have no
 * subunit at all, so dividing their stored value by 100 would show a price a
 * hundred times too small. `Intl` already knows this, so ask it rather than
 * keeping a table that drifts.
 */
function minorUnitDigits(currency: string): number {
  try {
    return (
      new Intl.NumberFormat("en-US", { style: "currency", currency }).resolvedOptions()
        .maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
}

/**
 * Most of the current inventory has no published price, so "Price on request"
 * is a first-class state rather than an error case. Callers should render the
 * result as-is; `isOnRequest` lets them de-emphasise it typographically.
 */
export function formatPrice(price?: Money | null): {
  label: string;
  isOnRequest: boolean;
} {
  if (!price || price.minor <= 0) {
    return { label: "Price on request", isOnRequest: true };
  }

  const digits = minorUnitDigits(price.currency);
  const major = price.minor / 10 ** digits;

  try {
    return {
      label: new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: price.currency,
        maximumFractionDigits: 0,
      }).format(major),
      isOnRequest: false,
    };
  } catch {
    // Unknown currency code — show the number and the code rather than nothing.
    return { label: `${NUM.format(major)} ${price.currency}`, isOnRequest: false };
  }
}

export function formatMileage(km?: number | null): string | null {
  if (km == null || km < 0) return null;
  return `${NUM.format(km)} km`;
}

export function formatYear(year?: number | null): string {
  return year ? String(year) : "—";
}

/** "2021 Toyota Hilux Revo" */
export function vehicleHeadline(v: {
  year: number;
  make: string;
  model: string;
}): string {
  return [v.year, v.make, v.model].filter(Boolean).join(" ");
}

/** "2.8 L" from 2800cc, for the spec table. */
export function formatDisplacement(cc?: number | null): string | null {
  if (!cc || cc <= 0) return null;
  return `${(cc / 1000).toFixed(1)} L`;
}
