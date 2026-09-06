import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createVehicle } from "@/admin/actions/vehicles";
import { VehicleForm } from "@/admin/components/vehicle-form";
import { requireAdminPage } from "@/admin/auth";

export const metadata: Metadata = { title: "Add a vehicle" };

export default async function NewVehiclePage() {
  await requireAdminPage();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/vehicles"
          className="inline-flex items-center gap-1 text-sm text-text-muted transition-colors hover:text-text"
        >
          <ChevronLeft aria-hidden className="size-4" />
          Vehicles
        </Link>

        <h1 className="mt-2 font-[family-name:var(--font-archivo)] text-2xl font-extrabold tracking-tight">
          Add a vehicle
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Photos are added after saving — the listing has to exist before images can
          attach to it. It saves as a draft unless you set the status to Active.
        </p>
      </div>

      <VehicleForm
        action={createVehicle}
        submitLabel="Save and add photos"
        defaults={{
          condition: "used",
          steering: "right",
          pricingType: "on_request",
          status: "draft",
          modelYear: String(new Date().getFullYear()),
        }}
      />
    </div>
  );
}
