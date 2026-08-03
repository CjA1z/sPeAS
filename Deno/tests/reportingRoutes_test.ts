import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { getAdminDashboard, exportOperationalReport } from "../controllers/reportsController.ts";
import { requireCapability } from "../middleware/authMiddleware.ts";
import { recordAuthorVisit } from "../routes/authorVisitsRoutes.ts";

function context(query: string) {
  return {
    request: { url: new URL(`http://localhost/api/admin/dashboard?${query}`) },
    response: { status: 0, body: undefined, headers: new Headers() },
  } as any;
}

Deno.test("invalid report range is rejected before database access", async () => {
  const ctx = context("range=1%20OR%201%3D1");
  await getAdminDashboard(ctx);
  assertEquals(ctx.response.status, 400);
  assertEquals(ctx.response.body.error, "INVALID_REPORT_RANGE");
});

Deno.test("dashboard accepts only its three supported ranges", async () => {
  const ctx = context("range=24h");
  await getAdminDashboard(ctx);
  assertEquals(ctx.response.status, 400);
  assertEquals(ctx.response.body.error, "INVALID_REPORT_RANGE");
});

Deno.test("invalid export format has a closed error code", async () => {
  const ctx = context("range=30d&format=html");
  await exportOperationalReport(ctx);
  assertEquals(ctx.response.status, 400);
  assertEquals(ctx.response.body.error, "INVALID_REPORT_FORMAT");
});

Deno.test("reporting capabilities reject publisher and user roles", async () => {
  for (const role of ["publisher", "user"]) {
    const middleware = requireCapability("reports:view");
    const ctx = { state: { user: { role } }, response: { status: 0, body: undefined } } as any;
    let called = false;
    await middleware(ctx, async () => { called = true; });
    assertEquals(called, false);
    assertEquals(ctx.response.status, 403);
    assertEquals(ctx.response.body.error, "Forbidden");
  }
});

Deno.test("administrator reporting capability reaches the handler", async () => {
  const middleware = requireCapability("reports:export");
  const ctx = { state: { user: { role: "admin" } }, response: { status: 0, body: undefined } } as any;
  let called = false;
  await middleware(ctx, async () => { called = true; });
  assertEquals(called, true);
});

Deno.test("legacy author visit writer is a deprecated no-op", async () => {
  const ctx = { response: { status: 0, body: undefined, headers: new Headers() } } as any;
  await recordAuthorVisit(ctx);
  assertEquals(ctx.response.status, 204);
  assertEquals(ctx.response.body, undefined);
  assertEquals(ctx.response.headers.get("Deprecation"), "true");
  assertEquals(ctx.response.headers.get("Sunset"), "true");
});
