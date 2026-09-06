import type { NextConfig } from "next";

/**
 * The host uploaded photos are served from, as a `remotePatterns` entry.
 *
 * S3_PUBLIC_URL is the CDN or public bucket domain; S3_ENDPOINT is the signing
 * host, which is the same thing only when the bucket is served directly. Both
 * are checked, and both are tolerated being absent or malformed — a bad URL
 * here should not stop the whole app from booting, it should just mean no
 * remote images are allowed.
 */
function uploadHostPatterns(): NonNullable<NextConfig["images"]>["remotePatterns"] {
  const seen = new Set<string>();
  const patterns: NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]> = [];

  for (const raw of [process.env.S3_PUBLIC_URL, process.env.S3_ENDPOINT]) {
    if (!raw) continue;
    try {
      const url = new URL(raw);
      if (seen.has(url.host)) continue;
      seen.add(url.host);
      patterns.push({
        protocol: url.protocol === "http:" ? "http" : "https",
        hostname: url.hostname,
        port: url.port || undefined,
        // Scoped no tighter than the host: a CDN in front of the bucket rarely
        // keeps the "/<bucket>/" prefix, so a path filter derived from the
        // endpoint would reject exactly the setup it was meant to allow.
        pathname: "/**",
      });
    } catch {
      // Not a URL — ignore rather than crash the config.
    }
  }

  return patterns;
}

const nextConfig: NextConfig = {
  /* `next build` prerenders with a pool of workers, each holding its own
     database connection. That is fine against Neon or Supabase, but the WASM
     Postgres behind `npm run db:local` serves one session at a time, so set
     NEXT_BUILD_CPUS=1 when building against it. Unset in every other case. */
  ...(process.env.NEXT_BUILD_CPUS
    ? { experimental: { cpus: Number(process.env.NEXT_BUILD_CPUS) } }
    : {}),

  images: {
    /* AVIF first, WebP as the fallback. AVIF is roughly 20–30% smaller again
       than WebP at the same quality, which matters most on the export-market
       connections this site is aimed at. Browsers that send neither in Accept
       still get the original JPEG. */
    formats: ["image/avif", "image/webp"],

    /* Photos uploaded through the admin panel are served from object storage,
       and `next/image` refuses any host not listed here — it would otherwise be
       an open image-resizing proxy for the whole internet.

       Derived from the environment rather than hard-coded so the bucket can
       move (or the provider change) without a code edit; seeded images under
       /vehicles are same-origin and need no entry. With no S3_* configured the
       list is empty, which is correct: the local driver writes to
       public/uploads, also same-origin. */
    remotePatterns: uploadHostPatterns(),
  },
};

export default nextConfig;
