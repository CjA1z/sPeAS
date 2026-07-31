import { client } from "../db/denopost_conn.ts";

export type NewsStatus = "draft" | "published";

export interface NewsPostInput {
  title: string;
  excerpt: string;
  body: string;
  coverImageUrl?: string | null;
  authorName: string;
  status: NewsStatus;
}

export interface NewsPost {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  coverImageUrl: string | null;
  authorName: string;
  status: NewsStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface NewsRow {
  id: number | bigint;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  cover_image_url: string | null;
  author_name: string;
  status: NewsStatus;
  published_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  total_count?: number | bigint;
}

const SELECT_FIELDS = `
  id, title, slug, excerpt, body, cover_image_url, author_name,
  status, published_at, created_at, updated_at
`;

export async function ensureNewsTableExists(): Promise<void> {
  await client.queryObject(`
    CREATE TABLE IF NOT EXISTS news_posts (
      id BIGSERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      slug VARCHAR(255) NOT NULL UNIQUE,
      excerpt TEXT NOT NULL,
      body TEXT NOT NULL,
      cover_image_url TEXT,
      author_name VARCHAR(160) NOT NULL DEFAULT 'Office of Research & Publications',
      status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
      published_at TIMESTAMPTZ,
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_news_posts_public_feed
      ON news_posts (published_at DESC)
      WHERE status = 'published' AND deleted_at IS NULL;
  `);
}

export async function listPublishedNews(page = 1, size = 9): Promise<{ posts: NewsPost[]; totalCount: number }> {
  const safePage = Math.max(1, page);
  const safeSize = Math.min(50, Math.max(1, size));
  const result = await client.queryObject<NewsRow>(`
    SELECT ${SELECT_FIELDS}, COUNT(*) OVER() AS total_count
    FROM news_posts
    WHERE status = 'published'
      AND deleted_at IS NULL
      AND published_at IS NOT NULL
      AND published_at <= CURRENT_TIMESTAMP
    ORDER BY published_at DESC, id DESC
    LIMIT $1 OFFSET $2
  `, [safeSize, (safePage - 1) * safeSize]);

  return {
    posts: result.rows.map(mapNewsRow),
    totalCount: result.rows.length ? Number(result.rows[0].total_count ?? 0) : 0,
  };
}

export async function getPublishedNewsBySlug(slug: string): Promise<NewsPost | null> {
  const result = await client.queryObject<NewsRow>(`
    SELECT ${SELECT_FIELDS}
    FROM news_posts
    WHERE slug = $1
      AND status = 'published'
      AND deleted_at IS NULL
      AND published_at IS NOT NULL
      AND published_at <= CURRENT_TIMESTAMP
    LIMIT 1
  `, [slug]);
  return result.rows[0] ? mapNewsRow(result.rows[0]) : null;
}

export async function listAllNews(): Promise<NewsPost[]> {
  const result = await client.queryObject<NewsRow>(`
    SELECT ${SELECT_FIELDS}
    FROM news_posts
    WHERE deleted_at IS NULL
    ORDER BY created_at DESC, id DESC
  `);
  return result.rows.map(mapNewsRow);
}

export async function createNewsPost(input: NewsPostInput, userId: string): Promise<NewsPost> {
  const slug = await uniqueSlug(input.title);
  const result = await client.queryObject<NewsRow>(`
    INSERT INTO news_posts (
      title, slug, excerpt, body, cover_image_url, author_name,
      status, published_at, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7,
      CASE WHEN $7 = 'published' THEN CURRENT_TIMESTAMP ELSE NULL END, $8)
    RETURNING ${SELECT_FIELDS}
  `, [
    input.title,
    slug,
    input.excerpt,
    input.body,
    input.coverImageUrl || null,
    input.authorName,
    input.status,
    userId,
  ]);
  return mapNewsRow(result.rows[0]);
}

export async function updateNewsPost(id: number, input: NewsPostInput): Promise<NewsPost | null> {
  const result = await client.queryObject<NewsRow>(`
    UPDATE news_posts
    SET title = $2,
        excerpt = $3,
        body = $4,
        cover_image_url = $5,
        author_name = $6,
        status = $7,
        published_at = CASE
          WHEN $7 = 'published' THEN COALESCE(published_at, CURRENT_TIMESTAMP)
          ELSE NULL
        END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $1 AND deleted_at IS NULL
    RETURNING ${SELECT_FIELDS}
  `, [
    id,
    input.title,
    input.excerpt,
    input.body,
    input.coverImageUrl || null,
    input.authorName,
    input.status,
  ]);
  return result.rows[0] ? mapNewsRow(result.rows[0]) : null;
}

export async function deleteNewsPost(id: number): Promise<boolean> {
  const result = await client.queryObject(`
    UPDATE news_posts
    SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = $1 AND deleted_at IS NULL
    RETURNING id
  `, [id]);
  return Boolean(result.rowCount);
}

async function uniqueSlug(title: string): Promise<string> {
  const base = slugify(title) || `news-${Date.now()}`;
  const result = await client.queryObject<{ slug: string }>(`
    SELECT slug FROM news_posts WHERE slug = $1 OR slug LIKE $2
  `, [base, `${base}-%`]);
  const existing = new Set(result.rows.map((row) => row.slug));
  if (!existing.has(base)) return base;

  let suffix = 2;
  while (existing.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 220);
}

function mapNewsRow(row: NewsRow): NewsPost {
  return {
    id: Number(row.id),
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    body: row.body,
    coverImageUrl: row.cover_image_url,
    authorName: row.author_name,
    status: row.status,
    publishedAt: toIso(row.published_at),
    createdAt: toIso(row.created_at) ?? "",
    updatedAt: toIso(row.updated_at) ?? "",
  };
}

function toIso(value: Date | string | null): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}
