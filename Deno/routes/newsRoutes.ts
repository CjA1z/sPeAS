import { Router } from "../deps.ts";
import { isAdmin, isAuthenticated } from "../middleware/authMiddleware.ts";
import {
  createNewsPost,
  deleteNewsPost,
  getPublishedNewsBySlug,
  listAllNews,
  listPublishedNews,
  updateNewsPost,
  type NewsPostInput,
} from "../services/newsService.ts";

const router = new Router();

router.get("/api/news", async (ctx) => {
  const page = positiveInteger(ctx.request.url.searchParams.get("page"), 1);
  const size = positiveInteger(ctx.request.url.searchParams.get("size"), 9);
  const result = await listPublishedNews(page, size);
  ctx.response.body = {
    ...result,
    currentPage: page,
    totalPages: Math.ceil(result.totalCount / Math.min(size, 50)),
  };
});

router.get("/api/news/:slug", async (ctx) => {
  const post = await getPublishedNewsBySlug(String(ctx.params.slug || ""));
  if (!post) {
    ctx.response.status = 404;
    ctx.response.body = { error: "News post not found" };
    return;
  }
  ctx.response.body = { post };
});

router.get("/api/admin/news", isAuthenticated, isAdmin, async (ctx) => {
  ctx.response.body = { posts: await listAllNews() };
});

router.post("/api/admin/news", isAuthenticated, isAdmin, async (ctx) => {
  const input = await readNewsInput(ctx);
  if (!input) return;
  const post = await createNewsPost(input, String(ctx.state.user.id));
  ctx.response.status = 201;
  ctx.response.body = { post };
});

router.put("/api/admin/news/:id", isAuthenticated, isAdmin, async (ctx) => {
  const id = positiveInteger(ctx.params.id, 0);
  const input = await readNewsInput(ctx);
  if (!id || !input) return;
  const post = await updateNewsPost(id, input);
  if (!post) {
    ctx.response.status = 404;
    ctx.response.body = { error: "News post not found" };
    return;
  }
  ctx.response.body = { post };
});

router.delete("/api/admin/news/:id", isAuthenticated, isAdmin, async (ctx) => {
  const id = positiveInteger(ctx.params.id, 0);
  if (!id) {
    ctx.response.status = 400;
    ctx.response.body = { error: "A valid news post ID is required" };
    return;
  }
  if (!await deleteNewsPost(id)) {
    ctx.response.status = 404;
    ctx.response.body = { error: "News post not found" };
    return;
  }
  ctx.response.status = 204;
});

async function readNewsInput(ctx: any): Promise<NewsPostInput | null> {
  let body: Record<string, unknown>;
  try {
    body = await ctx.request.body({ type: "json" }).value;
  } catch {
    ctx.response.status = 400;
    ctx.response.body = { error: "A valid JSON body is required" };
    return null;
  }

  const input: NewsPostInput = {
    title: String(body.title ?? "").trim(),
    excerpt: String(body.excerpt ?? "").trim(),
    body: String(body.body ?? "").trim(),
    coverImageUrl: String(body.coverImageUrl ?? "").trim() || null,
    authorName: String(body.authorName ?? "Office of Research & Publications").trim(),
    status: body.status === "published" ? "published" : "draft",
  };

  if (!input.title || !input.excerpt || !input.body || !input.authorName) {
    ctx.response.status = 400;
    ctx.response.body = { error: "Title, summary, article body, and author are required" };
    return null;
  }
  if (input.title.length > 255 || input.authorName.length > 160) {
    ctx.response.status = 400;
    ctx.response.body = { error: "Title or author is too long" };
    return null;
  }
  return input;
}

function positiveInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export default router;
