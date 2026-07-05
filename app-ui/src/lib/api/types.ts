import type { DocumentCategory } from "../constants/categories";

export interface ApiAuthor {
  id?: number | string;
  full_name?: string;
  name?: string;
}

export interface ApiTopic {
  id?: number | string;
  name?: string;
}

export interface DocumentRecord {
  id: number;
  title: string;
  description: string;
  category: DocumentCategory;
  rawCategory: string;
  publicationDate: string | null;
  authors: ApiAuthor[];
  authorsText: string;
  topics: ApiTopic[];
  isCompiled: boolean;
  childCount: number;
  volume?: string;
  issue?: string;
  startYear?: number;
  endYear?: number;
  raw: Record<string, unknown>;
}

export interface CategoryCount {
  name: DocumentCategory;
  label: string;
  count: number;
}

export interface DocumentFilterState {
  page: number;
  size: number;
  sort: "latest" | "earliest";
  category: DocumentCategory;
  search: string;
}

export interface PaginationState {
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

export interface DocumentsPageResult extends PaginationState {
  documents: DocumentRecord[];
}

export interface ArchiveRequest {
  id: number;
  isCompiled?: boolean;
  archiveChildren?: boolean;
}

export interface UploadSingleDocumentPayload {
  title: string;
  category: "THESIS" | "DISSERTATION";
  publication_date?: string;
  author_ids?: Array<number | string>;
  research_agenda_ids?: Array<number | string>;
  file?: File;
}

export interface UploadCompiledDocumentPayload {
  title?: string;
  category: "CONFLUENCE" | "SYNERGY";
  volume?: string;
  issue?: string;
  start_year?: number;
  end_year?: number;
  children?: UploadSingleDocumentPayload[];
}

export interface PermissionRequest {
  id: number;
  status: string;
  document_id?: number;
  requester_id?: number;
}

export interface AccessRequest {
  document_id: number;
  reason?: string;
}

export interface ArchivedDocumentRecord extends DocumentRecord {
  deletedAt: string | null;
  sourceTable: string;
}

export interface ArchivedDocumentsPageResult extends PaginationState {
  documents: ArchivedDocumentRecord[];
  categories: CategoryCount[];
}

export interface DocumentRequestRecord {
  id: number;
  documentId: string;
  fullName: string;
  email: string;
  affiliation: string;
  reason: string;
  reasonDetails: string;
  status: "pending" | "approved" | "rejected" | string;
  createdAt: string | null;
  updatedAt: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  reviewNotes?: string | null;
  bookTitle?: string | null;
  authorName?: string | null;
  volume?: string | null;
  raw: Record<string, unknown>;
}

export interface AuthorRecord {
  id: number | string;
  fullName: string;
  affiliation?: string | null;
  department?: string | null;
  email?: string | null;
  orcidId?: string | null;
  profilePicture?: string | null;
  raw: Record<string, unknown>;
}

export interface AuthorWorkRecord {
  id: number;
  title: string;
  category?: string | null;
  publicationDate?: string | null;
  raw: Record<string, unknown>;
}

export interface DashboardStats {
  totalWorks: number;
  totalVisits: number;
  guestVisits: number;
  userVisits: number;
  totalAuthors: number;
  raw: Record<string, unknown>;
}

export interface ReportStats {
  activeDocuments: number;
  archivedDocuments: number;
  totalDocuments: number;
  documentTypes: Array<{ documentType: string; count: number }>;
  timeRange: string;
  raw: Record<string, unknown>;
}

export interface SystemLogRecord {
  id?: number;
  logType?: string;
  username?: string | null;
  action?: string | null;
  status?: string | null;
  details?: unknown;
  timestamp?: string | null;
  formattedTimestamp?: string | null;
  raw: Record<string, unknown>;
}

export interface UserLibraryRecord {
  id: number;
  title: string;
  category?: string | null;
  raw: Record<string, unknown>;
}

export interface UserHistoryRecord {
  id?: number;
  documentId?: number;
  action?: string;
  title?: string;
  createdAt?: string | null;
  raw: Record<string, unknown>;
}

export interface PublicDocumentRecord extends DocumentRecord {
  isPublic?: boolean;
  filePath?: string | null;
}
