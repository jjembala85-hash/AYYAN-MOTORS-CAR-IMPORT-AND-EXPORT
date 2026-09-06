import { createSchema } from "graphql-yoga";
import type { CatalogVehicle, CatalogVehicleDetail, SortKey, VehicleQuery } from "@/lib/catalog";
/*
 * The cached read model, not the raw queries. Every GraphQL request renders
 * dynamically — the route is `force-dynamic` — so this is the one entry point
 * where the same query really does reach Postgres on every call.
 */
import * as catalog from "@/server/catalog/cached";
import type { GraphQLContext } from "./loaders";

export const typeDefs = /* GraphQL */ `
  """
  Money is always minor units plus an explicit currency — never a float, and
  never a bare number whose currency the client has to assume.
  """
  type Money {
    minor: Int!
    currency: String!
  }

  type Photo {
    url: String!
    alt: String
    width: Int
    height: Int
  }

  type Engine {
    engineCode: String
    displacementCc: Int
    cylinders: Int
    aspiration: String
    powerHp: Int
    torqueNm: Int
  }

  """
  A document issued by the exporting auction house. Grades are strings, not
  numbers: Japanese houses issue "4.5", "R" (repaired), "RA" and "S" alongside
  the 1–6 scale, and the vocabulary is theirs to define, not ours.
  """
  type AuctionSheet {
    id: ID!
    auctionHouse: String!
    auctionSite: String
    lotNumber: String
    auctionDate: String
    gradeOverall: String
    gradeExterior: String
    gradeInterior: String
    odometerKm: Int
    startingPrice: Money
    soldPrice: Money
    sheetImageUrl: String
    inspectorNotes: String
    translatedNotes: String
    """Null until a human has checked the sheet against the actual vehicle."""
    verifiedAt: String
  }

  type ConditionReportItem {
    id: ID!
    area: String!
    defectType: String
    severity: String!
    note: String
    photoUrl: String
  }

  """Ayyan's own inspection, carried out on landing — distinct from the auction sheet."""
  type ConditionReport {
    id: ID!
    inspectedBy: String
    inspectedAt: String!
    overallScore: Int
    exteriorScore: Int
    interiorScore: Int
    mechanicalScore: Int
    hasAccidentHistory: Boolean
    hasStructuralDamage: Boolean
    hasFloodDamage: Boolean
    summary: String
    documentUrl: String
    items: [ConditionReportItem!]!
  }

  type HistoryEvent {
    id: ID!
    eventType: String!
    occurredOn: String
    odometerKm: Int
    countryCode: String
    description: String
    source: String
    documentUrl: String
  }

  type Vehicle {
    id: ID!
    slug: String!
    title: String!
    year: Int!
    make: String!
    model: String!
    modelFamily: String!

    bodyType: String
    condition: String
    transmission: String
    fuelType: String
    driveType: String
    steering: String!

    chassisNumber: String
    vin: String

    mileageKm: Int
    exteriorColor: String
    interiorColor: String
    doors: Int
    seats: Int

    price: Money
    pricingType: String!
    status: String!
    isFeatured: Boolean!
    isAuction: Boolean!
    isSold: Boolean!

    description: String
    cover: Photo
    gallery: [Photo!]!
    features: [String!]!

    engine: Engine
    auctionSheets: [AuctionSheet!]!
    conditionReports: [ConditionReport!]!
    history: [HistoryEvent!]!

    related(limit: Int = 3): [Vehicle!]!
  }

  input VehicleFilter {
    """Free text; matched as a prefix search across title, year and chassis number."""
    q: String
    make: String
    model: String
    bodyType: String
    condition: String
    yearFrom: Int
    yearTo: Int
  }

  enum VehicleSort {
    NEWEST
    OLDEST
    AZ
  }

  type VehiclePage {
    """Total matching the filter, ignoring limit/offset."""
    totalCount: Int!
    nodes: [Vehicle!]!
  }

  type Facet {
    value: String!
    count: Int!
  }

  type ModelFacet {
    value: String!
    make: String!
    count: Int!
  }

  type YearRange {
    min: Int!
    max: Int!
  }

  type Facets {
    makes: [Facet!]!
    models: [ModelFacet!]!
    bodyTypes: [Facet!]!
    conditions: [Facet!]!
    years: YearRange!
  }

  type Query {
    vehicles(
      filter: VehicleFilter
      sort: VehicleSort = NEWEST
      limit: Int = 24
      offset: Int = 0
    ): VehiclePage!
    vehicle(slug: String!): Vehicle
    facets: Facets!
  }
`;

/* -------------------------------------------------------------------------- */

const SORT_MAP: Record<string, SortKey> = {
  NEWEST: "newest",
  OLDEST: "oldest",
  AZ: "az",
};

interface FilterInput {
  q?: string;
  make?: string;
  model?: string;
  bodyType?: string;
  condition?: string;
  yearFrom?: number;
  yearTo?: number;
}

function toQuery(filter: FilterInput | undefined, sort: string | undefined): VehicleQuery {
  return {
    q: filter?.q,
    make: filter?.make,
    model: filter?.model,
    type: filter?.bodyType,
    condition: filter?.condition,
    from: filter?.yearFrom,
    to: filter?.yearTo,
    sort: SORT_MAP[sort ?? "NEWEST"] ?? "newest",
  };
}

function money(minor: number | null, currency: string | null) {
  return minor != null && currency ? { minor: Number(minor), currency } : null;
}

/** GraphQL has no Date scalar by default; ISO strings keep the contract obvious. */
function iso(value: Date | string | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

type VehicleParent = CatalogVehicle & Partial<CatalogVehicleDetail>;

export const schema = createSchema<GraphQLContext>({
  typeDefs,
  resolvers: {
    Query: {
      vehicles: async (_parent, args: { filter?: FilterInput; sort?: string; limit?: number; offset?: number }, ctx) => {
        const query = toQuery(args.filter, args.sort);
        // Fetch the page and the total in parallel — the count is what the UI
        // shows as "N of M" and is needed even when nodes are empty.
        const [nodes, totalCount] = await Promise.all([
          catalog.listVehicles(ctx.db, query, Math.min(args.limit ?? 24, 100)),
          catalog.countVehicles(ctx.db, query),
        ]);
        return { nodes: nodes.slice(args.offset ?? 0), totalCount };
      },

      vehicle: (_parent, args: { slug: string }, ctx) =>
        catalog.getVehicleBySlug(ctx.db, args.slug),

      facets: async (_parent, _args, ctx) => {
        const f = await catalog.facets(ctx.db);
        return {
          makes: f.makes,
          models: f.models,
          bodyTypes: f.types,
          conditions: f.conditions,
          years: f.years,
        };
      },
    },

    Vehicle: {
      // Present on the detail query, absent on list rows — resolve to a safe
      // default rather than null so the non-null list contract holds.
      features: (v: VehicleParent) => v.features ?? [],
      engine: (v: VehicleParent) => v.engine ?? null,
      chassisNumber: (v: VehicleParent) => v.chassisNumber ?? null,
      vin: (v: VehicleParent) => v.vin ?? null,
      exteriorColor: (v: VehicleParent) => v.exteriorColor ?? null,
      interiorColor: (v: VehicleParent) => v.interiorColor ?? null,
      doors: (v: VehicleParent) => v.doors ?? null,
      seats: (v: VehicleParent) => v.seats ?? null,

      auctionSheets: async (v: VehicleParent, _args, ctx) => {
        const rows = await ctx.loaders.auctionSheets.load(v.id);
        return rows.map((r) => ({
          ...r,
          auctionDate: iso(r.auctionDate),
          verifiedAt: iso(r.verifiedAt),
          startingPrice: money(r.startingPriceMinor, r.priceCurrency),
          soldPrice: money(r.soldPriceMinor, r.priceCurrency),
        }));
      },

      conditionReports: async (v: VehicleParent, _args, ctx) => {
        const rows = await ctx.loaders.conditionReports.load(v.id);
        return rows.map((r) => ({ ...r, inspectedAt: iso(r.inspectedAt)! }));
      },

      history: async (v: VehicleParent, _args, ctx) => {
        const rows = await ctx.loaders.historyEvents.load(v.id);
        return rows.map((r) => ({ ...r, occurredOn: iso(r.occurredOn) }));
      },

      related: (v: VehicleParent, args: { limit?: number }, ctx) =>
        catalog.relatedVehicles(ctx.db, v, Math.min(args.limit ?? 3, 12)),
    },

    ConditionReport: {
      items: (report: { id: string }, _args, ctx) =>
        ctx.loaders.conditionReportItems.load(report.id),
    },
  },
});
