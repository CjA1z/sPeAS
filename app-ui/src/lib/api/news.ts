import { apiFetch } from "./http";

export type NewsStatus = "draft" | "published";

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

export interface NewsPostInput {
  title: string;
  excerpt: string;
  body: string;
  coverImageUrl?: string;
  authorName: string;
  status: NewsStatus;
}

export interface NewsPageResult {
  posts: NewsPost[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

export function fetchPublishedNews(page = 1, size = 9) {
  return apiFetch<NewsPageResult>(`/api/news?page=${page}&size=${size}`);
}

export async function fetchPublishedNewsPost(slug: string) {
  const result = await apiFetch<{ post: NewsPost }>(`/api/news/${encodeURIComponent(slug)}`);
  return result.post;
}

export async function fetchAdminNews() {
  const result = await apiFetch<{ posts: NewsPost[] }>("/api/admin/news");
  return result.posts;
}

export async function createNewsPost(input: NewsPostInput) {
  const result = await apiFetch<{ post: NewsPost }>("/api/admin/news", {
    method: "POST",
    json: input,
  });
  return result.post;
}

export async function updateNewsPost(id: number, input: NewsPostInput) {
  const result = await apiFetch<{ post: NewsPost }>(`/api/admin/news/${id}`, {
    method: "PUT",
    json: input,
  });
  return result.post;
}

export function deleteNewsPost(id: number) {
  return apiFetch<void>(`/api/admin/news/${id}`, { method: "DELETE" });
}
