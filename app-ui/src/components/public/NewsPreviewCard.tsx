import { ArrowRight, CalendarDays, Newspaper } from "lucide-react";
import { motion } from "motion/react";
import type { MouseEvent } from "react";
import type { NewsPost } from "../../lib/api/news";

const NEWS_NAVIGATION_DELAY_MS = 220;

export function NewsPreviewCard({ post, index = 0, transitionOnNavigate = false }: {
  post: NewsPost;
  index?: number;
  transitionOnNavigate?: boolean;
}) {
  const href = `/news.html?slug=${encodeURIComponent(post.slug)}`;
  const titleId = `news-card-title-${post.id}`;

  return (
    <motion.article className="peas-news-card" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
      <a
        className="peas-news-card__link"
        href={href}
        aria-labelledby={titleId}
        onClick={transitionOnNavigate ? handleNewsNavigation : undefined}
      >
        <div className="peas-news-card__body">
          <div className="peas-news-card__brand" aria-hidden="true">
            <span className="peas-news-card__logos">
              <img src="/Components/images/peas.png" alt="" />
              <img src="/Components/images/spud_logo_s.png" alt="" />
            </span>
            <span>Paulinian electronic<br />Archiving System (PeAS)</span>
          </div>
          <h3 id={titleId}>{post.title}</h3>
          <p>{post.excerpt}</p>
          <div className="peas-news-meta">
            <span><CalendarDays aria-hidden="true" /> {formatNewsDate(post.publishedAt)}</span>
            <span>By {post.authorName}</span>
          </div>
        </div>
        <div className="peas-news-card__image">
          {post.coverImageUrl ? <img src={post.coverImageUrl} alt={post.coverImageAlt || ""} /> : (
            <span className="peas-news-card__placeholder">
              <Newspaper aria-hidden="true" />
              <span>News &amp; updates</span>
            </span>
          )}
          <span className="peas-news-card__cta">
            Read full story <ArrowRight aria-hidden="true" />
          </span>
        </div>
      </a>
    </motion.article>
  );
}

function handleNewsNavigation(event: MouseEvent<HTMLAnchorElement>) {
  if (
    event.defaultPrevented
    || event.button !== 0
    || event.metaKey
    || event.ctrlKey
    || event.shiftKey
    || event.altKey
    || event.currentTarget.target === "_blank"
    || window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return;
  }

  event.preventDefault();
  const destination = event.currentTarget.href;
  const root = document.documentElement;
  const clearTransition = () => root.classList.remove("peas-news-route-leaving");

  root.classList.add("peas-news-route-leaving");
  window.addEventListener("pageshow", clearTransition, { once: true });
  window.setTimeout(() => window.location.assign(destination), NEWS_NAVIGATION_DELAY_MS);
}

function formatNewsDate(value: string | null) {
  if (!value) return "Publication date unavailable";
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "long" }).format(new Date(value));
}
