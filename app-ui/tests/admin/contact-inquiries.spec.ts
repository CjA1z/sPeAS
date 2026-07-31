import { expect, test } from "@playwright/test";

test("contact inquiry admin APIs reject unauthenticated access", async ({ request, baseURL }) => {
  for (const path of ["/api/admin/contact-inquiries", "/api/admin/contact-inquiries/summary"]) {
    const response = await request.get(`${baseURL}${path}`);
    expect([401, 403]).toContain(response.status());
  }
});

test("admin Contact Inquiries entry uses the React admin bundle", async ({ page }) => {
  await page.goto("/admin/Components/contact-inquiries.html");
  await expect(page.locator("#react-contact-inquiries-admin-root")).toBeVisible();
  await expect(page.locator('script[src="/admin/react-ui/main-admin.js"]')).toHaveCount(1);
});
