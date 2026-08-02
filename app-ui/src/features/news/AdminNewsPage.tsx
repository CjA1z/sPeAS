import {
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AtSign,
  Bold,
  Check,
  Code2,
  Edit3,
  Eye,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Newspaper,
  Plus,
  Quote,
  Save,
  Search,
  Send,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { AdminPageHeader } from "../../components/layout/AdminPageHeader";
import { NewsArticleBody } from "../../components/news/NewsArticleBody";
import { ArticleReferenceSelector } from "../../components/news/ArticleReferenceSelector";
import { InlineAuthorMentionPicker } from "../../components/news/InlineAuthorMentionPicker";
import { PeasStatusBadge } from "../../components/data-display/PeasStatusBadge";
import {
  PeasEmptyState,
  PeasErrorState,
  PeasLoadingState,
} from "../../components/feedback/PeasStates";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { PeasToaster, toast } from "../../components/ui/toast";
import { fetchSession } from "../../lib/api/auth";
import { getErrorMessage } from "../../lib/api/http";
import {
  createNewsPost,
  deleteNewsPost,
  fetchAdminNews,
  type NewsPost,
  type NewsPostInput,
  type NewsAuthorReference,
  type NewsStatus,
  type NewsWorkReference,
  updateNewsPost,
  uploadNewsImage,
} from "../../lib/api/news";

const DEFAULT_AUTHOR = "Office of Research & Publications";
const EMPTY_FORM: NewsPostInput = {
  title: "",
  excerpt: "",
  body: "",
  bodyFormat: "markdown",
  coverImageUrl: "",
  coverImageAlt: "",
  authorName: DEFAULT_AUTHOR,
  status: "draft",
  taggedAuthorIds: [],
  taggedWorks: [],
};
type StatusFilter = "all" | NewsStatus;

export function AdminNewsPage() {
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<NewsPost | null | undefined>(
    undefined,
  );
  const [form, setForm] = useState<NewsPostInput>(EMPTY_FORM);
  const [initialForm, setInitialForm] = useState<NewsPostInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const loadPosts = useCallback(() => {
    setLoading(true);
    setError("");
    fetchAdminNews()
      .then(setPosts)
      .catch((caughtError) => setError(getErrorMessage(caughtError)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);
  useEffect(() => {
    fetchSession().then((session) => setCanDelete(session?.role === "admin"))
      .catch(() => setCanDelete(false));
  }, []);

  const filteredPosts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return posts.filter((post) => {
      if (statusFilter !== "all" && post.status !== statusFilter) return false;
      return !normalized ||
        [post.title, post.excerpt, post.authorName].some((value) =>
          value.toLowerCase().includes(normalized)
        );
    });
  }, [posts, query, statusFilter]);

  const openCreate = () => {
    const next = { ...EMPTY_FORM };
    setEditing(null);
    setForm(next);
    setInitialForm(next);
  };

  const openEdit = (post: NewsPost) => {
    const next: NewsPostInput = {
      title: post.title,
      excerpt: post.excerpt,
      body: normalizeAuthorMentionTokens(post.body, post.taggedAuthors || []),
      bodyFormat: post.bodyFormat || "plain",
      coverImageUrl: post.coverImageUrl ?? "",
      coverImageAlt: post.coverImageAlt ?? "",
      authorName: post.authorName,
      status: post.status,
      taggedAuthorIds: (post.taggedAuthors || []).map((author) => author.id),
      taggedWorks: (post.taggedWorks || []).map((work) => ({
        id: work.id,
        recordType: work.recordType,
      })),
    };
    setEditing(post);
    setForm(next);
    setInitialForm(next);
  };

  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm);
  const closeEditor = () => {
    if (isDirty && !window.confirm("Discard your unsaved changes?")) return;
    setEditing(undefined);
  };

  useEffect(() => {
    if (editing === undefined || !isDirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [editing, isDirty]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (form.coverImageUrl && !form.coverImageAlt?.trim()) {
      toast.error("Add alternative text for the cover image before saving.");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateNewsPost(editing.id, form);
        toast.success(
          form.status === "published"
            ? "Article updated and published."
            : "Draft updated.",
        );
      } else {
        await createNewsPost(form);
        toast.success(
          form.status === "published" ? "Article published." : "Draft saved.",
        );
      }
      setInitialForm(form);
      setEditing(undefined);
      loadPosts();
    } catch (caughtError) {
      toast.error(getErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (post: NewsPost) => {
    if (!window.confirm(`Delete “${post.title}”? This cannot be undone.`)) {
      return;
    }
    try {
      await deleteNewsPost(post.id);
      toast.success("News post deleted.");
      loadPosts();
    } catch (caughtError) {
      toast.error(getErrorMessage(caughtError));
    }
  };

  return (
    <main className="peas-admin-island peas-admin-news">
      <PeasToaster />
      <AdminPageHeader
        eyebrow="Research & Publications"
        title="Department News"
        description="Plan, draft, preview, and publish department stories from one editorial workspace."
        actions={
          <Button onClick={openCreate}>
            <Plus aria-hidden="true" /> New article
          </Button>
        }
      />

      {!loading && !error && posts.length
        ? (
          <div className="peas-news-manager-toolbar" aria-label="News filters">
            <label className="peas-news-manager-search">
              <Search aria-hidden="true" />
              <span className="sr-only">Search news posts</span>
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search headline, summary, or author"
              />
            </label>
            <div
              className="peas-news-status-filters"
              role="group"
              aria-label="Filter by status"
            >
              {(["all", "draft", "published"] as const).map((status) => (
                <button
                  className={statusFilter === status ? "is-active" : ""}
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  type="button"
                >
                  {status === "all"
                    ? "All"
                    : status === "draft"
                    ? "Drafts"
                    : "Published"}
                  <span>
                    {status === "all"
                      ? posts.length
                      : posts.filter((post) => post.status === status).length}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )
        : null}

      {loading ? <PeasLoadingState /> : error
        ? (
          <PeasErrorState
            title="Unable to load news"
            message={error}
            onRetry={loadPosts}
          />
        )
        : filteredPosts.length
        ? (
          <div className="peas-admin-news-list">
            {filteredPosts.map((post) => (
              <article className="peas-admin-news-row" key={post.id}>
                <div className="peas-admin-news-row__image">
                  {post.coverImageUrl
                    ? (
                      <img
                        src={post.coverImageUrl}
                        alt={post.coverImageAlt || ""}
                      />
                    )
                    : <Newspaper aria-hidden="true" />}
                </div>
                <div className="peas-admin-news-row__copy">
                  <div>
                    <PeasStatusBadge status={post.status} />
                    <span>
                      {post.status === "published"
                        ? `Published ${formatDate(post.publishedAt)}`
                        : `Updated ${formatDate(post.updatedAt)}`}
                    </span>
                  </div>
                  <h2>{post.title}</h2>
                  <p>{post.excerpt}</p>
                  <small>
                    {wordCount(post.body)} words · {readingTime(post.body)}{" "}
                    min read · By {post.authorName}
                  </small>
                </div>
                <div className="peas-admin-news-row__actions">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      openEdit(post)}
                  >
                    <Edit3 aria-hidden="true" /> Edit
                  </Button>
                  {post.status === "published"
                    ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          window.open(
                            `/news.html?slug=${encodeURIComponent(post.slug)}`,
                            "_blank",
                            "noopener,noreferrer",
                          )}
                      >
                        <Eye aria-hidden="true" /> View
                      </Button>
                    )
                    : null}
                  {canDelete
                    ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void remove(post)}
                      >
                        <Trash2 aria-hidden="true" /> Delete
                      </Button>
                    )
                    : null}
                </div>
              </article>
            ))}
          </div>
        )
        : posts.length
        ? (
          <PeasEmptyState
            title="No matching articles"
            description="Try another search term or status filter."
          />
        )
        : (
          <PeasEmptyState
            title="No news posts yet"
            description="Create the department’s first public update with the New article button."
          />
        )}

      {editing !== undefined
        ? (
          <NewsEditor
            editing={editing}
            form={form}
            isDirty={isDirty}
            saving={saving}
            onChange={setForm}
            onClose={closeEditor}
            onSubmit={submit}
          />
        )
        : null}
    </main>
  );
}

function NewsEditor(
  { editing, form, isDirty, saving, onChange, onClose, onSubmit }: {
    editing: NewsPost | null;
    form: NewsPostInput;
    isDirty: boolean;
    saving: boolean;
    onChange: (form: NewsPostInput) => void;
    onClose: () => void;
    onSubmit: (event: FormEvent) => void;
  },
) {
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<"write" | "preview">("write");
  const [uploading, setUploading] = useState(false);
  const [mentionPickerOpen, setMentionPickerOpen] = useState(false);
  const [selectedAuthors, setSelectedAuthors] = useState<NewsAuthorReference[]>(
    editing?.taggedAuthors || [],
  );
  const [selectedWorks, setSelectedWorks] = useState<NewsWorkReference[]>(
    editing?.taggedWorks || [],
  );

  useEffect(() => {
    document.body.classList.add("peas-editor-open");
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.classList.remove("peas-editor-open");
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, saving]);

  const update = <Key extends keyof NewsPostInput>(
    key: Key,
    value: NewsPostInput[Key],
  ) => onChange({ ...form, [key]: value });
  const updateAuthors = (authors: NewsAuthorReference[]) => {
    const removedInlineAuthor = selectedAuthors.find((author) =>
      !authors.some((item) => item.id === author.id) &&
      containsAuthorMention(form.body, author)
    );
    if (removedInlineAuthor) {
      toast.error(`Remove @${removedInlineAuthor.fullName} from the article body before untagging this author.`);
      return;
    }
    setSelectedAuthors(authors);
    onChange({ ...form, taggedAuthorIds: authors.map((author) => author.id) });
  };
  const updateWorks = (works: NewsWorkReference[]) => {
    setSelectedWorks(works);
    onChange({
      ...form,
      taggedWorks: works.map((work) => ({ id: work.id, recordType: work.recordType })),
    });
  };
  const applyInline = (before: string, after: string, placeholder: string) => {
    const field = bodyRef.current;
    if (!field) return;
    const start = field.selectionStart;
    const end = field.selectionEnd;
    const selected = form.body.slice(start, end) || placeholder;
    const body = `${form.body.slice(0, start)}${before}${selected}${after}${
      form.body.slice(end)
    }`;
    onChange({ ...form, body, bodyFormat: "markdown" });
    requestAnimationFrame(() => {
      field.focus();
      field.setSelectionRange(
        start + before.length,
        start + before.length + selected.length,
      );
    });
  };
  const applyLine = (prefix: string, placeholder: string) => {
    const field = bodyRef.current;
    if (!field) return;
    const start = field.selectionStart;
    const end = field.selectionEnd;
    const lineStart = form.body.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const selection = form.body.slice(lineStart, end) || placeholder;
    const transformed = selection.split("\n").map((line, index) =>
      prefix === "1. " ? `${index + 1}. ${line}` : `${prefix}${line}`
    ).join("\n");
    onChange({
      ...form,
      body: `${form.body.slice(0, lineStart)}${transformed}${
        form.body.slice(end)
      }`,
      bodyFormat: "markdown",
    });
    requestAnimationFrame(() => field.focus());
  };
  const handleBodyKeys = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(event.metaKey || event.ctrlKey)) return;
    if (event.key.toLowerCase() === "b") {
      event.preventDefault();
      applyInline("**", "**", "bold text");
    }
    if (event.key.toLowerCase() === "i") {
      event.preventDefault();
      applyInline("*", "*", "italic text");
    }
  };
  const handleImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const asset = await uploadNewsImage(file, form.coverImageAlt || "");
      onChange({ ...form, coverImageUrl: asset.url });
      toast.success("Cover image uploaded.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setUploading(false);
    }
  };
  const insertAuthorMention = (author: NewsAuthorReference) => {
    const field = bodyRef.current;
    const start = field?.selectionStart ?? form.body.length;
    const end = field?.selectionEnd ?? start;
    const label = authorMentionLabel(author.fullName);
    const token = `@[${label}]`;
    const needsLeadingSpace = start > 0 && !/\s/.test(form.body[start - 1]);
    const needsTrailingSpace = end < form.body.length && !/\s|[.,!?;:]/.test(form.body[end]);
    const insertion = `${needsLeadingSpace ? " " : ""}${token}${needsTrailingSpace ? " " : ""}`;
    const nextAuthors = selectedAuthors.some((item) => item.id === author.id)
      ? selectedAuthors
      : [...selectedAuthors, author];
    const body = `${form.body.slice(0, start)}${insertion}${form.body.slice(end)}`;
    setSelectedAuthors(nextAuthors);
    onChange({
      ...form,
      body,
      bodyFormat: "markdown",
      taggedAuthorIds: nextAuthors.map((item) => item.id),
    });
    setMentionPickerOpen(false);
    requestAnimationFrame(() => {
      field?.focus();
      const cursor = start + insertion.length;
      field?.setSelectionRange(cursor, cursor);
    });
  };

  return (
    <div
      className="peas-article-editor"
      role="dialog"
      aria-modal="true"
      aria-labelledby="news-editor-title"
    >
      <form onSubmit={onSubmit}>
        <header className="peas-article-editor__topbar">
          <div className="peas-article-editor__identity">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close article editor"
            >
              <X aria-hidden="true" />
            </button>
            <div>
              <span>Department News</span>
              <strong id="news-editor-title">
                {editing ? "Edit article" : "New article"}
              </strong>
            </div>
          </div>
          <div className="peas-article-editor__save-state" aria-live="polite">
            {isDirty
              ? (
                <>
                  <span className="is-unsaved" /> Unsaved changes
                </>
              )
              : (
                <>
                  <Check aria-hidden="true" /> All changes saved
                </>
              )}
          </div>
          <div className="peas-article-editor__actions">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              <Save aria-hidden="true" /> {saving
                ? "Saving…"
                : form.status === "published"
                ? "Publish article"
                : "Save draft"}
            </Button>
          </div>
        </header>

        <div className="peas-article-editor__workspace">
          <main className="peas-article-editor__canvas">
            <div className="peas-article-editor__document">
              <label className="peas-article-title-field">
                <span className="sr-only">Headline</span>
                <textarea
                  required
                  maxLength={255}
                  rows={1}
                  value={form.title}
                  onChange={(event) => update("title", event.target.value)}
                  placeholder="Write a clear, compelling headline…"
                />
                <small>{form.title.length}/255</small>
              </label>
              <label className="peas-article-summary-field">
                <span>Summary</span>
                <Textarea
                  required
                  maxLength={600}
                  rows={3}
                  value={form.excerpt}
                  onChange={(event) => update("excerpt", event.target.value)}
                  placeholder="Give readers the essential context in one or two sentences."
                />
                <small>{form.excerpt.length}/600</small>
              </label>

              <div className="peas-article-composer">
                <div
                  className="peas-article-composer__tabs"
                  role="tablist"
                  aria-label="Article body view"
                >
                  <button
                    className={mode === "write" ? "is-active" : ""}
                    type="button"
                    role="tab"
                    aria-selected={mode === "write"}
                    onClick={() => setMode("write")}
                  >
                    <Edit3 aria-hidden="true" /> Write
                  </button>
                  <button
                    className={mode === "preview" ? "is-active" : ""}
                    type="button"
                    role="tab"
                    aria-selected={mode === "preview"}
                    onClick={() => setMode("preview")}
                  >
                    <Eye aria-hidden="true" /> Preview
                  </button>
                  <span>
                    {wordCount(form.body)} words · {readingTime(form.body)}{" "}
                    min read
                  </span>
                </div>
                {mode === "write"
                  ? (
                    <div className="peas-article-write-surface">
                      <div
                        className="peas-article-toolbar"
                        role="toolbar"
                        aria-label="Article formatting"
                      >
                        <EditorTool
                          label="Heading 2"
                          onClick={() => applyLine("## ", "Section heading")}
                        >
                          <Heading2 />
                        </EditorTool>
                        <EditorTool
                          label="Heading 3"
                          onClick={() => applyLine("### ", "Subheading")}
                        >
                          <Heading3 />
                        </EditorTool>
                        <span />
                        <EditorTool
                          label="Bold (Ctrl+B)"
                          onClick={() => applyInline("**", "**", "bold text")}
                        >
                          <Bold />
                        </EditorTool>
                        <EditorTool
                          label="Italic (Ctrl+I)"
                          onClick={() => applyInline("*", "*", "italic text")}
                        >
                          <Italic />
                        </EditorTool>
                        <EditorTool
                          label="Link"
                          onClick={() =>
                            applyInline(
                              "[",
                              "](https://example.com)",
                              "link text",
                            )}
                        >
                          <Link2 />
                        </EditorTool>
                        <EditorTool
                          label="Mention author"
                          active={mentionPickerOpen}
                          onClick={() => setMentionPickerOpen((open) => !open)}
                        >
                          <AtSign />
                        </EditorTool>
                        <EditorTool
                          label="Inline code"
                          onClick={() => applyInline("`", "`", "code")}
                        >
                          <Code2 />
                        </EditorTool>
                        <span />
                        <EditorTool
                          label="Bulleted list"
                          onClick={() => applyLine("- ", "List item")}
                        >
                          <List />
                        </EditorTool>
                        <EditorTool
                          label="Numbered list"
                          onClick={() => applyLine("1. ", "List item")}
                        >
                          <ListOrdered />
                        </EditorTool>
                        <EditorTool
                          label="Quote"
                          onClick={() => applyLine("> ", "Quoted text")}
                        >
                          <Quote />
                        </EditorTool>
                      </div>
                      <div className="peas-article-body-surface">
                        {mentionPickerOpen ? (
                          <InlineAuthorMentionPicker
                            selectedAuthors={selectedAuthors}
                            onSelect={insertAuthorMention}
                            onClose={() => setMentionPickerOpen(false)}
                          />
                        ) : null}
                        <Textarea
                          ref={bodyRef}
                          className="peas-article-body-field"
                          required
                          value={form.body}
                          onChange={(event) =>
                            onChange({
                              ...form,
                              body: event.target.value,
                              bodyFormat: "markdown",
                            })}
                          onKeyDown={handleBodyKeys}
                          placeholder="Begin the story here. Use the toolbar to add headings, emphasis, lists, links, and quotations."
                        />
                      </div>
                    </div>
                  )
                  : (
                    <div className="peas-article-live-preview">
                      {form.coverImageUrl
                        ? (
                          <img
                            src={form.coverImageUrl}
                            alt={form.coverImageAlt || ""}
                          />
                        )
                        : null}
                      <h1>{form.title || "Your headline will appear here"}</h1>
                      <p className="peas-article-live-preview__summary">
                        {form.excerpt ||
                          "Your article summary will appear here."}
                      </p>
                      <div className="peas-news-article__content">
                        {form.body
                          ? (
                            <NewsArticleBody
                              body={form.body}
                              format={form.bodyFormat}
                              authors={selectedAuthors}
                            />
                          )
                          : <p>Start writing to preview the article.</p>}
                      </div>
                    </div>
                  )}
              </div>
            </div>
          </main>

          <aside
            className="peas-article-editor__settings"
            aria-label="Article settings"
          >
            <section>
              <h2>Publishing</h2>
              <div className="peas-editor-status-options">
                <button
                  className={form.status === "draft" ? "is-active" : ""}
                  type="button"
                  onClick={() => update("status", "draft")}
                >
                  <Save aria-hidden="true" />
                  <span>
                    <strong>Draft</strong>
                    <small>Only workspace editors can view it</small>
                  </span>
                  {form.status === "draft"
                    ? <Check aria-hidden="true" />
                    : null}
                </button>
                <button
                  className={form.status === "published" ? "is-active" : ""}
                  type="button"
                  onClick={() => update("status", "published")}
                >
                  <Send aria-hidden="true" />
                  <span>
                    <strong>Published</strong>
                    <small>Visible on the public News page</small>
                  </span>
                  {form.status === "published"
                    ? <Check aria-hidden="true" />
                    : null}
                </button>
              </div>
              <label className="peas-field">
                <span>Author</span>
                <Input
                  required
                  maxLength={160}
                  value={form.authorName}
                  onChange={(event) => update("authorName", event.target.value)}
                />
              </label>
              <div className="peas-editor-slug">
                <span>Article URL</span>
                <code>
                  /news.html?slug={editing?.slug || slugify(form.title) ||
                    "your-headline"}
                </code>
              </div>
            </section>

            <section>
              <h2>Article references</h2>
              <p className="peas-editor-section-intro">
                Connect this story to people and publications already in PeAS.
              </p>
              <ArticleReferenceSelector
                selectedAuthors={selectedAuthors}
                selectedWorks={selectedWorks}
                onAuthorsChange={updateAuthors}
                onWorksChange={updateWorks}
              />
            </section>

            <section>
              <h2>Cover image</h2>
              <div
                className={`peas-news-cover ${
                  form.coverImageUrl ? "has-image" : ""
                }`}
              >
                {form.coverImageUrl
                  ? (
                    <img
                      src={form.coverImageUrl}
                      alt={form.coverImageAlt || ""}
                    />
                  )
                  : (
                    <>
                      <ImagePlus aria-hidden="true" />
                      <strong>Add a story image</strong>
                      <span>JPG, PNG, or WEBP · up to 8 MB</span>
                    </>
                  )}
                <label className="peas-news-cover__upload">
                  <Upload aria-hidden="true" /> {uploading
                    ? "Uploading…"
                    : form.coverImageUrl
                    ? "Replace image"
                    : "Upload image"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={uploading}
                    onChange={(event) => void handleImage(event)}
                  />
                </label>
              </div>
              <label className="peas-field">
                <span>
                  Image URL <small>optional alternative</small>
                </span>
                <Input
                  type="text"
                  value={form.coverImageUrl || ""}
                  onChange={(event) =>
                    update("coverImageUrl", event.target.value)}
                  placeholder="/storage/site-branding/news-cover/…"
                />
              </label>
              {form.coverImageUrl
                ? (
                  <label className="peas-field">
                    <span>
                      Alternative text <b>Required</b>
                    </span>
                    <Textarea
                      required
                      maxLength={255}
                      rows={3}
                      value={form.coverImageAlt || ""}
                      onChange={(event) =>
                        update("coverImageAlt", event.target.value)}
                      placeholder="Describe the meaningful content of the image."
                    />
                    <small>{form.coverImageAlt?.length || 0}/255</small>
                  </label>
                )
                : null}
              {form.coverImageUrl
                ? (
                  <button
                    className="peas-news-cover__remove"
                    type="button"
                    onClick={() =>
                      onChange({
                        ...form,
                        coverImageUrl: "",
                        coverImageAlt: "",
                      })}
                  >
                    <Trash2 aria-hidden="true" /> Remove image
                  </button>
                )
                : null}
            </section>
          </aside>
        </div>
      </form>
    </div>
  );
}

function authorMentionLabel(fullName: string) {
  return fullName.replace(/[\[\]()]/g, "").trim() || "Author";
}

function containsAuthorMention(body: string, author: NewsAuthorReference) {
  const label = authorMentionLabel(author.fullName);
  return body.includes(`@[${label}]`) || body.includes(`(author:${author.id})`);
}

function normalizeAuthorMentionTokens(body: string, authors: NewsAuthorReference[]) {
  return body.replace(
    /@\[([^\]]+)\]\(author:([0-9a-f-]+)\)/gi,
    (token, _label: string, id: string) => {
      const author = authors.find((item) => item.id.toLowerCase() === id.toLowerCase());
      return author ? `@[${authorMentionLabel(author.fullName)}]` : token;
    },
  );
}

function EditorTool(
  { label, onClick, children, active = false }: {
    label: string;
    onClick: () => void;
    children: ReactNode;
    active?: boolean;
  },
) {
  return (
    <button
      className={active ? "is-active" : ""}
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active || undefined}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function wordCount(value: string) {
  return value.replace(/[#>*_`\[\]()-]/g, " ").trim().split(/\s+/).filter(
    Boolean,
  ).length;
}

function readingTime(value: string) {
  return Math.max(1, Math.ceil(wordCount(value) / 220));
}

function slugify(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(
    new Date(value),
  );
}
