import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
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
  await page.route("**/api/admin/notifications", (route) => route.fulfill({ json: {
    notifications: [], summary: { total: 0, unread: 0, urgent: 0 },
  } }));
  await page.route("**/api/categories", (route) => route.fulfill({ json: [
    { name: "THESIS", count: 1 },
    { name: "DISSERTATION", count: 0 },
    { name: "CONFLUENCE", count: 0 },
    { name: "SYNERGY", count: 0 },
  ] }));
  await page.route("**/api/documents?*", (route) => {
    const url = new URL(route.request().url());
    const status = url.searchParams.get("review_status") ?? "approved";
    const pending = status === "pending_review";
    return route.fulfill({ json: {
      documents: pending ? [{
        id: 2,
        title: "Pending publisher submission",
        document_type: "THESIS",
        authors: [{ full_name: "Publisher Author" }],
        publication_date: "2026-07-01",
        review_status: "pending_review",
      }] : [{
        id: 1,
        title: "Single Thesis Sample",
        document_type: "THESIS",
        authors: [{ full_name: "Cj Anadon" }],
        publication_date: "2000-01-01",
        review_status: "approved",
      }],
      totalCount: 1,
      totalPages: 1,
    } });
  });
});

test("catalog rows use labeled actions and dashboard-aligned metadata", async ({ page }) => {
  await page.goto("/admin/Components/documents_list.html");

  await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Find documents" })).toBeVisible();
  await expect(page.getByText("Single Thesis Sample", { exact: true })).toBeVisible();
  await expect(page.getByText("Publication date: newest", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "View" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Actions for Single Thesis Sample" })).toBeVisible();
  await expect(page.getByText("Archive document", { exact: true })).toHaveCount(0);
  await expect(page.locator(".peas-category-filter__icon svg")).toHaveCount(5);
  await expect(page.locator(".peas-document-card__title-row .peas-ui-badge")).toHaveCount(0);

  const categoryIconPalette = await page.locator(".peas-category-filter__icon").evaluateAll((nodes) => (
    nodes.map((node) => {
      const style = getComputedStyle(node);
      return `${style.color}|${style.backgroundColor}`;
    })
  ));
  expect(new Set(categoryIconPalette).size).toBe(5);

  const documentCardBorder = await page.locator(".peas-document-card").evaluate((node) => getComputedStyle(node).borderLeftWidth);
  expect(documentCardBorder).toBe("1px");
});

test("review status filter updates the request and URL", async ({ page }) => {
  await page.goto("/admin/Components/documents_list.html");

  await page.getByRole("combobox", { name: "Filter by review status" }).click();
  await page.getByRole("option", { name: "Pending review" }).click();

  await expect(page).toHaveURL(/status=pending_review/);
  await expect(page.getByText("Pending publisher submission", { exact: true })).toBeVisible();
  await expect(page.getByText("Pending review", { exact: true })).toBeVisible();
});

test("action menus close before document dialogs open", async ({ page }) => {
  await page.goto("/admin/Components/documents_list.html");

  await page.getByRole("button", { name: "Actions for Single Thesis Sample" }).click();
  await page.getByRole("menuitem", { name: "Edit metadata" }).click();

  const dialog = page.getByRole("dialog", { name: "Edit Document" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Save changes" })).toBeDisabled();
  await dialog.getByLabel("Title").fill("Updated title");
  await expect(dialog.getByRole("button", { name: "Save changes" })).toBeEnabled();
  page.once("dialog", (browserDialog) => browserDialog.dismiss());
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("menu")).toHaveCount(0);
});
