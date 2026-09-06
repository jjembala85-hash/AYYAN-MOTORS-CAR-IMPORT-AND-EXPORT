# Vehicle Catalog Service

PostgreSQL + Drizzle + a GraphQL read API. The site reads the catalogue from the
database; `src/data/vehicles.json` is now only the seed input.

## Getting started

```bash
docker compose up -d              # Postgres 17 on 127.0.0.1:5432
cp .env.example .env.local        # DATABASE_URL is prefilled for the container

npm run db:migrate                # apply migrations
npm run db:seed                   # load the 17 legacy listings (destructive)
npm run dev
```

`npm run db:generate` writes a new migration whenever
`src/server/db/schema.ts` changes. Review the SQL before applying it.

### Without Docker

`npm run db:local` boots Postgres in-process (PGlite, compiled to WASM) behind a
real wire-protocol socket on `127.0.0.1:5433`, then migrates and seeds it. Data
lives in `./.pglite`; delete that directory for a clean slate.

```bash
npm run db:local                  # leave running
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/postgres npm run dev
```

One caveat, and only for this fallback: it serves a single session at a time, so
a **production build** against it needs `NEXT_BUILD_CPUS=1 PG_POOL_MAX=1`. Next
otherwise prerenders with a worker pool, and the concurrent connections
interleave the extended query protocol — which surfaces as misleading errors
like `invalid input value for enum listing_status: "a"`. Against Docker, Neon or
Supabase, leave both unset; a default 7-worker build is verified to work.

### Verification

`npm run db:verify` needs no database at all — it applies every migration to an
in-process Postgres, seeds it, and runs 60+ assertions over the query layer,
including proving each constraint rejects bad writes. Suitable for CI.

## Schema

Eleven tables. `vehicles` stays thin — identity, classification, commercial
state — and the *evidence* about a vehicle hangs off it, because a unit arrives
with a history that predates Ayyan owning it.

| Table | Holds |
| --- | --- |
| `makes`, `models` | Classification. `models.family` is what buyers shop by ("Hilux"), separate from the exact `name` ("Hilux Revo Double Cab"). |
| `vehicles` | Identity, spec summary, price, listing state, full-text search vector. |
| `vehicle_engines` | 1:1. Engine code, displacement, cylinders, aspiration, power, torque. |
| `vehicle_media` | Photos, 360° spin frames, video, documents. Ordered, with one enforced cover. |
| `vehicle_history_events` | Registration, ownership, odometer readings, service, accidents, import/export. |
| `condition_reports` + `_items` | Ayyan's own inspection on landing, with a panel-by-panel defect map. |
| `auction_sheets` | The exporting auction house's document, kept verbatim. |
| `features`, `vehicle_features` | Many-to-many equipment list. |

Decisions worth knowing:

- **Chassis number and VIN are separate, both nullable, independently unique.**
  Japanese and Thai imports are identified by a chassis number
  (`KDH201-0123456`) and often have no 17-character VIN at all. Requiring a VIN
  would make most of the real inventory unenterable. The VIN check constraint
  enforces ISO 3779's alphabet (no I, O or Q).
- **Money is `bigint` minor units plus an explicit currency**, never a float, and
  a `CHECK` keeps the two either both set or both null. `formatPrice` asks `Intl`
  how many minor digits a currency has, so UGX and JPY (which have none) are not
  divided by 100.
- **Auction grades are text, not numbers.** Japanese houses issue `4.5`, `R`,
  `RA` and `S` alongside 1–6. The vocabulary belongs to them.
- **`drive_type` includes `2wd`.** Many legacy listings record only "2WD" and
  which axle drives is genuinely unknown; inventing `rwd` would be fabrication.
- **Search is a stored `tsvector` with a GIN index**, queried with a prefix
  `to_tsquery` so a half-typed "hilu" matches. User input is stripped to
  alphanumerics first, since tsquery has its own operator syntax.
- **Constraints are real**: one cover photo per vehicle, `spin_index` if and only
  if the media is a spin frame, non-negative mileage and price. `db:verify`
  asserts each of these actually rejects bad writes.

The `model_year` CHECK is deliberately static (`1950..2100`) rather than
`extract(year from now()) + 2`. Postgres accepts a non-immutable CHECK, but its
meaning then drifts with the clock and it is re-validated on dump/restore; the
tighter rule belongs in application validation.

## GraphQL API

`POST /api/graphql`, with `GET` also served — a GET response is cacheable by a
CDN and the browser, which a POST is not, and that is the main latency lever for
export markets. GraphiQL is on in development, or set `ENABLE_GRAPHIQL=1`.

```graphql
{
  vehicles(filter: { model: "Hilux", yearFrom: 2020 }, sort: NEWEST, limit: 12) {
    totalCount
    nodes { slug title year bodyType cover { url width height } }
  }
  facets { makes { value count } years { min max } }
}
```

Child collections (`auctionSheets`, `conditionReports`, `history`) are batched
per request with DataLoader, so `vehicles { auctionSheets { … } }` issues one
query rather than one per vehicle. Loaders are created per request — sharing
them across requests would serve one caller's snapshot to the next.

`limit` is capped at 100 server-side, and `related(limit:)` at 12, so a single
query cannot ask for the whole table.
