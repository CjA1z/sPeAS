import { apiFetch } from "./http";

export interface SessionUser {
  id?: number | string;
  name?: string;
  email?: string;
  role?: string;
}

export interface SessionResponse {
  authenticated?: boolean;
  isAuthenticated?: boolean;
  user?: SessionUser;
  [key: string]: unknown;
}

export async function fetchSession() {
  return apiFetch<SessionResponse>("/api/auth/session");
}
