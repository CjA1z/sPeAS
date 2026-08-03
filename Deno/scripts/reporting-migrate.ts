import { client, withTransaction } from "../db/denopost_conn.ts";

const apply = Deno.args.includes("--apply");
const migrationPath = new URL("../db/migrations/2026-08_reporting_v2.sql", import.meta.url);

if (!apply) {
  console.log("Reporting v2 migration is ready. Re-run with --apply to execute it.");
  Deno.exit(0);
}

await withTransaction(async (connection) => {
  await connection.queryArray("SELECT pg_advisory_xact_lock(hashtext('peas-reporting-v2-schema'))");
  await connection.queryArray(await Deno.readTextFile(migrationPath));
});

const state = await client.queryObject<{ schema_version: string; writes_enabled: boolean; reads_enabled: boolean; live_started_at: string | null }>(
  "SELECT schema_version, writes_enabled, reads_enabled, live_started_at FROM operational_analytics_state WHERE state_id = TRUE",
);
console.log(JSON.stringify({ applied: true, state: state.rows[0] ?? null }, null, 2));
