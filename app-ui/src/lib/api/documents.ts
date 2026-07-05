import { CATEGORY_META, normalizeCategory, type DocumentCategory } from "../constants/categories";
import { apiFetch } from "./http";
import type {
  ApiAuthor,
  ApiTopic,
  ArchiveRequest,
  CategoryCount,
  DocumentRecord,
  DocumentsPageResult,
} from "./types";

interface RawDocumentsResponse {
  documents?: Array<Record<string, unknown>>;
  totalCount?: number;
  total_count?: number;
  total_documents?: number;
  totalPages?: number;
  total_pages?: number;
  currentPage?: number;
  current_page?: number;
}

interface FetchDocumentsParams {
  page: number;
  size: number;
  sort: "latest" | "earliest";
  category: DocumentCategory;
  search?: string;
  keyword?: string;
}

export async function fetchCategories(): Promise<CategoryCount[]> {
  const payload = await apiFetch<Array<Record<string, unknown>>>("/api/categories");

  return payload.map((row) => {
    const name = normalizeCategory(row.name ?? row.category ?? row.document_type);
    return {
      name,
      label: CATEGORY_META[name].label,
      count: Number(row.count ?? 0),
    };
  });
}

export async function fetchDocuments(params: FetchDocumentsParams): Promise<DocumentsPageResult> {
  const searchParams = new URLSearchParams({
    page: String(params.page),
    size: String(params.size),
    sort: params.sort,
  });

  if (params.category !== "All") searchParams.set("category", params.category);
  if (params.search?.trim()) searchParams.set("search", params.search.trim());
  if (params.keyword?.trim()) searchParams.set("keyword", params.keyword.trim());

  const payload = await apiFetch<RawDocumentsResponse>(`/api/documents?${searchParams.toString()}`);
  const documents = (payload.documents ?? []).map(normalizeDocumentRecord);
  const totalCount = Number(payload.totalCount ?? payload.total_count ?? payload.total_documents ?? documents.length);
  const totalPages = Number(payload.totalPages ?? payload.total_pages ?? (Math.ceil(totalCount / params.size) || 0));
  const currentPage = Number(payload.currentPage ?? payload.current_page ?? params.page);

  return {
    documents,
    totalCount,
    totalPages,
    currentPage,
  };
}

export async function fetchChildDocuments(parentId: number): Promise<DocumentRecord[]> {
  const payload = await apiFetch<RawDocumentsResponse>(`/api/documents/${parentId}/children`);
  return (payload.documents ?? []).map(normalizeDocumentRecord);
}

export async function archiveDocument(request: ArchiveRequest) {
  if (request.isCompiled) {
    return apiFetch<Record<string, unknown>>(`/api/archives/compiled/${request.id}`, {
      method: "POST",
    });
  }

  return apiFetch<Record<string, unknown>>("/api/archives", {
    method: "POST",
    json: {
      document_id: request.id,
      archive_children: request.archiveChildren ?? false,
      is_compiled: false,
    },
  });
}

function normalizeDocumentRecord(raw: Record<string, unknown>): DocumentRecord {
  const id = Number(raw.id ?? raw.doc_id ?? raw.document_id);
  const rawCategory = String(raw.document_type ?? raw.doc_type ?? raw.category ?? "");
  const category = normalizeCategory(rawCategory);
  const authors = normalizeAuthors(raw.authors ?? raw.enhancedAuthors ?? raw.author);
  const topics = normalizeTopics(raw.topics ?? raw.keywords);
  const publicationDate = stringifyNullable(raw.publication_date ?? raw.publicationDate ?? raw.date_uploaded ?? raw.created_at);

  return {
    id,
    title: String(raw.title ?? raw.document_title ?? raw.name ?? "Untitled Document"),
    description: String(raw.description ?? raw.abstract ?? ""),
    category,
    rawCategory,
    publicationDate,
    authors,
    authorsText: authors.map((author) => author.full_name ?? author.name).filter(Boolean).join(", ") || "Unknown author",
    topics,
    isCompiled: Boolean(raw.is_compiled ?? raw.is_parent),
    childCount: Number(raw.child_count ?? raw.document_count ?? raw.children_count ?? 0),
    volume: stringifyNullable(raw.volume) ?? undefined,
    issue: stringifyNullable(raw.issue ?? raw.issue_number) ?? undefined,
    startYear: numericNullable(raw.start_year),
    endYear: numericNullable(raw.end_year),
    raw,
  };
}

function normalizeAuthors(value: unknown): ApiAuthor[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return { full_name: item };
        if (item && typeof item === "object") return item as ApiAuthor;
        return null;
      })
      .filter(Boolean) as ApiAuthor[];
  }

  if (typeof value === "string" && value.trim()) {
    return value.split(",").map((author) => ({ full_name: author.trim() }));
  }

  return [];
}

function normalizeTopics(value: unknown): ApiTopic[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return { name: item };
        if (item && typeof item === "object") return item as ApiTopic;
        return null;
      })
      .filter(Boolean) as ApiTopic[];
  }

  return [];
}

function stringifyNullable(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

function numericNullable(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : undefined;
}
