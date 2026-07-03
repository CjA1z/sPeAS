# PeAS Refactoring Plan

Created 2026-07-03, after the dead-code sweep (27 dead files deleted, `deno task check` green).
Scope: the files flagged as needing refactoring in the >450-line audit. Phases are ordered
backend-first (type-checked, low risk) → frontend (untyped, needs manual verification).
Each phase is independently shippable; one commit per extraction step.

## Ground rules (apply to every phase)

- **Never change API shapes or URLs.** These refactors are pure moves/dedupes; the frontend and
  any external consumers must not notice.
- Run `deno task check` after every backend step; it must stay at zero errors.
- Keep the established conventions: controllers take web-standard `Request` and return
  `Response` (server.ts converts oak ctx); use `getErrorMessage` from `utils/errorHandler.ts`
  on untyped catches; pin oak imports via `deps.ts`.
- One route group / one module extraction per commit, so any regression bisects cleanly.

## Phase 0 — Safety net (do first, ~small)

There is no test suite. Before touching behavior-bearing code, build a cheap regression harness:

1. Commit the dead-file deletion separately so refactor diffs stay clean.
2. Write `Deno/scripts/smoke.ts`: hits ~20 key GET endpoints (`/ping`, `/api/documents`,
   `/api/authors/all`, `/api/category`, `/api/compiled-documents/:id`, page-visit stats,
   archive list, etc.) against a running dev server and snapshots status + JSON shape
   (top-level keys, array lengths) to `scratch/golden/*.json`. Re-run after each phase and
   diff. This is the acceptance gate for phases 1–5.

## Phase 1 — server.ts (2,295 → ~500 lines)

**Problem:** 42 routes registered in server.ts, ~15 of them with full inline handler bodies
(50–140 lines each), while other features already live in `routes/` modules.

**Inline handler groups and where they go:**

| server.ts lines | Routes | Destination |
|---|---|---|
| 267–293 | `/api/category`, `/api/documents/count-by-category` | `categoryController` (exists) + register in a new `routes/categoryRoutes.ts` |
| 295–455 | `/api/documents` GET/POST, `/:id/children` | `documentController` (exists) + `routes/documentRoutes.ts` (exists) |
| 461–482 | `/api/document-authors/:documentId` | `documentAuthorController` (exists) |
| 484–871 | `/api/authors/*` (all, search, works, update), `/api/document-research-agenda/link`, compiled sync-authors | merge into existing `routes/authorRoutes.ts` + `authorController` |
| 944–1129 | `/api/documents/:id/metadata`, `/api/ensure-directory` | `documentController` / new `routes/adminMaintenanceRoutes.ts` |
| 1211–1240 | `/api/affiliations`, `/ping` | ping stays in server.ts; affiliations → `authorController` |
| 1247–1314 | `/api/email-logs` | new `routes/adminMaintenanceRoutes.ts` |
| 1316–1563 | `/api/compiled-documents/:id` (+details, +children, legacy alias) | new `routes/compiledDocumentRoutes.ts` + handlers into `documentController` or a new `compiledDocumentController` |
| 1564+ | `/api/user/profile`, password | `userController` (exists) + new `routes/userProfileRoutes.ts` |

**Method:** move each handler body into the controller as a web-`Request` function; the route
module keeps only the oak-ctx→Request conversion shim (copy the existing pattern in server.ts).
End state: server.ts = middleware stack + `app.use(...)` wiring + ping.

**Order within phase:** smallest group first (category) to validate the pattern, then authors
(biggest), then compiled-documents, then the rest.

## Phase 2 — Route files containing business logic

### 2a. routes/documentRoutes.ts (960 → ~80 lines)
Eleven arrow-const handlers with full logic inline (`getPublicDocumentById` ~130 lines,
`downloadDocument` ~150). Move bodies into `documentController` (720 lines now — splitting into
`documentController` + `documentDownloadController` if it crosses ~1,000). `downloadDocument`
must reuse `DocumentModel.getDocumentPath` / `getCompiledDocumentChildPaths` instead of its own
path resolution — diff the two implementations first; if they disagree, the model wins and the
difference gets a comment.

### 2b. routes/pageVisitsRoutes.ts (963 → ~60 lines)
Thirteen handlers, five of which are `compat*` shims. Steps:
1. Grep the frontend (`dashboard.js`, `most-visited-works.js`, `dashboard-chart.js`,
   `document-visit-tracker.js`) for which compat endpoints are actually called; delete the
   unused ones (suspects: `compatGetHomePageVisitStats`, `compatGetGeneralVisitStats`).
2. New `controllers/pageVisitsController.ts` for the survivors; raw SQL moves into the existing
   `models/pageVisitsModel.ts`.
3. `getParentDocument` / `getCompiledDocumentDetails` (lines 684–924) are document endpoints
   that live here by accident — they belong with the compiled-document controller from Phase 1.

### 2c. routes/emailRoutes.ts (482 → ~40 lines)
`sendApprovalEmail` is ~340 lines: it fetches request + document, resolves file paths, then
calls emailService. Split: data lookup → `documentRequestController` (exists); path resolution →
reuse `DocumentModel`; the route keeps only registration. Do this together with Phase 3 since
the seams touch.

## Phase 3 — services/emailService.ts (1,475 → ~500 lines)

**Problem:** four send functions of 200–380 lines each (`sendEmailWithAttachment`,
`sendApprovedRequestEmail`, `sendRejectedRequestEmail`, `sendRequestConfirmationEmail`) that are
near-duplicates: each rebuilds the HTML template inline and re-implements MIME assembly.

**Extract three internals:**
- `emailTemplates.ts` — `renderRequestEmail(kind: "approved" | "rejected" | "confirmation", vars)`
  returning HTML; the three templates share a base layout with different body blocks.
- `buildMimeMessage(opts)` — headers, boundaries, base64 chunks, attachment encoding
  (absorbs `encodeFileForEmail`, `encode`, `uint8ArrayToBase64`).
- `sendEmail(message)` — the single SMTP/client call path with logging.

The four public functions become ~20-line wrappers; their signatures do not change.

**Verification:** `deno task check` + send a real test message per kind via
`scripts/test-smtp.ts` before and after; compare received emails visually.
**Risk:** MIME boundary/base64 subtleties — do not "clean up" encoding helpers while moving
them; move verbatim first, simplify in a follow-up commit.

## Phase 4 — controllers/unifiedArchiveController.ts (1,154 → ~350 + model)

Nine handlers averaging ~130 lines; raw SQL, BigInt serialization, and response shaping inline;
takes `ctx: any` (inconsistent with the codebase's typing standards).

1. New `models/archiveModel.ts`: all SQL (list with filters/pagination, byId, archive, restore,
   child queries, category counts, hard delete). `archiveCompiledDocument`'s child-cascade logic
   moves here as a transaction.
2. Move `convertBigIntToNumber` to `utils/` — check whether `processRowsForSerialization` in
   `documentModel.ts:887` duplicates it; if so, keep one.
3. Type the handlers (`RouterContext` or convert to the web-`Request` convention like the other
   controllers — prefer the latter for consistency).

## Phase 5 — services/documentService.ts (1,231 → ~800 lines)

`fetchDocuments` is ~415 lines (lines 102–517): filter parsing, WHERE building, sorting,
pagination, execution, and row hydration in one function. Split into module-private helpers:
`buildDocumentFilters(params) → {whereClause, params}`, `hydrateDocumentRows(rows)` (authors/
topics attach), and keep `fetchDocuments` as the ~50-line orchestrator. `getTotalDocumentCount`
already exists — make it the only count path. Also dedupe the child-management logic shared by
`createCompiledDocument` / `updateCompiledDocument` / `processChildDocuments`.

## Phase 6 — Frontend: the document-edit stack (highest value, highest risk)

**Problem:** `document-edit.js` (3,735) and `enhanced-compiled-document-edit.js` (4,453) are
both loaded on `documents_list.html`; the "enhanced" file is a fork that never replaced the
original, they communicate through window globals (`showEditModal`, `showCompiledEditModal`,
`populateCompiledDocForm`), and **enhanced monkey-patches `window.fetch`** to intercept
compiled-document requests.

**Steps (each independently shippable):**
1. **Kill the `window.fetch` monkey-patch first.** Find what it intercepts and replace with
   explicit calls at the call sites. This is the most fragile thing in the frontend and blocks
   safe merging. Verify: network tab shows identical requests for edit/save flows.
2. Extract shared modules under `admin/Components/js/lib/` (plain scripts or ES modules —
   no build system exists, so use `<script type="module">` or namespaced IIFEs matching the
   existing `window.NavbarModule` pattern):
   - `api-client.js` — fetch wrappers with error handling (no patching)
   - `modal-manager.js` — open/close/confirm dialogs (both files re-implement these)
   - `author-picker.js` — unify with the existing `author-search.js`
   - `toast.js` — `showToast`/`removeToast` (already duplicated across 3+ files)
3. Merge: `enhanced-compiled-document-edit.js` becomes the compiled-mode of a single
   `document-edit.js` (single docs + compiled docs), then delete the enhanced file and its
   `<script>` tag. Remove `debugCompiledDocumentForm`/`directPopulateCompiledForm` debug globals.

**Verification (manual, after each step):** edit single doc (fields, authors, save), edit
compiled doc (children add/remove, volume fields, save), cancel paths, error paths. Run the
app and exercise these flows — no automated coverage exists.

## Phase 7 — Frontend: the list/archive stack

`document-archive.js` (3,200), `document-list.js` (1,731), `archived-document-list.js` (1,452),
with `document-card-components.js` (814) already acting as a shared component file.

1. Move all card rendering into `document-card-components.js` (both list files build near-
   identical cards; `createChildDocumentCard` is literally duplicated by name).
2. Extract `pagination.js` and reuse `toast.js` from Phase 6.
3. Make `archived-document-list.js` a configuration of the same list module as
   `document-list.js` (data URL, card actions, empty-state text) rather than a parallel
   implementation.
4. `document-archive.js` keeps only archive/restore dialog logic and its `window.documentArchive`
   API; rendering concerns move to the shared modules.

## Phase 8 — Frontend: upload_document.js (2,558)

Split by wizard concern: form state/validation, file handling, author selection (reuse
`author-picker.js`), compiled-document child rows, submit/progress. Do after Phases 6–7 so the
shared modules exist. Verification: upload single doc, upload compiled doc with children,
validation errors, duplicate-file warning.

## Phase 9 — Frontend: navbar-loader.js (1,391)

One IIFE owning four unrelated jobs. Split into: `navbar-core.js` (fetch + inject navbar HTML),
`auth-menu.js` (login/logout, profile badge, mobile profile), `search-overlay.js` (openSearch/
closeSearch/filters — the largest chunk), and fold `recordPageVisit` into the existing
`document-visit-tracker.js`. Loaded on 12 public pages — keep the existing `window.*` globals
as thin aliases until every page's script tags are updated, then remove them.

## Explicitly NOT refactoring (audited, fine as-is)

`documentModel.ts`, `documentController.ts`, `pageVisitsModel.ts`, `authorVisitsModel.ts`,
`documentRequestController.ts`, `document-card-components.js` (until Phase 7 grows it),
`dashboard.js`, `author-search.js` (absorbed into author-picker in Phase 6),
`document-filters.js`, `document-visit-tracker.js`, `dashboard-chart.js`, `most-visited-works.js`.

## Sequencing summary

| # | Phase | Risk | Gate |
|---|---|---|---|
| 0 | Smoke harness + commit deletions | none | harness runs green |
| 1 | server.ts route extraction | low | check + smoke diff |
| 2 | documentRoutes / pageVisitsRoutes / emailRoutes | low-med | check + smoke diff |
| 3 | emailService dedupe | med (MIME) | test-smtp real sends |
| 4 | unifiedArchiveController → model | low-med | check + smoke + archive/restore flow |
| 5 | documentService.fetchDocuments split | med | check + smoke diff on /api/documents matrix |
| 6 | document-edit merge + de-monkey-patch | **high** | manual edit flows, network tab |
| 7 | list/archive unification | med | manual list/archive/restore flows |
| 8 | upload_document split | med | manual upload flows |
| 9 | navbar-loader split | med | all 12 public pages load, login/logout/search |
