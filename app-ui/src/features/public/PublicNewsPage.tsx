import { useCallback, useEffect, useState } from "react";
import { ArrowRight, FileSearch } from "lucide-react";
import { motion } from "motion/react";
import { PeasErrorState } from "../../components/feedback/PeasStates";
import { PublicDocumentResultCard } from "../../components/public/PublicDocumentResultCard";
import { PublicFooter } from "../../components/public/PublicFooter";
import { PublicNavbar } from "../../components/public/PublicNavbar";
import { Skeleton } from "../../components/ui/skeleton";
import { Button } from "../../components/ui/button";
import { fetchDocuments } from "../../lib/api/documents";
import { getErrorMessage } from "../../lib/api/http";
import { fetchOptionalSession, searchResultsUrl } from "../../lib/api/public";
import type { SessionResponse } from "../../lib/api/auth";
import type { DocumentRecord } from "../../lib/api/types";

const LATEST_COUNT = 9;

export function PublicNewsPage() {
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadLatest = useCallback(() => {
    setLoading(true);
    setError("");
    fetchDocuments({ page: 1, size: LATEST_COUNT, sort: "latest", category: "All" })
      .then((result) => setDocuments(result.documents))
      .catch((loadError) => {
        setError(getErrorMessage(loadError));
        setDocuments([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let mounted = true;

    fetchOptionalSession().then((payload) => {
      if (mounted) setSession(payload);
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    loadLatest();
  }, [loadLatest]);

  return (
    <div className="peas-public-page peas-public-search-page">
      <PublicNavbar session={session} onSessionChange={setSession} />

      <main className="peas-public-search-shell">
        <section className="peas-public-search-hero" aria-labelledby="public-news-title">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.34, ease: "easeOut" }}
          >
            <span>News &amp; Updates</span>
            <h1 id="public-news-title">What&apos;s new in the repository</h1>
            <p>
              The latest theses, dissertations, Confluence volumes, and Synergy records published
              through the Office of Research &amp; Publications. For announcements, submissions, or
              other inquiries, <a href="/contact.html">contact the office</a>.
            </p>
          </motion.div>
        </section>

        <section className="peas-public-results" aria-labelledby="public-news-latest-title">
          <div className="peas-public-results-head">
            <div>
              <span>{loading ? "Loading" : "Recently Added"}</span>
              <h2 id="public-news-latest-title">Latest repository entries</h2>
            </div>
            <Button variant="outline" size="sm" onClick={() => (window.location.href = searchResultsUrl(""))}>
              Browse all entries
              <ArrowRight aria-hidden="true" />
            </Button>
          </div>

          {loading ? (
            <NewsSkeleton />
          ) : error ? (
            <PeasErrorState title="Unable to load the latest entries" message={error} onRetry={loadLatest} />
          ) : documents.length > 0 ? (
            <div className="peas-public-search-results-list">
              {documents.map((document) => (
                <PublicDocumentResultCard
                  document={document}
                  session={session}
                  showDescription
                  key={`${document.id}-${document.isCompiled}`}
                />
              ))}
            </div>
          ) : (
            <div className="peas-public-search-empty">
              <FileSearch aria-hidden="true" />
              <h3>No entries yet</h3>
              <p>New repository records will appear here as soon as they are published.</p>
            </div>
          )}
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}

function NewsSkeleton() {
  return (
    <div className="peas-public-search-results-list" aria-label="Loading latest entries">
      {Array.from({ length: 4 }).map((_, index) => (
        <div className="peas-public-search-skeleton" key={index}>
          <Skeleton className="peas-public-search-skeleton__icon" />
          <div>
            <Skeleton className="peas-skeleton-line peas-skeleton-line--wide" />
            <Skeleton className="peas-skeleton-line" />
          </div>
        </div>
      ))}
    </div>
  );
}
