import { Context, Next } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { verifySession } from "../services/sessionService.ts";

/**
 * Extracts the session token from the request:
 * 1. the HttpOnly `session_token` cookie (primary — set by the login route)
 * 2. an `Authorization: Bearer` header (fallback for API clients/tooling)
 */
export async function getRequestToken(ctx: Context): Promise<string | null> {
    const cookieToken = await ctx.cookies.get("session_token");
    if (cookieToken) return cookieToken;

    const authHeader = ctx.request.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
        return authHeader.split(" ")[1] ?? null;
    }
    return null;
}

export async function isAuthenticated(ctx: Context, next: Next) {
    try {
        const token = await getRequestToken(ctx);
        const session = await verifySession(token);

        if (!session) {
            ctx.response.status = 401;
            ctx.response.body = { error: "Unauthorized" };
            return;
        }

        ctx.state.user = { id: session.id, role: session.role };
        await next();
    } catch (error) {
        console.error("isAuthenticated: unexpected error:", error);
        ctx.response.status = 401;
        ctx.response.body = { error: "Unauthorized" };
    }
}

export async function isAdmin(ctx: Context, next: Next) {
    const user = ctx.state.user;
    // Roles are normalized to lowercase by verifySession
    if (!user || user.role !== "admin") {
        ctx.response.status = 403;
        ctx.response.body = { error: "Forbidden" };
        return;
    }
    await next();
}
