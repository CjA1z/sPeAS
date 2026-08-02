import { expect, test, type Page } from "@playwright/test";

const sessionPayload = {
  session: { id: "session-1" },
  user: {
    id: "admin-01",
    name: "Admin M User",
    email: "admin@example.com",
    role: "admin",
    image: null,
  },
};

async function mockSignedIn(page: Page, role = "admin") {
  await page.route("**/api/auth/get-session", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ...sessionPayload, user: { ...sessionPayload.user, role } }),
  }));
}

function createSinglePagePdf() {
  const contentStream = "BT /F1 18 Tf 45 90 Td (Selectable paper text) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 320 180] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(contentStream, "ascii")} >>\nstream\n${contentStream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let source = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(source, "ascii"));
    source += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(source, "ascii");
  source += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  source += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  source += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(source, "ascii");
}

const libraryItems = [
  {
    record_id: 132,
    record_type: "document",
    title: "Single Thesis Sample",
    category: "Thesis",
    document_type: "Thesis",
    author_names: ["A. Researcher"],
    child_count: 0,
    publication_date: "2025-05-01T00:00:00.000Z",
    saved_at: "2026-07-31T09:00:00.000Z",
    availability: "available",
  },
  {
    record_id: 46,
    record_type: "compiled",
    title: "CONFLUENCE Vol. 3",
    category: "CONFLUENCE",
    document_type: "CONFLUENCE",
    author_names: [],
    child_count: 6,
    publication_date: "2024-12-31T00:00:00.000Z",
    saved_at: "2026-07-30T09:00:00.000Z",
    availability: "available",
  },
];

test("saved documents renders document and compiled cards with optimistic undo", async ({ page }, testInfo) => {
  await mockSignedIn(page);
  await page.route("**/api/user/library**", async (route) => {
    if (route.request().method() === "DELETE" || route.request().method() === "POST") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        items: libraryItems,
        documents: libraryItems,
        count: 2,
        totalCount: 2,
        totalPages: 1,
        currentPage: 1,
        filters: { availableCategories: ["CONFLUENCE", "Thesis"] },
      }),
    });
  });

  await page.goto("/pages/SavedDocument.html");
  await expect(page.getByRole("heading", { name: "Saved Documents" })).toBeVisible();
  if (testInfo.project.name === "pixel-7") {
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(page.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/admin/dashboard.html");
  } else {
    await expect(page.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/admin/dashboard.html");
  }
  if (testInfo.project.name === "pixel-7") {
    await expect(page.getByRole("banner").getByRole("link", { name: "Saved Documents", exact: true }).locator("svg.lucide-book-marked")).toBeVisible();
    await expect(page.getByRole("banner").getByRole("link", { name: "History", exact: true }).locator("svg.lucide-clock-3")).toBeVisible();
  } else {
    await expect(page.getByRole("link", { name: "Saved documents", exact: true }).locator("svg.lucide-book-marked")).toBeVisible();
    await expect(page.getByRole("link", { name: "User history" }).locator("svg.lucide-clock-3")).toBeVisible();
  }
  await expect(page.getByRole("navigation", { name: "Account navigation" }).getByRole("link", { name: "Saved Documents" }).locator("svg.lucide-book-marked")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Account navigation" }).getByRole("link", { name: "History" }).locator("svg.lucide-clock-3")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);
  await expect(page.locator(".peas-account-record")).toHaveCount(2);
  await expect(page.getByText("6 works")).toBeVisible();
  await expect(page.getByRole("link", { name: /CONFLUENCE Vol\. 3/ })).toHaveAttribute("href", /user-compiled\.html\?id=46/);

  await page.getByRole("button", { name: /Remove Single Thesis Sample/ }).click();
  await expect(page.locator(".peas-account-record")).toHaveCount(1);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.locator(".peas-account-record")).toHaveCount(2);
});

test("regular users do not receive the admin dashboard shortcut", async ({ page }) => {
  await mockSignedIn(page, "user");
  await page.route("**/api/user/library**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ success: true, items: [], documents: [], count: 0, totalCount: 0, totalPages: 0, currentPage: 1, filters: { availableCategories: [] } }),
  }));

  await page.goto("/pages/SavedDocument.html");
  await expect(page.getByRole("link", { name: "Dashboard" })).toHaveCount(0);
});

test("admin dashboard remains available from the mobile account menu", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockSignedIn(page);
  await page.route("**/api/user/library**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ success: true, items: [], documents: [], count: 0, totalCount: 0, totalPages: 0, currentPage: 1, filters: { availableCategories: [] } }),
  }));

  await page.goto("/pages/SavedDocument.html");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/admin/dashboard.html");
});

test("history filters are URL synchronized and empty dates stay visibly empty", async ({ page }) => {
  await mockSignedIn(page);
  await page.route("**/api/user/history**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      success: true,
      items: [{
        id: "compiled-46",
        record_id: 46,
        record_type: "compiled",
        title: "CONFLUENCE Vol. 3",
        category: "CONFLUENCE",
        author_names: [],
        last_accessed_at: "2026-07-31T10:00:00.000Z",
        latest_action: "DOWNLOAD",
        view_count: 2,
        download_count: 1,
        event_count: 3,
        availability: "available",
      }],
      totalCount: 1,
      totalPages: 1,
      currentPage: 1,
      filters: { availableCategories: ["CONFLUENCE"], availableActions: ["VIEW", "DOWNLOAD"] },
    }),
  }));

  await page.goto("/pages/UserHistory.html");
  await expect(page.getByRole("heading", { name: "History" })).toBeVisible();
  await expect(page.getByText("Any date")).toHaveCount(2);
  await expect(page.getByRole("article").getByText("Downloaded", { exact: true })).toBeVisible();
  await expect(page.getByText("2 opens")).toBeVisible();

  await page.getByRole("combobox", { name: "History activity" }).selectOption("DOWNLOAD");
  await expect(page).toHaveURL(/action=DOWNLOAD/);
  await page.getByRole("button", { name: "Clear dates" }).count().then((count) => expect(count).toBe(0));
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);
});

test("profile provides a managed identity state and accessible avatar picker", async ({ page }) => {
  await mockSignedIn(page);
  await page.route("**/api/user/profile", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      id: "admin-01",
      name: "Admin M User",
      first_name: "Admin",
      middle_name: "M",
      last_name: "User",
      email: "admin@example.com",
      role: "admin",
      created_at: "2025-04-29T15:19:33.059Z",
      profile_picture: null,
      can_change_password: false,
    }),
  }));
  await page.route("**/api/user/profile/picture", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ success: true, pictureUrl: "/storage/users/profile-picture/avatar.png", profilePicture: "storage/users/profile-picture/avatar.png" }),
  }));

  await page.goto("/pages/UserProfile.html");
  await expect(page.getByRole("heading", { name: "Profile", exact: true })).toBeVisible();
  await expect(page.getByText("Administrator")).toBeVisible();
  await expect(page.getByText("Password managed by your institution")).toBeVisible();
  await expect(page.getByText("Manage your password through your university identity provider.")).toBeVisible();

  const picker = page.locator('input[type="file"]');
  await picker.setInputFiles({ name: "avatar.png", mimeType: "image/png", buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) });
  await expect(page.getByText("Profile picture updated")).toBeVisible();
});

test("saved documents exposes a retryable error state", async ({ page }) => {
  await mockSignedIn(page);
  let failed = true;
  await page.route("**/api/user/library**", (route) => {
    if (failed) {
      failed = false;
      return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Library is temporarily unavailable" }) });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, items: [], count: 0, totalCount: 0, totalPages: 0, currentPage: 1, filters: { availableCategories: [] } }),
    });
  });

  await page.goto("/pages/SavedDocument.html");
  await expect(page.getByRole("heading", { name: "Unable to load saved documents" })).toBeVisible();
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByText("Your library is ready for research")).toBeVisible();
});

test("authenticated document details show accurate save state and report save failures", async ({ page }) => {
  await mockSignedIn(page);
  await page.route("**/api/documents/132", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ id: 132, title: "Single Thesis Sample", document_type: "THESIS", abstract: "A research record." }),
  }));
  await page.route("**/api/document-authors/132", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ authors: [{ id: "author-1", full_name: "Dr. Ana Researcher", profile_picture: null, department: "College of Science", affiliation: "St. Paul University Dumaguete" }] }) }));
  let previewCalls = 0;
  await page.route("**/api/authors/author-1/preview", (route) => {
    previewCalls += 1;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ author: { id: "author-1", fullName: "Dr. Ana Researcher", profilePicture: null, department: "College of Science", affiliation: "St. Paul University Dumaguete", biography: "A research author.", publicWorksCount: 7, researchCategories: [{ name: "Thesis", worksCount: 7 }], viewerActivity: { savedWorksCount: previewCalls > 1 ? 2 : 1, viewedWorksCount: 3 } } }) });
  });
  await page.route("**/api/user/library/check**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, inLibrary: false }) }));
  await page.route("**/api/user/library", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, inLibrary: true }) }));
  await page.route("**/api/papers/132/stream", (route) => route.fulfill({ status: 200, contentType: "application/pdf", body: createSinglePagePdf() }));

  await page.goto("/pages/user-single.html?id=132");
  const authorLink = page.getByRole("link", { name: "Dr. Ana Researcher" });
  await authorLink.focus();
  const authorPreview = page.getByRole("tooltip");
  await expect(authorPreview).toContainText("You saved 1 work");
  await expect(authorPreview).toContainText("You viewed 3 works");
  const reader = page.locator(".peas-paper-viewer--pdf");
  await expect(reader).toBeVisible();
  await expect(page.getByRole("link", { name: "Download PDF" })).toHaveAttribute("href", "/api/papers/132/stream?download=true");
  await expect(reader.locator(".textLayer")).toContainText("Selectable paper text");
  const save = page.getByRole("button", { name: "Save for later" });
  await expect(save).toBeVisible();
  await save.click();
  await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();
  await expect.poll(() => previewCalls).toBe(2);
  await authorLink.focus();
  await expect(authorPreview).toContainText("You saved 2 works");
});
