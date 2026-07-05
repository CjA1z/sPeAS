import { apiFetch } from "./http";
import type { ReportStats } from "./types";

export interface ReportParams {
  timeRange?: "all" | "daily" | "weekly" | "monthly" | "yearly";
}

export async function fetchDocumentStatistics(params: ReportParams = {}): Promise<ReportStats> {
  const searchParams = new URLSearchParams();
  if (params.timeRange) searchParams.set("timeRange", params.timeRange);
  const query = searchParams.toString();
  const payload = await apiFetch<Record<string, unknown>>(`/api/documents/statistics${query ? `?${query}` : ""}`);

  return normalizeReportStats(payload);
}

export async function fetchSummaryStats(): Promise<ReportStats> {
  const payload = await apiFetch<Record<string, unknown>>("/api/stats/summary");
  return normalizeReportStats(payload);
}

export function exportPdfReport(payload: Record<string, unknown>) {
  return exportReport("/api/reports/export-pdf", payload);
}

export function exportCsvReport(payload: Record<string, unknown>) {
  return exportReport("/api/reports/export-csv", payload);
}

async function exportReport(path: string, payload: Record<string, unknown>) {
  const response = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error((await response.text()) || "Export failed.");
  }

  return response.blob();
}

function normalizeReportStats(raw: Record<string, unknown>): ReportStats {
  const documentTypes = Array.isArray(raw.document_types)
    ? raw.document_types.map((row) => {
        const item = row as Record<string, unknown>;
        return {
          documentType: String(item.document_type ?? item.category ?? "unknown"),
          count: Number(item.count ?? 0),
        };
      })
    : [];

  return {
    activeDocuments: Number(raw.active_documents ?? 0),
    archivedDocuments: Number(raw.archived_documents ?? 0),
    totalDocuments: Number(raw.total_documents ?? 0),
    documentTypes,
    timeRange: String(raw.time_range ?? "all"),
    raw,
  };
}
