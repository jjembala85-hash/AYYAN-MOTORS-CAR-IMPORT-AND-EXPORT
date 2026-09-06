import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Clock,
  FileCheck2,
  Gavel,
  MapPin,
  MessageCircle,
  Phone,
  Search,
  Ship,
  ShieldCheck,
} from "lucide-react";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardDescription, CardTitle } from "@/components/ui/card";
import { Container, Section, SectionHeading } from "@/components/ui/layout";
import { VehicleGrid } from "@/components/vehicle/vehicle-card";
import { CONTACT, enquiryMessage, PRIMARY_PHONE, telHref, whatsappHref } from "@/lib/contact";
import { db } from "@/server/db";
import { countVehicles, facets, heroGradeVehicles } from "@/server/catalog/cached";

export const metadata: Metadata = {
  title: "Ayyan Motors Ltd — Vehicle import, export and sales in Kampala",
  description:
    "Pickups, SUVs and vans imported, inspected and sold from Rubaga Road, Kampala. Browse what's on the yard today, or tell us what to source.",
};

const SERVICES = [
  {
    icon: Ship,
    title: "Import",
    body: "Tell us the spec and budget. We source at auction, verify the sheet against the car, and handle the shipping.",
  },
  {
    icon: Gavel,
    title: "Auctions",
    body: "Access to overseas auction stock, with the grading sheet translated and checked before you commit to anything.",
  },
  {
    icon: FileCheck2,
    title: "Clearing",
    body: "Customs, duty and registration handled end to end, so the vehicle reaches you road-legal rather than stuck at the port.",
  },
  {
    icon: ShieldCheck,
    title: "Export",
    body: "Selling on to the region. Documentation, inspection and transport arranged from Kampala.",
  },
];

const STEPS = [
  { n: "01", title: "Tell us what you need", body: "Model, budget, timeline. A WhatsApp message is enough to start." },
  { n: "02", title: "We source and inspect", body: "From the yard or from auction, with the condition checked before money moves." },
  { n: "03", title: "Shipping and clearing", body: "Freight, customs and duty handled as one job rather than four separate headaches." },
  { n: "04", title: "Keys in Kampala", body: "Registered, road-legal and handed over at Rubaga Road." },
];

export default async function Home() {
  const [featured, total, available] = await Promise.all([
    heroGradeVehicles(db, 3),
    countVehicles(db),
    facets(db),
  ]);

  /*
   * The hero photo is a real listing, not stock art — the 1920px files in
   * public/hero are AI renders of cars Ayyan does not stock (an S-Class, and an
   * SUV wearing an invented badge), so leading with them would advertise
   * inventory that does not exist.
   *
   * Picked by shape rather than by slug: the widest A-tier cover suits a hero
   * band, and if that vehicle sells the next best one takes over automatically.
   */
  const hero =
    featured.find((v) => v.cover?.width && v.cover.height && v.cover.width / v.cover.height >= 1.5) ??
    featured[0];

  const topTypes = available.types.slice(0, 4);

  return (
    <div className="min-h-dvh bg-canvas">
      <SiteHeader />

      {/* ---------------------------------------------------------------- Hero */}
      <Section spacing="lg">
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div>
              <p className="eyebrow flex items-center gap-2 text-brand">
                <span aria-hidden className="h-px w-6 bg-brand" />
                Kampala · import &amp; export
              </p>
              <h1 className="mt-5 max-w-xl font-display text-4xl font-extrabold leading-[1.03] sm:text-5xl lg:text-6xl">
                The right vehicle,
                <br />
                landed and road-legal.
              </h1>
              <p className="mt-6 max-w-lg text-lg leading-relaxed text-text-muted">
                Ayyan Motors imports, inspects and sells pickups, SUVs and vans from
                Rubaga Road. Browse what&apos;s on the yard today, or tell us what to
                source and we&apos;ll go and find it.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button variant="primary" size="lg" asChild>
                  <Link href="/vehicles">
                    Browse {total} vehicles
                    <ArrowRight aria-hidden />
                  </Link>
                </Button>
                <Button variant="secondary" size="lg" asChild>
                  <a
                    href={whatsappHref("Hello Ayyan Motors, I'm looking for a vehicle.")}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle aria-hidden />
                    WhatsApp us
                  </a>
                </Button>
              </div>

              {/* Every figure here is counted from the catalogue, not asserted. */}
              <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4 border-t border-line pt-6">
                <Stat label="On the yard" value={String(total)} />
                <Stat label="Makes" value={String(available.makes.length)} />
                <Stat
                  label="Model years"
                  value={`${available.years.min}–${available.years.max}`}
                />
              </dl>
            </div>

            {hero?.cover && (
              <div className="relative">
                {/*
                  Framed rather than full-bleed: the library tops out at 1600px on
                  the long edge, and this is 1080. At this size it is sharp; run
                  edge-to-edge and the compression shows.
                */}
                <Link
                  href={`/vehicles/${hero.slug}`}
                  className="group block overflow-hidden rounded-xl border border-line bg-surface-sunken shadow-lg"
                >
                  <div className="relative aspect-[16/9]">
                    <Image
                      src={hero.cover.url}
                      alt={hero.cover.alt ?? `${hero.title} — ${hero.year}`}
                      fill
                      priority
                      sizes="(max-width: 1024px) 100vw, 55vw"
                      className="object-cover transition-transform duration-500 ease-[var(--ease-out-quick)] group-hover:scale-[1.03]"
                    />
                    <div
                      aria-hidden
                      className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-graphite-950/85 to-transparent"
                    />
                    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5">
                      <div>
                        <Badge variant="overlay" size="sm">
                          In stock now
                        </Badge>
                        <p className="mt-2 font-display text-lg font-bold text-graphite-0">
                          {hero.year} {hero.title}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-display text-sm font-semibold text-graphite-0 transition-transform duration-200 group-hover:translate-x-0.5">
                        View
                        <ArrowRight aria-hidden className="size-4" />
                      </span>
                    </div>
                  </div>
                </Link>
              </div>
            )}
          </div>
        </Container>
      </Section>

      {/* -------------------------------------------------------- Browse by type */}
      {topTypes.length > 0 && (
        <Section spacing="md" tone="surface" className="border-y border-line">
          <Container>
            <SectionHeading
              eyebrow="Browse"
              title="Start with a body type"
              action={
                <Button variant="secondary" size="sm" asChild>
                  <Link href="/vehicles">
                    All stock
                    <ArrowRight aria-hidden />
                  </Link>
                </Button>
              }
            />
            <ul className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {topTypes.map((type) => (
                <li key={type.value}>
                  <Link
                    href={`/vehicles?type=${encodeURIComponent(type.value)}`}
                    className="group flex items-center justify-between gap-3 rounded-lg border border-line bg-canvas px-5 py-4 transition-[border-color,box-shadow] duration-200 hover:border-line-strong hover:shadow-md"
                  >
                    <span className="font-display text-base font-bold">{type.value}</span>
                    <span className="tabular flex items-center gap-2 text-sm text-text-muted">
                      {type.count}
                      <ArrowRight
                        aria-hidden
                        className="size-4 text-brand transition-transform duration-200 group-hover:translate-x-0.5"
                      />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Container>
        </Section>
      )}

      {/* ------------------------------------------------------- Featured stock */}
      <Section spacing="lg">
        <Container>
          <SectionHeading
            eyebrow="Latest arrivals"
            title="On the yard now"
            description="Photographed at the yard in Kampala. Prices are quoted on request — call or message and we'll come back the same day."
            action={
              <Button variant="secondary" size="sm" asChild>
                <Link href="/vehicles">
                  See all {total}
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
            }
          />
          <VehicleGrid vehicles={featured} className="mt-9" priorityCount={0} />
        </Container>
      </Section>

      {/* ------------------------------------------------------------- Services */}
      <Section spacing="md" tone="surface" className="border-y border-line">
        <Container>
          <SectionHeading
            eyebrow="What we do"
            title="Sourcing, shipping and paperwork"
            description="Most of the work on an imported vehicle happens before it reaches you. We do that part."
          />
          <div className="mt-9 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {SERVICES.map(({ icon: Icon, title, body }) => (
              <Card key={title} elevation="flat">
                <CardBody>
                  <span className="inline-flex size-10 items-center justify-center rounded-md bg-brand-subtle text-brand-on-subtle">
                    <Icon aria-hidden className="size-5" />
                  </span>
                  <CardTitle className="mt-4">{title}</CardTitle>
                  <CardDescription className="mt-2">{body}</CardDescription>
                </CardBody>
              </Card>
            ))}
          </div>
        </Container>
      </Section>

      {/* --------------------------------------------------------------- Process */}
      <Section spacing="lg">
        <Container>
          <SectionHeading eyebrow="How it works" title="Four steps, one point of contact" />
          <ol className="mt-9 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step) => (
              <li key={step.n} className="border-t-2 border-brand pt-5">
                <p className="tabular font-display text-sm font-extrabold text-brand">
                  {step.n}
                </p>
                <h3 className="mt-2 font-display text-lg font-bold leading-snug">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </Container>
      </Section>

      {/* ------------------------------------------------------------- CTA band */}
      <Section spacing="md" tone="inverse">
        <Container>
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <h2 className="font-display text-2xl font-extrabold sm:text-3xl">
                Looking for something not on the yard?
              </h2>
              <p className="mt-3 text-base leading-relaxed text-graphite-400">
                Tell us the model and budget and we&apos;ll quote you landed, duty
                paid. Most enquiries are answered the same day.
              </p>
              <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-graphite-400">
                <li className="flex items-center gap-2">
                  <MapPin aria-hidden className="size-4 shrink-0 text-red-500" />
                  {CONTACT.address}
                </li>
                <li className="flex items-center gap-2">
                  <Clock aria-hidden className="size-4 shrink-0 text-red-500" />
                  {CONTACT.hours.join(" · ")}
                </li>
              </ul>
            </div>

            <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col">
              <Button variant="primary" size="lg" asChild>
                <a href={telHref()}>
                  <Phone aria-hidden />
                  {PRIMARY_PHONE}
                </a>
              </Button>
              <Button variant="inverse" size="lg" asChild>
                <a
                  href={whatsappHref(enquiryMessage("vehicle you have available"))}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle aria-hidden />
                  Message on WhatsApp
                </a>
              </Button>
              <Button variant="ghost" size="md" asChild>
                <Link href="/vehicles">
                  <Search aria-hidden />
                  Search the stock list
                </Link>
              </Button>
            </div>
          </div>
        </Container>
      </Section>

      <SiteFooter />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="eyebrow text-text-subtle">{label}</dt>
      <dd className="tabular mt-1.5 font-display text-2xl font-extrabold">{value}</dd>
    </div>
  );
}
