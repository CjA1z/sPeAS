/**
 * One-off migration: hash any plaintext passwords left in the credentials table.
 *
 * Historically, some rows stored the password as plaintext and verifyPassword()
 * had a plaintext-comparison fallback. That fallback has been removed, so any
 * remaining plaintext rows MUST be migrated or those users cannot log in.
 *
 * Idempotent: rows already in pbkdf2_sha256$... format are skipped.
 *
 * Run from the Deno/ directory:
 *   deno run --allow-net --allow-read --allow-env scripts/migrate-plaintext-passwords.ts
 */

import { client } from "../db/denopost_conn.ts";
import { hashPassword, isPasswordHash } from "../utils/hashPassword.ts";

const result = await client.queryObject<{ user_id: string; password: string }>(
  `SELECT user_id, password FROM credentials`,
);

const rows = result.rows ?? [];
let migrated = 0;
let skipped = 0;
let failed = 0;

for (const row of rows) {
  if (isPasswordHash(row.password)) {
    skipped++;
    continue;
  }

  try {
    await client.queryObject(
      `UPDATE credentials SET password = $1, updated_at = NOW() WHERE user_id = $2`,
      [await hashPassword(row.password), row.user_id],
    );
    migrated++;
    console.log(`migrated: ${row.user_id}`);
  } catch (err) {
    failed++;
    console.error(
      `FAILED: ${row.user_id}:`,
      err instanceof Error ? err.message : err,
    );
  }
}

console.log(
  `\nDone. ${migrated} migrated, ${skipped} already hashed, ${failed} failed ` +
    `(of ${rows.length} total).`,
);

if (failed > 0) {
  Deno.exit(1);
}
Deno.exit(0);
