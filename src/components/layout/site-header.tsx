"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, Phone, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/brand/theme-toggle";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/layout";
import { telHref } from "@/lib/contact";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/vehicles", label: "Stock" },
  { href: "/import", label: "Import" },
  { href: "/export", label: "Export" },
  { href: "/auctions", label: "Auctions" },
  { href: "/about", label: "About" },
];

export function SiteHeader() {
  const [open, setOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-canvas/85 backdrop-blur-md">
      <Container>
        <div className="flex h-16 items-center justify-between gap-4">
          <Link href="/" className="flex items-center" aria-label="Ayyan Motors — home">
            <Logo size="sm" withWordmark />
          </Link>

          <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-2 font-display text-sm font-semibold text-text-muted transition-colors hover:bg-surface-sunken hover:text-text"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <Button variant="primary" size="sm" className="hidden sm:inline-flex" asChild>
              <a href={telHref()}>
                <Phone aria-hidden />
                Call us
              </a>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X /> : <Menu />}
            </Button>
          </div>
        </div>
      </Container>

      <div
        id="mobile-nav"
        hidden={!open}
        className={cn("border-t border-line bg-surface lg:hidden")}
      >
        <Container className="flex flex-col py-2">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-3 font-display text-sm font-semibold text-text-muted hover:bg-surface-sunken hover:text-text"
            >
              {item.label}
            </Link>
          ))}
        </Container>
      </div>
    </header>
  );
}
