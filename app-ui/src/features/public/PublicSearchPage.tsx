import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, FileSearch, Search } from "lucide-react";
import { motion } from "motion/react";
import { PeasPagination } from "../../components/data-display/PeasPagination";
import { PeasErrorState } from "../../components/feedback/PeasStates";
import { PublicDocumentResultCard } from "../../components/public/PublicDocumentResultCard";
import { PublicFooter } from "../../components/public/PublicFooter";
import { PublicNavbar } from "../../components/public/PublicNavbar";
import { Skeleton } from "../../components/ui/skeleton";
import { Button } from "../../components/ui/button";
import { fetchSession, type SessionResponse } from "../../lib/api/auth";
import { fetchCategories, fetchDocuments } from "../../lib/api/documents";
import { getErrorMessage } from "../../lib/api/http";
import type { CategoryCount, DocumentsPageResult } from "../../lib/api/types";
import { CATEGORY_ORDER, getCategoryMeta, normalizeCategory, type DocumentCategory } from "../../lib/constants/categories";

const PAGE_SIZE = 8;

export function PublicSearchPage() {
  const initial = useMemo(() => readSearchParams(), []);
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [query, setQuery] = useState(initial.query);
  const [submittedQuery, setSubmittedQuery] = useState(initial.query);
  const [queryMode, setQueryMode] = useState<"search" | "keyword">(initial.mode);
  const [category, setCategory] = useState<DocumentCategory>(initial.category);
  const [sort, setSort] = useState<"latest" | "earliest">(initial.sort);
  const [page, setPage] = useState(initial.page);
  const [categories, setCategories] = useState<CategoryCount[]>([]);
  const [result, setResult] = useState<DocumentsPageResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadResults = useCallback(() => {
    setLoading(true);
    setError("");
    updateSearchUrl({ query: submittedQuery, mode: queryMode, category, sort, page });

    fetchDocuments({
      page,
      size: PAGE_SIZE,
      sort,
      category,
      search: queryMode === "search" ? submittedQuery : undefined,
      keyword: queryMode === "keyword" ? submittedQuery : undefined,
    })
      .then(setResult)
      .catch((searchError) => {
        setError(getErrorMessage(searchError));
        setResult(null);
      })
      .finally(() => setLoading(false));
  }, [category, page, queryMode, sort, submittedQuery]);

  useEffect(() => {
    let mounted = true;

    fetchSession().then((payload) => {
      if (mounted) setSession(payload);
    }).catch(() => {
      if (mounted) setSession(null);
    });

    fetchCategories().then((payload) => {
      if (mounted) setCategories(payload);
    }).catch(() => {
      if (mounted) setCategories([]);
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    loadResults();
  }, [loadResults]);

  const totalCount = result?.totalCount ?? 0;
  const visibleCount = result?.documents.length ?? 0;
  const resultLabel = submittedQuery ? `Results for "${submittedQuery}"` : "Browse all repository entries";

  return (
    <div className="peas-public-page peas-public-search-page">
      <PublicNavbar session={session} onSessionChange={setSession} />

      <main className="peas-public-search-shell">
        <section className="peas-public-search-hero" aria-labelledby="public-search-title">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.34, ease: "easeOut" }}
          >
            <span>Repository Search</span>
            <h1 id="public-search-title">{resultLabel}</h1>
            <p>Filter theses, dissertations, Confluence volumes, and Synergy records while keeping the academic archive easy to scan.</p>
          </motion.div>
        </section>

        <section className="peas-public-search-panel" aria-label="Search filters">
          <form
            className="peas-public-search-form"
            onSubmit={(event) => {
              event.preventDefault();
              setPage(1);
              setQueryMode("search");
              setSubmittedQuery(query.trim());
            }}
          >
            <label>
              <span>Search</span>
              <span className="peas-public-search-field">
                <Search aria-hidden="true" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.currentTarget.value)}
                  placeholder="Title, author, keyword, topic"
                />
              </span>
            </label>
            <label>
              <span>Collection</span>
              <select
                value={category}
                onChange={(event) => {
                  setPage(1);
                  setCategory(event.currentTarget.value as DocumentCategory);
                }}
              >
                {CATEGORY_ORDER.map((item) => (
                  <option value={item} key={item}>
                    {getCategoryMeta(item).label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Sort</span>
              <select
                value={sort}
                onChange={(event) => {
                  setPage(1);
                  setSort(event.currentTarget.value as "latest" | "earliest");
                }}
              >
                <option value="latest">Latest to Earliest</option>
                <option value="earliest">Earliest to Latest</option>
              </select>
            </label>
            <Button type="submit">
              Search
              <ArrowRight aria-hidden="true" />
            </Button>
          </form>

          <div className="peas-public-search-categories" aria-label="Collection quick filters">
            {CATEGORY_ORDER.map((item) => {
              const meta = getCategoryMeta(item);
              const count = item === "All"
                ? categories.reduce((sum, row) => sum + row.count, 0)
                : categories.find((row) => row.name === item)?.count ?? 0;
              return (
                <button
                  className={`peas-public-search-chip peas-category-tone-${meta.tone}${category === item ? " is-active" : ""}`}
                  type="button"
                  key={item}
                  onClick={() => {
                    setPage(1);
                    setCategory(item);
                  }}
                >
                  <span>{meta.label}</span>
                  <small>{count}</small>
                </button>
              );
            })}
          </div>
        </section>

        <section className="peas-public-results" aria-labelledby="public-results-title">
          <div className="peas-public-results-head">
            <div>
              <span>{loading ? "Searching" : `${totalCount} ${totalCount === 1 ? "match" : "matches"}`}</span>
              <h2 id="public-results-title">Documents</h2>
            </div>
            {submittedQuery || category !== "All" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setQuery("");
                  setSubmittedQuery("");
                  setQueryMode("search");
                  setCategory("All");
                  setSort("latest");
                  setPage(1);
                }}
              >
                Clear filters
              </Button>
            ) : null}
          </div>

          {loading ? (
            <SearchSkeleton />
          ) : error ? (
            <PeasErrorState title="Unable to load search results" message={error} onRetry={loadResults} />
          ) : result && result.documents.length > 0 ? (
            <>
              <div className="peas-public-search-results-list">
                {result.documents.map((document) => (
                  <PublicDocumentResultCard
                    document={document}
                    session={session}
                    showDescription
                    key={`${document.id}-${document.isCompiled}`}
                  />
                ))}
              </div>
              <PeasPagination
                page={result.currentPage}
                totalPages={result.totalPages}
                totalCount={result.totalCount}
                visibleCount={visibleCount}
                label="Search results pagination"
                onPageChange={(nextPage) => {
                  setPage(nextPage);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />
            </>
          ) : (
            <div className="peas-public-search-empty">
              <FileSearch aria-hidden="true" />
              <h3>No documents found</h3>
              <p>Try a broader keyword, remove the collection filter, or browse all repository entries.</p>
            </div>
          )}
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}

function SearchSkeleton() {
  return (
    <div className="peas-public-search-results-list" aria-label="Loading search results">
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

function readSearchParams() {
  const params = new URLSearchParams(window.location.search);
  const keyword = params.get("keyword") ?? "";
  const query = (params.get("q") || keyword).trim();
  const mode: "search" | "keyword" = keyword && !params.get("q") ? "keyword" : "search";
  const category = normalizeCategory(params.get("category"));
  const sort: "latest" | "earliest" = params.get("sort") === "earliest" ? "earliest" : "latest";
  const page = Math.max(1, Number(params.get("page") || 1) || 1);

  return { query, category, sort, page, mode };
}

function updateSearchUrl({
  query,
  mode,
  category,
  sort,
  page,
}: {
  query: string;
  mode: "search" | "keyword";
  category: DocumentCategory;
  sort: "latest" | "earliest";
  page: number;
}) {
  const params = new URLSearchParams();
  if (query.trim()) params.set(mode === "keyword" ? "keyword" : "q", query.trim());
  if (category !== "All") params.set("category", category);
  if (sort !== "latest") params.set("sort", sort);
  if (page > 1) params.set("page", String(page));
  const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
  window.history.replaceState(null, "", nextUrl);
}
