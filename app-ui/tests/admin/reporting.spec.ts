import { expect, test } from "@playwright/test";

const reportFixture = {
  meta: {
    dataVersion: 2,
    generatedAt: "2026-08-03T05:09:17.000Z",
    timezone: "Asia/Manila",
    range: { key: "30d", label: "Last 30 days", startInclusive: "2026-07-04T16:00:00.000Z", endExclusive: "2026-08-03T16:00:00.000Z", bucket: "day" },
    activityCoverageStartedAt: "2026-07-01T16:00:00.000Z",
    coverage: { repository: { startedAt: "2026-07-01T16:00:00.000Z", hourlyStartedAt: "2026-08-01T16:00:00.000Z", precision: "mixed", isCompleteForSelectedRange: true, warning: null }, home: { startedAt: null, hourlyStartedAt: null, precision: "daily", isCompleteForSelectedRange: true, warning: null }, authors: { startedAt: null, hourlyStartedAt: null, precision: "daily", isCompleteForSelectedRange: true, warning: null } },
  },
  inventory: { catalogEntries: 4, storedDocuments: 5, archivedCatalogEntries: 1, archivedDocuments: 2, authorRecords: 16, publishedAuthors: 4 },
  workflow: { pendingUploads: 1, pendingAccessRequests: 2 },
  activity: { uploadedEntries: 2, repositoryViews: 12, repositoryDownloads: 4, guestViews: 5, registeredViews: 7, approvedRequestDownloads: 1, activeRegisteredUsers: 3, homeVisits: { total: 12, guest: 4, registered: 8 } },
  series: { uploads: [{ bucket: "2026-08-01T16:00:00.000Z", count: 2 }], repositoryActivity: [{ bucket: "2026-08-01T16:00:00.000Z", views: 12, downloads: 4 }], homeVisits: [{ bucket: "2026-08-01T16:00:00.000Z", guest: 4, registered: 8, total: 12 }] },
  rankings: { mostViewedEntries: [], mostDownloadedEntries: [], mostVisitedAuthors: [], trendingTopics: [] },
  distributions: { documentTypes: [{ label: "THESIS", count: 2 }], requestStatuses: [{ status: "pending", count: 2 }, { status: "approved", count: 0 }, { status: "rejected", count: 0 }] },
  registeredReaderSummary: { activeUsers: 3, views: 7, downloads: 3, averageInteractionsPerActiveUser: 3.33 },
  metricDefinitions: { catalog_entries: "Current catalog entries", repository_views: "Successful repository views", home_visits: "Home-page requests" },
};

async function mockAdmin(page: import("@playwright/test").Page) {
  await page.route("**/api/auth/get-session", (route) => route.fulfill({ json: { session: { id: "admin-session" }, user: { id: "admin-1", name: "Admin User", role: "admin" } } }));
  await page.route("**/api/user/profile", (route) => route.fulfill({ json: { id: "admin-1", first_name: "Admin", last_name: "User" } }));
  await page.route("**/api/admin/reports/operational?*", (route) => route.fulfill({ json: reportFixture }));
  await page.route("**/api/admin/dashboard?*", (route) => route.fulfill({ json: reportFixture }));
  await page.route("**/api/admin/contact-inquiries/summary", (route) => route.fulfill({ json: { byStatus: {}, failedNotifications: 0, recipientConfigured: true } }));
}

test("@reporting operational reports show current and selected-period sections", async ({ page }) => {
  await mockAdmin(page);
  await page.goto("/admin/Components/reports.html?range=30d");
  await expect(page.getByRole("heading", { name: "Operational Reports" })).toBeVisible();
  await expect(page.getByText("Current snapshot")).toBeVisible();
  await expect(page.getByText("Activity during selected period")).toBeVisible();
  await expect(page.getByRole("button", { name: "CSV" })).toBeEnabled();
});

test("@reporting dashboard keeps the visible home split coherent", async ({ page }) => {
  await mockAdmin(page);
  await page.goto("/admin/dashboard.html");
  await expect(page.getByText("Home visits · last 30 days")).toBeVisible();
  await expect(page.getByText(/4 guest \+ 8 registered-user visits/)).toBeVisible();
});

test("@reporting normalizes an invalid range and keeps the shell within the viewport", async ({ page }) => {
  await mockAdmin(page);
  await page.goto("/admin/Components/reports.html?range=not-a-range");
  await expect(page).toHaveURL(/range=30d/);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("@reporting range changes are restored by browser history", async ({ page }) => {
  await mockAdmin(page);
  await page.goto("/admin/Components/reports.html?range=30d");
  await page.getByRole("combobox", { name: "Report time range" }).click();
  await page.getByRole("option", { name: "Last 90 days" }).click();
  await expect(page).toHaveURL(/range=90d/);
  await page.goBack();
  await expect(page).toHaveURL(/range=30d/);
});

test("@reporting top activity tabs support keyboard navigation", async ({ page }) => {
  await mockAdmin(page);
  await page.goto("/admin/dashboard.html");
  await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible();
  const tabs = page.getByRole("tab");
  await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
  await tabs.first().focus();
  await page.keyboard.press("ArrowRight");
  await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
  await tabs.nth(1).focus();
  await page.keyboard.press("End");
  await expect(tabs.nth(2)).toHaveAttribute("aria-selected", "true");
});
