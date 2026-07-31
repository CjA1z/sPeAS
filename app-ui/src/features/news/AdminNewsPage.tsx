import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Edit3, Newspaper, Plus, Send, Trash2 } from "lucide-react";
import { PeasEmptyState, PeasErrorState, PeasLoadingState } from "../../components/feedback/PeasStates";
import { PeasStatusBadge } from "../../components/data-display/PeasStatusBadge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { PeasToaster, toast } from "../../components/ui/toast";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "../../components/ui/sheet";
import {
  createNewsPost,
  deleteNewsPost,
  fetchAdminNews,
  updateNewsPost,
  type NewsPost,
  type NewsPostInput,
  type NewsStatus,
} from "../../lib/api/news";
import { getErrorMessage } from "../../lib/api/http";

const EMPTY_FORM: NewsPostInput = {
  title: "",
  excerpt: "",
  body: "",
  coverImageUrl: "",
  authorName: "Office of Research & Publications",
  status: "draft",
};

export function AdminNewsPage() {
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<NewsPost | null | undefined>(undefined);
  const [form, setForm] = useState<NewsPostInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const loadPosts = useCallback(() => {
    setLoading(true);
    setError("");
    fetchAdminNews()
      .then(setPosts)
      .catch((caughtError) => setError(getErrorMessage(caughtError)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const openEdit = (post: NewsPost) => {
    setEditing(post);
    setForm({
      title: post.title,
      excerpt: post.excerpt,
      body: post.body,
      coverImageUrl: post.coverImageUrl ?? "",
      authorName: post.authorName,
      status: post.status,
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await updateNewsPost(editing.id, form);
        toast.success("News post updated.");
      } else {
        await createNewsPost(form);
        toast.success(form.status === "published" ? "News post published." : "Draft saved.");
      }
      setEditing(undefined);
      loadPosts();
    } catch (caughtError) {
      toast.error(getErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (post: NewsPost) => {
    if (!window.confirm(`Delete “${post.title}”?`)) return;
    try {
      await deleteNewsPost(post.id);
      toast.success("News post deleted.");
      loadPosts();
    } catch (caughtError) {
      toast.error(getErrorMessage(caughtError));
    }
  };

  return (
    <div className="peas-admin-news">
      <PeasToaster />
      <header className="peas-page-heading">
        <div>
          <span>Research &amp; Publications</span>
          <h1>Department News</h1>
          <p>Create announcements, event stories, research updates, and publication milestones for the public News page.</p>
        </div>
        <Button onClick={openCreate}><Plus aria-hidden="true" /> New post</Button>
      </header>

      {loading ? <PeasLoadingState /> : error ? (
        <PeasErrorState title="Unable to load news" message={error} onRetry={loadPosts} />
      ) : posts.length ? (
        <div className="peas-admin-news-list">
          {posts.map((post) => (
            <article className="peas-admin-news-row" key={post.id}>
              <div className="peas-admin-news-row__image">
                {post.coverImageUrl ? <img src={post.coverImageUrl} alt="" /> : <Newspaper aria-hidden="true" />}
              </div>
              <div className="peas-admin-news-row__copy">
                <div><PeasStatusBadge status={post.status} /><span>{formatDate(post.publishedAt ?? post.createdAt)}</span></div>
                <h2>{post.title}</h2>
                <p>{post.excerpt}</p>
              </div>
              <div className="peas-admin-news-row__actions">
                <Button variant="outline" size="sm" onClick={() => openEdit(post)}><Edit3 aria-hidden="true" /> Edit</Button>
                <Button variant="ghost" size="sm" onClick={() => void remove(post)}><Trash2 aria-hidden="true" /> Delete</Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div>
          <PeasEmptyState title="No news posts yet" description="Create the department’s first public update." />
          <Button onClick={openCreate}><Plus aria-hidden="true" /> Create a post</Button>
        </div>
      )}

      <Sheet open={editing !== undefined} onOpenChange={(open) => { if (!open) setEditing(undefined); }}>
        <SheetContent className="peas-news-editor">
          <form onSubmit={submit}>
            <SheetHeader>
              <SheetTitle>{editing ? "Edit news post" : "Create news post"}</SheetTitle>
              <SheetDescription>Draft the story, then publish it when it is ready for the public News page.</SheetDescription>
            </SheetHeader>
            <div className="peas-news-editor__fields">
              <label className="peas-field"><span>Headline</span><Input required maxLength={255} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
              <label className="peas-field"><span>Summary</span><Textarea required rows={3} value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} /></label>
              <label className="peas-field"><span>Article</span><Textarea required rows={12} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Separate paragraphs with a blank line." /></label>
              <label className="peas-field"><span>Cover image URL</span><Input type="url" value={form.coverImageUrl} onChange={(e) => setForm({ ...form, coverImageUrl: e.target.value })} placeholder="/Components/images/news-cover.jpg" /></label>
              <label className="peas-field"><span>Author</span><Input required maxLength={160} value={form.authorName} onChange={(e) => setForm({ ...form, authorName: e.target.value })} /></label>
              <label className="peas-field"><span>Status</span><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as NewsStatus })}><option value="draft">Draft</option><option value="published">Published</option></select></label>
            </div>
            <SheetFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(undefined)}>Cancel</Button>
              <Button type="submit" disabled={saving}><Send aria-hidden="true" /> {saving ? "Saving…" : form.status === "published" ? "Publish" : "Save draft"}</Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(new Date(value));
}
