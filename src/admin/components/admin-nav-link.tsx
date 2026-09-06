"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Car, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A nav item that knows whether it is the current section.
 *
 * Split into its own Client Component so `AdminShell` — which reads the session
 * — can stay a Server Component. `usePathname` is the only thing that needs the
 * client.
 *
 * The icon is chosen here from a name rather than passed in as a prop: a React
 * component is a function, and functions cannot cross the server→client
 * boundary. Passing `icon={LayoutDashboard}` from the server shell throws
 * "Functions cannot be passed directly to Client Components" at render time.
 */

const ICONS = {
  dashboard: LayoutDashboard,
  car: Car,
} as const;

export type NavIcon = keyof typeof ICONS;

export function AdminNavLink({
  href,
  label,
  icon,
  exact,
}: {
  href: string;
  label: string;
  icon: NavIcon;
  exact: boolean;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname.startsWith(href);
  const Icon = ICONS[icon];

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
        active
          ? "bg-surface-sunken font-medium text-text"
          : "text-text-muted hover:bg-surface-sunken hover:text-text",
      )}
    >
      <Icon aria-hidden className="size-4" />
      {label}
    </Link>
  );
}
