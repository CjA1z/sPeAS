import { apiFetch } from "./http";
import { fetchSummaryStats } from "./reports";
import type { ReportStats } from "./types";

export type VisitPeriod = "daily" | "weekly" | "monthly";

export interface VisitPoint {
  date: string;
  guest: number;
  user: number;
  total: number;
}

export interface VisitStats {
  total: number;
  guest: number;
  user: number;
  period: VisitPeriod;
  points: VisitPoint[];
}

export interface TopAuthor {
  id: string;
  name: string;
  visits: number;
  profilePicture: string | null;
}

export interface DashboardSnapshot {
  repository: ReportStats;
  visits: VisitStats;
  topAuthors: TopAuthor[];
}

export async function fetchDashboardSnapshot(): Promise<DashboardSnapshot> {
  const [repository, visits, topAuthors] = await Promise.all([
    fetchSummaryStats(),
    fetchVisitStats("daily"),
    fetchTopAuthors(),
  ]);
  return { repository, visits, topAuthors };
}

export async function fetchVisitStats(period: VisitPeriod): Promise<VisitStats> {
  const payload = await apiFetch<Record<string, unknown>>(`/api/page-visits/stats/${period}`);
  const raw = (payload.stats && typeof payload.stats === "object" ? payload.stats : payload) as Record<string, unknown>;
  const guest = Number(raw.guest ?? 0);
  const user = Number(raw.user ?? 0);
  const points = (Array.isArray(raw.chart_data) ? raw.chart_data : []).map((value) => {
    const point = value as Record<string, unknown>;
    const pointGuest = Number(point.guest_visits ?? point.guest ?? 0);
    const pointUser = Number(point.user_visits ?? point.user ?? 0);
    return {
      date: String(point.date ?? ""),
      guest: pointGuest,
      user: pointUser,
      total: pointGuest + pointUser,
    };
  });

  // Total is deliberately derived from the visible parts so no rendered state
  // can contradict its guest/user breakdown.
  return { total: guest + user, guest, user, period, points };
}

async function fetchTopAuthors(): Promise<TopAuthor[]> {
  const payload = await apiFetch<Record<string, unknown>>("/api/author-visits/stats");
  return (Array.isArray(payload.topAuthors) ? payload.topAuthors : []).map((value) => {
    const row = value as Record<string, unknown>;
    return {
      id: String(row.author_id ?? row.id ?? ""),
      name: String(row.full_name ?? row.name ?? "Unnamed author"),
      visits: Number(row.visit_count ?? row.visits ?? 0),
      profilePicture: nullableString(row.profile_picture ?? row.profilePicUrl),
    };
  });
}

function nullableString(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}
