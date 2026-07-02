import { client } from "../db/denopost_conn.ts";
import {
  hashPassword,
  shouldRehashPassword,
  verifyPassword,
} from "../utils/hashPassword.ts";

/**
 * Fetch user details from the database by ID and password.
 * @param ID - User's school ID
 * @param Password - User's password
 * @returns User object (school_id & role) or null if not found
 */
export async function findUser(ID: string, Password: string) {
  try {
    const result = await client.queryObject(
      `SELECT c.user_id, c.password, COALESCE(r.role_name, 'User') AS role
             FROM credentials c
             JOIN users u ON c.user_id = u.id
             LEFT JOIN roles r ON u.role_id = r.id
             WHERE c.user_id = $1`,
      [ID],
    );

    if (result.rows.length === 0) {
      return null;
    }

    const user = result.rows[0] as {
      user_id: string;
      password: string;
      role: string;
    };
    const passwordMatches = await verifyPassword(Password, user.password);
    if (!passwordMatches) {
      return null;
    }

    if (shouldRehashPassword(user.password)) {
      try {
        await client.queryObject(
          `UPDATE credentials SET password = $1, updated_at = NOW() WHERE user_id = $2`,
          [await hashPassword(Password), user.user_id],
        );
      } catch (_rehashError) {
        // Successful authentication should not depend on opportunistic hash migration.
      }
    }

    return {
      school_id: user.user_id,
      user_id: user.user_id,
      role: user.role,
    };
  } catch (error) {
    throw error;
  }
}
