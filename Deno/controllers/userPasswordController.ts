import { client } from "../db/denopost_conn.ts";
import { hashPassword, verifyPassword } from "../utils/hashPassword.ts";

/**
 * Controller function to update a user's password
 *
 * @param request The HTTP request
 * @returns HTTP response
 */
export async function updateUserPassword(request: Request): Promise<Response> {
  try {
    // Verify that the request is a PUT
    if (request.method !== "PUT") {
      return new Response(
        JSON.stringify({
          error: "Method not allowed",
          message: "Only PUT method is allowed for password updates",
        }),
        { status: 405, headers: { "Content-Type": "application/json" } },
      );
    }

    // Extract user ID from query parameters
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId");

    if (!userId) {
      return new Response(
        JSON.stringify({
          error: "Missing user ID",
          message: "User ID is required to update password",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Extract password data from request body
    let requestBody;
    try {
      requestBody = await request.json();
    } catch (_error) {
      return new Response(
        JSON.stringify({
          error: "Invalid JSON",
          message: "Request body must be valid JSON",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const { currentPassword, newPassword } = requestBody;

    // Validate input
    if (!currentPassword || !newPassword) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields",
          message: "Current password and new password are required",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (newPassword.length < 8) {
      return new Response(
        JSON.stringify({
          error: "Password too short",
          message: "New password must be at least 8 characters",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Verify the current password
    const credResult = await client.queryObject(
      `SELECT user_id, password FROM credentials WHERE user_id = $1`,
      [userId],
    );
    const credential = credResult.rows?.[0] as
      | { user_id: string; password: string }
      | undefined;

    if (
      !credential ||
      !(await verifyPassword(currentPassword, credential.password))
    ) {
      return new Response(
        JSON.stringify({
          error: "Authentication failed",
          message: "Current password is incorrect",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    // Update the password
    await client.queryObject(
      `UPDATE credentials SET password = $1, updated_at = NOW() WHERE user_id = $2`,
      [await hashPassword(newPassword), userId],
    );

    // Log the password change event (optional but recommended for security)
    try {
      // Just log to console for now, could be expanded to use a proper logging system
    } catch (_logError) {
      // Continue with the password change even if logging fails
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Password updated successfully",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Server error",
        message: error instanceof Error
          ? error.message
          : "An unknown error occurred",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
