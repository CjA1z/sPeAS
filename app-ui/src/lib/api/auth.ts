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
  userId?: number | string;
  username?: string;
  role?: string;
  [key: string]: unknown;
}

export async function fetchSession() {
  return apiFetch<SessionResponse>("/api/auth/session");
}

export interface UserProfile {
  id?: number | string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  email?: string;
  role_id?: number;
  profile_picture?: string;
  [key: string]: unknown;
}

export async function fetchUserProfile() {
  return apiFetch<UserProfile>("/api/user/profile");
}

export async function logout() {
  await fetch("/logout", {
    method: "POST",
    credentials: "include",
    redirect: "follow",
  });
}
