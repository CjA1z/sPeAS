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
  reviewStatus: "pending_review" | "approved" | "rejected";
  isPublic?: boolean;
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
  status: "all" | "approved" | "pending_review" | "rejected";
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
  spudId?: string | null;
  affiliation?: string | null;
  department?: string | null;
  email?: string | null;
  orcidId?: string | null;
  profilePicture?: string | null;
  biography?: string | null;
  createdSource?: "document_upload" | "author_directory" | string | null;
  profileComplete?: boolean;
  worksCount: number;
  raw: Record<string, unknown>;
}

export interface DepartmentReference {
  id: number;
  name: string;
  code: string;
  authorCount: number;
  documentCount: number;
  userCount: number;
}

export interface AffiliationReference {
  id: number;
  name: string;
  authorCount: number;
}

export interface AuthorReferenceData {
  departments: DepartmentReference[];
  affiliations: AffiliationReference[];
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
  catalogEntries: number;
  archivedCatalogEntries: number;
  totalCatalogEntries: number;
  storedDocuments: number;
  authorRecords: number;
  documentTypes: Array<{ documentType: string; count: number }>;
  timeRange: string;
  metricDefinitions: Record<string, string>;
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
