import Link from "next/link";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Container, Section } from "@/components/ui/layout";
import { VehicleGrid } from "@/components/vehicle/vehicle-card";
import { db } from "@/server/db";
import { heroGradeVehicles } from "@/server/catalog/cached";

export default async function NotFound() {
  const suggestions = await heroGradeVehicles(db, 3);

  return (
    <div className="min-h-dvh bg-canvas">
      <SiteHeader />

      <Section spacing="lg">
        <Container>
          <p className="eyebrow flex items-center gap-2 text-brand">
            <span aria-hidden className="h-px w-6 bg-brand" />
            404
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-extrabold leading-[1.05] sm:text-5xl">
            That page isn&apos;t here
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-text-muted">
            The listing may have sold, or the link may be out of date. Everything
            currently on the yard is on the stock page.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button variant="primary" size="lg" asChild>
              <Link href="/vehicles">Browse stock</Link>
            </Button>
            <Button variant="secondary" size="lg" asChild>
              <Link href="/">Back to home</Link>
            </Button>
          </div>

          <VehicleGrid vehicles={suggestions} className="mt-16" priorityCount={0} />
        </Container>
      </Section>

      <SiteFooter />
    </div>
  );
}
