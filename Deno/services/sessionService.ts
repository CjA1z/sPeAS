/**
 * Session Service
 * Handles token generation and validation for user authentication.
 */

import { client } from "../db/denopost_conn.ts";

/**
 * Creates a session token for the user
 * @param userID - The user's ID
 * @param userRole - The user's role (admin, staff, student, etc.)
 * @returns A unique session token
 */
export async function createSessionToken(userID: string, userRole: string): Promise<string> {
    
  try {
    // Generate a UUID for the token
    const token = crypto.randomUUID();
    
    // Set expiration time (24 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Save the token to the database
    try {
      await client.queryObject(
        `INSERT INTO sessions (user_id, token, expires_at) 
         VALUES ($1, $2, $3)`,
        [userID, token, expiresAt]
    );
          } catch (dbError) {
          }
    
    return token;
  } catch (error) {
    throw error;
  }
}

/**
 * Validates a session token
 * @param token - The token to validate
 * @returns The user ID if valid, null otherwise
 */
export async function validateSessionToken(token: string | null): Promise<string | null> {
  if (!token) return null;
  
  try {
    const result = await client.queryObject(
      `SELECT user_id FROM sessions WHERE token = $1 AND expires_at > NOW()`,
      [token]
    );
    
    if (!result.rows || result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0].user_id;
  } catch (error) {
    return null;
  }
}

/**
 * Deletes a session token
 * @param token - The token to delete
 * @returns True if successful, false otherwise
 */
export async function deleteSessionToken(token: unknown): Promise<boolean> {
  if (token === null || token === undefined) {
        return false;
  }
  
  let tokenString: string;
  
  // Handle different token types, including objects
  if (typeof token === 'object') {
    try {
            tokenString = JSON.stringify(token);
    } catch (jsonError) {
      tokenString = String(token);
    }
  } else {
    tokenString = String(token);
  }
  
  // Log token type and part of the value for debugging
  try {
    const tokenStart = tokenString.substring(0, 8);
    const tokenEnd = tokenString.length > 16 ? tokenString.substring(tokenString.length - 8) : '';
      } catch (logError) {
  }
  
  // Try deleting from multiple tables to ensure all session data is removed
  let deletedFromAnyTable = false;
  
  try {
    // Try to delete from sessions table
    try {
      const result = await client.queryObject(
        `DELETE FROM sessions WHERE token = $1 RETURNING token`,
        [tokenString]
      );
      
      if (result.rows && result.rows.length > 0) {
                deletedFromAnyTable = true;
      } else {
              }
    } catch (sessionsError) {
    }
    
    // Also try to delete from tokens table if it exists
    try {
      const tokensResult = await client.queryObject(
        `DELETE FROM tokens WHERE token = $1 RETURNING token`,
        [tokenString]
      );
      
      if (tokensResult.rows && tokensResult.rows.length > 0) {
                deletedFromAnyTable = true;
      } else {
              }
    } catch (tokensError) {
          }
    
    return deletedFromAnyTable;
  } catch (error) {
    return false;
  }
}
