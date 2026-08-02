import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Archive, CheckCircle2, ExternalLink, FileWarning, RefreshCw, Save, X, XCircle } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { DocumentAuthorPicker } from "../../components/forms/DocumentAuthorPicker";
import { archiveDocument, fetchCategories, fetchChildDocuments, fetchDocuments, reviewDocument, updateDocumentMetadata } from "../../lib/api/documents";
import { fetchAuthors } from "../../lib/api/authors";
import { fetchDocumentResearchAgenda, linkDocumentAuthors, linkResearchAgenda, searchResearchAgendaItems, type ResearchAgendaSuggestion } from "../../lib/api/upload";
import { updateCompiledDocument as updateCompiledDocumentRecord } from "../../lib/api/compiled-documents";
import { getErrorMessage } from "../../lib/api/http";
import type { AuthorRecord, CategoryCount, DocumentFilterState, DocumentRecord } from "../../lib/api/types";
import type { DocumentAuthorSelection } from "../../lib/authorSelection";
import type { DocumentCategory } from "../../lib/constants/categories";
import { CATEGORY_ORDER, getCategoryMeta } from "../../lib/constants/categories";
import { PeasDocumentCard, PeasCompiledDocumentCard } from "../../components/documents/DocumentCards";
import { PeasEmptyState, PeasErrorState, PeasInlineSpinner, PeasLoadingState } from "../../components/feedback/PeasStates";
import { PeasPagination } from "../../components/data-display/PeasPagination";
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
import { AdminPageHeader } from "../../components/layout/AdminPageHeader";

const PAGE_SIZE = 10;

const DEFAULT_DOCUMENT_FILTER: DocumentFilterState = {
  page: 1,
  size: PAGE_SIZE,
  sort: "latest",
  category: "All",
  status: "approved",
  search: "",
};

export function DocumentsAdminPage() {
  const [filter, setFilter] = useState<DocumentFilterState>(readDocumentFilter);
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
  const [reviewBusyId, setReviewBusyId] = useState<number | null>(null);
  const requestIdRef = useRef(0);

  const queryFilter = useMemo(
    () => ({
      ...filter,
      search: debouncedSearch,
    }),
    [debouncedSearch, filter],
  );

  const loadCategories = useCallback(async () => {
    try {
      setCategories(await fetchCategories(filter.status));
    } catch {
      setCategories([]);
    }
  }, [filter.status]);

  const loadDocuments = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);
    setError(null);

    try {
      const result = await fetchDocuments(queryFilter);
      if (requestId !== requestIdRef.current) return;
      setDocuments(result.documents);
      setTotalCount(result.totalCount);
      setTotalPages(result.totalPages);
    } catch (caughtError) {
      if (requestId !== requestIdRef.current) return;
      setDocuments([]);
      setTotalCount(0);
      setTotalPages(0);
      setError(getErrorMessage(caughtError));
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
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

  const handleStatusChange = useCallback(
    (status: DocumentFilterState["status"]) => updateFilter({ status }),
    [updateFilter],
  );

  const clearFilters = useCallback(() => setFilter({ ...DEFAULT_DOCUMENT_FILTER }), []);

  const handlePageChange = useCallback((page: number) => {
    setFilter((current) => ({ ...current, page }));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filter.search.trim()) params.set("search", filter.search.trim());
    if (filter.category !== "All") params.set("category", filter.category);
    if (filter.status !== DEFAULT_DOCUMENT_FILTER.status) params.set("status", filter.status);
    if (filter.sort !== DEFAULT_DOCUMENT_FILTER.sort) params.set("sort", filter.sort);
    if (filter.page > 1) params.set("page", String(filter.page));
    const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    window.history.replaceState({}, "", nextUrl);
  }, [filter]);

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

  const handleSaveEdit = useCallback(async (payload: Record<string, unknown>, authors?: DocumentAuthorSelection[], tags?: string[]) => {
    if (!editTarget) return;

    setEditBusy(true);

    try {
      if (!editTarget.isCompiled && authors) {
        await linkDocumentAuthors(editTarget.id, authors);
        await linkResearchAgenda(editTarget.id, tags ?? []);
      }
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

  const handleReview = useCallback(async (
    document: DocumentRecord,
    decision: "approved" | "rejected",
    publish = false,
  ) => {
    setReviewBusyId(document.id);
    try {
      await reviewDocument(document.id, document.isCompiled, decision, publish);
      toast.success(
        decision === "rejected"
          ? `${document.title} was rejected.`
          : publish
            ? `${document.title} was approved and published.`
            : `${document.title} was approved as a private record.`,
      );
      setReloadKey((current) => current + 1);
    } catch (caughtError) {
      toast.error(getErrorMessage(caughtError));
    } finally {
      setReviewBusyId(null);
    }
  }, []);

  return (
    <main className="peas-admin-island peas-documents-page">
      <PeasToaster />
      <AdminPageHeader
        eyebrow="Repository catalog"
        title="Documents"
        description="Manage active catalog entries, publication, and review status."
        actions={<a className="peas-ui-button peas-ui-button--default" href="/admin/Components/upload_document.html">Upload document</a>}
      />
      <DocumentToolbar
        filter={filter}
        categories={categories}
        totalCount={totalCount}
        loading={loading}
        onClearFilters={clearFilters}
        onSearchChange={handleSearchChange}
        onSortChange={handleSortChange}
        onStatusChange={handleStatusChange}
        onCategoryChange={handleCategoryChange}
      />

      {loading && documents.length === 0 ? (
        <PeasLoadingState />
      ) : error && documents.length === 0 ? (
        <PeasErrorState message={error} onRetry={() => setReloadKey((current) => current + 1)} />
      ) : documents.length === 0 ? (
        <Reveal>
          <PeasEmptyState
            title={filter.search || filter.category !== "All" || filter.status !== "approved" ? "No matching documents" : "No documents yet"}
            description={filter.search || filter.category !== "All" || filter.status !== "approved" ? "Try a different search or clear one of the active filters." : "Upload a document to start building the repository catalog."}
            action={!filter.search && filter.category === "All" && filter.status === "approved" ? <a className="peas-ui-button peas-ui-button--default" href="/admin/Components/upload_document.html">Upload document</a> : <Button variant="outline" onClick={clearFilters}>Clear filters</Button>}
          />
        </Reveal>
      ) : (
        <div className={`peas-document-results${loading ? " is-loading" : ""}`} aria-busy={loading}>
          {error ? <PeasErrorState title="Results may be out of date" message={error} onRetry={() => setReloadKey((current) => current + 1)} /> : null}
          <div className="peas-document-list" aria-label="Document catalog results">
          <AnimatePresence initial={false}>
            {documents.map((document, index) => (
              <Reveal key={`${document.id}-${document.isCompiled ? "compiled" : "single"}`} index={index}>
                <div className={document.reviewStatus === "pending_review" ? "peas-review-queue-item" : undefined}>
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
                  {document.reviewStatus === "pending_review" ? (
                    <div className="peas-review-actions">
                      <div><strong>Pending administrator review</strong><span>Choose whether this upload remains private or becomes publicly visible.</span></div>
                      <Button size="sm" variant="outline" disabled={reviewBusyId === document.id} onClick={() => void handleReview(document, "rejected")}>
                        <XCircle aria-hidden="true" /> Reject
                      </Button>
                      <Button size="sm" variant="outline" disabled={reviewBusyId === document.id} onClick={() => void handleReview(document, "approved")}>
                        <CheckCircle2 aria-hidden="true" /> Approve Private
                      </Button>
                      <Button size="sm" disabled={reviewBusyId === document.id} onClick={() => void handleReview(document, "approved", true)}>
                        <CheckCircle2 aria-hidden="true" /> Approve &amp; Publish
                      </Button>
                    </div>
                  ) : null}
                </div>
              </Reveal>
            ))}
          </AnimatePresence>
          </div>
        </div>
      )}

      <PeasPagination
        page={filter.page}
        totalPages={totalPages}
        totalCount={totalCount}
        visibleCount={documents.length}
        label="Documents pagination"
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
  onSave: (payload: Record<string, unknown>, authors?: DocumentAuthorSelection[], tags?: string[]) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [publicationDate, setPublicationDate] = useState("");
  const [category, setCategory] = useState<DocumentCategory>("THESIS");
  const [startYear, setStartYear] = useState("");
  const [endYear, setEndYear] = useState("");
  const [volume, setVolume] = useState("");
  const [issue, setIssue] = useState("");
  const [authors, setAuthors] = useState<DocumentAuthorSelection[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [authorDirectory, setAuthorDirectory] = useState<AuthorRecord[]>([]);
  const [authorDirectoryLoading, setAuthorDirectoryLoading] = useState(false);
  const [authorDirectoryError, setAuthorDirectoryError] = useState<string | null>(null);
  const initialValuesRef = useRef("");
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!document) {
      initialValuesRef.current = "";
      setTagsLoading(false);
      return;
    }

    const nextValues = {
      title: document.title,
      description: document.description ?? "",
      publicationDate: document.publicationDate ? new Date(document.publicationDate).toISOString().slice(0, 10) : "",
      category: document.category === "All" ? "THESIS" : document.category,
      authors: document.authors
        .map((author) => ({
          id: author.id,
          fullName: author.full_name ?? author.name ?? "",
          source: "existing" as const,
        }))
        .filter((author) => author.fullName.trim()),
      tags: document.topics.map((topic) => topic.name?.trim() ?? "").filter(Boolean),
      startYear: document.startYear ? String(document.startYear) : "",
      endYear: document.endYear ? String(document.endYear) : "",
      volume: document.volume ? String(document.volume) : "",
      issue: document.issue ? String(document.issue) : "",
    };

    setTitle(nextValues.title);
    setDescription(nextValues.description);
    setPublicationDate(nextValues.publicationDate);
    setCategory(nextValues.category);
    setAuthors(nextValues.authors);
    setTags(nextValues.tags);
    setStartYear(nextValues.startYear);
    setEndYear(nextValues.endYear);
    setVolume(nextValues.volume);
    setIssue(nextValues.issue);
    initialValuesRef.current = JSON.stringify(nextValues);

    let active = true;
    if (document.isCompiled) {
      setTagsLoading(false);
    } else {
      setTagsLoading(true);
      void fetchDocumentResearchAgenda(document.id)
        .then((items) => {
          if (!active) return;
          const nextTags = items.map((item) => item.name).filter(Boolean);
          setTags(nextTags);
          initialValuesRef.current = JSON.stringify({ ...nextValues, tags: nextTags });
        })
        .catch(() => {
          // Keep the tags supplied with the document list when the detail lookup is unavailable.
        })
        .finally(() => {
          if (active) setTagsLoading(false);
        });
    }

    window.requestAnimationFrame(() => {
      const input = titleInputRef.current;
      if (!input) return;
      input.focus({ preventScroll: true });
      input.setSelectionRange(input.value.length, input.value.length);
    });

    return () => {
      active = false;
    };
  }, [document]);

  useEffect(() => {
    if (!document || document.isCompiled) {
      setAuthorDirectory([]);
      setAuthorDirectoryLoading(false);
      setAuthorDirectoryError(null);
      return;
    }

    let active = true;
    setAuthorDirectoryLoading(true);
    setAuthorDirectoryError(null);
    void fetchAuthors()
      .then((nextAuthors) => {
        if (active) setAuthorDirectory(nextAuthors);
      })
      .catch((caughtError) => {
        if (active) setAuthorDirectoryError(getErrorMessage(caughtError));
      })
      .finally(() => {
        if (active) setAuthorDirectoryLoading(false);
      });

    return () => {
      active = false;
    };
  }, [document]);

  const isCompiled = Boolean(document?.isCompiled);
  const currentValues = JSON.stringify({ title, description, publicationDate, category, authors, tags, startYear, endYear, volume, issue });
  const isDirty = Boolean(document) && initialValuesRef.current !== currentValues;

  const handleOpenChange = (open: boolean) => {
    if (open) {
      onOpenChange(true);
      return;
    }

    if (!isDirty || window.confirm("Discard your unsaved document changes?")) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={Boolean(document)} onOpenChange={handleOpenChange}>
      <DialogContent className="peas-document-edit-dialog">
        <DialogHeader>
          <DialogTitle>{isCompiled ? "Edit Compiled Document" : "Edit Document"}</DialogTitle>
          <DialogDescription>
            Update core metadata for the selected {isCompiled ? "compiled record" : "document"}.
          </DialogDescription>
        </DialogHeader>

        <form
          className="peas-document-edit-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!document || !isDirty) return;

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
            }, authors, tags);
          }}
        >
          <div className="peas-document-edit-form__body">
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
                <Input ref={titleInputRef} value={title} onChange={(event) => setTitle(event.currentTarget.value)} required />
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
              <div className="peas-field">
                <span>Authors</span>
                {authorDirectoryLoading ? <small className="peas-document-author-picker__status">Loading the author directory…</small> : null}
                <DocumentAuthorPicker
                  id="edit-document-authors"
                  authors={authorDirectory}
                  value={authors}
                  disabled={busy || authorDirectoryLoading}
                  onAuthorCreated={(author) => setAuthorDirectory((current) => current.some((item) => String(item.id) === String(author.id)) ? current : [...current, author])}
                  onChange={setAuthors}
                />
                {authorDirectoryError ? <small className="peas-document-author-picker__status is-error">The author directory could not be loaded. Existing author names can still be saved.</small> : null}
                {!authors.length ? <small className="peas-document-author-picker__status is-error">Select at least one author.</small> : null}
              </div>
              <div className="peas-field">
                <span>Tags</span>
                {tagsLoading ? <small className="peas-document-author-picker__status">Loading existing tags…</small> : null}
                <DocumentTagEditor id="edit-document-tags" value={tags} disabled={busy || tagsLoading} onChange={setTags} />
              </div>
              <label className="peas-field">
                <span>Description</span>
                <Textarea value={description} onChange={(event) => setDescription(event.currentTarget.value)} rows={4} />
              </label>
            </>
            )}
          </div>

          <DialogFooter className="peas-document-edit-form__footer">
            <Button type="button" variant="outline" disabled={busy} onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !isDirty || (!isCompiled && (!title.trim() || !authors.length))}>
              <Save aria-hidden="true" />
              {busy ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DocumentTagEditor({ id, value, disabled = false, onChange }: { id: string; value: string[]; disabled?: boolean; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const [suggestions, setSuggestions] = useState<ResearchAgendaSuggestion[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const query = draft.trim();
    if (disabled || query.length < 2) {
      setSuggestions([]);
      setSearching(false);
      return;
    }

    let active = true;
    const timeout = window.setTimeout(() => {
      setSearching(true);
      void searchResearchAgendaItems(query)
        .then((matches) => {
          if (active) setSuggestions(matches);
        })
        .catch(() => {
          if (active) setSuggestions([]);
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 180);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [disabled, draft]);

  function addTags(candidates: string[]) {
    const next = [...value];
    for (const candidate of candidates.map((tag) => tag.trim()).filter(Boolean)) {
      if (!next.some((tag) => tag.localeCompare(candidate, undefined, { sensitivity: "accent" }) === 0)) next.push(candidate);
    }
    onChange(next);
    setDraft("");
    setSuggestions([]);
  }

  function addDraft() {
    const candidates = draft.split(/[;,]/u).map((tag) => tag.trim()).filter(Boolean);
    if (!candidates.length) {
      setDraft("");
      return;
    }
    addTags(candidates);
  }

  return <div className="peas-document-tag-editor">
    {value.length ? <div className="peas-document-tag-editor__chips" role="list" aria-label="Selected tags">
      {value.map((tag, index) => <span className="peas-document-tag-editor__chip" role="listitem" key={`${tag}-${index}`}>
        {tag}
        <button type="button" aria-label={`Remove tag ${tag}`} disabled={disabled} onClick={() => onChange(value.filter((_, tagIndex) => tagIndex !== index))}><X aria-hidden="true" /></button>
      </span>)}
    </div> : null}
    <div className="peas-document-tag-editor__input">
      <Input
        id={id}
        aria-label="Add tag"
        value={draft}
        disabled={disabled}
        placeholder="Search or add a tag…"
        onChange={(event) => setDraft(event.currentTarget.value)}
        onBlur={addDraft}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === "," || event.key === ";") {
            event.preventDefault();
            addDraft();
          } else if (event.key === "Backspace" && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
      />
      {draft.trim().length >= 2 && (searching || suggestions.length) ? <div className="peas-document-tag-editor__suggestions" role="listbox" aria-label="Existing database tags">
        {searching ? <span>Searching existing tags…</span> : suggestions.map((suggestion) => <button key={suggestion.id} type="button" role="option" onMouseDown={(event) => { event.preventDefault(); addTags([suggestion.name]); }}>{suggestion.name}</button>)}
      </div> : null}
    </div>
    <small className="peas-document-tag-editor__hint">Press Enter, comma, or semicolon after each tag.</small>
  </div>;
}

function PdfPreviewDialog({
  document,
  onOpenChange,
}: {
  document: DocumentRecord | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [frameKey, setFrameKey] = useState(0);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
    setFrameKey((current) => current + 1);
  }, [document]);

  return (
    <Dialog open={Boolean(document)} onOpenChange={onOpenChange}>
      <DialogContent className="peas-pdf-dialog">
        <DialogHeader className="peas-pdf-dialog__header">
          <div>
            <DialogTitle>{document?.title ?? "Document preview"}</DialogTitle>
            <DialogDescription>
              {document ? `${document.authorsText} · ${formatPreviewDate(document.publicationDate)}` : "PDF preview from the current document record."}
            </DialogDescription>
          </div>
          {document ? <a className="peas-ui-button peas-ui-button--outline peas-ui-button--size-sm" href={`/api/documents/${document.id}/pdf`} target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true" /> Open in new tab</a> : null}
        </DialogHeader>
        {document ? (
          failed ? (
            <div className="peas-pdf-dialog__fallback" role="alert">
              <FileWarning aria-hidden="true" />
              <div><strong>Preview unavailable</strong><span>We could not load this PDF preview.</span><Button variant="outline" size="sm" onClick={() => { setFailed(false); setLoaded(false); setFrameKey((current) => current + 1); }}><RefreshCw aria-hidden="true" /> Retry</Button></div>
            </div>
          ) : (
            <div className="peas-pdf-dialog__surface">
              {!loaded ? <PeasInlineSpinner label="Loading PDF preview" /> : null}
              <iframe
                key={frameKey}
                className="peas-pdf-dialog__frame"
                src={`/api/documents/${document.id}/pdf`}
                title={`Preview of ${document.title}`}
                onLoad={() => setLoaded(true)}
                onError={() => setFailed(true)}
              />
            </div>
          )
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

function formatPreviewDate(value: string | null) {
  if (!value) return "Publication date not specified";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Publication date not specified" : new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function numericOrNull(value: string) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && value.trim() ? numberValue : null;
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timeout);
  }, [delayMs, value]);

  return debouncedValue;
}

function readDocumentFilter(): DocumentFilterState {
  if (typeof window === "undefined") return { ...DEFAULT_DOCUMENT_FILTER };

  const params = new URLSearchParams(window.location.search);
  const category = params.get("category");
  const status = params.get("status");
  const sort = params.get("sort");

  return {
    ...DEFAULT_DOCUMENT_FILTER,
    search: params.get("search") ?? "",
    category: category === "THESIS" || category === "DISSERTATION" || category === "CONFLUENCE" || category === "SYNERGY" ? category : "All",
    status: status === "all" || status === "approved" || status === "pending_review" || status === "rejected" ? status : "approved",
    sort: sort === "earliest" ? "earliest" : "latest",
    page: Math.max(1, Number(params.get("page") ?? "1") || 1),
  };
}
