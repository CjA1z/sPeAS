import { apiFetch } from "./http";
import type { LooseRecord } from "./account";

export async function fetchPublicDocumentDetail(id: string, compiled: boolean, authenticated: boolean) {
  const candidates = compiled
    ? authenticated ? [`/api/compiled-documents/${id}`, `/api/documents/${id}`] : [`/api/guest/compiled-documents/${id}`, `/api/documents/${id}?guest=true`]
    : authenticated ? [`/api/documents/${id}`] : [`/api/guest/documents/${id}`, `/api/public/documents/${id}`, `/api/documents/${id}?guest=true`];
  const record = await firstAvailable(candidates);
  const actualCompiled = compiled || record.is_compiled === true || String(record.document_type ?? "").toLowerCase() === "compiled" || Number(record.child_count ?? 0) > 0;
  const children = actualCompiled ? await fetchChildren(id, authenticated, record) : [];
  const authors = !actualCompiled ? await fetchAuthors(id, authenticated) : [];
  return { record, children, authors, compiled: actualCompiled };
}

export function submitDocumentAccessRequest(input: Record<string, unknown>) {
  return apiFetch<Record<string, unknown>>("/api/document-requests", { method: "POST", json: input });
}

async function fetchChildren(id: string, authenticated: boolean, record: LooseRecord): Promise<LooseRecord[]> {
  const embedded = record.children ?? record.child_documents ?? record.contained_documents;
  if (Array.isArray(embedded)) return embedded as LooseRecord[];
  const candidates = authenticated
    ? [`/api/compiled-documents/${id}/children`, `/api/documents/${id}/children`]
    : [`/api/guest/compiled-documents/${id}/children`, `/api/documents/${id}/children`];
  try {
    const payload = await firstAvailable(candidates);
    if (Array.isArray(payload)) return payload;
    const nested = payload.documents ?? payload.children;
    return Array.isArray(nested) ? nested as LooseRecord[] : [];
  } catch { return []; }
}

async function fetchAuthors(id: string, authenticated: boolean): Promise<LooseRecord[]> {
  const candidates = authenticated ? [`/api/document-authors/${id}`] : [`/api/guest/documents/${id}/authors`, `/api/public/documents/${id}/authors`, `/api/documents/${id}/authors`, `/api/document-authors/${id}`];
  try { const payload = await firstAvailable(candidates); return Array.isArray(payload.authors) ? payload.authors as LooseRecord[] : []; } catch { return []; }
}

async function firstAvailable(paths: string[]): Promise<any> {
  let lastStatus = 404;
  for (const path of paths) {
    const response = await fetch(path, { credentials: "include", headers: { Accept: "application/json" } });
    lastStatus = response.status;
    if (response.ok) return await response.json();
    if (![401, 403, 404].includes(response.status)) break;
  }
  throw new Error(lastStatus === 404 ? "Document not found or no longer available." : "This document is not available with your current access.");
}
