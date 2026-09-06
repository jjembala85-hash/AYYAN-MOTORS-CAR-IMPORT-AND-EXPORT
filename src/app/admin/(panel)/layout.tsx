import { redirect } from "next/navigation";
import { AdminShell } from "@/admin/components/admin-shell";
import { getSession } from "@/admin/auth";

/**
 * The authorization boundary for the panel.
 *
 * `(panel)` is a route group — it does not appear in the URL, so these pages
 * are still /admin and /admin/vehicles. Its only job is to be a layout that the
 * login page is *outside* of, which is what lets the guard be unconditional
 * here instead of a per-page check somebody eventually forgets.
 *
 * `proxy.ts` also redirects signed-out visitors, but only on the presence of a
 * cookie. This is the check that actually verifies the signature and confirms
 * the account is still active.
 */
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  return <AdminShell session={session}>{children}</AdminShell>;
}
