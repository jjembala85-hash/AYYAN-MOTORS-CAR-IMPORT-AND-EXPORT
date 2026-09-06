import type { Metadata } from "next";
import Image from "next/image";
import {
  ArrowRight,
  Calendar,
  Fuel,
  Gauge,
  Heart,
  Ship,
  Settings2,
  Trash2,
} from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardBody,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, Input, SearchInput, Select, Textarea } from "@/components/ui/field";
import { Container, Divider, Section, SectionHeading } from "@/components/ui/layout";
import { VehicleCardSkeleton } from "@/components/ui/skeleton";
import { Price, SpecGrid, SpecItem } from "@/components/ui/spec";
import { VehicleCard } from "@/components/vehicle/vehicle-card";
import { db } from "@/server/db";
import { heroGradeVehicles, listVehicles } from "@/server/catalog/queries";
import { Demo, Rule, Spec, Swatch, SwatchGrid } from "./_components/showcase";

export const metadata: Metadata = { title: "Design system" };

const NAV = [
  ["foundations", "Foundations"],
  ["colour", "Colour"],
  ["type", "Typography"],
  ["buttons", "Buttons"],
  ["badges", "Badges"],
  ["forms", "Forms"],
  ["cards", "Cards"],
  ["specs", "Specs & price"],
  ["vehicle", "Vehicle card"],
  ["sections", "Sections"],
  ["shell", "App shell"],
] as const;

export default async function DesignSystemPage() {
  const [featured, all] = await Promise.all([
    heroGradeVehicles(db, 6),
    listVehicles(db),
  ]);
  const sample = featured[0];

  return (
    <div className="min-h-dvh bg-canvas">
      <SiteHeader />

      {/* ---------------------------------------------------------------- */}
      <Section spacing="lg" className="border-b border-line">
        <Container>
          <p className="eyebrow flex items-center gap-2 text-brand">
            <span aria-hidden className="h-px w-6 bg-brand" />
            Ayyan Motors Ltd
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-extrabold leading-[1.05] sm:text-6xl">
            Design system
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-text-muted">
            The tokens, primitives and patterns the Ayyan Motors web app is built
            from. Colours are sampled from the logo; every component works in both
            themes — use the toggle in the header to check.
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            {NAV.map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                className="rounded-md border border-line bg-surface px-3 py-1.5 font-display text-xs font-semibold text-text-muted transition-colors hover:border-line-strong hover:text-text"
              >
                {label}
              </a>
            ))}
          </div>
        </Container>
      </Section>

      <Container className="space-y-14 py-14">
        {/* -------------------------------------------------------------- */}
        <Spec
          id="foundations"
          title="Foundations"
          description="Brand marks, radii, elevation and motion. The logo ships in two variants because the original artwork has a solid white background that breaks on dark surfaces."
        >
          <Demo label="Logo" className="gap-8">
            <div className="rounded-lg border border-line bg-graphite-50 p-8">
              <Logo size="lg" variant="light" />
            </div>
            <div className="rounded-lg border border-line bg-graphite-950 p-8">
              <Logo size="lg" variant="dark" />
            </div>
            <div className="rounded-lg border border-line bg-surface p-8">
              <Logo size="md" withWordmark />
            </div>
          </Demo>

          <Demo
            label="Radius"
            note="Tight and mechanical. Pills are reserved for badges; nothing else is fully rounded."
          >
            {(["xs", "sm", "md", "lg", "xl", "2xl"] as const).map((r) => (
              <div key={r} className="text-center">
                <div
                  className="size-16 border border-line-strong bg-surface-sunken"
                  style={{ borderRadius: `var(--radius-${r})` }}
                />
                <p className="mt-2 font-mono text-[0.6875rem] text-text-subtle">{r}</p>
              </div>
            ))}
          </Demo>

          <Demo label="Elevation">
            {(["sm", "md", "lg"] as const).map((s) => (
              <div key={s} className="text-center">
                <div
                  className="grid size-24 place-items-center rounded-lg border border-line bg-surface font-mono text-[0.6875rem] text-text-subtle"
                  style={{ boxShadow: `var(--shadow-${s})` }}
                >
                  {s}
                </div>
              </div>
            ))}
          </Demo>

          <div className="grid gap-3 sm:grid-cols-2">
            <Rule kind="do">
              Use one accent per screen. Red marks the single most important
              action.
            </Rule>
            <Rule kind="dont">
              Tint large surfaces red. It reads as an error state, not as brand.
            </Rule>
          </div>
        </Spec>

        {/* -------------------------------------------------------------- */}
        <Spec
          id="colour"
          title="Colour"
          description="Semantic tokens only in components — never a raw palette value. The aliases below re-resolve in dark mode, so a component written against them needs no dark: variants."
        >
          <Demo label="Surfaces & text">
            <SwatchGrid>
              <Swatch token="--canvas" name="canvas" usage="Page background" border />
              <Swatch token="--surface" name="surface" usage="Cards, panels" border />
              <Swatch token="--surface-sunken" name="surface-sunken" usage="Wells, placeholders" />
              <Swatch token="--text" name="text" usage="Body copy" />
              <Swatch token="--text-muted" name="text-muted" usage="Secondary" />
              <Swatch token="--text-subtle" name="text-subtle" usage="Labels, hints" />
            </SwatchGrid>
          </Demo>

          <Demo label="Brand & status">
            <SwatchGrid>
              <Swatch token="--brand" name="brand" usage="Primary action" />
              <Swatch token="--brand-hover" name="brand-hover" usage="Hover" />
              <Swatch token="--brand-subtle" name="brand-subtle" usage="Tinted background" border />
              <Swatch token="--success" name="success" usage="Available, verified" />
              <Swatch token="--warning" name="warning" usage="Reserved, ending soon" />
              <Swatch token="--info" name="info" usage="In transit" />
            </SwatchGrid>
          </Demo>

          <Demo
            label="Signal red — full ramp"
            note="Brand red is #E02222 (600). In dark mode the brand alias shifts up to 500 — the 600 vibrates against near-black."
          >
            <SwatchGrid>
              {(["300", "400", "500", "600", "700", "900"] as const).map((s) => (
                <Swatch key={s} token={`--red-${s}`} name={`red-${s}`} />
              ))}
            </SwatchGrid>
          </Demo>

          <Demo label="Graphite — full ramp">
            <SwatchGrid>
              {(["100", "300", "500", "700", "900", "950"] as const).map((s) => (
                <Swatch key={s} token={`--graphite-${s}`} name={`graphite-${s}`} />
              ))}
            </SwatchGrid>
          </Demo>
        </Spec>

        {/* -------------------------------------------------------------- */}
        <Spec
          id="type"
          title="Typography"
          description="Archivo for headings — heavy and slightly condensed, echoing the logo's wordmark. Inter for everything else. Numbers in specs and prices use tabular figures so they align in columns."
        >
          <div className="space-y-6 rounded-lg border border-line bg-surface p-7">
            <div>
              <p className="eyebrow mb-2 text-text-subtle">Display / 48–60 · Archivo 800</p>
              <p className="font-display text-5xl font-extrabold leading-[1.05] tracking-tight">
                Import with confidence
              </p>
            </div>
            <Divider />
            <div>
              <p className="eyebrow mb-2 text-text-subtle">Heading 2 / 30 · Archivo 800</p>
              <p className="font-display text-3xl font-extrabold tracking-tight">
                Available stock in Kampala
              </p>
            </div>
            <Divider />
            <div>
              <p className="eyebrow mb-2 text-text-subtle">Heading 3 / 18 · Archivo 700</p>
              <p className="font-display text-lg font-bold">Toyota Hilux Revo</p>
            </div>
            <Divider />
            <div>
              <p className="eyebrow mb-2 text-text-subtle">Body / 16 · Inter 400</p>
              <p className="max-w-2xl leading-relaxed text-text-muted">
                Ayyan Motors Ltd handles vehicle import, export, sales and auction
                bidding from Rubaga Road, Kampala. We clear, forward and register
                units for buyers across Uganda and the wider region.
              </p>
            </div>
            <Divider />
            <div>
              <p className="eyebrow mb-2 text-text-subtle">Eyebrow / 11 · Archivo 600 · 0.12em</p>
              <p className="eyebrow text-brand">Featured stock</p>
            </div>
            <Divider />
            <div>
              <p className="eyebrow mb-2 text-text-subtle">Tabular numerals</p>
              <div className="tabular space-y-0.5 font-display text-lg font-bold">
                <p>140,280 km</p>
                <p>80,000 km</p>
                <p>11,900 km</p>
              </div>
            </div>
          </div>
        </Spec>

        {/* -------------------------------------------------------------- */}
        <Spec
          id="buttons"
          title="Buttons"
          description="Six variants across four sizes. Only one primary per view — it is the red one, and red is otherwise reserved."
        >
          <Demo label="Variants">
            <Button variant="primary">Request a quote</Button>
            <Button variant="secondary">View details</Button>
            <Button variant="ghost">Compare</Button>
            <Button variant="inverse">Book inspection</Button>
            <Button variant="danger">
              <Trash2 aria-hidden />
              Remove
            </Button>
            <Button variant="link">See all stock</Button>
          </Demo>

          <Demo label="Sizes">
            <Button size="sm" variant="primary">Small</Button>
            <Button size="md" variant="primary">Medium</Button>
            <Button size="lg" variant="primary">Large</Button>
            <Button size="icon" variant="secondary" aria-label="Save to shortlist">
              <Heart />
            </Button>
            <Button size="icon-sm" variant="ghost" aria-label="Save to shortlist">
              <Heart />
            </Button>
          </Demo>

          <Demo label="With icons">
            <Button variant="primary">
              Start an import
              <ArrowRight aria-hidden />
            </Button>
            <Button variant="secondary">
              <Ship aria-hidden />
              Track shipment
            </Button>
          </Demo>

          <Demo label="States">
            <Button variant="primary" disabled>Disabled</Button>
            <Button variant="secondary" disabled>Disabled</Button>
            <Button variant="primary" full className="max-w-xs">Full width</Button>
          </Demo>

          <div className="grid gap-3 sm:grid-cols-2">
            <Rule kind="do">
              Give icon-only buttons an <code className="font-mono">aria-label</code>.
            </Rule>
            <Rule kind="dont">
              Put two primary buttons side by side — the eye loses the real action.
            </Rule>
          </div>
        </Spec>

        {/* -------------------------------------------------------------- */}
        <Spec
          id="badges"
          title="Badges"
          description="Short status labels. Overlay is for placing over a photo, where it gets a scrim and blur so it survives any background."
        >
          <Demo label="Variants">
            <Badge>Used</Badge>
            <Badge variant="brand">New</Badge>
            <Badge variant="brand-subtle">Featured</Badge>
            <Badge variant="success">Available</Badge>
            <Badge variant="warning">Reserved</Badge>
            <Badge variant="info">In transit</Badge>
            <Badge variant="outline">4×4</Badge>
          </Demo>

          <Demo label="Overlay — on a photo">
            <div className="relative h-40 w-72 overflow-hidden rounded-lg">
              <Image
                src={sample.cover?.url ?? ""}
                alt=""
                fill
                sizes="288px"
                className="object-cover"
              />
              <div className="absolute left-3 top-3 flex gap-1.5">
                <Badge variant="overlay">Auction</Badge>
                <Badge variant="brand">New</Badge>
              </div>
            </div>
          </Demo>
        </Spec>

        {/* -------------------------------------------------------------- */}
        <Spec
          id="forms"
          title="Forms"
          description="One control height (40px), one focus treatment, one error colour. Field wraps label, control and hint so spacing never drifts between forms."
        >
          <div className="grid max-w-4xl gap-5 rounded-lg border border-line bg-surface p-7 sm:grid-cols-2">
            <Field label="Search stock" htmlFor="q" className="sm:col-span-2">
              <SearchInput id="q" placeholder="Try “Hilux” or “Land Cruiser”" />
            </Field>

            <Field label="Full name" htmlFor="name">
              <Input id="name" placeholder="Your name" />
            </Field>

            <Field label="Phone" htmlFor="phone" hint="We reply on WhatsApp.">
              <Input id="phone" type="tel" placeholder="+256 7XX XXX XXX" />
            </Field>

            <Field label="Body type" htmlFor="body">
              <Select id="body" defaultValue="">
                <option value="" disabled>Select a type</option>
                <option>SUV</option>
                <option>Pickup</option>
                <option>Sedan</option>
                <option>Convertible</option>
              </Select>
            </Field>

            <Field label="Budget (USD)" htmlFor="budget" error="Enter a whole number.">
              <Input id="budget" defaultValue="25,00" invalid />
            </Field>

            <Field label="Message" htmlFor="msg" className="sm:col-span-2">
              <Textarea id="msg" placeholder="Tell us what you're looking for…" />
            </Field>

            <Field label="Disabled" htmlFor="dis">
              <Input id="dis" defaultValue="Not editable" disabled />
            </Field>
          </div>
        </Spec>

        {/* -------------------------------------------------------------- */}
        <Spec
          id="cards"
          title="Cards"
          description="A surface with a border and optional elevation. Set interactive only when the whole card is a single link target."
        >
          <div className="grid gap-6 sm:grid-cols-3">
            <Card elevation="flat">
              <CardHeader><CardTitle>Flat</CardTitle></CardHeader>
              <CardBody>
                <CardDescription>
                  Inside an already-elevated container, or in dense lists.
                </CardDescription>
              </CardBody>
            </Card>

            <Card elevation="raised">
              <CardHeader><CardTitle>Raised</CardTitle></CardHeader>
              <CardBody>
                <CardDescription>The default. Used for vehicle cards.</CardDescription>
              </CardBody>
              <CardFooter>
                <Button size="sm" variant="ghost">Action</Button>
              </CardFooter>
            </Card>

            <Card elevation="floating" interactive>
              <CardHeader><CardTitle>Floating + interactive</CardTitle></CardHeader>
              <CardBody>
                <CardDescription>Lifts on hover. Hover to see it.</CardDescription>
              </CardBody>
            </Card>
          </div>
        </Spec>

        {/* -------------------------------------------------------------- */}
        <Spec
          id="specs"
          title="Specs & price"
          description="Vehicle facts and pricing. Most of the current inventory has no published price, so “Price on request” is a designed state — muted and lighter — rather than an empty slot."
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardBody>
                <p className="eyebrow mb-4 text-text-subtle">Spec grid</p>
                <SpecGrid columns={4}>
                  <SpecItem icon={<Calendar />} label="Year" value="2021" />
                  <SpecItem icon={<Gauge />} label="Mileage" value="45,000 km" />
                  <SpecItem icon={<Settings2 />} label="Gearbox" value="Automatic" />
                  <SpecItem icon={<Fuel />} label="Fuel" value="Diesel" />
                </SpecGrid>
              </CardBody>
            </Card>

            <Card>
              <CardBody className="space-y-5">
                <p className="eyebrow text-text-subtle">Price</p>
                <div className="flex flex-wrap items-end gap-6">
                  <div>
                    <p className="eyebrow mb-2 text-text-subtle">Large</p>
                    <Price value={{ minor: 3850000, currency: "USD" }} size="lg" />
                  </div>
                  <div>
                    <p className="eyebrow mb-2 text-text-subtle">Medium</p>
                    <Price value={{ minor: 2490000, currency: "USD" }} size="md" />
                  </div>
                  <div>
                    <p className="eyebrow mb-2 text-text-subtle">Small</p>
                    <Price value={{ minor: 1800000, currency: "USD" }} size="sm" />
                  </div>
                </div>
                <Divider />
                <div>
                  <p className="eyebrow mb-2 text-text-subtle">
                    No price — every listing in the current data
                  </p>
                  <Price value={null} size="lg" />
                </div>
              </CardBody>
            </Card>
          </div>
        </Spec>

        {/* -------------------------------------------------------------- */}
        <Spec
          id="vehicle"
          title="Vehicle card"
          description="The core domain component. Cover photo, status badges, headline, three key specs, price and a stretched link over the whole card. Photos come from the audited set, cropped 4:3."
        >
          <Demo label="Default">
            <div className="grid w-full gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {featured.slice(0, 3).map((v, i) => (
                <VehicleCard key={v.id} vehicle={v} priority={i === 0} />
              ))}
            </div>
          </Demo>

          <Demo label="Compact — for sidebars and related rails">
            <div className="grid w-full gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {all.slice(3, 7).map((v) => (
                <VehicleCard key={v.id} vehicle={v} variant="compact" />
              ))}
            </div>
          </Demo>

          <Demo
            label="Loading"
            note="Skeleton matches the card's geometry so the grid doesn't reflow when data arrives."
          >
            <div className="grid w-full gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <VehicleCardSkeleton />
              <VehicleCardSkeleton />
              <VehicleCardSkeleton />
            </div>
          </Demo>
        </Spec>

        {/* -------------------------------------------------------------- */}
        <Spec
          id="sections"
          title="Sections & headings"
          description="Page rhythm. Section controls vertical spacing and tone; SectionHeading pairs an eyebrow, title, description and an optional trailing action."
        >
          <div className="overflow-hidden rounded-lg border border-line">
            <Section spacing="sm" tone="surface">
              <Container>
                <SectionHeading
                  eyebrow="Featured stock"
                  title="Ready to drive in Kampala"
                  description="Cleared, registered and inspected units available now."
                  action={
                    <Button variant="secondary" size="sm">
                      View all
                      <ArrowRight aria-hidden />
                    </Button>
                  }
                />
              </Container>
            </Section>

            <Section spacing="sm" tone="inverse">
              <Container>
                <SectionHeading
                  align="center"
                  eyebrow="Import service"
                  title="From auction to your gate"
                  description="A dark band breaks up a long page. Tone tokens flip inside it, so the same components work without changes."
                />
              </Container>
            </Section>
          </div>
        </Spec>

        {/* -------------------------------------------------------------- */}
        <Spec
          id="shell"
          title="App shell"
          description="The header is sticky and translucent with a blur; navigation collapses below lg. The footer carries the real contact details from the existing site."
        >
          <p className="text-sm text-text-muted">
            Both are live on this page — the header above, the footer below.
          </p>
        </Spec>
      </Container>

      <SiteFooter />
    </div>
  );
}
