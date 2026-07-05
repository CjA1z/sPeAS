import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, ChevronLeft, ChevronRight, FileWarning, Save } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { archiveDocument, fetchCategories, fetchChildDocuments, fetchDocuments, updateDocumentMetadata } from "../../lib/api/documents";
import { updateCompiledDocument as updateCompiledDocumentRecord } from "../../lib/api/compiled-documents";
import { getErrorMessage } from "../../lib/api/http";
import type { CategoryCount, DocumentFilterState, DocumentRecord } from "../../lib/api/types";
import type { DocumentCategory } from "../../lib/constants/categories";
import { CATEGORY_ORDER, getCategoryMeta } from "../../lib/constants/categories";
import { PeasDocumentCard, PeasCompiledDocumentCard } from "../../components/documents/DocumentCards";
import { PeasEmptyState, PeasErrorState, PeasLoadingState } from "../../components/feedback/PeasStates";
import { Reveal } from "../../components/motion/Reveal";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { PeasToaster, toast } from "../../components/ui/toast";
import { DocumentToolbar } from "./DocumentToolbar";

const PAGE_SIZE = 10;

export function DocumentsAdminPage() {
  const [filter, setFilter] = useState<DocumentFilterState>({
    page: 1,
    size: PAGE_SIZE,
    sort: "latest",
    category: "All",
    search: "",
  });
  const debouncedSearch = useDebouncedValue(filter.search, 250);
  const [categories, setCategories] = useState<CategoryCount[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [childrenByParent, setChildrenByParent] = useState<Record<number, DocumentRecord[]>>({});
  const [loadingChildren, setLoadingChildren] = useState<Set<number>>(new Set());
  const [archiveTarget, setArchiveTarget] = useState<DocumentRecord | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [previewTarget, setPreviewTarget] = useState<DocumentRecord | null>(null);
  const [editTarget, setEditTarget] = useState<DocumentRecord | null>(null);
  const [editBusy, setEditBusy] = useState(false);

  const queryFilter = useMemo(
    () => ({
      ...filter,
      search: debouncedSearch,
    }),
    [debouncedSearch, filter],
  );

  const loadCategories = useCallback(async () => {
    try {
      setCategories(await fetchCategories());
    } catch {
      setCategories([]);
    }
  }, []);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetchDocuments(queryFilter);
      setDocuments(result.documents);
      setTotalCount(result.totalCount);
      setTotalPages(result.totalPages);
    } catch (caughtError) {
      setDocuments([]);
      setTotalCount(0);
      setTotalPages(0);
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, [queryFilter]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories, reloadKey]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments, reloadKey]);

  const updateFilter = useCallback((updates: Partial<DocumentFilterState>) => {
    setFilter((current) => ({
      ...current,
      ...updates,
      page: updates.page ?? 1,
    }));
  }, []);

  const handleCategoryChange = useCallback(
    (category: DocumentCategory) => updateFilter({ category }),
    [updateFilter],
  );

  const handleSearchChange = useCallback(
    (search: string) => updateFilter({ search }),
    [updateFilter],
  );

  const handleSortChange = useCallback(
    (sort: "latest" | "earliest") => updateFilter({ sort }),
    [updateFilter],
  );

  const handlePageChange = useCallback((page: number) => {
    setFilter((current) => ({ ...current, page }));
  }, []);

  const handleToggleChildren = useCallback(
    async (document: DocumentRecord) => {
      setExpandedIds((current) => {
        const next = new Set(current);
        if (next.has(document.id)) next.delete(document.id);
        else next.add(document.id);
        return next;
      });

      if (childrenByParent[document.id]) return;

      setLoadingChildren((current) => new Set(current).add(document.id));

      try {
        const children = await fetchChildDocuments(document.id);
        setChildrenByParent((current) => ({ ...current, [document.id]: children }));
      } catch (caughtError) {
        toast.error(getErrorMessage(caughtError));
      } finally {
        setLoadingChildren((current) => {
          const next = new Set(current);
          next.delete(document.id);
          return next;
        });
      }
    },
    [childrenByParent],
  );

  const handleEdit = useCallback((document: DocumentRecord) => {
    setEditTarget(document);
  }, []);

  const handleArchive = useCallback(async () => {
    if (!archiveTarget) return;

    setArchiveBusy(true);

    try {
      await archiveDocument({
        id: archiveTarget.id,
        isCompiled: archiveTarget.isCompiled,
        archiveChildren: archiveTarget.isCompiled,
      });
      toast.success(`${archiveTarget.title} was moved to the archive.`);
      setArchiveTarget(null);
      setReloadKey((current) => current + 1);
    } catch (caughtError) {
      toast.error(getErrorMessage(caughtError));
    } finally {
      setArchiveBusy(false);
    }
  }, [archiveTarget]);

  const handleSaveEdit = useCallback(async (payload: Record<string, unknown>) => {
    if (!editTarget) return;

    setEditBusy(true);

    try {
      if (editTarget.isCompiled) {
        await updateCompiledDocumentRecord(editTarget.id, payload);
      } else {
        await updateDocumentMetadata(editTarget.id, payload);
      }
      toast.success(`${editTarget.title} was updated.`);
      setEditTarget(null);
      setReloadKey((current) => current + 1);
    } catch (caughtError) {
      toast.error(getErrorMessage(caughtError));
    } finally {
      setEditBusy(false);
    }
  }, [editTarget]);

  return (
    <main className="peas-admin-island peas-documents-page">
      <PeasToaster />
      <DocumentToolbar
        filter={filter}
        categories={categories}
        onSearchChange={handleSearchChange}
        onSortChange={handleSortChange}
        onCategoryChange={handleCategoryChange}
      />

      {loading ? (
        <PeasLoadingState />
      ) : error ? (
        <PeasErrorState message={error} onRetry={() => setReloadKey((current) => current + 1)} />
      ) : documents.length === 0 ? (
        <Reveal>
          <PeasEmptyState
            title="No documents found"
            description="Try a different search, category, or sort order."
          />
        </Reveal>
      ) : (
        <div className="peas-document-list">
          <AnimatePresence initial={false}>
            {documents.map((document, index) => (
              <Reveal key={`${document.id}-${document.isCompiled ? "compiled" : "single"}`} index={index}>
                {document.isCompiled ? (
                  <PeasCompiledDocumentCard
                    document={document}
                    expanded={expandedIds.has(document.id)}
                    childrenDocuments={childrenByParent[document.id] ?? []}
                    loadingChildren={loadingChildren.has(document.id)}
                    onToggleChildren={handleToggleChildren}
                    onPreview={setPreviewTarget}
                    onEdit={handleEdit}
                    onArchive={setArchiveTarget}
                  />
                ) : (
                  <PeasDocumentCard
                    document={document}
                    onPreview={setPreviewTarget}
                    onEdit={handleEdit}
                    onArchive={setArchiveTarget}
                  />
                )}
              </Reveal>
            ))}
          </AnimatePresence>
        </div>
      )}

      <Pagination
        page={filter.page}
        totalPages={totalPages}
        totalCount={totalCount}
        visibleCount={documents.length}
        onPageChange={handlePageChange}
      />

      <ArchiveDocumentDialog
        document={archiveTarget}
        busy={archiveBusy}
        onOpenChange={(open) => {
          if (!open) setArchiveTarget(null);
        }}
        onConfirm={handleArchive}
      />

      <EditDocumentDialog
        document={editTarget}
        busy={editBusy}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
        onSave={handleSaveEdit}
      />

      <PdfPreviewDialog document={previewTarget} onOpenChange={(open) => !open && setPreviewTarget(null)} />
    </main>
  );
}

interface PaginationProps {
  page: number;
  totalPages: number;
  totalCount: number;
  visibleCount: number;
  onPageChange: (page: number) => void;
}

function Pagination({ page, totalPages, totalCount, visibleCount, onPageChange }: PaginationProps) {
  const boundedTotalPages = Math.max(totalPages, 1);
  const pages = createPagination(page, boundedTotalPages);

  return (
    <nav className="peas-pagination" aria-label="Documents pagination">
      <div className="peas-pagination__summary">
        Showing {visibleCount} of {totalCount} {totalCount === 1 ? "entry" : "entries"}
      </div>
      {boundedTotalPages > 1 ? (
        <div className="peas-pagination__links">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            <ChevronLeft aria-hidden="true" />
            Previous
          </Button>
          {pages.map((pageNumber) => (
            <Button
              key={pageNumber}
              variant={pageNumber === page ? "default" : "outline"}
              size="sm"
              aria-current={pageNumber === page ? "page" : undefined}
              onClick={() => onPageChange(pageNumber)}
            >
              {pageNumber}
            </Button>
          ))}
          <Button
            variant="outline"
            size="sm"
            disabled={page >= boundedTotalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      ) : null}
    </nav>
  );
}

function ArchiveDocumentDialog({
  document,
  busy,
  onOpenChange,
  onConfirm,
}: {
  document: DocumentRecord | null;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={Boolean(document)} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="peas-alert-icon">
            <Archive aria-hidden="true" />
          </div>
          <AlertDialogTitle>Archive {document?.isCompiled ? "compiled document" : "document"}?</AlertDialogTitle>
          <AlertDialogDescription>
            {document ? (
              <>
                <strong>{document.title}</strong> will be moved to Archive Documents. You can restore it later.
              </>
            ) : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="peas-ui-button--destructive"
            disabled={busy}
            onClick={(event) => {
              event.preventDefault();
              void onConfirm();
            }}
          >
            {busy ? "Archiving..." : "Archive"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function EditDocumentDialog({
  document,
  busy,
  onOpenChange,
  onSave,
}: {
  document: DocumentRecord | null;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: Record<string, unknown>) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [publicationDate, setPublicationDate] = useState("");
  const [category, setCategory] = useState<DocumentCategory>("THESIS");
  const [startYear, setStartYear] = useState("");
  const [endYear, setEndYear] = useState("");
  const [volume, setVolume] = useState("");
  const [issue, setIssue] = useState("");

  useEffect(() => {
    if (!document) return;
    setTitle(document.title);
    setDescription(document.description ?? "");
    setPublicationDate(document.publicationDate ? new Date(document.publicationDate).toISOString().slice(0, 10) : "");
    setCategory(document.category === "All" ? "THESIS" : document.category);
    setStartYear(document.startYear ? String(document.startYear) : "");
    setEndYear(document.endYear ? String(document.endYear) : "");
    setVolume(document.volume ? String(document.volume) : "");
    setIssue(document.issue ? String(document.issue) : "");
  }, [document]);

  const isCompiled = Boolean(document?.isCompiled);

  return (
    <Dialog open={Boolean(document)} onOpenChange={onOpenChange}>
      <DialogContent className="peas-edit-dialog">
        <DialogHeader>
          <DialogTitle>{isCompiled ? "Edit Compiled Document" : "Edit Document"}</DialogTitle>
          <DialogDescription>
            Update core metadata for the selected {isCompiled ? "compiled record" : "document"}.
          </DialogDescription>
        </DialogHeader>

        <form
          className="peas-edit-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!document) return;

            if (isCompiled) {
              onSave({
                category,
                start_year: numericOrNull(startYear),
                end_year: numericOrNull(endYear),
                volume: numericOrNull(volume),
                issue_number: numericOrNull(issue),
              });
              return;
            }

            onSave({
              title: title.trim(),
              description: description.trim(),
              publication_date: publicationDate || null,
              document_type: category,
            });
          }}
        >
          {isCompiled ? (
            <div className="peas-form-grid peas-form-grid--two">
              <label className="peas-field">
                <span>Collection</span>
                <Select value={category} onValueChange={(value) => setCategory(value as DocumentCategory)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_ORDER.filter((item) => item !== "All").map((item) => (
                      <SelectItem value={item} key={item}>
                        {getCategoryMeta(item).label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="peas-field">
                <span>Volume</span>
                <Input value={volume} onChange={(event) => setVolume(event.currentTarget.value)} inputMode="numeric" />
              </label>
              <label className="peas-field">
                <span>Start Year</span>
                <Input value={startYear} onChange={(event) => setStartYear(event.currentTarget.value)} inputMode="numeric" />
              </label>
              <label className="peas-field">
                <span>End Year</span>
                <Input value={endYear} onChange={(event) => setEndYear(event.currentTarget.value)} inputMode="numeric" />
              </label>
              <label className="peas-field">
                <span>Issue Number</span>
                <Input value={issue} onChange={(event) => setIssue(event.currentTarget.value)} inputMode="numeric" />
              </label>
            </div>
          ) : (
            <>
              <label className="peas-field">
                <span>Title</span>
                <Input value={title} onChange={(event) => setTitle(event.currentTarget.value)} required />
              </label>
              <div className="peas-form-grid peas-form-grid--two">
                <label className="peas-field">
                  <span>Collection</span>
                  <Select value={category} onValueChange={(value) => setCategory(value as DocumentCategory)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_ORDER.filter((item) => item !== "All").map((item) => (
                        <SelectItem value={item} key={item}>
                          {getCategoryMeta(item).label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label className="peas-field">
                  <span>Publication Date</span>
                  <Input type="date" value={publicationDate} onChange={(event) => setPublicationDate(event.currentTarget.value)} />
                </label>
              </div>
              <label className="peas-field">
                <span>Description</span>
                <Textarea value={description} onChange={(event) => setDescription(event.currentTarget.value)} rows={4} />
              </label>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || (!isCompiled && !title.trim())}>
              <Save aria-hidden="true" />
              {busy ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PdfPreviewDialog({
  document,
  onOpenChange,
}: {
  document: DocumentRecord | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={Boolean(document)} onOpenChange={onOpenChange}>
      <DialogContent className="peas-pdf-dialog">
        <DialogHeader>
          <DialogTitle>{document?.title ?? "Document preview"}</DialogTitle>
          <DialogDescription>PDF preview from the current document record.</DialogDescription>
        </DialogHeader>
        {document ? (
          <iframe
            className="peas-pdf-dialog__frame"
            src={`/api/documents/${document.id}/pdf`}
            title={`Preview of ${document.title}`}
          />
        ) : (
          <div className="peas-pdf-dialog__fallback">
            <FileWarning aria-hidden="true" />
            No document selected.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function numericOrNull(value: string) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && value.trim() ? numberValue : null;
}

function createPagination(currentPage: number, totalPages: number) {
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, currentPage + 2);
  const pages: number[] = [];

  for (let page = start; page <= end; page += 1) {
    pages.push(page);
  }

  return pages;
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timeout);
  }, [delayMs, value]);

  return debouncedValue;
}
