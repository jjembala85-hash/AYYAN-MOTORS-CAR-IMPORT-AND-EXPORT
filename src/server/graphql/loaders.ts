import DataLoader from "dataloader";
import { inArray } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "@/server/db/schema";

type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

/**
 * A query like `vehicles { auctionSheets { grade } }` would otherwise issue one
 * SELECT per vehicle. These batch each child collection into a single
 * `where vehicle_id in (...)`.
 *
 * Loaders are per-request, never module scope: caching them across requests
 * would serve one visitor's snapshot of the catalogue to the next.
 */
export function createLoaders(db: Db) {
  const groupBy = <T extends { vehicleId: string }>(rows: T[], ids: readonly string[]) => {
    const grouped = new Map<string, T[]>();
    for (const row of rows) {
      const list = grouped.get(row.vehicleId);
      if (list) list.push(row);
      else grouped.set(row.vehicleId, [row]);
    }
    return ids.map((id) => grouped.get(id) ?? []);
  };

  return {
    auctionSheets: new DataLoader<string, (typeof schema.auctionSheets.$inferSelect)[]>(
      async (ids) => {
        const rows = await db
          .select()
          .from(schema.auctionSheets)
          .where(inArray(schema.auctionSheets.vehicleId, ids as string[]));
        return groupBy(rows, ids);
      },
    ),

    conditionReports: new DataLoader<
      string,
      (typeof schema.conditionReports.$inferSelect)[]
    >(async (ids) => {
      const rows = await db
        .select()
        .from(schema.conditionReports)
        .where(inArray(schema.conditionReports.vehicleId, ids as string[]));
      return groupBy(rows, ids);
    }),

    historyEvents: new DataLoader<
      string,
      (typeof schema.vehicleHistoryEvents.$inferSelect)[]
    >(async (ids) => {
      const rows = await db
        .select()
        .from(schema.vehicleHistoryEvents)
        .where(inArray(schema.vehicleHistoryEvents.vehicleId, ids as string[]));
      return groupBy(rows, ids);
    }),

    conditionReportItems: new DataLoader<
      string,
      (typeof schema.conditionReportItems.$inferSelect)[]
    >(async (reportIds) => {
      const rows = await db
        .select()
        .from(schema.conditionReportItems)
        .where(inArray(schema.conditionReportItems.reportId, reportIds as string[]));
      const grouped = new Map<string, (typeof schema.conditionReportItems.$inferSelect)[]>();
      for (const row of rows) {
        const list = grouped.get(row.reportId);
        if (list) list.push(row);
        else grouped.set(row.reportId, [row]);
      }
      return reportIds.map((id) => grouped.get(id) ?? []);
    }),
  };
}

export type Loaders = ReturnType<typeof createLoaders>;

export interface GraphQLContext {
  db: Db;
  loaders: Loaders;
}
