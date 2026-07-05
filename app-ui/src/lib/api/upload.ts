import { apiFetch } from "./http";
import type { UploadCompiledDocumentPayload, UploadSingleDocumentPayload } from "./types";

export interface UploadedFileResult {
  message?: string;
  filePath: string;
  originalName?: string;
  size?: number;
  metadata?: {
    abstract?: string;
    pageCount?: number;
    pages?: number;
    [key: string]: unknown;
  } | null;
  fileType?: string;
  status?: string;
  details?: Record<string, unknown>;
}

export interface CreatedDocumentResult {
  id: number;
  title?: string;
  [key: string]: unknown;
}

export function uploadSingleDocument(payload: FormData | UploadSingleDocumentPayload) {
  if (payload instanceof FormData) {
    return apiFetch<Record<string, unknown>>("/api/upload", {
      method: "POST",
      body: payload,
    });
  }

  return apiFetch<Record<string, unknown>>("/api/documents", {
    method: "POST",
    json: payload,
  });
}

export function uploadCompiledDocument(payload: UploadCompiledDocumentPayload) {
  return apiFetch<Record<string, unknown>>("/api/compiled-documents", {
    method: "POST",
    json: payload,
  });
}

export function uploadDocumentFile(formData: FormData) {
  return apiFetch<Record<string, unknown>>("/api/documents/upload-file", {
    method: "POST",
    body: formData,
  });
}

export function uploadFile(file: File, options: { storagePath: string; documentType: string; category?: string; isForeword?: boolean }) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("storagePath", options.storagePath);
  formData.append("document_type", options.documentType);
  if (options.category) formData.append("category", options.category);
  if (options.isForeword) formData.append("is_foreword", "true");

  return apiFetch<UploadedFileResult>("/api/upload", {
    method: "POST",
    body: formData,
  });
}

export function createDocumentRecord(payload: Record<string, unknown>) {
  return apiFetch<CreatedDocumentResult>("/api/documents", {
    method: "POST",
    json: payload,
  });
}

export function createCompiledDocumentRecord(payload: UploadCompiledDocumentPayload | Record<string, unknown>) {
  return apiFetch<{ id: number; success?: boolean }>("/api/compiled-documents", {
    method: "POST",
    json: payload,
  });
}

export function linkDocumentsToCompilation(compiledDocumentId: number, documentIds: number[]) {
  return apiFetch<Record<string, unknown>>("/api/compiled-documents/add-documents", {
    method: "POST",
    json: {
      compiledDocumentId,
      documentIds,
    },
  });
}

export function linkDocumentAuthors(documentId: number, authors: string[]) {
  if (authors.length === 0) return Promise.resolve(null);

  return apiFetch<Record<string, unknown>>("/document-authors", {
    method: "POST",
    json: {
      document_id: documentId,
      authors,
    },
  });
}

export async function linkResearchAgenda(documentId: number, agendaItems: string[]) {
  if (agendaItems.length === 0) return;

  const payload = {
    document_id: documentId,
    agenda_items: agendaItems,
  };

  await Promise.allSettled([
    apiFetch<Record<string, unknown>>("/document-research-agenda", {
      method: "POST",
      json: payload,
    }),
    apiFetch<Record<string, unknown>>("/api/document-research-agenda/link", {
      method: "POST",
      json: payload,
    }),
  ]);
}
