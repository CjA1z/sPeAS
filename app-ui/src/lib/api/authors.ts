import { apiFetch } from "./http";
import type { AuthorRecord, AuthorWorkRecord } from "./types";

export interface Author {
  id: number | string;
  full_name: string;
  affiliation?: string;
  department?: string;
  email?: string;
  orcid_id?: string;
}

export async function fetchAuthors(search?: string): Promise<AuthorRecord[]> {
  const params = new URLSearchParams();
  if (search?.trim()) params.set("q", search.trim());
  const endpoint = search?.trim() ? `/api/authors/search?${params.toString()}` : "/api/authors/all";
  const payload = await apiFetch<Array<Record<string, unknown>>>(endpoint);

  return payload.map(normalizeAuthor);
}

export function fetchDocumentAuthors(documentId: number) {
  return apiFetch<Author[]>(`/api/document-authors/${documentId}`);
}

export async function fetchAuthorWorks(authorId: string | number): Promise<AuthorWorkRecord[]> {
  const payload = await apiFetch<Array<Record<string, unknown>>>(`/api/authors/${authorId}/works`);
  return payload.map((raw) => ({
    id: Number(raw.id ?? raw.document_id),
    title: String(raw.title ?? raw.document_title ?? "Untitled document"),
    category: stringifyNullable(raw.document_type ?? raw.category),
    publicationDate: stringifyNullable(raw.publication_date ?? raw.created_at),
    raw,
  }));
}

export function updateAuthor(authorId: string | number, payload: Record<string, unknown>) {
  return apiFetch<Record<string, unknown>>(`/api/authors/${authorId}`, {
    method: "PUT",
    json: payload,
  });
}

export function createAuthor(payload: Record<string, unknown>) {
  return apiFetch<Record<string, unknown>>("/authors", {
    method: "POST",
    json: payload,
  });
}

export function restoreAuthor(authorId: string | number) {
  return apiFetch<Record<string, unknown>>(`/authors/${authorId}/restore`, {
    method: "POST",
  });
}

function normalizeAuthor(raw: Record<string, unknown>): AuthorRecord {
  return {
    id: (raw.id ?? raw.author_id ?? "") as string | number,
    fullName: String(raw.full_name ?? raw.name ?? "Unnamed author"),
    affiliation: stringifyNullable(raw.affiliation),
    department: stringifyNullable(raw.department),
    email: stringifyNullable(raw.email),
    orcidId: stringifyNullable(raw.orcid_id ?? raw.orcidId),
    profilePicture: stringifyNullable(raw.profile_picture ?? raw.profilePicture ?? raw.profile_pic),
    raw,
  };
}

function stringifyNullable(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}
