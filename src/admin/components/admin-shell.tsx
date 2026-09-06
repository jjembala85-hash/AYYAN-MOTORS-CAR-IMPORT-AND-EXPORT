import Link from "next/link";
import { LogOut, SquareArrowOutUpRight } from "lucide-react";
import { logout } from "@/admin/actions/auth";
import type { AdminSession } from "@/admin/auth";
import { AdminNavLink, type NavIcon } from "./admin-nav-link";

/**
 * The frame every signed-in admin screen renders inside.
 *
 * Deliberately does NOT use `SiteHeader` / `SiteFooter`. The public chrome is
 * built for a visitor browsing stock — a hero nav, a contact footer, marketing
 * links — and none of it helps someone entering a vehicle. Sharing it would
 * also mean every future change to the public header had to be checked against
 * the panel. What the two do share is the design system underneath: the same
 * tokens, the same `Button`, `Field` and `Card`, so the panel looks like part of
 * the same product without being coupled to the marketing site's layout.
 */

/* Icons are named, not imported here — see the note in `admin-nav-link.tsx`:
   a component is a function, and functions cannot cross into a Client
   Component as props. */
const NAV: { href: string; label: string; icon: NavIcon; exact: boolean }[] = [
  { href: "/admin", label: "Dashboard", icon: "dashboard", exact: true },
  { href: "/admin/vehicles", label: "Vehicles", icon: "car", exact: false },
];

export function AdminShell({
  session,
  children,
}: {
  session: AdminSession;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-surface-sunken text-text">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 sm:px-6">
          <Link href="/admin" className="font-[family-name:var(--font-archivo)] font-extrabold tracking-tight">
            Ayyan <span className="text-brand">Admin</span>
          </Link>

          <nav className="flex items-center gap-1">
            {NAV.map((item) => (
              <AdminNavLink key={item.href} {...item} />
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <Link
              href="/"
              target="_blank"
              rel="noreferrer"
              className="hidden items-center gap-1.5 text-xs text-text-muted transition-colors hover:text-text sm:flex"
            >
              View site
              <SquareArrowOutUpRight aria-hidden className="size-3" />
            </Link>

            <span className="hidden text-xs text-text-muted sm:inline">
              {session.name}
              {session.role === "owner" ? " · owner" : ""}
            </span>

            <form action={logout}>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-text-muted transition-colors hover:bg-surface-sunken hover:text-text"
              >
                <LogOut aria-hidden className="size-3.5" />
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
