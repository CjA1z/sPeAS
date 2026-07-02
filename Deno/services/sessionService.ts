/**
 * Session Service — single source of truth for session tokens.
 *
 * - Tokens are random UUIDs handed to the client; only their SHA-256 hash
 *   is stored in the sessions table, so a DB leak does not expose live sessions.
 * - Roles are resolved from roles.role_name and normalized to lowercase
 *   (e.g. "admin", "user"). All role comparisons in the app should use
 *   lowercase values.
 */

import { client } from "../db/denopost_conn.ts";

/** Session data returned by verifySession */
export interface SessionData {
  id: string;
  role: string;
  isLoggedIn: boolean;
}

/**
 * Extracts the session token from a plain Request:
 * 1. the HttpOnly `session_token` cookie (primary)
 * 2. an `Authorization: Bearer` header (fallback for API clients/tooling)
 */
export function getTokenFromRequest(req: Request): string | null {
  const cookieHeader = req.headers.get("Cookie") ?? "";
  const match = cookieHeader.match(/(?:^|;\s*)session_token=([^;]+)/);
  if (match) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (authHeader.startsWith("Bearer ")) return authHeader.slice(7);
  return null;
}

/** SHA-256 hex digest of a token — the only form ever stored in the DB. */
export async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Creates a session token for the user.
 * @param userID - The user's ID
 * @returns The raw token to hand to the client (only its hash is stored)
 */
export async function createSessionToken(userID: string): Promise<string> {
  const token = crypto.randomUUID();

  // Set expiration time (24 hours from now)
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  await client.queryObject(
    `INSERT INTO sessions (user_id, token, expires_at)
     VALUES ($1, $2, $3)`,
    [userID, await hashToken(token), expiresAt],
  );

  return token;
}

/**
 * Verifies a session token and resolves the user's role.
 * This is the single verification path — middleware, controllers, and
 * routes should all go through here.
 * @returns `{ id, role, isLoggedIn }` if valid, null otherwise
 */
export async function verifySession(
  token: string | null | undefined,
): Promise<SessionData | null> {
  if (!token || typeof token !== "string") return null;

  try {
    const result = await client.queryObject(
      `SELECT s.user_id, r.role_name
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE s.token = $1 AND s.expires_at > NOW()`,
      [await hashToken(token)],
    );

    if (!result.rows || result.rows.length === 0) return null;

    const row = result.rows[0] as { user_id: string; role_name: string | null };
    return {
      id: row.user_id,
      role: String(row.role_name || "user").toLowerCase(),
      isLoggedIn: true,
    };
  } catch (error) {
    console.error("verifySession: session lookup failed:", error);
    return null;
  }
}

/**
 * Validates a session token.
 * @returns The user ID if valid, null otherwise
 */
export async function validateSessionToken(
  token: string | null,
): Promise<string | null> {
  const session = await verifySession(token);
  return session ? session.id : null;
}

/**
 * Deletes a session token (logout).
 * @returns True if a session row was deleted, false otherwise
 */
export async function deleteSessionToken(token: unknown): Promise<boolean> {
  if (typeof token !== "string" || token.length === 0) return false;

  try {
    const result = await client.queryObject(
      `DELETE FROM sessions WHERE token = $1 RETURNING token`,
      [await hashToken(token)],
    );
    return Boolean(result.rows && result.rows.length > 0);
  } catch (error) {
    console.error("deleteSessionToken: delete failed:", error);
    return false;
  }
}
