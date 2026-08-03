import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpenText, ClipboardList, Eye, FileStack, RefreshCw, Tags, UsersRound } from "lucide-react";
import { AdminPageHeader } from "../../components/layout/AdminPageHeader";
import { useAdminIdentity } from "../../components/layout/AdminLayout";
import { PeasEmptyState, PeasErrorState } from "../../components/feedback/PeasStates";
import { Skeleton } from "../../components/ui/skeleton";
import { Button } from "../../components/ui/button";
import { PeasChart } from "../../components/data-display/PeasChart";
import { fetchDashboardSnapshot, type DashboardRange, type DashboardSnapshot } from "../../lib/api/dashboard";
import { getErrorMessage } from "../../lib/api/http";

const RANGE_LABELS: Record<DashboardRange, string> = { "30d": "Last 30 days", "90d": "Last 90 days", "1y": "Last 12 months" };

export function DashboardPage() {
  const { userName } = useAdminIdentity();
  const [range, setRange] = useState<DashboardRange>("30d");
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const snapshotRef = useRef<DashboardSnapshot | null>(null);

  const load = useCallback(async (nextRange = range, manual = false) => {
    const currentRequest = ++requestId.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setError("");
    if (manual || snapshotRef.current) setRefreshing(true); else setLoading(true);
    try {
      const next = await fetchDashboardSnapshot(nextRange, controller.signal);
      if (currentRequest === requestId.current && !controller.signal.aborted) {
        snapshotRef.current = next;
        setSnapshot(next);
      }
    } catch (caughtError) {
      if (currentRequest === requestId.current && !controller.signal.aborted) setError(getErrorMessage(caughtError));
    } finally {
      if (currentRequest === requestId.current) { setLoading(false); setRefreshing(false); }
    }
  }, [range]);

  useEffect(() => {
    void load(range);
    return () => abortRef.current?.abort();
  }, [range, load]);

  const firstName = userName.split(/\s+/)[0] || "Administrator";
  const selectedLabel = RANGE_LABELS[range];
  const snapshotMatchesRange = snapshot?.range === range;
  const displayedRangeLabel = snapshotMatchesRange ? selectedLabel : snapshot?.meta.range.label ?? selectedLabel;
  return (
    <main className="peas-admin-island peas-dashboard-page">
      <AdminPageHeader eyebrow="Repository overview" title={`Welcome back, ${firstName}`} description={new Intl.DateTimeFormat("en-PH", { dateStyle: "full" }).format(new Date())} actions={<div className="peas-dashboard-header-actions"><label className="peas-dashboard-range"><span>Traffic range</span><select value={range} onChange={(event) => setRange(event.target.value as DashboardRange)} aria-label="Dashboard traffic range">{Object.entries(RANGE_LABELS).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label><Button variant="outline" disabled={loading || refreshing} onClick={() => void load(range, true)}><RefreshCw aria-hidden="true" /> {refreshing ? "Refreshing…" : "Refresh"}</Button></div>} />
      {error && !snapshot ? <PeasErrorState title="Unable to load dashboard" message={error} onRetry={() => void load(range)} /> : <>
      {error ? <p className="peas-dashboard-stale-warning" role="status">The previous snapshot is shown. {error}</p> : null}
        {snapshot && !snapshotMatchesRange ? <p className="peas-dashboard-stale-warning" role="status">Updating the dashboard to {selectedLabel}…</p> : null}
        {snapshot ? <p className="peas-report-coverage">Updated {formatUpdated(snapshot.meta.generatedAt)}</p> : null}
        {snapshot ? <CoverageNotice coverage={snapshot.meta.coverage} /> : null}
        <section className="peas-dashboard-kpis" aria-label="Repository summary" aria-busy={loading && !snapshot}>
          <DashboardKpi icon={<FileStack />} label="Catalog entries" value={snapshot?.inventory.catalogEntries} help={snapshot?.metricDefinitions.catalog_entries} />
          <DashboardKpi icon={<BookOpenText />} label="Stored documents" value={snapshot?.inventory.storedDocuments} help={snapshot?.metricDefinitions.stored_documents} />
          <DashboardKpi icon={<Eye />} label={`Home visits · ${displayedRangeLabel.toLowerCase()}`} value={snapshot?.activity.homeVisits.total} help={snapshot ? `${snapshot.metricDefinitions.home_visits} ${snapshot.activity.homeVisits.guest} guest + ${snapshot.activity.homeVisits.registered} registered-user visits.` : undefined} />
          <DashboardKpi icon={<UsersRound />} label="Author records" value={snapshot?.inventory.authorRecords} help={snapshot?.metricDefinitions.author_records} />
        </section>
        <NeedsAttention snapshot={snapshot} loading={loading && !snapshot} />
        <section className="peas-dashboard-grid">
          <VisitChart points={snapshot?.series.homeVisits ?? []} rangeLabel={displayedRangeLabel} loading={loading && !snapshot} />
          <TopActivity snapshot={snapshot} loading={loading && !snapshot} rangeLabel={displayedRangeLabel} />
        </section>
        <CategoryBreakdown rows={snapshot?.distributions.documentTypes ?? []} loading={loading && !snapshot} />
      </>}
    </main>
  );
}

function DashboardKpi({ icon, label, value, help }: { icon: React.ReactNode; label: string; value?: number; help?: string }) {
  return <article className="peas-dashboard-kpi"><div className="peas-dashboard-kpi__icon" aria-hidden="true">{icon}</div><div><span>{label}</span>{value === undefined ? <Skeleton className="peas-dashboard-kpi__skeleton" /> : <strong>{value.toLocaleString()}</strong>}<small>{help ?? "Loading metric definition…"}</small></div></article>;
}

function NeedsAttention({ snapshot, loading }: { snapshot: DashboardSnapshot | null; loading: boolean }) {
  return <section className="peas-dashboard-attention" aria-labelledby="dashboard-attention-title"><header><div><span>Needs attention</span><h2 id="dashboard-attention-title">Review queue</h2></div></header><div className="peas-dashboard-attention__grid"><AttentionCard icon={<FileStack />} label="Pending uploads" value={snapshot?.workflow.pendingUploads} href="/admin/Components/documents_list.html?status=pending_review" loading={loading} /><AttentionCard icon={<ClipboardList />} label="Pending access requests" value={snapshot?.workflow.pendingAccessRequests} href="/admin/Components/document-permissions.html?status=pending" loading={loading} /></div></section>;
}

function AttentionCard({ icon, label, value, href, loading }: { icon: React.ReactNode; label: string; value?: number; href: string; loading: boolean }) {
  return <a className="peas-dashboard-attention__card" href={href}><span className="peas-dashboard-attention__icon" aria-hidden="true">{icon}</span><span><small>{label}</small>{loading || value === undefined ? <Skeleton className="peas-dashboard-attention__skeleton" /> : <strong>{value.toLocaleString()}</strong>}</span><span className="peas-dashboard-attention__action">Review</span></a>;
}

function VisitChart({ points, rangeLabel, loading }: { points: DashboardSnapshot["series"]["homeVisits"]; rangeLabel: string; loading: boolean }) {
  const labels = points.map((point) => formatDate(point.bucket));
  return <article className="peas-dashboard-panel peas-visit-panel"><header><div><span>Home traffic</span><h2>Visits — {rangeLabel}</h2></div></header>{loading ? <Skeleton className="peas-dashboard-chart-skeleton" /> : <PeasChart type="bar" labels={labels} ariaLabel={`Guest and registered-user home visits for ${rangeLabel}`} datasets={[{ label: "Guest", data: points.map((point) => point.guest), backgroundColor: "#9fd8c8" }, { label: "Registered user", data: points.map((point) => point.registered), backgroundColor: "#006f54" }]} tableHeaders={["Period", "Guest", "Registered user", "Total"]} tableRows={points.map((point) => [formatDate(point.bucket), point.guest, point.registered, point.total])} emptyTitle="No visits in this period" emptyDescription="Traffic will appear here after the first recorded home-page visit." />}<div className="peas-visit-legend"><span className="is-guest">Guest</span><span className="is-user">Registered user</span></div></article>;
}

function TopActivity({ snapshot, loading, rangeLabel }: { snapshot: DashboardSnapshot | null; loading: boolean; rangeLabel: string }) {
  const [tab, setTab] = useState<"works" | "authors" | "topics">("works");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const tabs = [{ key: "works", label: "Most visited works" }, { key: "authors", label: "Authors" }, { key: "topics", label: "Trending topics" }] as const;
  const activate = (nextTab: typeof tab, focus = true) => {
    setTab(nextTab);
    if (focus) requestAnimationFrame(() => tabRefs.current[tabs.findIndex((item) => item.key === nextTab)]?.focus());
  };
  // Native listeners keep the roving-tab interaction reliable in the static
  // production shell as well as in React's delegated event system.
  useEffect(() => {
    const cleanups = tabRefs.current.map((button, index) => {
      if (!button) return undefined;
      const onKeyDown = (event: KeyboardEvent) => {
        if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const nextIndex = event.key === "Home"
          ? 0
          : event.key === "End"
            ? tabs.length - 1
            : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
        setTab(tabs[nextIndex].key);
        requestAnimationFrame(() => tabRefs.current[nextIndex]?.focus());
      };
      button.addEventListener("keydown", onKeyDown);
      return () => button.removeEventListener("keydown", onKeyDown);
    });
    return () => cleanups.forEach((cleanup) => cleanup?.());
  }, []);
  return <article className="peas-dashboard-panel peas-top-authors peas-top-activity"><header><div><span>Top activity</span><h2>Most active — {rangeLabel}</h2></div></header><div className="peas-dashboard-tabs" role="tablist" aria-label="Top activity">{tabs.map((item, index) => <button ref={(element) => { tabRefs.current[index] = element; }} type="button" role="tab" id={`dashboard-tab-${item.key}`} aria-controls={`dashboard-panel-${item.key}`} aria-selected={tab === item.key} tabIndex={tab === item.key ? 0 : -1} className={tab === item.key ? "is-active" : ""} onClick={() => activate(item.key, false)} key={item.key}>{item.label}</button>)}</div>{loading ? <Skeleton className="peas-dashboard-list-skeleton" /> : <div role="tabpanel" id={`dashboard-panel-${tab}`} aria-labelledby={`dashboard-tab-${tab}`}>{tab === "works" ? <WorkList rows={snapshot?.rankings.mostViewedEntries ?? []} /> : tab === "authors" ? <AuthorList rows={snapshot?.rankings.mostVisitedAuthors ?? []} /> : <TopicList rows={snapshot?.rankings.trendingTopics ?? []} />}</div>}</article>;
}

function WorkList({ rows }: { rows: DashboardSnapshot["rankings"]["mostViewedEntries"] }) { return rows.length ? <ol className="peas-dashboard-ranking">{rows.slice(0, 5).map((row, index) => <li key={`${row.recordType}-${row.id}`}><strong>{index + 1}</strong><span>{row.href ? <a href={row.href}><b>{row.title}</b></a> : <b>{row.title}</b>}<small>{row.category} · {row.views.toLocaleString()} views</small></span></li>)}</ol> : <PeasEmptyState title="No work views yet" description="The list will populate after public works receive views." />; }
function AuthorList({ rows }: { rows: DashboardSnapshot["rankings"]["mostVisitedAuthors"] }) { return rows.length ? <ol className="peas-dashboard-ranking">{rows.slice(0, 5).map((row, index) => <li key={row.id}><strong>{index + 1}</strong><span>{row.href ? <a href={row.href}><b>{row.name}</b></a> : <b>{row.name}</b>}<small>{row.visits.toLocaleString()} profile visits</small></span></li>)}</ol> : <PeasEmptyState title="No author visits yet" description="The list will populate after author profiles receive visits." />; }
function TopicList({ rows }: { rows: DashboardSnapshot["rankings"]["trendingTopics"] }) { return rows.length ? <ol className="peas-dashboard-ranking">{rows.slice(0, 5).map((row, index) => <li key={row.id}><strong>{index + 1}</strong><span>{row.href ? <a href={row.href}><b>{row.name}</b></a> : <b>{row.name}</b>}<small>{row.views.toLocaleString()} views · {row.entryCount} works</small></span></li>)}</ol> : <PeasEmptyState title="No trending topics yet" description="Approved topics will appear after their works receive views." />; }

function CategoryBreakdown({ rows, loading }: { rows: Array<{ label: string; count: number }>; loading: boolean }) { const total = rows.reduce((sum, row) => sum + row.count, 0); return <section className="peas-dashboard-panel peas-category-breakdown" aria-labelledby="category-breakdown-title"><header><div><span>Repository structure</span><h2 id="category-breakdown-title">Entries by category</h2></div></header>{loading ? <Skeleton className="peas-dashboard-list-skeleton" /> : rows.length ? <div>{rows.map((row) => { const percentage = total ? Math.round((row.count / total) * 100) : 0; return <article key={row.label}><span>{titleCase(row.label)}</span><strong>{row.count}</strong><div><i style={{ width: `${percentage}%` }} /></div><small>{percentage}% of catalog entries</small></article>; })}</div> : <PeasEmptyState title="No catalog entries yet" description="Category totals will appear after repository entries are added." />}</section>; }

function CoverageNotice({ coverage }: { coverage?: DashboardSnapshot["meta"]["coverage"] }) {
  const warnings = coverage
    ? [["Repository", coverage.repository?.warning], ["Home", coverage.home?.warning], ["Authors", coverage.authors?.warning]].filter((item): item is [string, string] => Boolean(item[1]))
    : [];
  return warnings.length ? <aside className="peas-report-coverage-warning" role="status"><strong>Historical coverage note</strong>{warnings.map(([label, warning]) => <span key={label}><b>{label}:</b> {warning}</span>)}</aside> : null;
}

function formatDate(value: string) { const date = new Date(value.includes("T") ? value : `${value}T00:00:00`); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", timeZone: "Asia/Manila" }).format(date); }
function titleCase(value: string) { return value.toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase()); }
function formatUpdated(value: string) { return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(value)); }
