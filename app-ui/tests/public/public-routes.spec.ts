import { expect, test } from "@playwright/test";
import { source as axeSource } from "axe-core";

const routes = [
  "/index.html", "/news.html", "/pages/searchResultsPage.html", "/contact.html",
  "/pages/miscellaneous/T&A-Public.html", "/pages/miscellaneous/Privacy.html",
  "/log-in.html", "/reset-password.html", "/pages/authorprofile.html",
  "/pages/guest-single.html", "/pages/guest-compiled.html",
];

for (const route of routes) {
  test(`${route} uses the shared public application`, async ({ page }) => {
    const response = await page.goto(route);
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator("#react-public-root")).toBeVisible();
    await expect(page.locator('script[src="/react-ui/main-public.js"]')).toHaveCount(1);
    const forbidden = await page.locator('script[src*="jquery"],script[src*="tailwindcss"],script[src*="flowbite"],script[src*="publicRuntime"],link[href*="fonts.googleapis"]').count();
    expect(forbidden).toBe(0);
  });
}

test("contact validates fields and preserves values after a failed submission", async ({ page }) => {
  await page.route("/api/contact-inquiries", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Temporarily unavailable" }) }));
  await page.goto("/contact.html");
  await page.locator("#contact-first-name").fill("Jane"); await page.locator("#contact-last-name").fill("Doe");
  await page.locator("#contact-email").fill("jane@example.com"); await page.locator("#contact-subject").fill("Repository access");
  await page.locator("#contact-message").fill("Please help me access the repository record.");
  await page.getByRole("button", { name: "Send inquiry" }).click();
  await expect(page.locator(".peas-contact-error")).toBeVisible();
  await expect(page.locator("#contact-message")).toHaveValue("Please help me access the repository record.");
});

test("home has no critical Axe violations and mobile navigation opens", async ({ page }, testInfo) => {
  await page.goto("/index.html");
  if (testInfo.project.name === "pixel-7") {
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(page.locator(".peas-public-mobile-panel")).toBeVisible();
  }
  await page.addScriptTag({ content: axeSource });
  const critical = await page.evaluate(async () => (await (window as any).axe.run(document)).violations.filter((item: any) => item.impact === "critical"));
  expect(critical).toEqual([]);
});

test("home renders published organization-chart content", async ({ page }) => {
  await page.route("/api/experience/public", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      source: "published",
      config: {
        schemaVersion: 2,
        pages: {
          landing: {
            data: {
              content: [{
                type: "ImageFeatureBlock",
                props: {
                  id: "org-chart",
                  title: "Our research leadership",
                  body: "Meet the people supporting university research.",
                  roles: [{
                    id: "director-orp",
                    title: "Research Office Director",
                    label: "Director",
                    caption: "Research Leadership",
                    name: "Dr. Ada Paul",
                    summary: "Coordinates the university research program.",
                  }],
                },
              }],
            },
          },
          login: { data: { content: [] } },
        },
      },
    }),
  }));

  await page.goto("/index.html");
  await expect(page.getByRole("heading", { name: "Our research leadership" })).toBeVisible();
  const director = page.getByRole("button", { name: /Dr\. Ada Paul, Research Office Director/ });
  await expect(director).toBeVisible();
  await director.click();
  await expect(page.getByText("Coordinates the university research program.")).toBeVisible();
});

test("organization chart details stay within the responsive layout", async ({ page }, testInfo) => {
  const tablet = testInfo.project.name === "desktop";
  const viewport = tablet ? { width: 820, height: 1180 } : { width: 390, height: 844 };
  await page.setViewportSize(viewport);
  await page.goto("/index.html#org-chart");

  const menu = page.getByRole("button", { name: "Open navigation" });
  const menuBox = await menu.boundingBox();
  expect(menuBox).not.toBeNull();
  expect(viewport.width - (menuBox?.x ?? 0) - (menuBox?.width ?? 0)).toBeLessThanOrEqual(20);

  await page.getByRole("button", { name: /details for Associate Assistant/ }).click();
  const chart = page.locator(".peas-org-chart");
  const tree = page.locator(".peas-org-tree");
  const detail = page.locator(".peas-org-detail");
  await expect(detail).toBeVisible();

  const [chartBox, treeBox, detailBox, detailPosition, pageWidth] = await Promise.all([
    chart.boundingBox(),
    tree.boundingBox(),
    detail.boundingBox(),
    detail.evaluate((element) => getComputedStyle(element).position),
    page.evaluate(() => document.documentElement.scrollWidth),
  ]);

  expect(pageWidth).toBeLessThanOrEqual(viewport.width);
  expect(chartBox).not.toBeNull();
  expect(treeBox).not.toBeNull();
  expect(detailBox).not.toBeNull();

  if (tablet) {
    expect(detailPosition).toBe("sticky");
    expect(detailBox?.x ?? 0).toBeGreaterThan((treeBox?.x ?? 0) + (treeBox?.width ?? 0));
    expect((detailBox?.x ?? 0) + (detailBox?.width ?? 0)).toBeLessThanOrEqual(
      (chartBox?.x ?? 0) + (chartBox?.width ?? 0),
    );
  } else {
    expect(detailPosition).toBe("fixed");
    expect(detailBox?.height ?? Infinity).toBeLessThanOrEqual(viewport.height * 0.45 + 1);
    expect((detailBox?.y ?? 0) + (detailBox?.height ?? 0)).toBeLessThan(viewport.height);
  }
});

test("protected account route redirects with a same-origin return path", async ({ page }) => {
  await page.goto("/pages/SavedDocument.html");
  await expect(page).toHaveURL(/\/log-in\.html\?redirect=/);
});
