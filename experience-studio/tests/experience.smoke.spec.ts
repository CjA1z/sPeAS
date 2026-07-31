import { expect, test } from "@playwright/test";
import { source as axeSource } from "axe-core";

async function expectNoCriticalA11yViolations(page: import("@playwright/test").Page) {
  await page.addScriptTag({ content: axeSource });
  const results = await page.evaluate(async () => {
    return await (window as any).axe.run(document, {
      resultTypes: ["violations"],
    });
  });

  const critical = results.violations.filter((violation: any) => violation.impact === "critical");
  expect(critical, critical.map((violation: any) => violation.id).join(", ")).toHaveLength(0);
}

test("public experience API and runtime pages load", async ({ page, request, baseURL }) => {
  const publicResponse = await request.get(`${baseURL}/api/experience/public`);
  expect(publicResponse.ok()).toBeTruthy();
  await expect(await publicResponse.json()).toEqual(expect.objectContaining({ source: expect.any(String) }));

  await page.goto("/index.html");
  await expect(page.locator("#react-public-root")).toBeVisible();
  await expect(page.locator(".peas-public-navbar")).toBeVisible();
  await expect(page.locator("#public-home-title")).toBeVisible();
  await expectNoCriticalA11yViolations(page);

  await page.goto("/log-in.html");
  await expect(page.locator("#react-public-root")).toBeVisible();
  await expect(page.locator("#school-id")).toBeVisible();
  await expect(page.locator("#password")).toBeVisible();
  await expectNoCriticalA11yViolations(page);
});

test("experience admin and user APIs stay protected", async ({ request, baseURL }) => {
  const draftResponse = await request.get(`${baseURL}/api/admin/experience/draft`);
  expect([401, 403]).toContain(draftResponse.status());

  const preferenceResponse = await request.get(`${baseURL}/api/user/experience-preferences`);
  expect(preferenceResponse.status()).toBe(401);

  const profileResponse = await request.get(`${baseURL}/api/user/profile?userId=someone-else`);
  expect(profileResponse.status()).toBe(401);
});
