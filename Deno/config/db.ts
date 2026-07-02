import { dotenvConfig, Pool } from "../deps.ts";

// Load .env from the Deno project root (path pinned to this module so it
// works regardless of the process working directory) and export the values
// to Deno.env — this is the single dotenv load for the whole app.
const env = await dotenvConfig({
  envPath: new URL("../.env", import.meta.url).pathname,
  export: true,
});

function requireEnv(name: string): string {
  const value = Deno.env.get(name) ?? env[name];
  if (!value) {
    // Fail fast: never fall back to default credentials. A misconfigured
    // deployment must not silently connect as a superuser with a weak password.
    throw new Error(
      `Missing required environment variable ${name}. ` +
        `Set it in Deno/.env (see ReadMe) before starting the server.`,
    );
  }
  return value;
}

// Create a connection pool
export const pool = new Pool({
  user: requireEnv("PGUSER"),
  password: requireEnv("PGPASSWORD"),
  database: requireEnv("PGDATABASE"),
  hostname: Deno.env.get("PGHOST") ?? env.PGHOST ?? "localhost",
  port: Number(Deno.env.get("PGPORT") ?? env.PGPORT) || 5432,
}, 20); // Maximum number of connections

// Test the connection
try {
  const client = await pool.connect();
  client.release();
} catch (err) {
  console.error(
    "Database connection test failed (server continues; DB-dependent routes will error):",
    err instanceof Error ? err.message : err,
  );
}
