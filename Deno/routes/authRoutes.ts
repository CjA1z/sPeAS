import { Route } from "./index.ts";
import { RouterContext } from "../deps.ts";
import { loginRateLimit } from "../middleware/rateLimit.ts";
import * as sessionService from "../services/sessionService.ts";
import { SystemLogsModel } from "../models/systemLogsModel.ts";
import { hashPassword, shouldRehashPassword, verifyPassword } from "../utils/hashPassword.ts";

// Create a function to get server start time without creating circular imports
let cachedServerStartTime: number | null = null;
const getServerStartTime = (): number => {
  if (cachedServerStartTime === null) {
    // If not cached yet, use current time as fallback
    cachedServerStartTime = Date.now();
  }
  return cachedServerStartTime;
};

// Add function to set server start time from server.ts
export function setServerStartTime(time: number): void {
  cachedServerStartTime = time;
}

// Auth route handlers
const login = async (ctx: RouterContext<any, any, any>) => {
  try {
    // Get request body
    let body: Record<string, any> = {};
    try {
      // Oak v12 body parsing
      const bodyParser = await ctx.request.body({ type: "json" });
      body = await bodyParser.value;
    } catch (bodyError) {
      // Fallback to a simple object if JSON parsing fails
      body = {};

      // Try to get form data from URL parameters if JSON fails
      const params = new URL(ctx.request.url).searchParams;
      for (const [key, value] of params.entries()) {
        body[key] = value;
      }
    }

    // Get user info from request
    const userId = body.ID || body.id;
    const password = body.Password || body.password;

    if (!userId || !password) {
      throw new Error("User ID and password are required");
    }

    // Query the database to validate credentials
    let userRole = "User"; // Default role
    let userExists = false;

    try {
      // Import the client here to avoid issues
      const { client } = await import("../db/denopost_conn.ts");

      // First check if the user exists in the users table (required for sessions foreign key)
      const userCheckResult = await client.queryObject(
        `SELECT id, role_id FROM users WHERE id = $1`,
        [userId]
      );

      if (userCheckResult.rows && userCheckResult.rows.length > 0) {
        // User exists in the users table, now check credentials.
        const credResult = await client.queryObject(
          `SELECT user_id, password FROM credentials WHERE user_id = $1`,
          [userId]
        );
        const credential = credResult.rows?.[0] as
          | { user_id: string; password: string }
          | undefined;
        const passwordMatches = credential
          ? await verifyPassword(String(password), credential.password)
          : false;

        if (credential && passwordMatches) {
          userExists = true;

          if (shouldRehashPassword(credential.password)) {
            try {
              await client.queryObject(
                `UPDATE credentials SET password = $1, updated_at = NOW() WHERE user_id = $2`,
                [await hashPassword(String(password)), userId]
              );
            } catch (_rehashError) {
              // Login can continue; the next successful login can attempt the upgrade again.
            }
          }

          // Resolve the user's role by role_name (single source of truth for roles)
          const roleResult = await client.queryObject(
            `SELECT r.role_name
             FROM users u
             JOIN roles r ON u.role_id = r.id
             WHERE u.id = $1`,
            [userId]
          );

          if (roleResult.rows && roleResult.rows.length > 0) {
            const row = roleResult.rows[0] as { role_name: string };
            userRole = String(row.role_name || "User");
          }
        } else {
          // Credentials don't match
          userExists = false;
        }
      } else {
        // User doesn't exist in users table
        userExists = false;
      }
    } catch (dbError) {
      userExists = false; // Don't allow login on database errors
    }

    if (!userExists) {
      ctx.response.status = 401;
      ctx.response.body = {
        message: "Invalid credentials or user does not exist",
        error: "Authentication failed",
      };

      // Log the failed login attempt to system logs
      try {
        await SystemLogsModel.createLog({
          log_type: "login",
          username: userId,
          action: "Failed login attempt",
          details: {
            reason: "Invalid credentials or user not found",
            timestamp: new Date().toISOString(),
            browser: ctx.request.headers.get("user-agent") || "Unknown",
            ip: ctx.request.ip || "Unknown",
          },
          ip_address: ctx.request.ip || "Unknown",
          status: "failed",
        });
      } catch (logError) {
      }

      return;
    }

    // Update last_login timestamp in the users table
    try {
      const { client } = await import("../db/denopost_conn.ts");
      await client.queryObject(
        `UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1`,
        [userId]
      );
    } catch (updateError) {
      // Continue with login process even if timestamp update fails
    }

    // Generate a session token (only its hash is stored server-side)
    const token = await sessionService.createSessionToken(String(userId));

    // Set the session cookie server-side: HttpOnly so scripts can't read it.
    // `secure` follows the connection so local HTTP development still works.
    await ctx.cookies.set("session_token", token, {
      httpOnly: true,
      secure: ctx.request.secure,
      sameSite: "lax",
      path: "/",
      maxAge: 24 * 60 * 60, // seconds; matches the session's 24h expiry
    });

    // Log the successful login to the system logs
    try {
      await SystemLogsModel.createLog({
        log_type: "login",
        user_id: String(userId),
        username: String(userId),
        action: "User login",
        details: {
          role: userRole,
          timestamp: new Date().toISOString(),
          browser: ctx.request.headers.get("user-agent") || "Unknown",
          ip: ctx.request.ip || "Unknown",
        },
        ip_address: ctx.request.ip || "Unknown",
        status: "success",
      });
    } catch (logError) {
    }

    // Determine redirect URL based on user role
    const lowerRole = String(userRole).toLowerCase();
    const redirectUrl = lowerRole === "admin"
      ? "/admin/dashboard.html" // Admin dashboard
      : "/index.html"; // Regular user home

    // Return successful response. The session token travels only in the
    // HttpOnly cookie — it is intentionally not included in the body.
    ctx.response.status = 200;
    ctx.response.body = {
      message: "Login successful",
      userId: userId,
      username: userId,
      role: userRole,
      redirect: redirectUrl,
      serverTime: getServerStartTime(),
    };
  } catch (error) {
    ctx.response.status = 400;
    ctx.response.body = {
      message: "Login failed",
      error: error instanceof Error ? error.message : String(error),
      details: "See server logs for more information",
    };
  }
};

const register = async (ctx: RouterContext<any, any, any>) => {
  const bodyParser = await ctx.request.body({ type: "json" });
  const body = await bodyParser.value;
  ctx.response.body = { message: "User registered successfully", data: body };
};

const logout = async (ctx: RouterContext<any, any, any>) => {
  try {
    // Extract the session token: cookie first, Bearer header as fallback
    let token: string | null = (await ctx.cookies.get("session_token")) ??
      (await ctx.cookies.get("auth_token")) ?? null;

    if (!token) {
      const authHeader = ctx.request.headers.get("Authorization");
      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
    }

    if (token) {
      // Look up the user before deleting the session so we can stamp last_logout
      const session = await sessionService.verifySession(token);
      await sessionService.deleteSessionToken(token);

      if (session) {
        try {
          const { client } = await import("../db/denopost_conn.ts");
          await client.queryObject(
            `UPDATE users SET last_logout = CURRENT_TIMESTAMP WHERE id = $1`,
            [session.id]
          );
        } catch (dbError) {
          // Logout proceeds even if the timestamp update fails
        }
      }
    }

    // Clear session cookie
    ctx.cookies.set("session_token", "", {
      expires: new Date(0),
      path: "/",
      httpOnly: true,
    });

    // Set more forceful redirect headers and status
    const redirectUrl = `/index.html?loggedOut=true&t=${Date.now()}`;

    ctx.response.headers.set("Location", redirectUrl);
    ctx.response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    ctx.response.headers.set("Pragma", "no-cache");
    ctx.response.headers.set("Expires", "0");
    ctx.response.headers.set("Clear-Site-Data", '"cache", "cookies", "storage"');

    ctx.response.status = 302; // Use redirect status code
    ctx.response.body = null;
  } catch (error) {
    // More forceful redirect on error
    const errorRedirectUrl = `/index.html?loggedOut=true&error=true&t=${Date.now()}`;
    ctx.response.headers.set("Location", errorRedirectUrl);
    ctx.response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    ctx.response.headers.set("Pragma", "no-cache");
    ctx.response.headers.set("Expires", "0");
    ctx.response.headers.set("Clear-Site-Data", '"cache", "cookies", "storage"');
    ctx.response.status = 302;
    ctx.response.body = null;
  }
};

// Export an array of routes. Login endpoints are rate-limited per IP to
// slow credential brute-forcing.
export const authRoutes: Route[] = [
  { method: "POST", path: "/auth/login", handler: login, middleware: [loginRateLimit] },
  { method: "POST", path: "/login", handler: login, middleware: [loginRateLimit] }, // Add plain /login endpoint
  { method: "POST", path: "/auth/register", handler: register },
  { method: "POST", path: "/auth/logout", handler: logout },
  { method: "POST", path: "/logout", handler: logout }, // Add direct /logout endpoint
  { method: "GET", path: "/logout", handler: logout }, // Add GET method support for logout
];
