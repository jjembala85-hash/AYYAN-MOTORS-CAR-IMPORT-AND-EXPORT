"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, SearchInput, Select } from "@/components/ui/field";
import {
  SORTS,
  yearOptions,
  type Facet,
  type Facets,
  type SortKey,
  type VehicleQuery,
} from "@/lib/catalog";
import { cn } from "@/lib/utils";

export interface StockFiltersProps {
  /** Current query, resolved on the server so this component never reads the URL. */
  values: VehicleQuery;
  facets: Facets;
  showClear: boolean;
}

const EMPTY: VehicleQuery = {
  q: "",
  make: "",
  model: "",
  type: "",
  condition: "",
  from: undefined,
  to: undefined,
};

function toHref(pathname: string, query: VehicleQuery): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.make) params.set("make", query.make);
  if (query.model) params.set("model", query.model);
  if (query.type) params.set("type", query.type);
  if (query.condition) params.set("condition", query.condition);
  if (query.from) params.set("from", String(query.from));
  if (query.to) params.set("to", String(query.to));
  // "newest" is the default, so leave it out and keep the canonical URL clean.
  if (query.sort && query.sort !== "newest") params.set("sort", query.sort);

  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/**
 * Filters live in the URL, so a filtered list is shareable and the back button
 * works. Selects apply on change; the text box applies on submit rather than on
 * every keystroke, which would push a history entry per character.
 */
export function StockFilters({ values, facets, showClear }: StockFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = React.useTransition();
  const years = React.useMemo(() => yearOptions(facets.years), [facets.years]);

  // Holds the chosen option through the round trip to the server. Without this
  // the controlled <select> is re-rendered from the old props mid-navigation
  // and visibly snaps back to the previous value.
  const [query, setOptimistic] = React.useOptimistic(values);

  // The text box owns its own value so typing never waits on the server. It is
  // re-seeded whenever the URL's `q` changes from somewhere else — Clear, or a
  // browser Back. Doing this during render rather than in an effect avoids the
  // remount (and lost focus) that a `key` would cause on every submit.
  const [text, setText] = React.useState(values.q ?? "");
  const [seededFrom, setSeededFrom] = React.useState(values.q ?? "");
  if ((values.q ?? "") !== seededFrom) {
    setSeededFrom(values.q ?? "");
    setText(values.q ?? "");
  }

  const apply = React.useCallback(
    (patch: Partial<VehicleQuery>) => {
      const next = { ...query, ...patch };

      // Switching make would otherwise strand a model from the old brand and
      // return nothing, so drop the model unless it belongs to the new make.
      if (patch.make !== undefined && next.model) {
        const owner = facets.models.find((m) => m.value === next.model)?.make;
        if (patch.make && owner !== patch.make) next.model = "";
      }
      // Keep the range the right way round rather than silently returning zero.
      if (patch.from && next.to && patch.from > next.to) next.to = patch.from;
      if (patch.to && next.from && patch.to < next.from) next.from = patch.to;

      startTransition(() => {
        setOptimistic(next);
        router.push(toHref(pathname, next), { scroll: false });
      });
    },
    [facets.models, pathname, query, router, setOptimistic],
  );

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    apply({ q: text.trim() });
  };

  const onClear = () => {
    setText("");
    apply(EMPTY);
  };

  return (
    <form
      onSubmit={onSubmit}
      aria-busy={pending}
      className={cn(
        "grid gap-4 rounded-lg border border-line bg-surface p-4 transition-opacity duration-150",
        "sm:grid-cols-2 lg:grid-cols-4 lg:items-end",
        pending && "opacity-70",
      )}
    >
      <Field label="Search" htmlFor="stock-q" className="lg:col-span-2">
        <SearchInput
          id="stock-q"
          name="q"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Hilux, Prado, 2021…"
        />
      </Field>

      <FacetSelect
        id="stock-make"
        label="Make"
        allLabel="All makes"
        options={facets.makes}
        value={query.make ?? ""}
        onChange={(make) => apply({ make })}
      />

      <FacetSelect
        id="stock-model"
        label="Model"
        allLabel={query.make ? `All ${query.make} models` : "All models"}
        // Narrowed to the chosen make so the list stays short and every option
        // returns something.
        options={
          query.make
            ? facets.models.filter((m) => m.make === query.make)
            : facets.models
        }
        value={query.model ?? ""}
        onChange={(model) => apply({ model })}
      />

      <FacetSelect
        id="stock-type"
        label="Body type"
        allLabel="All types"
        options={facets.types}
        value={query.type ?? ""}
        onChange={(type) => apply({ type })}
      />

      <FacetSelect
        id="stock-condition"
        label="Condition"
        allLabel="New & used"
        options={facets.conditions}
        value={query.condition ?? ""}
        onChange={(condition) => apply({ condition })}
      />

      <YearSelect
        id="stock-from"
        label="Year from"
        allLabel="Any"
        // Never offer a "from" later than the chosen "to".
        options={query.to ? years.filter((y) => y <= query.to!) : years}
        value={query.from}
        onChange={(from) => apply({ from })}
      />

      <YearSelect
        id="stock-to"
        label="Year to"
        allLabel="Any"
        options={query.from ? years.filter((y) => y >= query.from!) : years}
        value={query.to}
        onChange={(to) => apply({ to })}
      />

      <Field label="Sort" htmlFor="stock-sort" className="lg:col-span-2">
        <Select
          id="stock-sort"
          value={query.sort ?? "newest"}
          onChange={(e) => apply({ sort: e.target.value as SortKey })}
        >
          {Object.entries(SORTS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </Select>
      </Field>

      {/* Submits the search box. The selects have already applied themselves by
          the time anyone tabs this far, so it stays out of the visual layout. */}
      <button type="submit" className="sr-only">
        Apply filters
      </button>

      {showClear && (
        <div className="flex items-center sm:col-span-2 lg:col-span-2 lg:justify-end">
          <Button type="button" variant="ghost" size="md" onClick={onClear}>
            <X aria-hidden />
            Clear all filters
          </Button>
        </div>
      )}
    </form>
  );
}

function FacetSelect({
  id,
  label,
  allLabel,
  options,
  value,
  onChange,
}: {
  id: string;
  label: string;
  allLabel: string;
  options: Facet[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label} htmlFor={id}>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.value} ({o.count})
          </option>
        ))}
      </Select>
    </Field>
  );
}

function YearSelect({
  id,
  label,
  allLabel,
  options,
  value,
  onChange,
}: {
  id: string;
  label: string;
  allLabel: string;
  options: number[];
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <Field label={label} htmlFor={id}>
      <Select
        id={id}
        value={value ? String(value) : ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
      >
        <option value="">{allLabel}</option>
        {options.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </Select>
    </Field>
  );
}
