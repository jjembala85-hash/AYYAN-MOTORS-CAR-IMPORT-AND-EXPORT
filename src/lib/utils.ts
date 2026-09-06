import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge conditional classes, with later Tailwind utilities winning over earlier
 * ones. Lets a caller pass `className` to override a component's own styling.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
