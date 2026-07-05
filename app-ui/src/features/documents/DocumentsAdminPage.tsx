import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, ChevronLeft, ChevronRight, FileWarning } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { archiveDocument, fetchCategories, fetchChildDocuments, fetchDocuments } from "../../lib/api/documents";
import { getErrorMessage } from "../../lib/api/http";
import type { CategoryCount, DocumentFilterState, DocumentRecord } from "../../lib/api/types";
import type { DocumentCategory } from "../../lib/constants/categories";
import { PeasDocumentCard, PeasCompiledDocumentCard } from "../../components/documents/DocumentCards";
import { PeasEmptyState, PeasErrorState, PeasLoadingState } from "../../components/feedback/PeasStates";
import { Reveal } from "../../components/motion/Reveal";
import { Button } from "../../components/ui/button";
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
    const legacyWindow = window as typeof window & {
      documentEdit?: {
        showEditModal?: (id: number) => void;
        showCompiledEditModal?: (id: number) => void;
      };
      showEditModal?: (id: number) => void;
      showCompiledEditModal?: (id: number) => void;
    };

    if (document.isCompiled) {
      const openCompiledModal = legacyWindow.documentEdit?.showCompiledEditModal ?? legacyWindow.showCompiledEditModal;
      if (openCompiledModal) {
        openCompiledModal(document.id);
        return;
      }
    } else {
      const openEditModal = legacyWindow.documentEdit?.showEditModal ?? legacyWindow.showEditModal;
      if (openEditModal) {
        openEditModal(document.id);
        return;
      }
    }

    toast.error("The edit dialog is still loading. Please try again in a moment.");
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
