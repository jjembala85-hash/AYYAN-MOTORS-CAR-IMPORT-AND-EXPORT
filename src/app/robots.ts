import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // The design system is an internal component showcase, not a page buyers
      // should land on from a search result.
      disallow: ["/admin", "/api/", "/design-system"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
