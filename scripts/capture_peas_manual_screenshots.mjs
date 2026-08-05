import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const PUBLIC_ROOT = join(ROOT, "Deno", "Public");
const ADMIN_ROOT = join(ROOT, "Deno", "admin");
const OUT = join(ROOT, "output", "evidence", "user_manual_screenshots");
const PORT = 18181;

const S = {
  publicUser: { id: "demo-reader", name: "Demo Reader", role: "user", email: "reader@example.invalid" },
  publisher: { id: "demo-publisher", name: "Demo Publisher", role: "publisher", username: "demo-publisher" },
  admin: { id: "demo-admin", name: "Demo Administrator", role: "admin", username: "demo-admin" },
};

const records = [
  { id: 701, title: "SAMPLE: Community Garden Water Monitoring", document_type: "THESIS", authors: [{ full_name: "Sample Researcher" }], publication_date: "2026-01-15", abstract: "A fictional demonstration record used only for this manual.", review_status: "approved", is_public: true, pages: 24, classification: { researchAgendas: [{ id: 1, name: "Sample Institutional Priority" }], topics: [{ id: 2, name: "Demonstration topic" }], keywords: [{ id: 3, name: "demo record" }] } },
  { id: 702, title: "SAMPLE: Solar Study Spaces", document_type: "DISSERTATION", authors: [{ full_name: "Demo Coauthor" }], publication_date: "2025-10-03", abstract: "Another fictional record for UI demonstration.", review_status: "approved", is_public: true, pages: 18 },
  { id: 703, title: "SAMPLE COLLECTION: Student Research Showcase 2026", document_type: "CONFLUENCE", authors: [], start_year: 2025, end_year: 2026, child_count: 2, abstract: "A fictional compiled collection for the demonstration manual.", review_status: "approved", is_public: true },
  { id: 704, title: "SAMPLE: Pending Publisher Submission", document_type: "THESIS", authors: [{ full_name: "Demo Author" }], publication_date: "2026-07-01", review_status: "pending_review", is_public: false },
];

const reportFixture = {
  meta: { dataVersion: 3, generatedAt: "2026-08-05T08:00:00.000Z", timezone: "Asia/Manila", range: { key: "30d", label: "Last 30 days", startInclusive: "2026-07-06T16:00:00.000Z", endExclusive: "2026-08-05T16:00:00.000Z", bucket: "day" }, activityCoverageStartedAt: "2026-07-01T16:00:00.000Z", trafficV3StartedAt: "2026-08-01T16:00:00.000Z", coverage: {} },
  inventory: { catalogEntries: 12, storedDocuments: 18, archivedCatalogEntries: 2, archivedDocuments: 3, authorRecords: 9, publishedAuthors: 7 },
  workflow: { pendingUploads: 2, pendingAccessRequests: 1 },
  activity: { sitePageViews: { total: 84, guest: 51, registered: 33 }, siteVisits: { total: 29, guest: 18, registered: 11 }, homePageViews: { total: 37, guest: 24, registered: 13 }, uploadedEntries: 4, repositoryViews: 46, repositoryDownloads: 9, guestRepositoryViews: 20, registeredRepositoryViews: 26, authorProfileViews: 14, topicWorkViews: 18, guestViews: 20, registeredViews: 26, approvedRequestDownloads: 2, activeRegisteredUsers: 6, activeRegisteredReaders: 6, homeVisits: { total: 37, guest: 24, registered: 13 } },
  series: { uploads: [{ bucket: "2026-08-01T16:00:00.000Z", count: 4 }], repositoryActivity: [{ bucket: "2026-08-01T16:00:00.000Z", views: 46, downloads: 9 }], homeVisits: [{ bucket: "2026-08-01T16:00:00.000Z", guest: 24, registered: 13, total: 37 }], siteTraffic: [{ bucket: "2026-08-01T16:00:00.000Z", pageViews: 84, visits: 29, guestPageViews: 51, registeredPageViews: 33, guestVisits: 18, registeredVisits: 11 }] },
  rankings: { mostViewedEntries: [{ title: records[0].title, category: "THESIS", views: 19 }, { title: records[1].title, category: "DISSERTATION", views: 14 }], mostDownloadedEntries: [{ title: records[0].title, category: "THESIS", downloads: 5 }], mostVisitedAuthors: [{ name: "Sample Researcher", views: 12 }], mostViewedAuthors: [{ name: "Sample Researcher", views: 12 }], trendingTopics: [{ name: "Demonstration topic", works: 3, views: 18 }] },
  distributions: { documentTypes: [{ label: "THESIS", count: 7 }, { label: "DISSERTATION", count: 3 }, { label: "CONFLUENCE", count: 2 }], requestStatuses: [{ status: "pending", count: 1 }, { status: "approved", count: 4 }, { status: "rejected", count: 0 }] },
  registeredReaderSummary: { activeUsers: 6, views: 26, downloads: 9, averageInteractionsPerActiveUser: 5.83 },
  metricDefinitions: { catalog_entries: "Current catalog entries", repository_views: "Successful repository views", site_page_views: "Successful tracked public HTML page loads", site_visits: "Whole-site browsing sessions", active_registered_readers: "Distinct signed-in readers" },
};

const experience = {
  schemaVersion: 3,
  pages: {
    landing: { data: { content: [] } },
    login: { data: { content: [] } },
  },
};

const categories = [
  { name: "THESIS", count: 7 },
  { name: "DISSERTATION", count: 3 },
  { name: "CONFLUENCE", count: 2 },
  { name: "SYNERGY", count: 0 },
];

const newsPosts = [{
  id: 801,
  title: "SAMPLE: Research Orientation Week",
  slug: "sample-research-orientation-week",
  excerpt: "A fictional Department News story for this manual.",
  body: "This demonstration article contains no live institutional data.",
  bodyFormat: "plain",
  coverImageUrl: "/Components/images/peas-news-1-p-500.png",
  coverImageAlt: "Fictional research orientation illustration",
  coverMediaId: null,
  authorName: "Office of Research & Publications",
  status: "published",
  publishedAt: "2026-08-01T00:00:00.000Z",
  createdAt: "2026-07-30T00:00:00.000Z",
  updatedAt: "2026-07-30T00:00:00.000Z",
  taggedAuthors: [], taggedWorks: [], media: [],
}];

function json(value, status = 200) {
  return { status, contentType: "application/json", body: JSON.stringify(value) };
}

function samplePdf() {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Length 235 >>\nstream\nBT\n/F1 24 Tf\n72 710 Td\n(SAMPLE RESEARCH PAPER) Tj\n/F1 15 Tf\n0 -42 Td\n(Community Garden Water Monitoring) Tj\n/F1 11 Tf\n0 -34 Td\n(Fictional demonstration page - no live repository data.) Tj\n0 -28 Td\n(This page is included to show reader controls.) Tj\n0 -72 Td\n(Introduction) Tj\n0 -20 Td\n(Use the toolbar to zoom, save, mark as read, download, or add notes.) Tj\nET\nendstream"
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(Buffer.byteLength(pdf, "binary"));
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, "binary");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i += 1) pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "binary");
}

function sessionFor(role) {
  const user = role === "admin" ? S.admin : role === "publisher" ? S.publisher : S.publicUser;
  return { session: { id: `session-${user.id}` }, user };
}

function documentsPayload(url) {
  const status = url.searchParams.get("review_status") ?? "approved";
  const filtered = status === "pending_review" ? records.filter((r) => r.review_status === "pending_review") : records.filter((r) => r.review_status === "approved");
  return { documents: filtered, totalCount: filtered.length, totalPages: filtered.length ? 1 : 0, currentPage: 1 };
}

function fixture(url, method) {
  const path = url.pathname;
  if (path === "/api/auth/get-session") return url.searchParams.get("role") ? json(sessionFor(url.searchParams.get("role"))) : json(null);
  if (path === "/api/user/profile") return json({ id: "demo-reader", first_name: "Demo", last_name: "Reader", email: "reader@example.invalid", role: "user", email_verified: true, can_change_password: true });
  if (path === "/api/experience/public") return json(experience);
  if (path === "/api/categories") return json(categories);
  if (path === "/api/documents") return json(documentsPayload(url));
  if (path === "/api/research-agendas" || path === "/api/admin/research-agendas") return json([{ id: 1, name: "Sample Institutional Priority", isActive: true, is_active: true, sortOrder: 1, documentCount: 2, primaryDocumentCount: 1 }]);
  if (path === "/api/trending-keywords") return json(["demo record", "sample topic", "community research"]);
  if (path === "/api/page-visits/home-stats") return json({ totalVisits: 37, guestVisits: 24, userVisits: 13 });
  if (path === "/api/authors/all") return json([{ id: "author-demo", full_name: "Sample Researcher", department: "Demonstration Department", affiliation: "Sample University" }, { id: "author-demo-2", full_name: "Demo Coauthor", department: "Demonstration Department", affiliation: "Sample University" }]);
  if (path === "/api/news" || path === "/api/admin/news") return json(path === "/api/admin/news" ? { posts: newsPosts } : { posts: newsPosts, totalCount: 1, totalPages: 1, currentPage: 1 });
  if (path === "/api/search/suggestions") return json({ suggestions: [] });
  if (path.startsWith("/api/guest/documents/") || path.startsWith("/api/documents/")) {
    const id = Number(path.split("/").pop());
    const record = records.find((r) => r.id === id) ?? records[0];
    return json({ success: true, document: record });
  }
  if (path === "/api/guest/documents/701/authors" || path === "/api/document-authors/701") return json({ authors: [{ full_name: "Sample Researcher", id: "author-demo" }] });
  if (path.startsWith("/api/papers/") && path.endsWith("/stream")) return { status: 200, contentType: "application/pdf", body: samplePdf() };
  if (path.startsWith("/api/papers/") && path.includes("/pages/")) return { status: 200, contentType: "image/svg+xml", body: `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="#f8faf8"/><rect x="80" y="70" width="1040" height="90" rx="12" fill="#006b4e"/><text x="120" y="128" font-family="Arial" font-size="34" font-weight="700" fill="white">SAMPLE RESEARCH PAPER</text><text x="100" y="240" font-family="Arial" font-size="26" fill="#17324d">Community Garden Water Monitoring</text><line x1="100" y1="290" x2="1080" y2="290" stroke="#d5ded8" stroke-width="3"/><g fill="#9aaba1"><rect x="100" y="340" width="900" height="16" rx="8"/><rect x="100" y="380" width="820" height="16" rx="8"/><rect x="100" y="420" width="940" height="16" rx="8"/><rect x="100" y="460" width="770" height="16" rx="8"/><rect x="100" y="560" width="400" height="150" rx="12" fill="#e6f1eb"/><rect x="540" y="560" width="500" height="16" rx="8"/><rect x="540" y="600" width="430" height="16" rx="8"/><rect x="540" y="640" width="470" height="16" rx="8"/></g></svg>` };
  if (path === "/api/user/library") return json({ success: true, items: [{ record_id: 701, record_type: "document", title: records[0].title, category: "Thesis", document_type: "Thesis", author_names: ["Sample Researcher"], child_count: 0, saved_at: "2026-08-02T09:00:00.000Z", read_at: null, availability: "available", annotation_count: 2 }], documents: [{ record_id: 701, record_type: "document", title: records[0].title, category: "Thesis", document_type: "Thesis", author_names: ["Sample Researcher"], child_count: 0, saved_at: "2026-08-02T09:00:00.000Z", read_at: null, availability: "available", annotation_count: 2 }], count: 1, totalCount: 1, totalPages: 1, currentPage: 1, filters: { availableCategories: ["Thesis"] } });
  if (path === "/api/user/history") return json({ success: true, items: [{ id: "history-demo", record_id: 701, record_type: "document", title: records[0].title, category: "Thesis", author_names: ["Sample Researcher"], last_accessed_at: "2026-08-03T09:00:00.000Z", latest_action: "VIEW", view_count: 2, download_count: 0, event_count: 2, availability: "available" }], totalCount: 1, totalPages: 1, currentPage: 1, filters: { availableCategories: ["Thesis"], availableActions: ["VIEW"] } });
  if (path === "/api/user/annotation-capabilities") return json({ success: true, enabled: true });
  if (path === "/api/user/annotations") return json({ success: true, items: [{ id: "annotation-demo", document_id: 701, source_id: "source-demo", annotation_type: "highlight", anchor_type: "text", page_number: 4, selected_text: "A useful demonstration passage", text_prefix: "Before ", text_suffix: " after", rects: [{ x: 0.1, y: 0.2, width: 0.4, height: 0.05 }], color: "yellow", label: "Review", note_text: "A fictional private note.", tags: ["demo"], title: records[0].title, document_available: true, needs_review: false, created_at: "2026-08-01T08:00:00.000Z", updated_at: "2026-08-02T08:00:00.000Z", reading_last_page: 4, reading_page_count: 24 }], totalCount: 1, totalPages: 1, page: 1 });
  if (path.startsWith("/api/user/documents/") && path.endsWith("/annotation-context")) return json({ success: true, source: { id: "source-demo", pageCount: 24 }, page: 1, annotations: [], counts: {}, progress: { lastPage: 1, pageCount: 24, updatedAt: null }, tags: ["demo"] });
  if (path.startsWith("/api/user/documents/") && path.endsWith("/annotations")) return json({ success: true, items: [], totalCount: 0, totalPages: 0, page: 1, size: 20 });
  if (path.startsWith("/api/user/library/check")) return json({ inLibrary: true, count: 1 });
  if (path.startsWith("/api/user/read-status")) return json({ success: true, read: false, readAt: null, recordId: 701, recordType: "document" });
  if (path === "/api/admin/dashboard" || path === "/api/admin/reports/operational") return json(reportFixture);
  if (path === "/api/admin/contact-inquiries/summary") return json({ byStatus: { new: 1, read: 0, resolved: 0, spam: 0 }, failedNotifications: 0, recipientConfigured: true });
  if (path === "/api/admin/notifications") return json({ notifications: [], summary: { total: 0, unread: 0, urgent: 0 } });
  if (path === "/api/admin/author-reference-data") return json({ departments: [{ id: 1, name: "Demonstration Department", code: "DEMO" }], affiliations: [{ id: 1, name: "Sample University" }] });
  if (path === "/api/admin/users") return json({ users: [{ id: "demo-reader", name: "Demo Reader", email: "reader@example.invalid", role: "user", created_at: "2026-01-01" }] });
  if (path.startsWith("/api/admin/abstract-reviews")) return json({ items: [] });
  if (path === "/api/admin/topics" || path === "/api/admin/keywords") return json([]);
  if (path === "/api/user/profile" || method !== "GET") return json({ success: true });
  return null;
}

function mime(path) {
  return ({ ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".mjs": "text/javascript" })[extname(path).toLowerCase()] ?? "application/octet-stream";
}

async function serveFile(req, res) {
  const requestPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  let root = PUBLIC_ROOT;
  let relative = requestPath.replace(/^\//, "");
  if (requestPath.startsWith("/admin/")) { root = ADMIN_ROOT; relative = requestPath.replace(/^\/admin\//, ""); }
  const target = normalize(join(root, relative));
  if (!target.startsWith(root)) { res.writeHead(403); res.end("Forbidden"); return; }
  try {
    const info = await stat(target);
    if (!info.isFile()) throw new Error("Not a file");
    res.writeHead(200, { "Content-Type": mime(target), "Cache-Control": "no-store" });
    res.end(await readFile(target));
  } catch {
    res.writeHead(404); res.end("Not found");
  }
}

async function main() {
  await stat(join(ROOT, "Deno", "Public", "react-ui", "main-public.js"));
  await stat(join(ROOT, "Deno", "admin", "react-ui", "main-admin.js"));
  const server = createServer((req, res) => { void serveFile(req, res); });
  await new Promise((resolveReady) => server.listen(PORT, "127.0.0.1", resolveReady));
  const browser = await chromium.launch({ headless: true });
  const fixtureRequests = [];
  const unhandled = [];
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2, reducedMotion: "reduce" });
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== `http://127.0.0.1:${PORT}`) { await route.abort(); return; }
    if (url.pathname.startsWith("/api/")) {
      const payload = fixture(url, request.method());
      if (!payload) {
        unhandled.push(`${request.method()} ${url.pathname}${url.search}`);
        await route.fulfill(json({}));
        return;
      }
      fixtureRequests.push(`${request.method()} ${url.pathname}${url.search}`);
      await route.fulfill(payload);
      return;
    }
    await route.continue();
  });

  const captures = [
    ["01-public-home.png", "/index.html", null, async (page) => page.locator(".peas-public-hero")],
    ["02-public-search.png", "/pages/searchResultsPage.html", null, async (page) => page.locator(".peas-public-search-hero")],
    ["03-login.png", "/log-in.html", null, async (page) => page.locator(".peas-login-page")],
    ["04-guest-document.png", "/pages/guest-single.html?id=701", null, async (page) => page.locator(".peas-request-dialog")],
    ["05-reader-document.png", "/pages/user-single.html?id=701", "user", async (page) => page.locator(".peas-document-reader")],
    ["06-reader-saved.png", "/pages/SavedDocument.html", "user", async (page) => page.locator(".peas-account-shell")],
    ["07-reader-annotations.png", "/pages/UserAnnotations.html", "user", async (page) => page.locator(".peas-account-shell")],
    ["08-publisher-news.png", "/admin/Components/news.html", "publisher", async (page) => page.locator(".peas-admin-content")],
    ["09-publisher-upload.png", "/admin/Components/upload_document.html", "publisher", async (page) => page.locator(".peas-admin-content")],
    ["10-admin-dashboard.png", "/admin/dashboard.html", "admin", async (page) => page.locator(".peas-admin-shell")],
    ["11-admin-documents.png", "/admin/Components/documents_list.html", "admin", async (page) => page.locator(".peas-admin-shell")],
    ["12-admin-reports.png", "/admin/Components/reports.html?range=30d", "admin", async (page) => page.locator(".peas-admin-shell")],
  ];
  for (const [name, path, role, target] of captures) {
    const page = await context.newPage();
    if (role) {
      await page.route("**/api/auth/get-session", (route) => route.fulfill(json(sessionFor(role))));
      if (role === "publisher") await page.route("**/api/user/profile", (route) => route.fulfill(json({ id: S.publisher.id, first_name: "Demo", last_name: "Publisher", role: "publisher" })));
      if (role === "admin") await page.route("**/api/user/profile", (route) => route.fulfill(json({ id: S.admin.id, first_name: "Demo", last_name: "Administrator", role: "admin" })));
    }
    await page.goto(`http://127.0.0.1:${PORT}${path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    if (name === "04-guest-document.png") {
      await page.getByRole("button", { name: "Request access" }).click();
      await page.locator(".peas-request-dialog").waitFor({ state: "visible" });
    }
    const locator = await target(page);
    await locator.screenshot({ path: join(OUT, name), animations: "disabled" });
    await page.close();
  }
  await context.close();
  await browser.close();
  await new Promise((resolveClosed) => server.close(resolveClosed));
  if (unhandled.length) throw new Error(`Unhandled API fixtures:\n${[...new Set(unhandled)].join("\n")}`);
  await (await import("node:fs/promises")).writeFile(join(OUT, "capture-manifest.json"), JSON.stringify({ generatedAt: "2026-08-05", source: "static local UI with fixture-intercepted APIs", databaseConnected: false, fixtureRequests: [...new Set(fixtureRequests)], screenshots: captures.map(([name]) => name) }, null, 2));
}

await (await import("node:fs/promises")).mkdir(OUT, { recursive: true });
await main();
