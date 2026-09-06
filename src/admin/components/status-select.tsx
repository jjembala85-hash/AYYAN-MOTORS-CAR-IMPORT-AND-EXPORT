"use client";

import { useRef } from "react";
import { setVehicleStatus } from "@/admin/actions/vehicles";
import { STATUS_TONE, STATUSES } from "@/admin/options";
import { Select } from "@/components/ui/field";

/**
 * Inline status change from the listing table.
 *
 * A Client Component because it submits on `change` — a separate Save button per
 * row would add a second click to the single most frequent edit in the panel
 * (draft → active, active → sold). The `onChange` handler is the whole reason
 * this is split out of the table, which is otherwise a Server Component.
 *
 * `requestSubmit()` rather than `submit()`: the former runs the form's normal
 * submission path, which is what invokes the Server Action.
 */
export function StatusSelect({
  vehicleId,
  title,
  status,
}: {
  vehicleId: string;
  title: string;
  status: string;
}) {
  const form = useRef<HTMLFormElement>(null);

  return (
    <form ref={form} action={setVehicleStatus}>
      <input type="hidden" name="id" value={vehicleId} />
      <Select
        name="status"
        defaultValue={status}
        aria-label={`Status for ${title}`}
        className={`h-8 w-44 text-xs ${STATUS_TONE[status] ?? ""}`}
        onChange={() => form.current?.requestSubmit()}
      >
        {STATUSES.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </form>
  );
}
