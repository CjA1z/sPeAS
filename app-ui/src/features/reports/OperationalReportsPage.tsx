import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, Download, FileStack, Library, RefreshCw, UsersRound } from "lucide-react";
import { AdminPageHeader } from "../../components/layout/AdminPageHeader";
import { PeasEmptyState, PeasErrorState } from "../../components/feedback/PeasStates";
import { Skeleton } from "../../components/ui/skeleton";
import { Button } from "../../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { PeasToaster, toast } from "../../components/ui/toast";
import { exportCsvReport, exportPdfReport, fetchDocumentStatistics, type ReportParams } from "../../lib/api/reports";
import type { ReportStats } from "../../lib/api/types";
import { getErrorMessage } from "../../lib/api/http";

type TimeRange = NonNullable<ReportParams["timeRange"]>;
const RANGE_LABELS: Record<TimeRange, string> = { all: "All time", daily: "Last 24 hours", weekly: "Last 7 days", monthly: "Last month", yearly: "Last year" };

export function OperationalReportsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (notify = false) => {
    setLoading(true); setError("");
    try {
      setStats(await fetchDocumentStatistics({ timeRange }));
      if (notify) toast.success("Statistics updated.");
    } catch (caughtError) { const message = getErrorMessage(caughtError); setError(message); if (notify) toast.error(message); }
    finally { setLoading(false); }
  }, [timeRange]);

  useEffect(() => { void load(false); }, [load]);

  const exportReport = async (format: "pdf" | "csv") => {
    if (!stats) return;
    try {
      const payload = { reportType: "operational_repository", timeRange, data: stats.raw };
      const blob = format === "pdf" ? await exportPdfReport(payload) : await exportCsvReport(payload);
      downloadBlob(blob, `peas-operational-report-${timeRange}-${new Date().toISOString().slice(0, 10)}.${format}`);
      toast.success(`${format.toUpperCase()} report downloaded.`);
    } catch (caughtError) { toast.error(getErrorMessage(caughtError)); }
  };

  return (
    <main className="peas-admin-island peas-reports-page">
      <PeasToaster />
      <AdminPageHeader eyebrow="Operational visibility" title="Operational Reports" description="Review repository inventory, archive status, and category distribution using canonical PeAS metrics." actions={<><Select value={timeRange} onValueChange={(value) => setTimeRange(value as TimeRange)}><SelectTrigger aria-label="Report time range" className="peas-report-range"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(RANGE_LABELS).map(([value, label]) => <SelectItem value={value} key={value}>{label}</SelectItem>)}</SelectContent></Select><Button variant="outline" disabled={loading} onClick={() => void load(true)}><RefreshCw aria-hidden="true" /> {loading ? "Refreshing…" : "Refresh"}</Button></>} />
      {error && !stats ? <PeasErrorState title="Unable to load reports" message={error} onRetry={() => void load(false)} /> : <>
        <section className="peas-report-kpis" aria-label={`${RANGE_LABELS[timeRange]} repository metrics`} aria-busy={loading}>
          <ReportKpi icon={<FileStack />} label="Catalog entries" value={stats?.catalogEntries} help={stats?.metricDefinitions.catalog_entries} />
          <ReportKpi icon={<Library />} label="Stored documents" value={stats?.storedDocuments} help={stats?.metricDefinitions.stored_documents} />
          <ReportKpi icon={<Archive />} label="Archived entries" value={stats?.archivedCatalogEntries} help={stats?.metricDefinitions.archived_catalog_entries} />
          <ReportKpi icon={<UsersRound />} label="Author records" value={stats?.authorRecords} help={stats?.metricDefinitions.author_records} />
        </section>
        <section className="peas-reports-grid">
          <StatusSummary stats={stats} loading={loading && !stats} />
          <CategorySummary stats={stats} loading={loading && !stats} />
        </section>
        <section className="peas-report-export"><div><h2>Export this operational snapshot</h2><p>The export uses the same {RANGE_LABELS[timeRange].toLowerCase()} filters and metric definitions shown above.</p></div><div><Button variant="outline" disabled={!stats} onClick={() => void exportReport("csv")}><Download aria-hidden="true" /> CSV</Button><Button disabled={!stats} onClick={() => void exportReport("pdf")}><Download aria-hidden="true" /> PDF</Button></div></section>
      </>}
    </main>
  );
}

function ReportKpi({ icon, label, value, help }: { icon: React.ReactNode; label: string; value?: number; help?: string }) { return <article className="peas-report-kpi"><span aria-hidden="true">{icon}</span><div><small>{label}</small>{value === undefined ? <Skeleton className="peas-report-kpi__skeleton" /> : <strong>{value.toLocaleString()}</strong>}<p>{help ?? "Loading counting rule…"}</p></div></article>; }

function StatusSummary({ stats, loading }: { stats: ReportStats | null; loading: boolean }) {
  const active = stats?.catalogEntries ?? 0; const archived = stats?.archivedCatalogEntries ?? 0; const total = active + archived; const activePercent = total ? Math.round((active / total) * 100) : 0;
  return <article className="peas-report-panel"><header><h2>Active and archived entries</h2></header>{loading ? <Skeleton className="peas-report-chart-skeleton" /> : total ? <div className="peas-report-status"><div className="peas-report-donut" style={{ background: `conic-gradient(var(--brand-green) 0 ${activePercent}%, #d4a017 ${activePercent}% 100%)` }}><span><strong>{total}</strong><small>entries</small></span></div><dl><div><dt>Active catalog entries</dt><dd>{active}</dd></div><div><dt>Archived catalog entries</dt><dd>{archived}</dd></div></dl></div> : <PeasEmptyState title="No catalog activity" description="Active and archived entries will appear here." />}</article>;
}

function CategorySummary({ stats, loading }: { stats: ReportStats | null; loading: boolean }) {
  const max = useMemo(() => Math.max(1, ...(stats?.documentTypes.map((row) => row.count) ?? [])), [stats]);
  return <article className="peas-report-panel"><header><h2>Category distribution</h2></header>{loading ? <Skeleton className="peas-report-chart-skeleton" /> : stats?.documentTypes.length ? <div className="peas-report-bars">{stats.documentTypes.map((row) => <div key={row.documentType}><span>{titleCase(row.documentType)}</span><div><i style={{ width: `${(row.count / max) * 100}%` }} /></div><strong>{row.count}</strong></div>)}</div> : <PeasEmptyState title="No category data" description="Category totals will appear after entries are added." />}</article>;
}

function downloadBlob(blob: Blob, filename: string) { const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 0); }
function titleCase(value: string) { return value.toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase()); }
