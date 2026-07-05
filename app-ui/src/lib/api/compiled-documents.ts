import { apiFetch } from "./http";
import type { DocumentRecord } from "./types";
import { fetchChildDocuments } from "./documents";

export interface CompiledDocumentRecord {
  id: number;
  title?: string;
  category?: string;
  volume?: string | number;
  issue_number?: string | number;
  start_year?: number;
  end_year?: number;
  document_count?: number;
  [key: string]: unknown;
}

export function fetchCompiledDocument(id: number) {
  return apiFetch<CompiledDocumentRecord>(`/api/compiled-documents/${id}`);
}

export function fetchCompiledDocumentChildren(id: number): Promise<DocumentRecord[]> {
  return fetchChildDocuments(id);
}

export function updateCompiledDocument(id: number, payload: Record<string, unknown> | FormData) {
  if (payload instanceof FormData) {
    return apiFetch<CompiledDocumentRecord>(`/api/compiled-documents/${id}`, {
      method: "PUT",
      body: payload,
    });
  }

  return apiFetch<CompiledDocumentRecord>(`/api/compiled-documents/${id}`, {
    method: "PUT",
    json: payload,
  });
}
