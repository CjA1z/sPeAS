import { Context, Next } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { getSessionFromHeaders } from "../services/sessionService.ts";

export async function isAuthenticated(ctx: Context, next: Next) {
    try {
        const session = await getSessionFromHeaders(ctx.request.headers);

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
    // Roles are normalized to lowercase by getSessionFromHeaders
    if (!user || user.role !== "admin") {
        ctx.response.status = 403;
        ctx.response.body = { error: "Forbidden" };
        return;
    }
    await next();
}
