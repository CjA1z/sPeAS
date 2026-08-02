import { apiFetch } from "./http";

export type NewsStatus = "draft" | "published";
export type NewsBodyFormat = "plain" | "markdown";
export type NewsWorkType = "document" | "compiled";

export interface NewsAuthorReference {
  id: string;
  fullName: string;
  spudId: string | null;
  affiliation: string | null;
  department: string | null;
  biography: string | null;
  profilePicture: string | null;
  worksCount: number;
}

export interface NewsWorkReference {
  id: number;
  recordType: NewsWorkType;
  title: string;
  category: string;
  description: string;
  publicationDate: string | null;
  childCount: number;
}

export interface NewsWorkInput {
  id: number;
  recordType: NewsWorkType;
}

export interface NewsPost {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  bodyFormat: NewsBodyFormat;
  coverImageUrl: string | null;
  coverImageAlt: string;
  authorName: string;
  status: NewsStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  taggedAuthors: NewsAuthorReference[];
  taggedWorks: NewsWorkReference[];
}

export interface NewsPostInput {
  title: string;
  excerpt: string;
  body: string;
  bodyFormat?: NewsBodyFormat;
  coverImageUrl?: string;
  coverImageAlt?: string;
  authorName: string;
  status: NewsStatus;
  taggedAuthorIds?: string[];
  taggedWorks?: NewsWorkInput[];
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

export function searchNewsReferences(query = "") {
  return apiFetch<{ authors: NewsAuthorReference[]; works: NewsWorkReference[] }>(
    `/api/admin/news/references?q=${encodeURIComponent(query)}`,
  );
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

export async function uploadNewsImage(file: File, altText: string) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("altText", altText);
  const result = await apiFetch<{
    asset: { url: string; altText: string; mimeType: string; sizeBytes: number };
  }>("/api/admin/news/assets", { method: "POST", body: formData });
  return result.asset;
}
