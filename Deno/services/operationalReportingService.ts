import { client, withTransaction } from "../db/denopost_conn.ts";
import { UserDocumentHistoryModel } from "../models/userDocumentHistoryModel.ts";

export const REPORT_RANGES = ["24h", "7d", "30d", "90d", "1y", "all"] as const;
export type ReportRange = typeof REPORT_RANGES[number];
export const REPORTING_TIMEZONE = "Asia/Manila" as const;
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

export const METRIC_DEFINITIONS = {
  catalog_entries: "Non-archived top-level records. A single or compilation counts once; child studies do not add entries.",
  stored_documents: "Non-archived rows in documents, including child studies inside compilations.",
  archived_catalog_entries: "Archived top-level single records plus archived compilation records.",
  archived_documents: "Archived rows in documents, including child studies.",
  author_records: "Every author-directory row, including authors without linked works.",
  published_authors: "Distinct authors linked to an active, approved, public top-level work or an eligible active child of a public compilation.",
  pending_uploads: "Non-archived top-level singles and compilations with pending_review status; child studies are excluded.",
  pending_access_requests: "Every access request whose current status is pending, regardless of submission date.",
  uploaded_entries: "Top-level singles and compilations created during the selected period, regardless of current review status.",
  repository_views: "One successful authorized public or registered-reader metadata/detail request. Administrator and publisher previews are excluded.",
  repository_downloads: "One successful authorized attachment/file response. Inline PDF viewing is not a download.",
  guest_views: "Successful public repository metadata/detail requests made without a registered-reader session.",
  registered_views: "Successful public repository metadata/detail requests made by a registered-reader session.",
  approved_request_downloads: "Successful attachment responses delivered through an approved outsider request.",
  active_registered_readers: "Distinct registered users with role user and at least one server-recorded view or download in the selected period.",
  active_registered_users: "Distinct registered users with role user and at least one server-recorded view or download in the selected period.",
  home_visits: "Home-page requests recorded after the page-view endpoint validates the server-derived audience. This is a request/view count, not unique visitors.",
  home_guest_visits: "Home-page requests from guests during the selected period; this is a request/view count, not unique visitors.",
  home_registered_visits: "Home-page requests from registered users during the selected period; this is a request/view count, not unique visitors.",
  most_viewed_entries: "Activity rolled up to the top-level catalog entry; child-study activity contributes to its compilation.",
  most_downloaded_entries: "Successful attachment activity rolled up to the top-level catalog entry.",
  most_visited_authors: "Successful public author-profile visits during the selected period.",
  trending_topics: "Approved topics ranked by views. A work contributes once per distinct approved topic association.",
  document_types: "Active non-archived top-level catalog entries grouped by document type/category; current snapshot only.",
  request_statuses: "Requests submitted during the selected period grouped by their current pending, approved, or rejected status.",
  registered_reader_activity: "Aggregate registered-reader views, downloads, active users, and average interactions; no identities are exposed.",
  reader_views: "Registered-reader repository views during the selected period.",
  reader_downloads: "Registered-reader attachment downloads during the selected period.",
  average_reader_interactions: "Registered-reader views plus downloads divided by active registered readers; zero when there are no active readers.",
} as const;

export interface ReportWindow {
  key: ReportRange;
  label: string;
  startInclusive: Date | null;
  endExclusive: Date;
  bucket: "hour" | "day" | "week" | "month" | "year";
  sourceGrain: "hour" | "day";
}

export interface ActivityCoverage {
  startedAt: string | null;
  hourlyStartedAt: string | null;
  precision: "hourly" | "daily" | "mixed";
  isCompleteForSelectedRange: boolean;
  warning: string | null;
}

export interface OperationalReport {
  meta: {
    dataVersion: 2;
    generatedAt: string;
    timezone: typeof REPORTING_TIMEZONE;
    range: Omit<ReportWindow, "startInclusive" | "endExclusive" | "sourceGrain"> & {
      startInclusive: string | null;
      endExclusive: string;
    };
    activityCoverageStartedAt: string | null;
    coverage: {
      repository: ActivityCoverage;
      home: ActivityCoverage;
      authors: ActivityCoverage;
    };
  };
  inventory: {
    catalogEntries: number;
    storedDocuments: number;
    archivedCatalogEntries: number;
    archivedDocuments: number;
    authorRecords: number;
    publishedAuthors: number;
  };
  workflow: { pendingUploads: number; pendingAccessRequests: number };
  activity: {
    uploadedEntries: number;
    repositoryViews: number;
    repositoryDownloads: number;
    guestViews: number;
    registeredViews: number;
    approvedRequestDownloads: number;
    activeRegisteredUsers: number;
    homeVisits: { total: number; guest: number; registered: number };
  };
  series: {
    uploads: Array<{ bucket: string; count: number }>;
    repositoryActivity: Array<{ bucket: string; views: number; downloads: number }>;
    homeVisits: Array<{ bucket: string; guest: number; registered: number; total: number }>;
  };
  rankings: {
    mostViewedEntries: RankedWork[];
    mostDownloadedEntries: RankedWork[];
    mostVisitedAuthors: RankedAuthor[];
    trendingTopics: RankedTopic[];
  };
  distributions: {
    documentTypes: Array<{ label: string; count: number }>;
    requestStatuses: Array<{ status: "pending" | "approved" | "rejected"; count: number }>;
  };
  registeredReaderSummary: {
    activeUsers: number;
    views: number;
    downloads: number;
    averageInteractionsPerActiveUser: number;
  };
  metricDefinitions: Record<string, string>;
}

export interface RankedWork {
  id: number;
  recordType: "document" | "compiled";
  title: string;
  category: string;
  views: number;
  downloads: number;
  href?: string;
}

export interface RankedAuthor {
  id: string;
  name: string;
  visits: number;
  profilePicture: string | null;
  href?: string;
}

export interface RankedTopic {
  id: number;
  name: string;
  views: number;
  entryCount: number;
  activeCatalogEntryCount?: number;
  href?: string;
}

export function isReportRange(value: unknown): value is ReportRange {
  return typeof value === "string" && (REPORT_RANGES as readonly string[]).includes(value);
}

function toManilaLocal(date: Date): Date {
  return new Date(date.getTime() + MANILA_OFFSET_MS);
}

function fromManilaLocal(date: Date): Date {
  return new Date(date.getTime() - MANILA_OFFSET_MS);
}

function startOfLocalDay(date: Date): Date {
  const local = toManilaLocal(date);
  local.setUTCHours(0, 0, 0, 0);
  return fromManilaLocal(local);
}

function startOfLocalHour(date: Date): Date {
  const local = toManilaLocal(date);
  local.setUTCMinutes(0, 0, 0);
  return fromManilaLocal(local);
}

function startOfLocalMonth(date: Date): Date {
  const local = toManilaLocal(date);
  local.setUTCDate(1);
  local.setUTCHours(0, 0, 0, 0);
  return fromManilaLocal(local);
}

function addLocalDays(date: Date, amount: number): Date {
  const local = toManilaLocal(date);
  local.setUTCDate(local.getUTCDate() + amount);
  return fromManilaLocal(local);
}

function addLocalMonths(date: Date, amount: number): Date {
  const local = toManilaLocal(date);
  local.setUTCMonth(local.getUTCMonth() + amount);
  return fromManilaLocal(local);
}

function calendarMonthSpan(start: Date, end: Date): number {
  const startLocal = toManilaLocal(start);
  const endLocal = toManilaLocal(end);
  const wholeMonths = (endLocal.getUTCFullYear() - startLocal.getUTCFullYear()) * 12
    + endLocal.getUTCMonth() - startLocal.getUTCMonth();
  // Coverage is bucket-based: a partial first month still occupies that
  // monthly bucket, while endExclusive is the first month not included.
  return Math.max(0, wholeMonths);
}

export function resolveReportWindow(key: ReportRange, now = new Date()): ReportWindow {
  const labels: Record<ReportRange, string> = {
    "24h": "Last 24 hours",
    "7d": "Last 7 days",
    "30d": "Last 30 days",
    "90d": "Last 90 days",
    "1y": "Last 12 months",
    all: "All time",
  };
  if (key === "24h") {
    const end = new Date(startOfLocalHour(now).getTime() + 60 * 60 * 1000);
    return { key, label: labels[key], startInclusive: new Date(end.getTime() - 24 * 60 * 60 * 1000), endExclusive: end, bucket: "hour", sourceGrain: "hour" };
  }
  if (key === "7d" || key === "30d" || key === "90d") {
    const days = key === "7d" ? 7 : key === "30d" ? 30 : 90;
    const end = addLocalDays(startOfLocalDay(now), 1);
    return { key, label: labels[key], startInclusive: addLocalDays(end, -days), endExclusive: end, bucket: key === "90d" ? "week" : "day", sourceGrain: "day" };
  }
  if (key === "1y") {
    const end = addLocalMonths(startOfLocalMonth(now), 1);
    return { key, label: labels[key], startInclusive: addLocalMonths(end, -12), endExclusive: end, bucket: "month", sourceGrain: "day" };
  }
  return { key, label: labels[key], startInclusive: null, endExclusive: addLocalMonths(startOfLocalMonth(now), 1), bucket: "month", sourceGrain: "day" };
}

function safeCount(value: unknown, label = "count"): number {
  const number = typeof value === "bigint" ? Number(value) : Number(value ?? 0);
  if (!Number.isFinite(number) || number < 0 || !Number.isSafeInteger(number)) {
    throw new Error(`REPORTING_COUNT_OVERFLOW:${label}`);
  }
  return number;
}

function count(value: unknown, label?: string): number {
  return safeCount(value, label);
}

function dateParam(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

function rollupRange(alias: string, window: ReportWindow, startParam = 1): { clause: string; params: unknown[] } {
  const grainParam = `$${startParam}`;
  if (!window.startInclusive) return { clause: `${alias}.grain = ${grainParam}`, params: [window.sourceGrain] };
  return {
    clause: `${alias}.grain = $${startParam} AND ${alias}.bucket_start >= $${startParam + 1} AND ${alias}.bucket_start < $${startParam + 2}`,
    params: [window.sourceGrain, window.startInclusive, window.endExclusive],
  };
}

function timestampRange(column: string, window: ReportWindow, startParam = 1): { clause: string; params: unknown[] } {
  if (!window.startInclusive) return { clause: "TRUE", params: [] };
  return { clause: `${column} >= $${startParam} AND ${column} < $${startParam + 1}`, params: [window.startInclusive, window.endExclusive] };
}

function bucketExpression(column: string, bucket: ReportWindow["bucket"]): string {
  const local = `${column} AT TIME ZONE '${REPORTING_TIMEZONE}'`;
  if (bucket === "hour") return `DATE_TRUNC('hour', ${local}) AT TIME ZONE '${REPORTING_TIMEZONE}'`;
  if (bucket === "day") return `DATE_TRUNC('day', ${local}) AT TIME ZONE '${REPORTING_TIMEZONE}'`;
  if (bucket === "week") return `DATE_TRUNC('week', ${local}) AT TIME ZONE '${REPORTING_TIMEZONE}'`;
  if (bucket === "year") return `DATE_TRUNC('year', ${local}) AT TIME ZONE '${REPORTING_TIMEZONE}'`;
  return `DATE_TRUNC('month', ${local}) AT TIME ZONE '${REPORTING_TIMEZONE}'`;
}

function normaliseBucket(value: unknown): string {
  const date = new Date(String(value ?? ""));
  return Number.isNaN(date.getTime()) ? String(value ?? "") : date.toISOString();
}

function alignedBucketStart(date: Date, bucket: ReportWindow["bucket"]): Date {
  if (bucket === "hour") return startOfLocalHour(date);
  if (bucket === "day") return startOfLocalDay(date);
  if (bucket === "month") return startOfLocalMonth(date);
  if (bucket === "year") {
    const local = toManilaLocal(date);
    local.setUTCMonth(0, 1);
    local.setUTCHours(0, 0, 0, 0);
    return fromManilaLocal(local);
  }
  if (bucket === "week") {
    const local = toManilaLocal(startOfLocalDay(date));
    const mondayIndex = (local.getUTCDay() + 6) % 7;
    local.setUTCDate(local.getUTCDate() - mondayIndex);
    return fromManilaLocal(local);
  }
  return date;
}

function advanceBucket(date: Date, bucket: ReportWindow["bucket"]): Date {
  if (bucket === "hour") return new Date(date.getTime() + 60 * 60 * 1000);
  if (bucket === "day") return addLocalDays(date, 1);
  if (bucket === "week") return addLocalDays(date, 7);
  if (bucket === "month") return addLocalMonths(date, 1);
  return addLocalMonths(date, 12);
}

function completeSeries<T extends { bucket: string }>(
  rows: T[],
  window: ReportWindow,
  factory: (bucket: string, row: T | undefined) => T,
): T[] {
  const result = new Map(rows.map((row) => [normaliseBucket(row.bucket), row]));
  if (!window.startInclusive && rows.length === 0) return rows;
  const output: T[] = [];
  const firstBucket = window.startInclusive ?? rows
    .map((row) => new Date(row.bucket))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime())[0] ?? window.endExclusive;
  let cursor = alignedBucketStart(firstBucket, window.bucket);
  const end = window.endExclusive;
  let guard = 0;
  while (cursor < end && guard++ < 5000) {
    const key = cursor.toISOString();
    output.push(factory(key, result.get(key)));
    cursor = advanceBucket(cursor, window.bucket);
  }
  return output;
}

async function assertReportingSchema(connection: any): Promise<void> {
  const result = await connection.queryObject(`
    SELECT to_regclass('public.repository_activity_rollups')::text AS repository,
           to_regclass('public.page_activity_rollups')::text AS page,
           to_regclass('public.author_activity_rollups')::text AS author,
           to_regclass('public.operational_analytics_state')::text AS state
  `);
  const row = result.rows[0];
  if (!row?.repository || !row.page || !row.author || !row.state) {
    throw new Error("REPORTING_SCHEMA_UNAVAILABLE");
  }
  const state = await connection.queryObject(
    "SELECT reads_enabled FROM operational_analytics_state WHERE state_id = TRUE",
  );
  if (state.rows.length === 0) throw new Error("REPORTING_SCHEMA_UNAVAILABLE");
  if (state.rows[0]?.reads_enabled !== true) throw new Error("REPORTING_NOT_READY");
}

async function tableExists(connection: any, table: string): Promise<boolean> {
  const result = await connection.queryObject("SELECT to_regclass($1) IS NOT NULL AS exists", [`public.${table}`]);
  return Boolean(result.rows[0]?.exists);
}

async function incrementRepositoryRollup(connection: any, grain: "hour" | "day", input: { recordType: "document" | "compiled"; recordId: number; audience: "guest" | "registered" | "approved_request"; action: "view" | "download" }, bucket: Date): Promise<void> {
  const column = input.action === "view" ? "view_count" : "download_count";
  await connection.queryObject(`
    INSERT INTO repository_activity_rollups
      (grain, bucket_start, record_type, record_id, audience, ${column})
    VALUES ($1, $2, $3, $4, $5, 1)
    ON CONFLICT (grain, bucket_start, record_type, record_id, audience)
    DO UPDATE SET ${column} = repository_activity_rollups.${column} + 1,
                  last_recorded_at = CURRENT_TIMESTAMP
  `, [grain, bucket, input.recordType, input.recordId, input.audience]);
}

function writesEnabledByEnvironment(): boolean {
  // An explicit false is the emergency stop.  The state table is checked in
  // the transaction below so a newly migrated database remains write-gated
  // until its backfill/cutover has completed.
  return Deno.env.get("PEAS_REPORTING_V2_WRITES") !== "false";
}

const analyticsLogBuckets = new Map<string, { firstAt: number; count: number }>();
function logAnalyticsFailure(kind: string): void {
  const now = Date.now();
  const existing = analyticsLogBuckets.get(kind);
  if (!existing || now - existing.firstAt >= 60_000) {
    analyticsLogBuckets.set(kind, { firstAt: now, count: 1 });
    console.error("analytics write failed", { kind });
    return;
  }
  existing.count += 1;
}

async function isV2WriteGateOpen(connection: any): Promise<boolean> {
  if (!writesEnabledByEnvironment()) return false;
  const result = await connection.queryObject(
    "SELECT writes_enabled FROM operational_analytics_state WHERE state_id = TRUE",
  );
  // Fail closed when the explicit cutover state is absent. Content delivery
  // continues because callers treat analytics failures as non-fatal.
  return result.rows.length === 1 && Boolean(result.rows[0]?.writes_enabled);
}

export function normalizePageKey(pathname: string): string {
  let path = String(pathname ?? "");
  try {
    if (/^[a-z][a-z\d+.-]*:\/\//iu.test(path)) path = new URL(path).pathname;
  } catch {
    path = "/";
  }
  path = path.split(/[?#]/u, 1)[0] || "/";
  const normalized = path.toLowerCase().replace(/\/+$/u, "") || "/";
  return ["/", "/index", "/index.html"].includes(normalized) ? "/" : normalized;
}

export async function recordRepositoryActivity(input: {
  recordType: "document" | "compiled";
  recordId: number;
  audience: "guest" | "registered" | "approved_request";
  action: "view" | "download";
  registeredUserId?: string;
}): Promise<void> {
  if (!writesEnabledByEnvironment() || !Number.isSafeInteger(input.recordId) || input.recordId <= 0) return;
  if (!(["document", "compiled"] as const).includes(input.recordType)) return;
  if (!(["guest", "registered", "approved_request"] as const).includes(input.audience)) return;
  if (!(["view", "download"] as const).includes(input.action)) return;
  if (input.action === "download" && input.audience === "guest") return;
  if (input.action === "view" && input.audience === "approved_request") return;
  try {
    await withTransaction(async (connection) => {
      if (!await isV2WriteGateOpen(connection)) return;
      const now = new Date();
      await incrementRepositoryRollup(connection, "hour", input, startOfLocalHour(now));
      await incrementRepositoryRollup(connection, "day", input, startOfLocalDay(now));
      if (input.audience === "registered" && input.registeredUserId) {
        await UserDocumentHistoryModel.recordActionOnConnection(
          connection,
          input.registeredUserId,
          input.recordId,
          input.action === "view" ? "VIEW" : "DOWNLOAD",
          input.recordType,
        );
      }
    });
  } catch (error) {
    logAnalyticsFailure(`repository:${input.action}:${input.recordType}`);
    throw error;
  }
}

export async function recordPageActivity(pathname: string, audience: "guest" | "registered"): Promise<void> {
  if (!writesEnabledByEnvironment()) return;
  if (!(["guest", "registered"] as const).includes(audience)) return;
  const pageKey = normalizePageKey(pathname);
  try {
    await withTransaction(async (connection) => {
      if (!await isV2WriteGateOpen(connection)) return;
      const recordedAt = new Date();
      for (const [grain, bucket] of [["hour", startOfLocalHour(recordedAt)], ["day", startOfLocalDay(recordedAt)]] as const) {
        await connection.queryObject(`
          INSERT INTO page_activity_rollups (grain, bucket_start, page_key, audience, visit_count)
          VALUES ($1, $2, $3, $4, 1)
          ON CONFLICT (grain, bucket_start, page_key, audience)
          DO UPDATE SET visit_count = page_activity_rollups.visit_count + 1, last_recorded_at = CURRENT_TIMESTAMP
        `, [grain, bucket, pageKey, audience]);
      }
    });
  } catch (error) {
    logAnalyticsFailure(`page:${audience}`);
    throw error;
  }
}

export async function recordAuthorActivity(authorId: string, audience: "guest" | "registered"): Promise<void> {
  if (!writesEnabledByEnvironment() || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(authorId)) return;
  if (!(["guest", "registered"] as const).includes(audience)) return;
  try {
    await withTransaction(async (connection) => {
      if (!await isV2WriteGateOpen(connection)) return;
      const recordedAt = new Date();
      for (const [grain, bucket] of [["hour", startOfLocalHour(recordedAt)], ["day", startOfLocalDay(recordedAt)]] as const) {
        await connection.queryObject(`
          INSERT INTO author_activity_rollups (grain, bucket_start, author_id, audience, visit_count)
          VALUES ($1, $2, $3, $4, 1)
          ON CONFLICT (grain, bucket_start, author_id, audience)
          DO UPDATE SET visit_count = author_activity_rollups.visit_count + 1, last_recorded_at = CURRENT_TIMESTAMP
        `, [grain, bucket, authorId, audience]);
      }
    });
  } catch (error) {
    logAnalyticsFailure(`author:${audience}`);
    throw error;
  }
}

export async function verifyOperationalReportingSchema(): Promise<void> {
  const result = await client.queryObject(`
    SELECT to_regclass('public.repository_activity_rollups')::text AS repository,
           to_regclass('public.page_activity_rollups')::text AS page,
           to_regclass('public.author_activity_rollups')::text AS author,
           to_regclass('public.operational_analytics_state')::text AS state
  `);
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row?.repository || !row.page || !row.author || !row.state) {
    throw new Error("REPORTING_SCHEMA_UNAVAILABLE");
  }
}

async function queryCoverage(connection: any, table: string, dateColumn = "bucket_start") {
  const result = await connection.queryObject(`
    SELECT MIN(${dateColumn}) FILTER (WHERE grain = 'day')::text AS started_at,
           MIN(${dateColumn}) FILTER (WHERE grain = 'hour')::text AS hourly_started_at
    FROM ${table}
  `);
  return result.rows[0] ?? { started_at: null, hourly_started_at: null };
}

function buildCoverage(row: { started_at: string | null; hourly_started_at: string | null }, window: ReportWindow): ActivityCoverage {
  const startedAt = row.started_at ? new Date(row.started_at) : null;
  const hourlyStartedAt = row.hourly_started_at ? new Date(row.hourly_started_at) : null;
  const noActivity = !startedAt && !hourlyStartedAt;
  const complete = !window.startInclusive || noActivity || (window.sourceGrain === "day"
    ? Boolean(startedAt && startedAt <= window.startInclusive)
    : Boolean(hourlyStartedAt && hourlyStartedAt <= window.startInclusive));
  const precision = startedAt && hourlyStartedAt ? "mixed" : hourlyStartedAt ? "hourly" : "daily";
  return {
    startedAt: startedAt?.toISOString() ?? null,
    hourlyStartedAt: hourlyStartedAt?.toISOString() ?? null,
    precision,
    isCompleteForSelectedRange: complete,
    warning: complete ? null : "Some activity predates the precise hourly coverage window and is not distributed into invented hourly buckets.",
  };
}

async function queryRankedWorks(connection: any, window: ReportWindow, metric: "views" | "downloads"): Promise<RankedWork[]> {
  const range = rollupRange("ra", window);
  const metricColumn = metric === "views" ? "views" : "downloads";
  const result = await connection.queryObject(`
    WITH eligible_compilations AS (
      SELECT cd.id
      FROM compiled_documents cd
      WHERE cd.deleted_at IS NULL AND cd.review_status = 'approved'
    ), eligible_documents AS (
      SELECT d.id, NULL::INTEGER AS compiled_parent_id
      FROM documents d
      WHERE d.deleted_at IS NULL AND d.compiled_parent_id IS NULL
        AND d.review_status = 'approved' AND d.is_public = TRUE
      UNION ALL
      SELECT d.id, d.compiled_parent_id
      FROM documents d JOIN eligible_compilations ec ON ec.id = d.compiled_parent_id
      WHERE d.deleted_at IS NULL AND d.review_status = 'approved' AND d.is_public = TRUE
    ), entry_map AS (
      SELECT 'document'::TEXT AS activity_record_type, ed.id AS activity_record_id,
             CASE WHEN ed.compiled_parent_id IS NULL THEN 'document' ELSE 'compiled' END::TEXT AS entry_type,
             COALESCE(ed.compiled_parent_id, ed.id) AS entry_id
      FROM eligible_documents ed
      UNION ALL
      SELECT 'compiled', ec.id, 'compiled', ec.id FROM eligible_compilations ec
    ), activity AS (
      SELECT ra.record_type, ra.record_id,
             SUM(ra.view_count) FILTER (WHERE ra.audience IN ('guest', 'registered'))::BIGINT AS views,
             SUM(ra.download_count) FILTER (WHERE ra.audience IN ('registered', 'approved_request'))::BIGINT AS downloads
      FROM repository_activity_rollups ra
      WHERE ${range.clause}
      GROUP BY ra.record_type, ra.record_id
    ), grouped AS (
      SELECT em.entry_type, em.entry_id,
             SUM(activity.views)::BIGINT AS views,
             SUM(activity.downloads)::BIGINT AS downloads
      FROM activity JOIN entry_map em
        ON em.activity_record_type = activity.record_type
       AND em.activity_record_id = activity.record_id
      GROUP BY em.entry_type, em.entry_id
    )
    SELECT g.entry_id AS id, g.entry_type AS record_type,
      CASE WHEN g.entry_type = 'document' THEN d.title
           ELSE CONCAT(COALESCE(cd.category, 'Compilation'), CASE WHEN cd.volume IS NOT NULL THEN CONCAT(' Vol. ', cd.volume) ELSE '' END)
      END AS title,
      CASE WHEN g.entry_type = 'document' THEN d.document_type::TEXT ELSE COALESCE(cd.category, 'COMPILED') END AS category,
      g.views, g.downloads
    FROM grouped g
    LEFT JOIN documents d ON g.entry_type = 'document' AND d.id = g.entry_id
    LEFT JOIN compiled_documents cd ON g.entry_type = 'compiled' AND cd.id = g.entry_id
    WHERE g.${metricColumn} > 0
    ORDER BY g.${metricColumn} DESC, g.views DESC, g.downloads DESC, title ASC, g.entry_id ASC
    LIMIT 10
  `, range.params);
  return result.rows.map((value: Record<string, unknown>) => {
    const id = count(value.id, "ranking.id");
    const recordType = String(value.record_type) as "document" | "compiled";
    return { id, recordType, title: String(value.title ?? "Untitled entry"), category: String(value.category ?? "Unknown"), views: count(value.views, "ranking.views"), downloads: count(value.downloads, "ranking.downloads"), href: `/pages/${recordType === "compiled" ? "guest-compiled" : "guest-single"}.html?id=${encodeURIComponent(String(id))}` };
  });
}

export async function getOperationalReport(rangeKey: ReportRange, now = new Date()): Promise<OperationalReport> {
  if (!isReportRange(rangeKey)) throw new Error("INVALID_REPORT_RANGE");
  let window = resolveReportWindow(rangeKey, now);
  return withTransaction(async (connection: any) => {
    await connection.queryArray("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await connection.queryArray("SET LOCAL statement_timeout = '3000ms'");
    await assertReportingSchema(connection);

    const repositoryCoverageRow = await queryCoverage(connection, "repository_activity_rollups");
    const homeCoverageRow = await queryCoverage(connection, "page_activity_rollups");
    const authorCoverageRow = await queryCoverage(connection, "author_activity_rollups");
    if (rangeKey === "all") {
      const earliest = [repositoryCoverageRow.started_at, homeCoverageRow.started_at, authorCoverageRow.started_at].filter(Boolean).map((value) => new Date(String(value))).sort((a, b) => a.getTime() - b.getTime())[0];
      const months = earliest ? calendarMonthSpan(earliest, window.endExclusive) : 0;
      window = { ...window, bucket: months > 36 ? "year" : "month" };
    }

    const inventoryResult = await connection.queryObject(`
      WITH document_inventory AS (
        SELECT COUNT(*) FILTER (WHERE deleted_at IS NULL)::BIGINT AS stored_documents,
               COUNT(*) FILTER (WHERE deleted_at IS NOT NULL)::BIGINT AS archived_documents,
               COUNT(*) FILTER (WHERE deleted_at IS NULL AND compiled_parent_id IS NULL)::BIGINT AS active_single_entries,
               COUNT(*) FILTER (WHERE deleted_at IS NOT NULL AND compiled_parent_id IS NULL)::BIGINT AS archived_single_entries
        FROM documents
      ), compilation_inventory AS (
        SELECT COUNT(*) FILTER (WHERE deleted_at IS NULL)::BIGINT AS active_compilations,
               COUNT(*) FILTER (WHERE deleted_at IS NOT NULL)::BIGINT AS archived_compilations
        FROM compiled_documents
      ) SELECT * FROM document_inventory CROSS JOIN compilation_inventory
    `);
    const inventoryRow = (inventoryResult.rows[0] ?? {}) as Record<string, unknown>;
    const authorResult = await connection.queryObject("SELECT COUNT(*)::BIGINT AS count FROM authors");
    const publishedResult = await connection.queryObject(`
      WITH eligible_compilations AS (
        SELECT id FROM compiled_documents WHERE deleted_at IS NULL AND review_status = 'approved'
      ), eligible_documents AS (
        SELECT d.id FROM documents d WHERE d.deleted_at IS NULL AND d.compiled_parent_id IS NULL AND d.review_status = 'approved' AND d.is_public = TRUE
        UNION ALL
        SELECT d.id FROM documents d JOIN eligible_compilations c ON c.id = d.compiled_parent_id WHERE d.deleted_at IS NULL AND d.review_status = 'approved' AND d.is_public = TRUE
      )
      SELECT COUNT(DISTINCT da.author_id)::BIGINT AS count
      FROM document_authors da JOIN eligible_documents ed ON ed.id = da.document_id
    `);
    const pendingUploadResult = await connection.queryObject(`
      SELECT (
        SELECT COUNT(*) FROM documents WHERE deleted_at IS NULL AND compiled_parent_id IS NULL AND review_status = 'pending_review'
      ) + (
        SELECT COUNT(*) FROM compiled_documents WHERE deleted_at IS NULL AND review_status = 'pending_review'
      ) AS count
    `);
    const pendingRequestResult = await connection.queryObject("SELECT COUNT(*)::BIGINT AS count FROM document_requests WHERE status = 'pending'");

    const repositoryRange = rollupRange("ra", window);
    const repositoryActivityResult = await connection.queryObject(`
      SELECT COALESCE(SUM(view_count) FILTER (WHERE audience IN ('guest', 'registered')), 0)::BIGINT AS views,
             COALESCE(SUM(download_count) FILTER (WHERE audience IN ('registered', 'approved_request')), 0)::BIGINT AS downloads,
             COALESCE(SUM(view_count) FILTER (WHERE audience = 'guest'), 0)::BIGINT AS guest_views,
             COALESCE(SUM(view_count) FILTER (WHERE audience = 'registered'), 0)::BIGINT AS registered_views,
             COALESCE(SUM(download_count) FILTER (WHERE audience = 'registered'), 0)::BIGINT AS registered_downloads,
             COALESCE(SUM(download_count) FILTER (WHERE audience = 'approved_request'), 0)::BIGINT AS approved_request_downloads
      FROM repository_activity_rollups ra WHERE ${repositoryRange.clause}
    `, repositoryRange.params);

    const uploadRange = timestampRange("created_at", window);
    const uploadRangeSecond = timestampRange("created_at", window, uploadRange.params.length + 1);
    const uploadedResult = await connection.queryObject(`
      SELECT COUNT(*)::BIGINT AS count FROM (
        SELECT d.id FROM documents d WHERE d.compiled_parent_id IS NULL AND ${uploadRange.clause}
        UNION ALL
        SELECT cd.id FROM compiled_documents cd WHERE ${uploadRangeSecond.clause}
      ) entries
    `, [...uploadRange.params, ...uploadRangeSecond.params]);

    const pageRange = rollupRange("pa", window);
    const homeResult = await connection.queryObject(`
      SELECT audience, COALESCE(SUM(visit_count), 0)::BIGINT AS count
      FROM page_activity_rollups pa
      WHERE pa.page_key = '/' AND ${pageRange.clause}
      GROUP BY audience
    `, pageRange.params);
    const home = { guest: 0, registered: 0 };
    for (const row of homeResult.rows as Array<Record<string, unknown>>) {
      if (row.audience === "guest") home.guest = count(row.count, "home.guest");
      if (row.audience === "registered") home.registered = count(row.count, "home.registered");
    }

    const documentHistoryExists = await tableExists(connection, "user_document_history");
    const compiledHistoryExists = await tableExists(connection, "user_compiled_document_history");
    const historyTables = [documentHistoryExists, compiledHistoryExists];
    let readerUsers = 0;
    let readerViews = 0;
    let readerDownloads = 0;
    if (historyTables.some(Boolean)) {
      const historyQueries: string[] = [];
      if (historyTables[0]) historyQueries.push("SELECT h.user_id::text AS user_id, h.action, h.accessed_at FROM user_document_history h");
      if (historyTables[1]) historyQueries.push("SELECT h.user_id::text AS user_id, h.action, h.accessed_at FROM user_compiled_document_history h");
      const readerRange = timestampRange("events.accessed_at", window);
      const readerResult = await connection.queryObject(`
        WITH events AS (${historyQueries.join(" UNION ALL ")})
        SELECT COUNT(DISTINCT events.user_id) FILTER (WHERE LOWER(u.role) = 'user')::BIGINT AS users,
               COUNT(*) FILTER (WHERE LOWER(u.role) = 'user' AND UPPER(events.action) = 'VIEW')::BIGINT AS views,
               COUNT(*) FILTER (WHERE LOWER(u.role) = 'user' AND UPPER(events.action) = 'DOWNLOAD')::BIGINT AS downloads
        FROM events JOIN users u ON u.id::text = events.user_id
        WHERE ${readerRange.clause}
      `, readerRange.params);
      const row = (readerResult.rows[0] ?? {}) as Record<string, unknown>;
      readerUsers = count(row.users, "reader.users");
      readerViews = count(row.views, "reader.views");
      readerDownloads = count(row.downloads, "reader.downloads");
    }

    const uploadSeriesSecond = timestampRange("created_at", window, uploadRange.params.length + 1);
    const uploadsSeriesResult = await connection.queryObject(`
      SELECT ${bucketExpression("created_at", window.bucket)}::TEXT AS bucket, COUNT(*)::BIGINT AS count
      FROM (
        SELECT d.created_at FROM documents d WHERE d.compiled_parent_id IS NULL AND ${uploadRange.clause}
        UNION ALL
        SELECT cd.created_at FROM compiled_documents cd WHERE ${uploadSeriesSecond.clause}
      ) entries
      GROUP BY ${bucketExpression("created_at", window.bucket)}
      ORDER BY ${bucketExpression("created_at", window.bucket)}
    `, [...uploadRange.params, ...uploadSeriesSecond.params]);
    const repositorySeriesResult = await connection.queryObject(`
      SELECT ${bucketExpression("ra.bucket_start", window.bucket)}::TEXT AS bucket,
             COALESCE(SUM(ra.view_count) FILTER (WHERE ra.audience IN ('guest', 'registered')), 0)::BIGINT AS views,
             COALESCE(SUM(ra.download_count) FILTER (WHERE ra.audience IN ('registered', 'approved_request')), 0)::BIGINT AS downloads
      FROM repository_activity_rollups ra WHERE ${repositoryRange.clause}
      GROUP BY ${bucketExpression("ra.bucket_start", window.bucket)}
      ORDER BY ${bucketExpression("ra.bucket_start", window.bucket)}
    `, repositoryRange.params);
    const homeSeriesResult = await connection.queryObject(`
      SELECT ${bucketExpression("pa.bucket_start", window.bucket)}::TEXT AS bucket,
             COALESCE(SUM(pa.visit_count) FILTER (WHERE pa.audience = 'guest'), 0)::BIGINT AS guest,
             COALESCE(SUM(pa.visit_count) FILTER (WHERE pa.audience = 'registered'), 0)::BIGINT AS registered
      FROM page_activity_rollups pa WHERE pa.page_key = '/' AND ${pageRange.clause}
      GROUP BY ${bucketExpression("pa.bucket_start", window.bucket)}
      ORDER BY ${bucketExpression("pa.bucket_start", window.bucket)}
    `, pageRange.params);

    const toUploadRows = uploadsSeriesResult.rows.map((row: Record<string, unknown>) => ({ bucket: normaliseBucket(row.bucket), count: count(row.count, "series.uploads") }));
    const toRepositoryRows = repositorySeriesResult.rows.map((row: Record<string, unknown>) => ({ bucket: normaliseBucket(row.bucket), views: count(row.views, "series.views"), downloads: count(row.downloads, "series.downloads") }));
    const toHomeRows = homeSeriesResult.rows.map((row: Record<string, unknown>) => { const guest = count(row.guest, "series.home.guest"); const registered = count(row.registered, "series.home.registered"); return { bucket: normaliseBucket(row.bucket), guest, registered, total: guest + registered }; });
    const uploads = completeSeries<{ bucket: string; count: number }>(toUploadRows, window, (bucket, row) => ({ bucket, count: row?.count ?? 0 }));
    const repositorySeries = completeSeries<{ bucket: string; views: number; downloads: number }>(toRepositoryRows, window, (bucket, row) => ({ bucket, views: row?.views ?? 0, downloads: row?.downloads ?? 0 }));
    const homeVisits = completeSeries<{ bucket: string; guest: number; registered: number; total: number }>(toHomeRows, window, (bucket, row) => { const guest = row?.guest ?? 0; const registered = row?.registered ?? 0; return { bucket, guest, registered, total: guest + registered }; });

    const topViews = await queryRankedWorks(connection, window, "views");
    const topDownloads = await queryRankedWorks(connection, window, "downloads");
    const authorRange = rollupRange("aa", window);
    const topAuthorsResult = await connection.queryObject(`
      SELECT a.id, a.full_name, a.profile_picture, SUM(aa.visit_count)::BIGINT AS visits
      FROM author_activity_rollups aa JOIN authors a ON a.id = aa.author_id
      WHERE ${authorRange.clause}
      GROUP BY a.id, a.full_name, a.profile_picture
      ORDER BY visits DESC, a.full_name ASC, a.id ASC
      LIMIT 10
    `, authorRange.params);

    const topicRange = rollupRange("ra", window);
    const topicResult = await connection.queryObject(`
      WITH eligible_compilations AS (
        SELECT id FROM compiled_documents WHERE deleted_at IS NULL AND review_status = 'approved'
      ), eligible_documents AS (
        SELECT d.id, NULL::INTEGER AS compiled_parent_id
        FROM documents d WHERE d.deleted_at IS NULL AND d.compiled_parent_id IS NULL AND d.review_status = 'approved' AND d.is_public = TRUE
        UNION ALL
        SELECT d.id, d.compiled_parent_id
        FROM documents d JOIN eligible_compilations c ON c.id = d.compiled_parent_id
        WHERE d.deleted_at IS NULL AND d.review_status = 'approved' AND d.is_public = TRUE
      ), topic_records AS (
        SELECT DISTINCT 'document'::TEXT AS record_type, ed.id AS record_id, t.id AS topic_id, t.name,
          CASE WHEN ed.compiled_parent_id IS NULL THEN 'document' ELSE 'compiled' END::TEXT AS entry_type,
          COALESCE(ed.compiled_parent_id, ed.id) AS entry_id
        FROM eligible_documents ed JOIN document_topics dt ON dt.document_id = ed.id
        JOIN topics t ON t.id = dt.topic_id AND t.status = 'approved'
        UNION
        SELECT DISTINCT 'compiled'::TEXT, c.id, t.id, t.name, 'compiled'::TEXT, c.id
        FROM eligible_compilations c
        JOIN compiled_document_items cdi ON cdi.compiled_document_id = c.id
        JOIN eligible_documents child ON child.id = cdi.document_id
        JOIN document_topics dt ON dt.document_id = child.id
        JOIN topics t ON t.id = dt.topic_id AND t.status = 'approved'
      ), activity AS (
        SELECT ra.record_type, ra.record_id, SUM(ra.view_count) FILTER (WHERE ra.audience IN ('guest', 'registered'))::BIGINT AS views
        FROM repository_activity_rollups ra WHERE ${topicRange.clause}
        GROUP BY ra.record_type, ra.record_id
      ), topic_views AS (
        SELECT tr.topic_id AS id, tr.name, SUM(a.views)::BIGINT AS views,
               COUNT(DISTINCT (tr.entry_type, tr.entry_id))::BIGINT AS entries
        FROM topic_records tr JOIN activity a ON a.record_type = tr.record_type AND a.record_id = tr.record_id
        GROUP BY tr.topic_id, tr.name
      )
      SELECT id, name, views, entries FROM topic_views
      ORDER BY views DESC, entries DESC, LOWER(name) ASC, name ASC, id ASC LIMIT 10
    `, topicRange.params);

    const typesResult = await connection.queryObject(`
      SELECT label, COUNT(*)::BIGINT AS count FROM (
        SELECT d.document_type::TEXT AS label FROM documents d
        WHERE d.deleted_at IS NULL AND d.compiled_parent_id IS NULL
        UNION ALL
        SELECT COALESCE(cd.category, 'COMPILED')::TEXT FROM compiled_documents cd
        WHERE cd.deleted_at IS NULL
      ) entries GROUP BY label ORDER BY label
    `);
    const requestRange = timestampRange("created_at", window);
    const requestStatusResult = await connection.queryObject(`
      SELECT status, COUNT(*)::BIGINT AS count FROM document_requests
      WHERE ${requestRange.clause} AND status IN ('pending', 'approved', 'rejected')
      GROUP BY status
    `, requestRange.params);
    const requestCounts = new Map<string, number>(requestStatusResult.rows.map((row: Record<string, unknown>) => [String(row.status), count(row.count, "request.status")]));
    const requestStatuses = (["pending", "approved", "rejected"] as const).map((status) => ({ status, count: requestCounts.get(status) ?? 0 }));

    const repositoryActivity = (repositoryActivityResult.rows[0] ?? {}) as Record<string, unknown>;
    const repositoryViews = count(repositoryActivity.views, "activity.repositoryViews");
    const repositoryDownloads = count(repositoryActivity.downloads, "activity.repositoryDownloads");
    const guestViews = count(repositoryActivity.guest_views, "activity.guestViews");
    const registeredViews = count(repositoryActivity.registered_views, "activity.registeredViews");
    const registeredDownloads = count(repositoryActivity.registered_downloads, "activity.registeredDownloads");
    const approvedRequestDownloads = count(repositoryActivity.approved_request_downloads, "activity.approvedRequestDownloads");
    if (repositoryViews !== guestViews + registeredViews) throw new Error("REPORTING_INVARIANT_REPOSITORY_VIEWS");
    if (repositoryDownloads !== registeredDownloads + approvedRequestDownloads) throw new Error("REPORTING_INVARIANT_REPOSITORY_DOWNLOADS");

    const repositoryCoverage = buildCoverage(repositoryCoverageRow, window);
    const homeCoverage = buildCoverage(homeCoverageRow, window);
    const authorCoverage = buildCoverage(authorCoverageRow, window);
    const generatedAt = now.toISOString();
    const coverageStartedAt = [repositoryCoverage.startedAt, homeCoverage.startedAt, authorCoverage.startedAt].filter(Boolean).sort()[0] ?? null;
    const definitions: Record<string, string> = { ...METRIC_DEFINITIONS };
    return {
      meta: {
        dataVersion: 2,
        generatedAt,
        timezone: REPORTING_TIMEZONE,
        range: { key: window.key, label: window.label, bucket: window.bucket, startInclusive: dateParam(window.startInclusive), endExclusive: window.endExclusive.toISOString() },
        activityCoverageStartedAt: coverageStartedAt,
        coverage: { repository: repositoryCoverage, home: homeCoverage, authors: authorCoverage },
      },
      inventory: {
        catalogEntries: count(inventoryRow.active_single_entries, "inventory.activeSingleEntries") + count(inventoryRow.active_compilations, "inventory.activeCompilations"),
        storedDocuments: count(inventoryRow.stored_documents, "inventory.storedDocuments"),
        archivedCatalogEntries: count(inventoryRow.archived_single_entries, "inventory.archivedSingleEntries") + count(inventoryRow.archived_compilations, "inventory.archivedCompilations"),
        archivedDocuments: count(inventoryRow.archived_documents, "inventory.archivedDocuments"),
        authorRecords: count((authorResult.rows[0] as Record<string, unknown> | undefined)?.count, "inventory.authorRecords"),
        publishedAuthors: count((publishedResult.rows[0] as Record<string, unknown> | undefined)?.count, "inventory.publishedAuthors"),
      },
      workflow: { pendingUploads: count((pendingUploadResult.rows[0] as Record<string, unknown> | undefined)?.count, "workflow.pendingUploads"), pendingAccessRequests: count((pendingRequestResult.rows[0] as Record<string, unknown> | undefined)?.count, "workflow.pendingAccessRequests") },
      activity: {
        uploadedEntries: count((uploadedResult.rows[0] as Record<string, unknown> | undefined)?.count, "activity.uploadedEntries"),
        repositoryViews,
        repositoryDownloads,
        guestViews,
        registeredViews,
        approvedRequestDownloads,
        activeRegisteredUsers: readerUsers,
        homeVisits: { guest: home.guest, registered: home.registered, total: home.guest + home.registered },
      },
      series: { uploads, repositoryActivity: repositorySeries, homeVisits },
      rankings: {
        mostViewedEntries: topViews,
        mostDownloadedEntries: topDownloads,
        mostVisitedAuthors: topAuthorsResult.rows.map((value: Record<string, unknown>) => ({ id: String(value.id ?? ""), name: String(value.full_name ?? "Unnamed author"), visits: count(value.visits, "ranking.authorVisits"), profilePicture: value.profile_picture ? String(value.profile_picture) : null, href: `/pages/authorprofile.html?id=${encodeURIComponent(String(value.id ?? ""))}` })),
        trendingTopics: topicResult.rows.map((value: Record<string, unknown>) => { const entryCount = count(value.entries, "ranking.topicEntries"); return { id: count(value.id, "ranking.topicId"), name: String(value.name ?? "Unnamed topic"), views: count(value.views, "ranking.topicViews"), entryCount, activeCatalogEntryCount: entryCount, href: `/pages/searchResultsPage.html?topic=${encodeURIComponent(String(value.id ?? ""))}` }; }),
      },
      distributions: {
        documentTypes: typesResult.rows.map((value: Record<string, unknown>) => ({ label: String(value.label ?? "Unknown"), count: count(value.count, "distribution.documentType") })),
        requestStatuses,
      },
      registeredReaderSummary: { activeUsers: readerUsers, views: readerViews, downloads: readerDownloads, averageInteractionsPerActiveUser: readerUsers ? (readerViews + readerDownloads) / readerUsers : 0 },
      metricDefinitions: definitions,
    };
  });
}

export async function getDashboardReport(range: ReportRange, now = new Date()): Promise<OperationalReport> {
  return getOperationalReport(range, now);
}
