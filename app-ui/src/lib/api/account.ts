import { apiFetch } from "./http";

export type LooseRecord = Record<string, unknown>;

export function fetchSavedDocuments() { return apiFetch<{ success: boolean; documents: LooseRecord[]; count: number }>("/api/user/library"); }
export function removeSavedDocument(documentId: string | number) { return apiFetch(`/api/user/library?documentId=${encodeURIComponent(documentId)}`, { method: "DELETE" }); }
export function addSavedDocument(documentId: string | number) { return apiFetch("/api/user/library", { method: "POST", json: { documentId } }); }
export function fetchUserHistory(params: URLSearchParams) { return apiFetch<{ items?: LooseRecord[]; totalCount?: number; filters?: LooseRecord }>(`/api/user/history?${params}`); }
export function uploadProfilePicture(file: File) { const form = new FormData(); form.append("profilePicture", file); return apiFetch<LooseRecord>("/api/user/profile/picture", { method: "POST", body: form }); }
export function changePassword(currentPassword: string, newPassword: string) { return apiFetch("/api/auth/change-password", { method: "POST", json: { currentPassword, newPassword, revokeOtherSessions: true } }); }
export function fetchAuthors() { return apiFetch<{ authors?: LooseRecord[] }>("/api/authors/all"); }
export function fetchAuthorWorks(id: string) { return apiFetch<{ works?: LooseRecord[] }>(`/api/authors/${encodeURIComponent(id)}/works`); }
