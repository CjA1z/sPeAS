import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { client } from "../db/denopost_conn.ts";

const databaseName = Deno.env.get("PGDATABASE") ?? "";
if (!/_test$/u.test(databaseName)) throw new Error("Refusing backfill tests outside *_test");

const marker = await client.queryObject<{ ambiguous_repository_rows: string; skipped_repository_rows: string; skipped_invalid_rows: string }>(
  "SELECT ambiguous_repository_rows::text, skipped_repository_rows::text, skipped_invalid_rows::text FROM operational_analytics_backfills WHERE version = 'repository-activity-v2'",
);
assertEquals(marker.rows.length, 1);
assertEquals(Number(marker.rows[0]?.ambiguous_repository_rows), 1);
assertEquals(Number(marker.rows[0]?.skipped_repository_rows), 1);
assertEquals(Number(marker.rows[0]?.skipped_invalid_rows), 0);

const before = await client.queryObject<{ views: string; rows: string }>(`
  SELECT COALESCE(SUM(view_count), 0)::text AS views, COUNT(*)::text AS rows
  FROM repository_activity_rollups WHERE record_id = 1
`);
assertEquals(Number(before.rows[0]?.views), 11); // legacy daily 7 + reader document/compilation views in hour and day rows
assertEquals(Number(before.rows[0]?.rows) >= 3, true);

const state = await client.queryObject<{ writes_enabled: boolean; reads_enabled: boolean }>("SELECT writes_enabled, reads_enabled FROM operational_analytics_state WHERE state_id = TRUE");
assertEquals(state.rows[0]?.writes_enabled, true);
assertEquals(state.rows[0]?.reads_enabled, true);
console.log(`Reporting backfill reconciliation passed on ${databaseName}`);
