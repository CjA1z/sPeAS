import { Router } from "../deps.ts";
import {
  isAuthenticated,
  requireCapability,
} from "../middleware/authMiddleware.ts";
import { SystemLogsModel } from "../models/systemLogsModel.ts";
import {
  saveSiteAsset,
  SiteAssetValidationError,
} from "../services/experienceService.ts";
import {
  createNewsPost,
  deleteNewsPost,
  getPublishedNewsBySlug,
  listAllNews,
  listPublishedNews,
  type NewsPostInput,
  NewsReferenceValidationError,
  type NewsWorkInput,
  searchNewsReferences,
  updateNewsPost,
} from "../services/newsService.ts";

const router = new Router();
const requireNewsManagement = requireCapability("news:manage");
const requireNewsDeletion = requireCapability("news:delete");

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

router.get(
  "/api/admin/news",
  isAuthenticated,
  requireNewsManagement,
  async (ctx) => {
    ctx.response.body = { posts: await listAllNews() };
  },
);

router.get(
  "/api/admin/news/references",
  isAuthenticated,
  requireNewsManagement,
  async (ctx) => {
    const query = ctx.request.url.searchParams.get("q") ?? "";
    ctx.response.body = await searchNewsReferences(query);
  },
);

router.post(
  "/api/admin/news/assets",
  isAuthenticated,
  requireNewsManagement,
  async (ctx) => {
    if (
      !(ctx.request.headers.get("content-type") || "").includes(
        "multipart/form-data",
      )
    ) {
      ctx.response.status = 400;
      ctx.response.body = {
        error: "Upload a JPG, PNG, or WEBP image using multipart form data",
      };
      return;
    }

    try {
      const form = await ctx.request.body({ type: "form-data" }).value;
      const data = await form.read({
        maxFileSize: 8 * 1024 * 1024,
        maxSize: 10 * 1024 * 1024,
      });
      const file = data.files?.[0];
      if (!file) {
        ctx.response.status = 400;
        ctx.response.body = { error: "Choose an image to upload" };
        return;
      }
      const asset = await saveSiteAsset({
        file: file as unknown as {
          filename?: string;
          name?: string;
          type?: string;
          content?: Uint8Array;
          path?: string;
        },
        kind: "news-cover",
        altText: data.fields.altText ? String(data.fields.altText) : undefined,
        userId: String(ctx.state.user.id),
      });
      ctx.response.body = {
        asset: {
          url: asset.file_path,
          altText: asset.alt_text || "",
          mimeType: asset.mime_type,
          sizeBytes: asset.size_bytes,
        },
      };
    } catch (error) {
      ctx.response.status = error instanceof SiteAssetValidationError
        ? 400
        : 500;
      ctx.response.body = {
        error: error instanceof SiteAssetValidationError
          ? error.message
          : "Unable to upload the news image",
      };
    }
  },
);

router.post(
  "/api/admin/news",
  isAuthenticated,
  requireNewsManagement,
  async (ctx) => {
    const input = await readNewsInput(ctx);
    if (!input) return;
    let post;
    try {
      post = await createNewsPost(input, String(ctx.state.user.id));
    } catch (error) {
      if (error instanceof NewsReferenceValidationError) {
        ctx.response.status = 400;
        ctx.response.body = { error: error.message };
        return;
      }
      throw error;
    }
    await logNewsAction(
      ctx,
      input.status === "published" ? "news_published" : "news_draft_created",
      post.id,
      {
        title: post.title,
        status: post.status,
      },
    );
    ctx.response.status = 201;
    ctx.response.body = { post };
  },
);

router.put(
  "/api/admin/news/:id",
  isAuthenticated,
  requireNewsManagement,
  async (ctx) => {
    const id = positiveInteger(ctx.params.id, 0);
    const input = await readNewsInput(ctx);
    if (!id || !input) return;
    const previous = (await listAllNews()).find((post) => post.id === id);
    let post;
    try {
      post = await updateNewsPost(id, input);
    } catch (error) {
      if (error instanceof NewsReferenceValidationError) {
        ctx.response.status = 400;
        ctx.response.body = { error: error.message };
        return;
      }
      throw error;
    }
    if (!post) {
      ctx.response.status = 404;
      ctx.response.body = { error: "News post not found" };
      return;
    }
    const action = previous?.status !== post.status
      ? post.status === "published" ? "news_published" : "news_unpublished"
      : "news_updated";
    await logNewsAction(ctx, action, post.id, {
      title: post.title,
      previousStatus: previous?.status,
      status: post.status,
    });
    ctx.response.body = { post };
  },
);

router.delete(
  "/api/admin/news/:id",
  isAuthenticated,
  requireNewsDeletion,
  async (ctx) => {
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
    await logNewsAction(ctx, "news_deleted", id);
    ctx.response.status = 204;
  },
);

async function logNewsAction(
  ctx: any,
  action: string,
  newsId: number,
  details: Record<string, unknown> = {},
) {
  await SystemLogsModel.createLog({
    log_type: "news",
    user_id: String(ctx.state.user.id),
    username: String(ctx.state.user.id),
    action,
    details: { ...details, role: String(ctx.state.user.role) },
    related_id: String(newsId),
  }).catch(() => undefined);
}

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
    bodyFormat: body.bodyFormat === "markdown" ? "markdown" : "plain",
    coverImageUrl: String(body.coverImageUrl ?? "").trim() || null,
    coverImageAlt: String(body.coverImageAlt ?? "").trim(),
    authorName: String(body.authorName ?? "Office of Research & Publications")
      .trim(),
    status: body.status === "published" ? "published" : "draft",
    taggedAuthorIds: parseAuthorIds(body.taggedAuthorIds),
    taggedWorks: parseTaggedWorks(body.taggedWorks),
  };

  if (!input.taggedAuthorIds || !input.taggedWorks) {
    ctx.response.status = 400;
    ctx.response.body = {
      error: "Tagged authors or works contain an invalid record identifier",
    };
    return null;
  }
  if (input.taggedAuthorIds.length > 20 || input.taggedWorks.length > 20) {
    ctx.response.status = 400;
    ctx.response.body = {
      error: "An article can tag up to 20 authors and 20 works",
    };
    return null;
  }

  if (!input.title || !input.excerpt || !input.body || !input.authorName) {
    ctx.response.status = 400;
    ctx.response.body = {
      error: "Title, summary, article body, and author are required",
    };
    return null;
  }
  if (input.title.length > 255 || input.authorName.length > 160) {
    ctx.response.status = 400;
    ctx.response.body = { error: "Title or author is too long" };
    return null;
  }
  if ((input.coverImageAlt?.length ?? 0) > 255) {
    ctx.response.status = 400;
    ctx.response.body = {
      error: "Cover image alternative text must be 255 characters or fewer",
    };
    return null;
  }
  if (input.coverImageUrl && !input.coverImageAlt) {
    ctx.response.status = 400;
    ctx.response.body = {
      error: "Alternative text is required when a cover image is used",
    };
    return null;
  }
  return input;
}

function parseAuthorIds(value: unknown): string[] | undefined {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return undefined;
  const ids = value.map((item) => String(item).trim());
  if (
    ids.some((id) =>
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        .test(id)
    )
  ) {
    return undefined;
  }
  return [...new Set(ids)];
}

function parseTaggedWorks(value: unknown): NewsWorkInput[] | undefined {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return undefined;
  const works: NewsWorkInput[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return undefined;
    const record = item as Record<string, unknown>;
    const id = Number(record.id);
    const recordType = record.recordType;
    if (
      !Number.isInteger(id) || id <= 0 ||
      (recordType !== "document" && recordType !== "compiled")
    ) {
      return undefined;
    }
    if (
      !works.some((work) => work.id === id && work.recordType === recordType)
    ) {
      works.push({ id, recordType });
    }
  }
  return works;
}

function positiveInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export default router;
