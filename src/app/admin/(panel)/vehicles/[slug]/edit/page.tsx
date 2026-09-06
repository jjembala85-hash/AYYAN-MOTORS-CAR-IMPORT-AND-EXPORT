import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, SquareArrowOutUpRight, Trash2 } from "lucide-react";
import { deleteVehicle, updateVehicle } from "@/admin/actions/vehicles";
import { getVehicleForEdit } from "@/admin/queries";
import { PhotoManager } from "@/admin/components/photo-manager";
import { VehicleForm } from "@/admin/components/vehicle-form";
import { Button } from "@/components/ui/button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const row = await getVehicleForEdit(slug);
  return { title: row ? `Edit ${row.vehicle.title}` : "Edit vehicle" };
}

export default async function EditVehiclePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { slug } = await params;
  const { created } = await searchParams;

  const row = await getVehicleForEdit(slug);
  if (!row) notFound();

  const { vehicle, engine, makeName, modelName, media } = row;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start gap-4">
        <div>
          <Link
            href="/admin/vehicles"
            className="inline-flex items-center gap-1 text-sm text-text-muted transition-colors hover:text-text"
          >
            <ChevronLeft aria-hidden className="size-4" />
            Vehicles
          </Link>

          <h1 className="mt-2 font-[family-name:var(--font-archivo)] text-2xl font-extrabold tracking-tight">
            {vehicle.title}
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            {makeName} · {vehicle.modelYear} · /{vehicle.slug}
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href={`/vehicles/${vehicle.slug}`} target="_blank" rel="noreferrer">
              View on site
              <SquareArrowOutUpRight aria-hidden className="size-3.5" />
            </Link>
          </Button>
        </div>
      </div>

      {created ? (
        <p
          role="status"
          className="rounded-md border border-emerald-500/40 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300"
        >
          Listing created. Add its photos below — the first one becomes the cover.
        </p>
      ) : null}

      {/* Photos first: on a newly created listing that is the next thing to do,
          and on an existing one it is what people come back to change. */}
      <section>
        <h2 className="mb-3 font-[family-name:var(--font-archivo)] text-sm font-bold tracking-tight">
          Photos
        </h2>
        <PhotoManager vehicleId={vehicle.id} photos={media} />
      </section>

      <section>
        <h2 className="mb-3 font-[family-name:var(--font-archivo)] text-sm font-bold tracking-tight">
          Details
        </h2>

        <VehicleForm
          action={updateVehicle}
          submitLabel="Save changes"
          defaults={{
            id: vehicle.id,
            title: vehicle.title,
            slug: vehicle.slug,
            make: makeName,
            model: modelName,
            modelYear: String(vehicle.modelYear),
            chassisNumber: vehicle.chassisNumber ?? "",
            vin: vehicle.vin ?? "",
            engineNumber: vehicle.engineNumber ?? "",
            registrationNumber: vehicle.registrationNumber ?? "",
            bodyType: vehicle.bodyType ?? "",
            condition: vehicle.condition,
            steering: vehicle.steering,
            transmission: vehicle.transmission ?? "",
            driveType: vehicle.driveType ?? "",
            fuelType: vehicle.fuelType ?? "",
            mileageKm: vehicle.mileageKm?.toString() ?? "",
            mileageVerified: vehicle.mileageVerified,
            exteriorColor: vehicle.exteriorColor ?? "",
            interiorColor: vehicle.interiorColor ?? "",
            doors: vehicle.doors?.toString() ?? "",
            seats: vehicle.seats?.toString() ?? "",
            // Minor units back to the major units a person types. Integer
            // division would drop the cents, so divide and let toString keep
            // whatever precision is actually there.
            price: vehicle.priceMinor === null ? "" : (vehicle.priceMinor / 100).toString(),
            priceCurrency: vehicle.priceCurrency ?? "",
            pricingType: vehicle.pricingType,
            status: vehicle.status,
            isFeatured: vehicle.isFeatured,
            isAuction: vehicle.isAuction,
            description: vehicle.description ?? "",
            engineCode: engine?.engineCode ?? "",
            displacementCc: engine?.displacementCc?.toString() ?? "",
            cylinders: engine?.cylinders?.toString() ?? "",
            aspiration: engine?.aspiration ?? "",
            powerHp: engine?.powerHp?.toString() ?? "",
            torqueNm: engine?.torqueNm?.toString() ?? "",
          }}
        />
      </section>

      <section className="rounded-lg border border-line bg-surface p-5">
        <h2 className="font-[family-name:var(--font-archivo)] text-sm font-bold tracking-tight">
          Delete this listing
        </h2>
        <p className="mt-1 max-w-prose text-sm text-text-muted">
          This cannot be undone, and it also destroys the photos, the auction sheet and any
          inspection report attached to this vehicle. To take a listing off the site while
          keeping its records, set its status to <strong>Archived</strong> instead.
        </p>

        <form action={deleteVehicle} className="mt-4">
          <input type="hidden" name="id" value={vehicle.id} />
          <Button type="submit" variant="danger" size="sm">
            <Trash2 aria-hidden className="size-3.5" />
            Delete permanently
          </Button>
        </form>
      </section>
    </div>
  );
}
