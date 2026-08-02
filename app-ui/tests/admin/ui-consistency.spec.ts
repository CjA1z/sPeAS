import { expect, test, type Page } from "@playwright/test";
import { source as axeSource } from "axe-core";

const ADMIN_LINKS = [
  "Dashboard",
  "Documents",
  "Archived Documents",
  "Authors",
  "Document Permissions",
  "Operational Reports",
  "Experience Studio",
  "Department News",
  "Role Management",
  "Contact Inquiries",
];

test.beforeEach(async ({ page }) => {
  await mockAdminIdentity(page);
  await page.route("**/api/categories", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/documents?*", (route) => route.fulfill({ json: { documents: [], totalCount: 0, totalPages: 0 } }));
  await page.route("**/api/stats/summary", (route) => route.fulfill({ json: canonicalStats() }));
  await page.route("**/api/documents/statistics?*", (route) => route.fulfill({ json: canonicalStats() }));
  await page.route("**/api/page-visits/stats/*", (route) => route.fulfill({ json: {
    success: true,
    stats: {
      total: 999,
      guest: 2,
      user: 3,
      chart_data: [{ date: "2026-07-31", guest_visits: 2, user_visits: 3 }],
    },
  } }));
  await page.route("**/api/author-visits/stats", (route) => route.fulfill({ json: { success: true, topAuthors: [] } }));
  await page.route("**/api/document-requests", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/admin/notifications", (route) => route.fulfill({ json: { notifications: [{ id: 1, type: "author_profile_incomplete", entityType: "author", entityId: "author-1", severity: "urgent", title: "Complete author profile", message: "Incomplete Author is missing directory information.", actionPath: "/admin/Components/author-list.html?author=author-1&action=complete", isRead: false, resolved: false, createdAt: "2026-08-01T00:00:00.000Z" }], summary: { total: 1, unread: 1, urgent: 1 } } }));
});

test("admin notification bell exposes urgent author action", async ({ page }) => {
  await page.goto("/admin/dashboard.html");
  const bell = page.getByRole("button", { name: /Notifications, 1 urgent/ });
  await expect(bell).toBeVisible();
  await bell.click();
  await expect(page.getByRole("dialog", { name: "Notifications" })).toContainText("Complete author profile");
});

test("admin routes keep one shell, identity, and navigation set", async ({ page }) => {
  await page.goto("/admin/Components/documents_list.html");
  await expect(page.getByText("Admin M User", { exact: true })).toBeVisible();
  await expect(page.getByText("Administrator", { exact: true })).toBeVisible();
  await expect(page.getByText("Guest", { exact: true })).toHaveCount(0);

  const navigation = page.getByRole("navigation", { name: "Workspace" });
  await expect(navigation.getByRole("link")).toHaveText(ADMIN_LINKS);
  await page.locator(".peas-admin-shell").evaluate((element) => element.setAttribute("data-shell-instance", "preserved"));

  await navigation.getByRole("link", { name: "Dashboard" }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard\.html$/);
  await expect(page.locator(".peas-admin-shell")).toHaveAttribute("data-shell-instance", "preserved");
  await expect(page.getByText("Checking your workspace access…")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Welcome back, Admin" })).toBeVisible();
  await expect(navigation.getByRole("link")).toHaveText(ADMIN_LINKS);

  await navigation.getByRole("link", { name: "Operational Reports" }).click();
  await expect(page.getByRole("heading", { name: "Operational Reports" })).toBeVisible();
  await expect(page.locator(".peas-admin-shell")).toHaveAttribute("data-shell-instance", "preserved");
  await expect(navigation.getByRole("link")).toHaveText(ADMIN_LINKS);
});

test("dashboard visit total is always derived from its visible parts", async ({ page }) => {
  await page.goto("/admin/dashboard.html");
  const visitCard = page.locator(".peas-dashboard-kpi").filter({ hasText: "Home visits · last 30 days" });
  await expect(visitCard.locator("strong")).toHaveText("5");
  await expect(visitCard).toContainText("2 guest + 3 registered-user visits");
  await expect(visitCard).not.toContainText("999");
});

test("permission date filters have an explicit empty state", async ({ page }) => {
  await page.goto("/admin/Components/document-permissions.html");
  await expect(page.getByText("Any date", { exact: true })).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Clear dates" })).toHaveCount(0);
  await expect(page.getByLabel("From date")).toHaveValue("");
  await expect(page.getByLabel("To date")).toHaveValue("");
});

test("standard admin layouts stay aligned and overflow-free", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  for (const path of [
    "/admin/dashboard.html",
    "/admin/Components/documents_list.html",
    "/admin/Components/reports.html",
    "/admin/Components/upload_document.html",
  ]) {
    await page.goto(path);
    await waitForWorkspace(page);
    const metrics = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      content: document.querySelector(".peas-admin-content")?.getBoundingClientRect(),
      header: document.querySelector(".peas-admin-page-header")?.getBoundingClientRect(),
    }));
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewport);
    if (metrics.content && metrics.header) expect(Math.abs(metrics.content.left - metrics.header.left)).toBeLessThanOrEqual(1);
  }

  await page.goto("/admin/Components/documents_list.html");
  await waitForWorkspace(page);
  const collapse = page.getByRole("button", { name: "Collapse sidebar" });
  await collapse.focus();
  await collapse.press("Enter");
  await expect(page.locator(".peas-admin-shell")).toHaveClass(/is-collapsed/);
  await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
  await page.getByRole("button", { name: "Expand sidebar" }).press("Enter");
  await expect(page.locator(".peas-admin-shell")).not.toHaveClass(/is-collapsed/);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/Components/documents_list.html");
  await waitForWorkspace(page);
  const mobileMetrics = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  expect(mobileMetrics.scrollWidth).toBeLessThanOrEqual(mobileMetrics.viewport);
  const openNavigation = page.getByRole("button", { name: "Open navigation" });
  await openNavigation.focus();
  await openNavigation.press("Enter");
  await expect(page.locator(".peas-admin-sidebar")).toHaveClass(/is-mobile-open/);
  await page.getByRole("button", { name: "Close navigation" }).first().press("Enter");
  await expect(page.locator(".peas-admin-sidebar")).not.toHaveClass(/is-mobile-open/);

  await page.goto("/admin/Components/upload_document.html");
  await page.addScriptTag({ content: axeSource });
  const critical = await page.evaluate(async () => (await (window as any).axe.run(document)).violations.filter((item: any) => item.impact === "critical"));
  expect(critical).toEqual([]);
});

test("legacy audit targets are React admin entries", async ({ request, baseURL }) => {
  const entries = [
    ["/admin/dashboard.html", "react-dashboard-admin-root"],
    ["/admin/Components/author-list.html", "react-authors-admin-root"],
    ["/admin/Components/reports.html", "react-reports-admin-root"],
  ];
  for (const [path, rootId] of entries) {
    const response = await request.get(`${baseURL}${path}`);
    expect(response.ok()).toBeTruthy();
    const html = await response.text();
    expect(html).toContain(`id="${rootId}"`);
    expect(html).toContain('src="/admin/react-ui/main-admin.js"');
    expect(html).not.toContain("tailwindcss.com");
    expect(html).not.toContain("fonts.googleapis.com");
  }
});

async function mockAdminIdentity(page: Page) {
  await page.route("**/api/auth/get-session", (route) => route.fulfill({ json: {
    session: { id: "session-admin" },
    user: { id: "admin-01", name: "Admin M User", role: "admin", username: "admin-01" },
  } }));
  await page.route("**/api/user/profile", (route) => route.fulfill({ json: {
    id: "admin-01", first_name: "Admin", middle_name: "M", last_name: "User",
  } }));
  await page.route("**/api/admin/contact-inquiries/summary", (route) => route.fulfill({ json: {
    byStatus: { new: 0, read: 0, resolved: 0, spam: 0 }, failedNotifications: 0, recipientConfigured: true,
  } }));
}

async function waitForWorkspace(page: Page) {
  await expect(page.locator(".peas-admin-shell")).toBeVisible();
  await expect(page.getByText("Checking your workspace access…", { exact: true })).toHaveCount(0);
}

function canonicalStats() {
  return {
    active_documents: 4,
    archived_documents: 1,
    total_documents: 5,
    catalog_entries: 3,
    archived_catalog_entries: 1,
    total_catalog_entries: 4,
    stored_documents: 4,
    author_records: 14,
    document_types: [{ document_type: "THESIS", count: 2 }, { document_type: "CONFLUENCE", count: 1 }],
    time_range: "all",
    metric_definitions: {
      catalog_entries: "Active top-level repository entries.",
      stored_documents: "Active document records, including compilation studies.",
      archived_catalog_entries: "Archived top-level repository entries.",
      author_records: "All author directory records.",
    },
  };
}
