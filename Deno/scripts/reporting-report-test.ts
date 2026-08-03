import { assertEquals, assert } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { getOperationalReport } from "../services/operationalReportingService.ts";

const databaseName = Deno.env.get("PGDATABASE") ?? "";
if (!/_test$/u.test(databaseName)) throw new Error("Refusing reporting report tests outside *_test");

const report = await getOperationalReport("30d");
assertEquals(report.meta.dataVersion, 2);
assertEquals(report.inventory.catalogEntries, 6); // all active top-level singles/compilations, irrespective of review status
assertEquals(report.inventory.storedDocuments, 6);
assertEquals(report.inventory.archivedCatalogEntries, 1);
assertEquals(report.inventory.archivedDocuments, 2);
assertEquals(report.workflow.pendingUploads, 2); // one top-level single + one compilation
assertEquals(report.workflow.pendingAccessRequests, 1); // current status ignores the activity range
assertEquals(report.activity.repositoryViews, 9);
assertEquals(report.activity.guestViews, 7);
assertEquals(report.activity.registeredViews, 2);
assertEquals(report.activity.repositoryDownloads, 3);
assertEquals(report.activity.approvedRequestDownloads, 2);
assertEquals(report.activity.homeVisits.total, 7);
assertEquals(report.activity.homeVisits.total, report.activity.homeVisits.guest + report.activity.homeVisits.registered);
assertEquals(report.meta.coverage.repository.isCompleteForSelectedRange, false);
assert(report.meta.coverage.repository.warning !== null);
assertEquals(report.rankings.mostViewedEntries[0]?.recordType, "compiled");
assertEquals(report.rankings.mostViewedEntries[0]?.id, 1);
assertEquals(report.rankings.trendingTopics[0]?.name, "Approved Topic");
assert(report.rankings.trendingTopics.every((topic) => topic.name !== "Retired Topic" && topic.name !== "Pending Topic"));
assertEquals(report.distributions.requestStatuses.map((item) => item.status).join(","), "pending,approved,rejected");
console.log(`Reporting service fixture test passed on ${databaseName}`);
