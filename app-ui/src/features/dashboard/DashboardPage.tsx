import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpenText, Eye, FileStack, RefreshCw, UsersRound } from "lucide-react";
import { AdminPageHeader } from "../../components/layout/AdminPageHeader";
import { useAdminIdentity } from "../../components/layout/AdminLayout";
import { AuthorImage } from "../../components/authors/AuthorImage";
import { PeasEmptyState, PeasErrorState } from "../../components/feedback/PeasStates";
import { Skeleton } from "../../components/ui/skeleton";
import { Button } from "../../components/ui/button";
import {
  fetchDashboardSnapshot,
  fetchVisitStats,
  type DashboardSnapshot,
  type VisitPeriod,
  type VisitStats,
} from "../../lib/api/dashboard";
import { getErrorMessage } from "../../lib/api/http";

const PERIOD_LABELS: Record<VisitPeriod, string> = {
  daily: "Daily visits — last 30 days",
  weekly: "Weekly view — last 90 days",
  monthly: "Monthly view — last 12 months",
};

export function DashboardPage() {
  const { userName } = useAdminIdentity();
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setSnapshot(await fetchDashboardSnapshot());
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const firstName = userName.split(/\s+/)[0] || "Administrator";
  return (
    <main className="peas-admin-island peas-dashboard-page">
      <AdminPageHeader
        eyebrow="Repository overview"
        title={`Welcome back, ${firstName}`}
        description={new Intl.DateTimeFormat("en-PH", { dateStyle: "full" }).format(new Date())}
        actions={<Button variant="outline" disabled={loading} onClick={() => void load()}><RefreshCw aria-hidden="true" /> Refresh</Button>}
      />

      {error && !snapshot ? <PeasErrorState title="Unable to load dashboard" message={error} onRetry={load} /> : (
        <>
          <section className="peas-dashboard-kpis" aria-label="Repository summary" aria-busy={loading}>
            <DashboardKpi icon={<FileStack />} label="Catalog entries" value={snapshot?.repository.catalogEntries} help="Active top-level works; each compilation counts once." />
            <DashboardKpi icon={<BookOpenText />} label="Stored documents" value={snapshot?.repository.storedDocuments} help="Active document records; compilation studies are included." />
            <DashboardKpi icon={<Eye />} label="Home visits · last 30 days" value={snapshot?.visits.total} help={snapshot ? `${snapshot.visits.guest} guest + ${snapshot.visits.user} registered-user visits` : undefined} />
            <DashboardKpi icon={<UsersRound />} label="Author records" value={snapshot?.repository.authorRecords} help="All directory records, including authors with no linked works." />
          </section>

          <section className="peas-dashboard-grid">
            <VisitChart initialStats={snapshot?.visits ?? null} />
            <TopAuthors authors={snapshot?.topAuthors ?? []} loading={loading && !snapshot} />
          </section>

          <CategoryBreakdown rows={snapshot?.repository.documentTypes ?? []} loading={loading && !snapshot} />
        </>
      )}
    </main>
  );
}

function DashboardKpi({ icon, label, value, help }: { icon: React.ReactNode; label: string; value?: number; help?: string }) {
  return (
    <article className="peas-dashboard-kpi">
      <div className="peas-dashboard-kpi__icon" aria-hidden="true">{icon}</div>
      <div>
        <span>{label}</span>
        {value === undefined ? <Skeleton className="peas-dashboard-kpi__skeleton" /> : <strong>{value.toLocaleString()}</strong>}
        <small>{help ?? "Loading metric definition…"}</small>
      </div>
    </article>
  );
}

function VisitChart({ initialStats }: { initialStats: VisitStats | null }) {
  const [period, setPeriod] = useState<VisitPeriod>("daily");
  const [stats, setStats] = useState<VisitStats | null>(initialStats);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialStats && period === "daily") setStats(initialStats);
  }, [initialStats, period]);

  const changePeriod = async (nextPeriod: VisitPeriod) => {
    setPeriod(nextPeriod);
    setLoading(true);
    setError("");
    try {
      setStats(await fetchVisitStats(nextPeriod));
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  };

  const max = Math.max(1, ...(stats?.points.map((point) => point.total) ?? []));
  return (
    <article className="peas-dashboard-panel peas-visit-panel">
      <header>
        <div><h2>{PERIOD_LABELS[period]}</h2></div>
        <div className="peas-dashboard-periods" aria-label="Visit chart period">
          {(["daily", "weekly", "monthly"] as VisitPeriod[]).map((value) => (
            <button type="button" className={period === value ? "is-active" : ""} aria-pressed={period === value} onClick={() => void changePeriod(value)} key={value}>{value[0].toUpperCase() + value.slice(1)}</button>
          ))}
        </div>
      </header>
      {loading ? <Skeleton className="peas-dashboard-chart-skeleton" /> : error ? <PeasErrorState title="Unable to load visits" message={error} /> : stats?.points.length ? (
        <div className="peas-visit-chart" role="img" aria-label={`${PERIOD_LABELS[period]}. Guest and registered-user visits.`}>
          {stats.points.map((point) => (
            <div className="peas-visit-chart__column" key={point.date} title={`${formatChartDate(point.date)}: ${point.total} visits`}>
              <div className="peas-visit-chart__bar" style={{ height: `${Math.max(4, (point.total / max) * 100)}%` }}>
                <span className="is-user" style={{ height: `${point.total ? (point.user / point.total) * 100 : 0}%` }} />
              </div>
              <small>{formatChartDate(point.date)}</small>
            </div>
          ))}
        </div>
      ) : <PeasEmptyState title="No visits in this period" description="Traffic will appear here after the first recorded home-page visit." />}
      <div className="peas-visit-legend"><span className="is-guest">Guest</span><span className="is-user">Registered user</span></div>
    </article>
  );
}

function TopAuthors({ authors, loading }: { authors: DashboardSnapshot["topAuthors"]; loading: boolean }) {
  return (
    <article className="peas-dashboard-panel peas-top-authors">
      <header><div><h2>Most visited authors</h2></div></header>
      {loading ? <Skeleton className="peas-dashboard-list-skeleton" /> : authors.length ? (
        <ol>
          {authors.map((author) => (
            <li key={author.id}>
              <span className="peas-dashboard-author-avatar"><AuthorImage src={author.profilePicture} name={author.name} alt="" /></span>
              <div><strong>{author.name}</strong><small>{author.visits.toLocaleString()} profile {author.visits === 1 ? "visit" : "visits"}</small></div>
            </li>
          ))}
        </ol>
      ) : <PeasEmptyState title="No author visits yet" description="The list will populate after author profiles receive visits." />}
    </article>
  );
}

function CategoryBreakdown({ rows, loading }: { rows: DashboardSnapshot["repository"]["documentTypes"]; loading: boolean }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return (
    <section className="peas-dashboard-panel peas-category-breakdown" aria-labelledby="category-breakdown-title">
      <header><div><h2 id="category-breakdown-title">Entries by category</h2></div></header>
      {loading ? <Skeleton className="peas-dashboard-list-skeleton" /> : rows.length ? <div>{rows.map((row) => {
        const percentage = total ? Math.round((row.count / total) * 100) : 0;
        return <article key={row.documentType}><span>{titleCase(row.documentType)}</span><strong>{row.count}</strong><div><i style={{ width: `${percentage}%` }} /></div><small>{percentage}% of catalog entries</small></article>;
      })}</div> : <PeasEmptyState title="No catalog entries yet" description="Category totals will appear after repository entries are added." />}
    </section>
  );
}

function formatChartDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric" }).format(date);
}

function titleCase(value: string) { return value.toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase()); }
