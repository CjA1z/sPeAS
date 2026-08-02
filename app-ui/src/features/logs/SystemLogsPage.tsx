import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Download, LogIn, RefreshCw, ScrollText } from "lucide-react";
import { AdminPageHeader } from "../../components/layout/AdminPageHeader";
import { PeasEmptyState, PeasErrorState, PeasInlineSpinner } from "../../components/feedback/PeasStates";
import { Button } from "../../components/ui/button";
import { fetchSystemLogs, fetchSystemLogsSummary, type SystemLogsSummary } from "../../lib/api/system-logs";
import { getErrorMessage } from "../../lib/api/http";
import type { SystemLogRecord } from "../../lib/api/types";

const PAGE_SIZE = 20;

export function SystemLogsPage() {
  const [summary, setSummary] = useState<SystemLogsSummary | null>(null);
  const [logs, setLogs] = useState<SystemLogRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (nextPage = page) => {
    setLoading(true);
    setError("");
    try {
      const [nextSummary, result] = await Promise.all([
        fetchSystemLogsSummary(),
        fetchSystemLogs({ limit: PAGE_SIZE, offset: (nextPage - 1) * PAGE_SIZE }),
      ]);
      setSummary(nextSummary);
      setLogs(result.logs);
      setTotal(result.total);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { void load(page); }, [load, page]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="peas-admin-page peas-logs-page">
      <AdminPageHeader eyebrow="Administration" title="System Logs" description="Review recent sign-ins, downloads, and administrative activity." actions={
        <Button variant="outline" onClick={() => void load(page)} disabled={loading}><RefreshCw aria-hidden="true" /> {loading ? "Refreshing" : "Refresh"}</Button>
      } />
      {error ? <PeasErrorState title="Unable to load system logs" message={error} onRetry={() => void load(page)} /> : (
        <>
          <div className="peas-log-summary-grid">
            <LogCard title="Recent downloads" icon={<Download aria-hidden="true" />} logs={summary?.recentDownloads ?? []} loading={loading && !summary} />
            <LogCard title="Recent sign-ins" icon={<LogIn aria-hidden="true" />} logs={summary?.recentLogins ?? []} loading={loading && !summary} />
          </div>
          <section className="peas-admin-card peas-logs-table-card">
            <header><div><h2>All system activity</h2></div><small>{total} log{total === 1 ? "" : "s"}</small></header>
            {loading && !logs.length ? <PeasInlineSpinner label="Loading system logs" /> : logs.length ? (
              <div className="peas-data-table-wrap"><table className="peas-data-table"><thead><tr><th>Date and time</th><th>Type</th><th>User</th><th>Action</th><th>Status</th><th>Details</th></tr></thead><tbody>{logs.map((log, index) => <tr key={log.id ?? `${page}-${index}`}><td>{displayTime(log)}</td><td>{log.logType || "—"}</td><td>{log.username || "System"}</td><td>{log.action || "—"}</td><td><span className={`peas-log-status peas-log-status--${String(log.status || "unknown").toLowerCase()}`}>{log.status || "Unknown"}</span></td><td>{displayDetails(log.details)}</td></tr>)}</tbody></table></div>
            ) : <PeasEmptyState title="No system activity yet" description="New administrative and access events will appear here." icon={<ScrollText aria-hidden="true" />} />}
            <footer className="peas-table-pagination"><Button variant="outline" size="sm" disabled={loading || page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><span>Page {page} of {pages}</span><Button variant="outline" size="sm" disabled={loading || page >= pages} onClick={() => setPage((value) => value + 1)}>Next</Button></footer>
          </section>
        </>
      )}
    </main>
  );
}

function LogCard({ title, icon, logs, loading }: { title: string; icon: ReactNode; logs: SystemLogRecord[]; loading: boolean }) {
  return <section className="peas-admin-card peas-log-card"><header>{icon}<h2>{title}</h2></header>{loading ? <PeasInlineSpinner /> : logs.length ? <ul>{logs.slice(0, 5).map((log, index) => <li key={log.id ?? index}><div><strong>{log.username || "System"}</strong><span>{log.action || log.logType || "Activity"}</span></div><time>{displayTime(log)}</time></li>)}</ul> : <p>No recent activity.</p>}</section>;
}

function displayTime(log: SystemLogRecord) { return log.formattedTimestamp || (log.timestamp ? new Date(log.timestamp).toLocaleString() : "—"); }
function displayDetails(details: unknown) {
  if (!details) return "—";
  if (typeof details === "string") return details;
  try { return JSON.stringify(details); } catch { return "—"; }
}
