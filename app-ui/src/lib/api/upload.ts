import { apiFetch } from "./http";
import type { DocumentAuthorReference, DocumentAuthorSelection } from "../authorSelection";
import type { UploadCompiledDocumentPayload, UploadSingleDocumentPayload } from "./types";
import type { DocumentClassification } from "./types";

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
  review_status?: "pending_review" | "approved" | "rejected";
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

  return apiFetch<UploadedFileResult>("/api/content/upload", {
    method: "POST",
    body: formData,
  });
}

export function uploadAuthorProfilePicture(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("is_profile_picture", "true");
  return apiFetch<{ filePath: string }>("/api/upload", { method: "POST", body: formData });
}

export function uploadUserProfilePicture(file: File) {
  const formData = new FormData();
  formData.append("profilePicture", file);
  return apiFetch<{ success: boolean; pictureUrl: string; profilePicture: string }>("/api/user/profile/picture", {
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

export function fetchResearchAgendas() {
  return apiFetch<Array<{ id: number; code?: string; name: string }>>("/api/research-agendas");
}

export function fetchAdminResearchAgendas() {
  return apiFetch<Array<{ id: number; code?: string; name: string; is_active?: boolean }>>("/api/research-agendas?include_inactive=true");
}

export function createAdminResearchAgenda(payload: Record<string, unknown>) {
  return apiFetch<{ id: number; code?: string; name: string }>("/api/admin/research-agendas", { method: "POST", json: payload });
}

export function updateAdminResearchAgenda(id: number, payload: Record<string, unknown>) {
  return apiFetch<{ id: number; code?: string; name: string }>(`/api/admin/research-agendas/${id}`, { method: "PUT", json: payload });
}

export function fetchAdminTopics(status = "all") {
  return apiFetch<Array<{ id: number; name: string; status?: string }>>(`/api/admin/topics?status=${encodeURIComponent(status)}`);
}

export function createAdminTopic(name: string) {
  return apiFetch<{ id: number; name: string; status?: string }>("/api/admin/topics", { method: "POST", json: { name } });
}

export function reviewAdminTopic(id: number, decision: "approve" | "reject") {
  return apiFetch<{ id: number; name: string; status?: string }>(`/api/admin/topics/${id}/${decision}`, { method: "POST" });
}

export interface ClassificationMigrationReview {
  document_id: number;
  legacy_research_agenda_id: number;
  legacy_value: string;
  suggested_type?: string;
  decision?: string;
  target_id?: number;
  status: string;
  document_title?: string;
}

export function fetchClassificationMigrationReview(status = "pending") {
  return apiFetch<ClassificationMigrationReview[]>(`/api/admin/classification/migration-review?status=${encodeURIComponent(status)}`);
}

export function resolveClassificationMigrationReview(documentId: number, legacyId: number, payload: { decision: string; targetId?: number; notes?: string }) {
  return apiFetch<Record<string, unknown>>(`/api/admin/classification/migration-review/${documentId}/${legacyId}/resolve`, { method: "POST", json: payload });
}

export function searchTopics(query: string) {
  const trimmed = query.trim();
  if (trimmed.length < 2) return Promise.resolve<Array<{ id: number; name: string }>>([]);
  return apiFetch<Array<{ id: number; name: string; status?: string }>>(`/api/topics?q=${encodeURIComponent(trimmed)}`);
}

export function proposeTopic(name: string) {
  return apiFetch<{ id: number; name: string; status?: string }>("/api/topics/proposals", {
    method: "POST",
    json: { name },
  });
}

export function fetchDocumentClassification(documentId: number) {
  return apiFetch<{ classification: DocumentClassification }>(`/api/documents/${documentId}/classification`);
}

export function updateDocumentClassification(documentId: number, classification: Record<string, unknown>) {
  return apiFetch<{ classification: DocumentClassification }>(`/api/documents/${documentId}/classification`, {
    method: "PUT",
    json: { classification },
  });
}

export function createCompiledDocumentRecord(payload: UploadCompiledDocumentPayload | Record<string, unknown>) {
  return apiFetch<{
    id: number;
    success?: boolean;
    reviewStatus?: "pending_review" | "approved" | "rejected";
  }>("/api/compiled-documents", {
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

export function linkDocumentAuthors(documentId: number, authors: DocumentAuthorSelection[] | DocumentAuthorReference[]) {
  if (authors.length === 0) return Promise.resolve(null);

  return apiFetch<Record<string, unknown>>("/document-authors", {
    method: "POST",
    json: {
      document_id: documentId,
      authors: authors.map((author) => typeof author === "string"
        ? author
        : "source" in author
          ? { id: author.id, full_name: author.fullName }
          : author),
    },
  });
}

export interface ResearchAgendaSuggestion {
  id: number;
  name: string;
}

export async function fetchDocumentResearchAgenda(documentId: number): Promise<ResearchAgendaSuggestion[]> {
  const payload = await apiFetch<unknown>(`/api/document-research-agenda/${documentId}`);
  const items = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { items?: unknown[] }).items)
      ? (payload as { items: unknown[] }).items
      : [];

  return items
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const id = Number(record.id);
      const name = String(record.name ?? "").trim();
      return Number.isFinite(id) && name ? { id, name } : null;
    })
    .filter((item): item is ResearchAgendaSuggestion => Boolean(item));
}

export function searchResearchAgendaItems(query: string) {
  const trimmed = query.trim();
  if (trimmed.length < 2) return Promise.resolve<ResearchAgendaSuggestion[]>([]);
  return apiFetch<ResearchAgendaSuggestion[]>(`/api/research-agenda-items/search?q=${encodeURIComponent(trimmed)}`);
}

export async function linkResearchAgenda(documentId: number, agendaItems: string[]) {
  const payload = {
    document_id: documentId,
    agenda_items: agendaItems,
  };

  // Use the canonical API route once. Calling the legacy route in parallel
  // causes both handlers to delete and recreate the same links concurrently,
  // which can violate the document/agenda junction table's unique key.
  await apiFetch<Record<string, unknown>>("/api/document-research-agenda/link", {
    method: "POST",
    json: payload,
  });
}
