import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Newspaper } from "lucide-react";
import { motion } from "motion/react";
import { PeasErrorState } from "../../components/feedback/PeasStates";
import { PeasPagination } from "../../components/data-display/PeasPagination";
import { PublicPageShell } from "../../components/public/PublicPageShell";
import { Skeleton } from "../../components/ui/skeleton";
import { getErrorMessage } from "../../lib/api/http";
import { fetchPublishedNews, fetchPublishedNewsPost, type NewsPost } from "../../lib/api/news";

const PAGE_SIZE = 9;

export function PublicNewsPage() {
  const slug = useMemo(() => new URLSearchParams(window.location.search).get("slug")?.trim() || "", []);
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [article, setArticle] = useState<NewsPost | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadNews = useCallback(() => {
    setLoading(true);
    setError("");
    const request = slug
      ? fetchPublishedNewsPost(slug).then((post) => setArticle(post))
      : fetchPublishedNews(page, PAGE_SIZE).then((result) => {
        setPosts(result.posts);
        setTotalCount(result.totalCount);
        setTotalPages(result.totalPages);
      });

    request.catch((caughtError) => setError(getErrorMessage(caughtError))).finally(() => setLoading(false));
  }, [page, slug]);

  useEffect(() => { loadNews(); }, [loadNews]);

  return (
    <PublicPageShell mainClassName="peas-news-shell peas-news-page">
        {loading ? <NewsSkeleton article={Boolean(slug)} /> : error ? (
          <PeasErrorState title="Unable to load news" message={error} onRetry={loadNews} />
        ) : article ? <NewsArticle post={article} /> : (
          <NewsFeed posts={posts} page={page} totalCount={totalCount} totalPages={totalPages} onPageChange={setPage} />
        )}
    </PublicPageShell>
  );
}

function NewsFeed({ posts, page, totalCount, totalPages, onPageChange }: {
  posts: NewsPost[];
  page: number;
  totalCount: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <>
      <section className="peas-news-hero" aria-labelledby="news-title">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
          <span>Office of Research &amp; Publications</span>
          <h1 id="news-title">News from Research &amp; Publications</h1>
          <p>Department announcements, research activities, publication milestones, events, and opportunities for the Paulinian community.</p>
        </motion.div>
      </section>

      <section className="peas-news-feed" aria-labelledby="latest-news-title">
        <div className="peas-news-feed__heading">
          <span>Department Updates</span>
          <h2 id="latest-news-title">Latest news</h2>
        </div>
        {posts.length ? (
          <div className="peas-news-grid">
            {posts.map((post, index) => <NewsCard post={post} index={index} key={post.id} />)}
          </div>
        ) : (
          <div className="peas-news-empty">
            <Newspaper aria-hidden="true" />
            <h3>No published news yet</h3>
            <p>Updates from the Office of Research &amp; Publications will appear here.</p>
          </div>
        )}
        {posts.length ? <PeasPagination page={page} totalPages={totalPages} totalCount={totalCount} visibleCount={posts.length} label="News pages" onPageChange={onPageChange} /> : null}
      </section>
    </>
  );
}

function NewsCard({ post, index }: { post: NewsPost; index: number }) {
  return (
    <motion.article className="peas-news-card" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
      <a className="peas-news-card__image" href={`/news.html?slug=${encodeURIComponent(post.slug)}`}>
        {post.coverImageUrl ? <img src={post.coverImageUrl} alt="" /> : <Newspaper aria-hidden="true" />}
      </a>
      <div className="peas-news-card__body">
        <NewsMeta post={post} />
        <h3><a href={`/news.html?slug=${encodeURIComponent(post.slug)}`}>{post.title}</a></h3>
        <p>{post.excerpt}</p>
        <a className="peas-news-card__link" href={`/news.html?slug=${encodeURIComponent(post.slug)}`}>
          Read full story <ArrowRight aria-hidden="true" />
        </a>
      </div>
    </motion.article>
  );
}

function NewsArticle({ post }: { post: NewsPost }) {
  const paragraphs = post.body.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
  return (
    <article className="peas-news-article">
      <a className="peas-news-back" href="/news.html"><ArrowLeft aria-hidden="true" /> All news</a>
      <header>
        <span>Office of Research &amp; Publications</span>
        <h1>{post.title}</h1>
        <NewsMeta post={post} />
        <p>{post.excerpt}</p>
      </header>
      {post.coverImageUrl ? <img className="peas-news-article__cover" src={post.coverImageUrl} alt="" /> : null}
      <div className="peas-news-article__content">
        {paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
      </div>
    </article>
  );
}

function NewsMeta({ post }: { post: NewsPost }) {
  return (
    <div className="peas-news-meta">
      <span><CalendarDays aria-hidden="true" /> {formatNewsDate(post.publishedAt)}</span>
      <span>By {post.authorName}</span>
    </div>
  );
}

function NewsSkeleton({ article }: { article: boolean }) {
  return (
    <div className={article ? "peas-news-article" : "peas-news-feed"} aria-label="Loading news">
      <Skeleton className="peas-skeleton-line peas-skeleton-line--wide" />
      <Skeleton className="peas-skeleton-line" />
      <Skeleton className="peas-news-skeleton-block" />
    </div>
  );
}

function formatNewsDate(value: string | null) {
  if (!value) return "Publication date unavailable";
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "long" }).format(new Date(value));
}
