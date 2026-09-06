import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Container } from "@/components/ui/layout";
import { CONTACT, telHref } from "@/lib/contact";

export { CONTACT };

const COLUMNS = [
  {
    title: "Vehicles",
    links: [
      { href: "/vehicles", label: "All stock" },
      { href: "/vehicles?type=SUV", label: "SUVs" },
      { href: "/vehicles?type=Pickup", label: "Pickups" },
      { href: "/auctions", label: "Auctions" },
    ],
  },
  {
    title: "Services",
    links: [
      { href: "/import", label: "Vehicle import" },
      { href: "/export", label: "Vehicle export" },
      { href: "/clearing", label: "Clearing & forwarding" },
      { href: "/finance", label: "Financing" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About us" },
      { href: "/contact", label: "Contact" },
      { href: "/terms", label: "Terms" },
      { href: "/privacy", label: "Privacy" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-graphite-950 text-graphite-300">
      <Container className="py-14">
        <div className="grid gap-10 lg:grid-cols-[1.5fr_repeat(3,1fr)]">
          <div>
            <Logo size="md" variant="dark" />
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-graphite-400">
              Premium vehicle import, export and sales, based in Kampala and
              serving all of Uganda.
            </p>

            <ul className="mt-6 space-y-2.5 text-sm">
              <li className="flex items-start gap-2.5">
                <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-red-500" />
                <span className="text-graphite-400">{CONTACT.address}</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Phone aria-hidden className="mt-0.5 size-4 shrink-0 text-red-500" />
                <span className="flex flex-col gap-0.5">
                  {CONTACT.phones.map((p) => (
                    <a
                      key={p}
                      href={telHref(p)}
                      className="tabular text-graphite-300 hover:text-graphite-0"
                    >
                      {p}
                    </a>
                  ))}
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <Mail aria-hidden className="mt-0.5 size-4 shrink-0 text-red-500" />
                <a
                  href={`mailto:${CONTACT.email}`}
                  className="break-all text-graphite-300 hover:text-graphite-0"
                >
                  {CONTACT.email}
                </a>
              </li>
            </ul>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h2 className="eyebrow text-graphite-0">{col.title}</h2>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-sm text-graphite-400 transition-colors hover:text-graphite-0"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-graphite-800 pt-6 text-xs text-graphite-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Ayyan Motors Ltd. All rights reserved.</p>
          <p className="tabular">{CONTACT.hours.join(" · ")}</p>
        </div>
      </Container>
    </footer>
  );
}
