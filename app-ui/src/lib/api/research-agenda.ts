import { apiFetch } from "./http";

export interface ResearchAgendaItem {
  id: number | string;
  name: string;
  description?: string;
}

export function fetchResearchAgenda(search?: string) {
  const params = new URLSearchParams();
  if (search?.trim()) params.set("search", search.trim());
  const query = params.toString();

  return apiFetch<ResearchAgendaItem[]>(`/api/research-agenda${query ? `?${query}` : ""}`);
}

export function fetchDocumentResearchAgenda(documentId: number) {
  return apiFetch<ResearchAgendaItem[]>(`/api/documents/${documentId}/research-agenda`);
}
