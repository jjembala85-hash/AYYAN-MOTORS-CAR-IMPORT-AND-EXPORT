import type { Metadata } from "next";

/**
 * Wraps every admin screen, signed in or not.
 *
 * Carries no authentication itself — the login page is inside this segment and
 * must render for a signed-out visitor. The guard lives one level down, in
 * `(panel)/layout.tsx`, which wraps everything except login.
 */

export const metadata: Metadata = {
  title: {
    default: "Admin Panel",
    template: "%s · Ayyan Admin",
  },
  // The panel must never appear in search results, and unlike the public pages
  // there is no reason for a crawler to see it at all.
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
