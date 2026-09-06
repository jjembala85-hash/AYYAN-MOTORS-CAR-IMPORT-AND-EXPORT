"use client";

import { useActionState, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { Save } from "lucide-react";
import {
  ASPIRATIONS,
  BODY_TYPES,
  CONDITIONS,
  CURRENCIES,
  DRIVE_TYPES,
  FUEL_TYPES,
  type Option,
  PRICING_TYPES,
  STATUSES,
  STEERING,
  TRANSMISSIONS,
} from "@/admin/options";
import type { FormState } from "@/admin/schemas/vehicle";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";

/**
 * The add/edit form for a listing.
 *
 * One component for both, because the two differ only in which action they post
 * to and whether the fields start filled. Keeping them separate would guarantee
 * they drift — a field added to "new" and forgotten in "edit" is invisible until
 * someone notices data going missing on save.
 *
 * Every field is a plain uncontrolled input with a `defaultValue`. React state
 * per field would buy nothing here: the server is the validator, and on a
 * rejected submit the action echoes back what was typed, which becomes the new
 * `defaultValue` via the `key` on the form.
 */

export interface VehicleFormDefaults {
  id?: string;
  [key: string]: string | boolean | undefined;
}

function OptionalSelect({
  options,
  placeholder,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  options: Option[];
  placeholder: string;
  invalid?: boolean;
}) {
  return (
    <Select {...props}>
      {/* An explicit empty option, so "not recorded" is a choice the operator
          makes rather than whatever happens to be first in the list. */}
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}

function Fieldset({
  legend,
  hint,
  children,
  columns = 2,
}: {
  legend: string;
  hint?: string;
  children: React.ReactNode;
  columns?: 1 | 2 | 3;
}) {
  return (
    <fieldset className="rounded-lg border border-line bg-surface p-5">
      <legend className="px-1 font-[family-name:var(--font-archivo)] text-sm font-bold tracking-tight">
        {legend}
      </legend>
      {hint ? <p className="mb-4 text-xs text-text-subtle">{hint}</p> : <div className="mb-4" />}
      <div
        className={
          columns === 1
            ? "grid gap-4"
            : columns === 3
              ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              : "grid gap-4 sm:grid-cols-2"
        }
      >
        {children}
      </div>
    </fieldset>
  );
}

function Checkbox({
  name,
  label,
  hint,
  defaultChecked,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultChecked?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-2.5">
      <input
        id={id}
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        className="mt-0.5 size-4 rounded border-line-strong text-brand focus:ring-2 focus:ring-[var(--brand-ring)]"
      />
      <div>
        <label htmlFor={id} className="text-sm text-text">
          {label}
        </label>
        {hint ? <p className="text-xs text-text-subtle">{hint}</p> : null}
      </div>
    </div>
  );
}

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Save aria-hidden className="size-4" />
      {pending ? "Saving…" : label}
    </Button>
  );
}

export function VehicleForm({
  action,
  defaults,
  submitLabel,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaults: VehicleFormDefaults;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const [pricingType, setPricingType] = useState(
    String(defaults.pricingType ?? "on_request"),
  );

  // Values the operator just typed win over what was loaded from the database,
  // so a rejected save redisplays their work rather than reverting it.
  const value = (name: string) =>
    state.values?.[name] ?? (defaults[name] as string | undefined) ?? "";
  const checked = (name: string) =>
    state.values ? state.values[name] === "on" : Boolean(defaults[name]);
  const error = (name: string) => state.errors?.[name]?.[0];

  const priceNeeded = pricingType !== "on_request";

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}

      {state.message ? (
        <p
          role="alert"
          className={
            state.ok
              ? "rounded-md border border-emerald-500/40 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300"
              : "rounded-md border border-brand/40 bg-brand/5 px-3 py-2 text-sm text-brand"
          }
        >
          {state.message}
        </p>
      ) : null}

      <Fieldset
        legend="Identity"
        hint="What this unit is, and how it is told apart from another of the same model."
      >
        <Field
          label="Listing title"
          htmlFor="title"
          error={error("title")}
          hint="Shown as the heading, e.g. “Toyota Hilux Revo”."
          className="sm:col-span-2"
        >
          <Input id="title" name="title" defaultValue={value("title")} required invalid={Boolean(error("title"))} />
        </Field>

        <Field label="Make" htmlFor="make" error={error("make")} hint="Created automatically if new.">
          <Input id="make" name="make" defaultValue={value("make")} required list="make-suggestions" invalid={Boolean(error("make"))} />
        </Field>

        <Field label="Model" htmlFor="model" error={error("model")} hint="e.g. “Hilux Revo”, “Fortuner GR Sport”.">
          <Input id="model" name="model" defaultValue={value("model")} required invalid={Boolean(error("model"))} />
        </Field>

        <Field label="Model year" htmlFor="modelYear" error={error("modelYear")}>
          <Input
            id="modelYear"
            name="modelYear"
            type="number"
            inputMode="numeric"
            defaultValue={value("modelYear")}
            required
            invalid={Boolean(error("modelYear"))}
          />
        </Field>

        <Field
          label="Web address"
          htmlFor="slug"
          error={error("slug")}
          hint="Leave blank to generate from the title. Changing it breaks existing links."
        >
          <Input id="slug" name="slug" defaultValue={value("slug")} placeholder="toyota-hilux-revo-2021" invalid={Boolean(error("slug"))} />
        </Field>

        <Field
          label="Chassis number"
          htmlFor="chassisNumber"
          error={error("chassisNumber")}
          hint="Japanese and Thai imports usually have this and no VIN."
        >
          <Input id="chassisNumber" name="chassisNumber" defaultValue={value("chassisNumber")} placeholder="KDH201-0123456" invalid={Boolean(error("chassisNumber"))} />
        </Field>

        <Field label="VIN" htmlFor="vin" error={error("vin")} hint="17 characters. Leave blank if the unit has none.">
          <Input id="vin" name="vin" defaultValue={value("vin")} maxLength={17} className="uppercase" invalid={Boolean(error("vin"))} />
        </Field>

        <Field label="Engine number" htmlFor="engineNumber" error={error("engineNumber")}>
          <Input id="engineNumber" name="engineNumber" defaultValue={value("engineNumber")} />
        </Field>

        <Field label="Registration number" htmlFor="registrationNumber" error={error("registrationNumber")}>
          <Input id="registrationNumber" name="registrationNumber" defaultValue={value("registrationNumber")} />
        </Field>
      </Fieldset>

      <Fieldset legend="Specification" columns={3}>
        <Field label="Body type" htmlFor="bodyType" error={error("bodyType")}>
          <OptionalSelect id="bodyType" name="bodyType" options={BODY_TYPES} placeholder="Not recorded" defaultValue={value("bodyType")} />
        </Field>

        <Field label="Condition" htmlFor="condition" error={error("condition")}>
          <Select id="condition" name="condition" defaultValue={value("condition") || "used"}>
            {CONDITIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </Field>

        <Field label="Steering" htmlFor="steering" error={error("steering")}>
          <Select id="steering" name="steering" defaultValue={value("steering") || "right"}>
            {STEERING.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </Field>

        <Field label="Transmission" htmlFor="transmission" error={error("transmission")}>
          <OptionalSelect id="transmission" name="transmission" options={TRANSMISSIONS} placeholder="Not recorded" defaultValue={value("transmission")} />
        </Field>

        <Field label="Drive" htmlFor="driveType" error={error("driveType")}>
          <OptionalSelect id="driveType" name="driveType" options={DRIVE_TYPES} placeholder="Not recorded" defaultValue={value("driveType")} />
        </Field>

        <Field label="Fuel" htmlFor="fuelType" error={error("fuelType")}>
          <OptionalSelect id="fuelType" name="fuelType" options={FUEL_TYPES} placeholder="Not recorded" defaultValue={value("fuelType")} />
        </Field>

        <Field label="Mileage (km)" htmlFor="mileageKm" error={error("mileageKm")}>
          <Input id="mileageKm" name="mileageKm" type="number" inputMode="numeric" defaultValue={value("mileageKm")} invalid={Boolean(error("mileageKm"))} />
        </Field>

        <Field label="Exterior colour" htmlFor="exteriorColor" error={error("exteriorColor")}>
          <Input id="exteriorColor" name="exteriorColor" defaultValue={value("exteriorColor")} />
        </Field>

        <Field label="Interior colour" htmlFor="interiorColor" error={error("interiorColor")}>
          <Input id="interiorColor" name="interiorColor" defaultValue={value("interiorColor")} />
        </Field>

        <Field label="Doors" htmlFor="doors" error={error("doors")}>
          <Input id="doors" name="doors" type="number" inputMode="numeric" defaultValue={value("doors")} />
        </Field>

        <Field label="Seats" htmlFor="seats" error={error("seats")}>
          <Input id="seats" name="seats" type="number" inputMode="numeric" defaultValue={value("seats")} />
        </Field>

        <div className="flex items-center sm:col-span-2 lg:col-span-1">
          <Checkbox
            name="mileageVerified"
            label="Odometer verified"
            hint="Only tick if it has actually been checked against a document."
            defaultChecked={checked("mileageVerified")}
          />
        </div>
      </Fieldset>

      <Fieldset legend="Engine" hint="All optional — leave the whole section blank if the detail is unknown." columns={3}>
        <Field label="Engine code" htmlFor="engineCode" error={error("engineCode")} hint="e.g. 2GD-FTV">
          <Input id="engineCode" name="engineCode" defaultValue={value("engineCode")} />
        </Field>

        <Field label="Displacement (cc)" htmlFor="displacementCc" error={error("displacementCc")}>
          <Input id="displacementCc" name="displacementCc" type="number" inputMode="numeric" defaultValue={value("displacementCc")} placeholder="2800" invalid={Boolean(error("displacementCc"))} />
        </Field>

        <Field label="Cylinders" htmlFor="cylinders" error={error("cylinders")}>
          <Input id="cylinders" name="cylinders" type="number" inputMode="numeric" defaultValue={value("cylinders")} />
        </Field>

        <Field label="Aspiration" htmlFor="aspiration" error={error("aspiration")}>
          <OptionalSelect id="aspiration" name="aspiration" options={ASPIRATIONS} placeholder="Not recorded" defaultValue={value("aspiration")} />
        </Field>

        <Field label="Power (hp)" htmlFor="powerHp" error={error("powerHp")}>
          <Input id="powerHp" name="powerHp" type="number" inputMode="numeric" defaultValue={value("powerHp")} />
        </Field>

        <Field label="Torque (Nm)" htmlFor="torqueNm" error={error("torqueNm")}>
          <Input id="torqueNm" name="torqueNm" type="number" inputMode="numeric" defaultValue={value("torqueNm")} />
        </Field>
      </Fieldset>

      <Fieldset legend="Price and visibility">
        <Field label="Pricing" htmlFor="pricingType" error={error("pricingType")}>
          <Select
            id="pricingType"
            name="pricingType"
            value={pricingType}
            onChange={(e) => setPricingType(e.target.value)}
          >
            {PRICING_TYPES.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </Field>

        <Field label="Status" htmlFor="status" error={error("status")}>
          <Select id="status" name="status" defaultValue={value("status") || "draft"}>
            {STATUSES.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </Field>

        <Field
          label="Price"
          htmlFor="price"
          error={error("price")}
          hint={priceNeeded ? "Amount only — no symbols or separators." : "Not needed for “Price on request”."}
        >
          <Input
            id="price"
            name="price"
            type="number"
            step="0.01"
            inputMode="decimal"
            defaultValue={value("price")}
            disabled={!priceNeeded}
            placeholder={priceNeeded ? "25000" : "—"}
            invalid={Boolean(error("price"))}
          />
        </Field>

        <Field label="Currency" htmlFor="priceCurrency" error={error("priceCurrency")}>
          <OptionalSelect
            id="priceCurrency"
            name="priceCurrency"
            options={CURRENCIES}
            placeholder="—"
            defaultValue={value("priceCurrency")}
            disabled={!priceNeeded}
            invalid={Boolean(error("priceCurrency"))}
          />
        </Field>

        <div className="flex flex-col gap-3 sm:col-span-2">
          <Checkbox
            name="isFeatured"
            label="Feature on the homepage"
            hint="Only photographs good enough to lead a page should be featured."
            defaultChecked={checked("isFeatured")}
          />
          <Checkbox
            name="isAuction"
            label="This unit is going to auction"
            defaultChecked={checked("isAuction")}
          />
        </div>
      </Fieldset>

      <Fieldset legend="Description" columns={1}>
        <Field label="Description" htmlFor="description" srOnlyLabel error={error("description")}>
          <Textarea
            id="description"
            name="description"
            rows={6}
            defaultValue={value("description")}
            placeholder="Condition, service history, extras fitted, anything a buyer would ask about."
          />
        </Field>
      </Fieldset>

      <div className="flex items-center gap-3">
        <SaveButton label={submitLabel} />
        <p className="text-xs text-text-subtle">
          Saving a listing set to <strong>Active</strong> publishes it to the public site immediately.
        </p>
      </div>
    </form>
  );
}
