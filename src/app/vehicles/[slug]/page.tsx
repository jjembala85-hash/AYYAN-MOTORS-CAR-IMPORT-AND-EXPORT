import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronRight,
  Fuel,
  Gauge,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Settings2,
  Truck,
} from "lucide-react";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Container, Section, SectionHeading } from "@/components/ui/layout";
import { Price, SpecGrid, SpecItem } from "@/components/ui/spec";
import { VehicleGrid } from "@/components/vehicle/vehicle-card";
import {
  CONTACT,
  enquiryMessage,
  mailtoHref,
  PRIMARY_PHONE,
  telHref,
  whatsappHref,
} from "@/lib/contact";
import { formatDisplacement, formatMileage, vehicleHeadline } from "@/lib/format";
import type { CatalogVehicleDetail } from "@/lib/catalog";
import { db } from "@/server/db";
import { getVehicleBySlug, relatedVehicles } from "@/server/catalog/cached";
// Uncached: `generateStaticParams` runs once per build, where a cached slug list
// could omit a vehicle added since the last one.
import { listVehicleSlugs } from "@/server/catalog/queries";
import { Gallery } from "./_components/gallery";

export async function generateStaticParams() {
  // Reads the catalogue at build time, so DATABASE_URL must be set for `next build`.
  const slugs = await listVehicleSlugs(db);
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const vehicle = await getVehicleBySlug(db, slug);
  if (!vehicle) return { title: "Vehicle not found" };

  const headline = vehicleHeadline(vehicle);
  const description =
    vehicle.description?.trim() ||
    `${headline} — ${[vehicle.bodyType, vehicle.transmission, vehicle.fuelType, vehicle.driveType]
      .filter(Boolean)
      .join(", ")}. Available from Ayyan Motors Ltd, Kampala.`;

  return {
    title: headline,
    description,
    openGraph: {
      title: headline,
      description,
      images: vehicle.cover ? [vehicle.cover.url] : [],
    },
  };
}

export default async function VehiclePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const vehicle = await getVehicleBySlug(db, slug);
  if (!vehicle) notFound();

  const headline = vehicleHeadline(vehicle);
  const images = [vehicle.cover, ...vehicle.gallery].filter((p) => p !== null);
  const specs = specRows(vehicle);
  const related = await relatedVehicles(db, vehicle);
  const message = enquiryMessage(headline);

  return (
    <div className="min-h-dvh bg-canvas">
      <SiteHeader />

      <Container className="pt-6">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1.5 text-sm text-text-muted">
            <li>
              <Link href="/" className="hover:text-text">
                Home
              </Link>
            </li>
            <ChevronRight aria-hidden className="size-3.5 text-text-subtle" />
            <li>
              <Link href="/vehicles" className="hover:text-text">
                Stock
              </Link>
            </li>
            <ChevronRight aria-hidden className="size-3.5 text-text-subtle" />
            <li aria-current="page" className="font-medium text-text">
              {vehicle.title}
            </li>
          </ol>
        </nav>
      </Container>

      <Section spacing="sm">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
            <Gallery images={images.map((p) => p.url)} title={headline} />

            {/* Sticks alongside the gallery on desktop so the phone number is
                always one glance away. */}
            <div className="lg:sticky lg:top-24">
              <div className="flex flex-wrap items-center gap-2">
                {vehicle.condition && (
                  <Badge variant={vehicle.condition === "New" ? "brand" : "outline"}>
                    {vehicle.condition}
                  </Badge>
                )}
                {vehicle.bodyType && <Badge variant="neutral">{vehicle.bodyType}</Badge>}
                {vehicle.isAuction && <Badge variant="warning">Auction</Badge>}
                {vehicle.isSold && <Badge variant="neutral">Sold</Badge>}
              </div>

              <h1 className="mt-4 font-display text-3xl font-extrabold leading-[1.1] sm:text-4xl">
                {vehicle.title}
              </h1>
              <p className="tabular mt-2 text-sm text-text-muted">
                {vehicle.year} · {vehicle.make}
              </p>

              <div className="mt-6 border-t border-line pt-6">
                <Price value={vehicle.price} size="lg" />
                {!vehicle.price && (
                  <p className="mt-2 text-sm leading-relaxed text-text-muted">
                    {vehicle.pricingType === "negotiable"
                      ? "Negotiable — call for today's figure."
                      : "Call or message for today's figure."}
                  </p>
                )}
              </div>

              <SpecGrid columns={2} className="mt-6 border-t border-line pt-6">
                <SpecItem
                  icon={<Gauge />}
                  label="Mileage"
                  value={formatMileage(vehicle.mileageKm) ?? "—"}
                />
                <SpecItem
                  icon={<Settings2 />}
                  label="Gearbox"
                  value={vehicle.transmission ?? "—"}
                />
                <SpecItem icon={<Fuel />} label="Fuel" value={vehicle.fuelType ?? "—"} />
                <SpecItem
                  icon={<Truck />}
                  label="Drive"
                  value={vehicle.driveType ?? "—"}
                />
              </SpecGrid>

              <div className="mt-7 flex flex-col gap-2.5">
                <Button variant="primary" size="lg" full asChild>
                  <a href={telHref()}>
                    <Phone aria-hidden />
                    Call {PRIMARY_PHONE}
                  </a>
                </Button>
                <Button variant="secondary" size="lg" full asChild>
                  <a
                    href={whatsappHref(message)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle aria-hidden />
                    WhatsApp us
                  </a>
                </Button>
                <Button variant="ghost" size="md" full asChild>
                  <a href={mailtoHref(`Enquiry: ${headline}`, message)}>
                    <Mail aria-hidden />
                    Email an enquiry
                  </a>
                </Button>
              </div>

              <p className="mt-5 flex items-start gap-2.5 text-sm leading-relaxed text-text-muted">
                <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-brand" />
                {CONTACT.address}
              </p>
            </div>
          </div>
        </Container>
      </Section>

      {(vehicle.description || specs.length > 0 || vehicle.features.length > 0) && (
        <Section spacing="md" tone="surface" className="border-y border-line">
          <Container>
            <div className="grid gap-10 lg:grid-cols-2">
              <div className="flex flex-col gap-10">
                {vehicle.description && (
                  <div>
                    <h2 className="font-display text-2xl font-extrabold">Description</h2>
                    <p className="mt-4 whitespace-pre-line text-base leading-relaxed text-text-muted">
                      {vehicle.description}
                    </p>
                  </div>
                )}

                {vehicle.features.length > 0 && (
                  <div>
                    <h2 className="font-display text-2xl font-extrabold">Features</h2>
                    <ul className="mt-4 flex flex-wrap gap-2">
                      {vehicle.features.map((f) => (
                        <li key={f}>
                          <Badge variant="outline" size="md">
                            {f}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {specs.length > 0 && (
                <div>
                  <h2 className="font-display text-2xl font-extrabold">Specification</h2>
                  <Card elevation="flat" className="mt-4">
                    <CardBody className="p-0">
                      <dl className="divide-y divide-[var(--border)]">
                        {specs.map((s) => (
                          <div
                            key={s.label}
                            className="flex flex-wrap items-baseline justify-between gap-3 px-5 py-3.5"
                          >
                            <dt className="eyebrow text-text-subtle">{s.label}</dt>
                            <dd className="tabular max-w-[65%] text-right text-sm font-medium">
                              {s.value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </CardBody>
                  </Card>
                </div>
              )}
            </div>
          </Container>
        </Section>
      )}

      {related.length > 0 && (
        <Section spacing="lg">
          <Container>
            <SectionHeading
              eyebrow="Also on the yard"
              title="Similar vehicles"
              action={
                <Button variant="secondary" size="sm" asChild>
                  <Link href="/vehicles">View all stock</Link>
                </Button>
              }
            />
            <VehicleGrid vehicles={related} className="mt-9" priorityCount={0} />
          </Container>
        </Section>
      )}

      <SiteFooter />
    </div>
  );
}

/**
 * Specs are typed columns now rather than a free-form JSON blob, so the table is
 * assembled explicitly. Empty values are dropped so a sparsely-filled listing
 * doesn't render a column of dashes.
 */
function specRows(v: CatalogVehicleDetail): { label: string; value: string }[] {
  const aspiration: Record<string, string> = {
    natural: "Naturally aspirated",
    turbo: "Turbocharged",
    twin_turbo: "Twin turbo",
    supercharged: "Supercharged",
  };

  return (
    [
      { label: "Engine", value: v.engine?.engineCode },
      { label: "Displacement", value: formatDisplacement(v.engine?.displacementCc) },
      { label: "Cylinders", value: v.engine?.cylinders?.toString() },
      { label: "Aspiration", value: v.engine?.aspiration ? aspiration[v.engine.aspiration] : null },
      { label: "Power", value: v.engine?.powerHp ? `${v.engine.powerHp} hp` : null },
      { label: "Torque", value: v.engine?.torqueNm ? `${v.engine.torqueNm} Nm` : null },
      { label: "Steering", value: v.steering === "right" ? "Right-hand drive" : "Left-hand drive" },
      { label: "Doors", value: v.doors?.toString() },
      { label: "Seats", value: v.seats?.toString() },
      { label: "Exterior", value: v.exteriorColor },
      { label: "Interior", value: v.interiorColor },
      { label: "Chassis no.", value: v.chassisNumber },
      { label: "VIN", value: v.vin },
    ] as { label: string; value: string | null | undefined }[]
  )
    .filter((row): row is { label: string; value: string } => Boolean(row.value))
    .map((row) => ({ label: row.label, value: row.value }));
}
