import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { db } from "@/server/db";
import { listSitemapEntries } from "@/server/catalog/queries";

/*
 * Regenerated hourly rather than baked in at build time, so a vehicle added in
 * the admin panel reaches search engines without a redeploy.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const vehicles = await listSitemapEntries(db);
  const newest = vehicles.reduce<Date | undefined>(
    (max, v) => (!max || v.updatedAt > max ? v.updatedAt : max),
    undefined,
  );

  return [
    { url: SITE_URL, lastModified: newest, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/vehicles`, lastModified: newest, changeFrequency: "daily", priority: 0.9 },
    ...vehicles.map((v) => ({
      url: `${SITE_URL}/vehicles/${v.slug}`,
      lastModified: v.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
