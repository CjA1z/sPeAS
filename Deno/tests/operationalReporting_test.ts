import { assert, assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { isReportRange, METRIC_DEFINITIONS, normalizePageKey, resolveReportWindow } from "../services/operationalReportingService.ts";

Deno.test("operational report ranges use explicit labels and buckets", () => {
  const now = new Date("2026-08-03T00:00:00.000Z");
  assertEquals(resolveReportWindow("30d", now).label, "Last 30 days");
  assertEquals(resolveReportWindow("24h", now).bucket, "hour");
  assertEquals(resolveReportWindow("30d", now).bucket, "day");
  assertEquals(resolveReportWindow("90d", now).bucket, "week");
  assertEquals(resolveReportWindow("1y", now).bucket, "month");
  assertEquals(resolveReportWindow("all", now).startInclusive, null);
});

Deno.test("report range validation rejects client-defined SQL values", () => {
  assert(isReportRange("30d"));
  assert(isReportRange("all"));
  assert(!isReportRange("30 days; DROP TABLE documents"));
  assert(!isReportRange(null));
});

Deno.test("canonical definitions include reader and topic guardrails", () => {
  assert(METRIC_DEFINITIONS.active_registered_users.includes("Distinct registered users"));
  assert(METRIC_DEFINITIONS.trending_topics.includes("Approved topics"));
});

Deno.test("home aliases normalize to one server-owned page key", () => {
  assertEquals(normalizePageKey("/"), "/");
  assertEquals(normalizePageKey("/index/"), "/");
  assertEquals(normalizePageKey("/index.html///"), "/");
  assertEquals(normalizePageKey("https://example.test/index.html/"), "/");
});
