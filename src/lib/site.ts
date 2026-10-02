/**
 * The public origin, without a trailing slash. Used for Open Graph images, the
 * sitemap and robots.txt. `||` rather than `??`: Vercel can hold the variable
 * as an empty string, and `new URL("")` fails the build.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.ayyanmotorsltd.com"
).replace(/\/+$/, "");
