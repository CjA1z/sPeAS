import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { BookMarked, Clock, FileText, Trash2, UserRound } from "lucide-react";
import { PeasPagination } from "../../components/data-display/PeasPagination";
import { PublicPageShell } from "../../components/public/PublicPageShell";
import { usePublicSession } from "../../components/public/PublicSessionProvider";
import { Button } from "../../components/ui/button";
import { changePassword, fetchSavedDocuments, fetchUserHistory, removeSavedDocument, uploadProfilePicture, type LooseRecord } from "../../lib/api/account";
import { fetchUserProfile, type UserProfile } from "../../lib/api/auth";
import { getErrorMessage } from "../../lib/api/http";

export function PublicSavedDocumentsPage() {
  return <ProtectedPublicPage><SavedDocuments /></ProtectedPublicPage>;
}
export function PublicHistoryPage() { return <ProtectedPublicPage><History /></ProtectedPublicPage>; }
export function PublicProfilePage() { return <ProtectedPublicPage><Profile /></ProtectedPublicPage>; }

function ProtectedPublicPage({ children }: { children: ReactNode }) {
  const { session, loading } = usePublicSession();
  useEffect(() => {
    if (!loading && !session?.authenticated) {
      const samePath = `${window.location.pathname}${window.location.search}`;
      window.location.replace(`/log-in.html?redirect=${encodeURIComponent(samePath)}`);
    }
  }, [loading, session]);
  if (loading || !session?.authenticated) return <PublicPageShell mainClassName="peas-account-loading"><p>Checking your session…</p></PublicPageShell>;
  return <PublicPageShell mainClassName="peas-account-page">{children}</PublicPageShell>;
}

function SavedDocuments() {
  const [items, setItems] = useState<LooseRecord[]>([]); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  const load = useCallback(() => { setLoading(true); fetchSavedDocuments().then((data) => setItems(data.documents ?? [])).catch((caught) => setError(getErrorMessage(caught))).finally(() => setLoading(false)); }, []);
  useEffect(load, [load]);
  return <><AccountHeader icon={<BookMarked />} eyebrow="Your library" title="Saved Documents" copy="Research records you saved for quick access." />{error ? <p className="peas-account-error">{error}</p> : loading ? <p>Loading saved documents…</p> : items.length ? <div className="peas-account-list">{items.map((item, index) => { const id = value(item, "doc_id", "id") || index; const compiled = Boolean(item.is_compiled); return <article key={String(id)}><FileText aria-hidden="true" /><div><span>{value(item, "document_type", "category") || "Research document"}</span><h2>{value(item, "title") || "Untitled document"}</h2><p>{arrayValue(item.author_names).join(", ") || "Author unavailable"}</p></div><div><a href={`/pages/${compiled ? "user-compiled" : "user-single"}.html?id=${encodeURIComponent(String(id))}`}>View details</a><Button variant="outline" size="sm" onClick={async () => { await removeSavedDocument(id); load(); }}><Trash2 aria-hidden="true" /> Remove</Button></div></article>; })}</div> : <EmptyState text="You have not saved any documents yet." />}</>;
}

function History() {
  const [items, setItems] = useState<LooseRecord[]>([]); const [query, setQuery] = useState(""); const [category, setCategory] = useState("all"); const [startDate, setStartDate] = useState(""); const [endDate, setEndDate] = useState(""); const [sort, setSort] = useState("newest"); const [page, setPage] = useState(1); const [total, setTotal] = useState(0); const [error, setError] = useState("");
  const load = useCallback(() => { const params = new URLSearchParams({ page: String(page), limit: "20", sortBy: sort }); if (query.trim()) params.set("search", query.trim()); if (category !== "all") params.set("category", category); if (startDate) params.set("startDate", startDate); if (endDate) params.set("endDate", endDate); fetchUserHistory(params).then((data) => { setItems(data.items ?? []); setTotal(data.totalCount ?? 0); }).catch((caught) => setError(getErrorMessage(caught))); }, [category, endDate, page, query, sort, startDate]);
  useEffect(load, [load]);
  return <><AccountHeader icon={<Clock />} eyebrow="Account activity" title="History" copy="Documents you have recently opened in PeAS." /><form className="peas-account-search peas-history-filters" onSubmit={(event) => { event.preventDefault(); setPage(1); load(); }}><input aria-label="Search history" value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Search title, author, or keyword" /><select aria-label="History category" value={category} onChange={(event) => setCategory(event.currentTarget.value)}><option value="all">All categories</option><option value="THESIS">Thesis</option><option value="DISSERTATION">Dissertation</option><option value="CONFLUENCE">Confluence</option><option value="SYNERGY">Synergy</option></select><input aria-label="History start date" type="date" value={startDate} onChange={(event) => setStartDate(event.currentTarget.value)} /><input aria-label="History end date" type="date" min={startDate || undefined} value={endDate} onChange={(event) => setEndDate(event.currentTarget.value)} /><select aria-label="History sort" value={sort} onChange={(event) => setSort(event.currentTarget.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select><Button>Apply filters</Button></form>{error ? <p className="peas-account-error">{error}</p> : items.length ? <div className="peas-account-list">{items.map((item, index) => { const id = value(item, "document_id", "id") || index; return <article key={`${id}-${index}`}><Clock aria-hidden="true" /><div><span>{value(item, "category") || "Document"}</span><h2>{value(item, "title") || `Document #${id}`}</h2><p>{arrayValue(item.author_names).join(", ") || value(item, "author") || "Author unavailable"}</p></div><time>{formatDate(value(item, "accessed_at", "date"))}</time></article>; })}</div> : <EmptyState text="No history records match this filter." />}{total > 0 ? <PeasPagination page={page} totalPages={Math.max(1, Math.ceil(total / 20))} totalCount={total} visibleCount={items.length} label="History pages" onPageChange={setPage} /> : null}</>;
}

function Profile() {
  const [profile, setProfile] = useState<UserProfile | null>(null); const [currentPassword, setCurrentPassword] = useState(""); const [newPassword, setNewPassword] = useState(""); const [confirm, setConfirm] = useState(""); const [notice, setNotice] = useState("");
  useEffect(() => { fetchUserProfile().then(setProfile).catch((caught) => setNotice(getErrorMessage(caught))); }, []);
  const submitPassword = async (event: FormEvent) => { event.preventDefault(); if (newPassword.length < 8 || newPassword !== confirm) return setNotice("New passwords must match and contain at least 8 characters."); try { await changePassword(currentPassword, newPassword); setNotice("Password updated successfully."); setCurrentPassword(""); setNewPassword(""); setConfirm(""); } catch (caught) { setNotice(getErrorMessage(caught)); } };
  return <><AccountHeader icon={<UserRound />} eyebrow="Account" title="Profile" copy="Review your account details, picture, and password." />{notice ? <div className="peas-account-notice" role="status">{notice}</div> : null}<div className="peas-profile-grid"><section><h2>Profile details</h2>{profile ? <dl><div><dt>Name</dt><dd>{[profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(" ") || "Not provided"}</dd></div><div><dt>Email</dt><dd>{String(profile.email || "Not provided")}</dd></div><div><dt>Account ID</dt><dd>{String(profile.id || "Unavailable")}</dd></div></dl> : <p>Loading profile…</p>}<label className="peas-profile-upload">Update profile picture<input type="file" accept="image/jpeg,image/png,image/webp" onChange={async (event) => { const file = event.currentTarget.files?.[0]; if (!file) return; try { await uploadProfilePicture(file); setNotice("Profile picture updated."); } catch (caught) { setNotice(getErrorMessage(caught)); } }} /></label></section><section><h2>Change password</h2><form onSubmit={submitPassword}><label>Current password<input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.currentTarget.value)} /></label><label>New password<input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.currentTarget.value)} /></label><label>Confirm new password<input type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.currentTarget.value)} /></label><Button>Update password</Button></form></section></div></>;
}

function AccountHeader({ icon, eyebrow, title, copy }: { icon: ReactNode; eyebrow: string; title: string; copy: string }) { return <header className="peas-account-header"><div>{icon}<span>{eyebrow}</span></div><h1>{title}</h1><p>{copy}</p></header>; }
function EmptyState({ text }: { text: string }) { return <div className="peas-account-empty"><FileText aria-hidden="true" /><p>{text}</p><a href="/pages/searchResultsPage.html">Browse the repository</a></div>; }
function value(item: LooseRecord, ...keys: string[]) { for (const key of keys) if (item[key] !== undefined && item[key] !== null) return String(item[key]); return ""; }
function arrayValue(value: unknown) { return Array.isArray(value) ? value.map(String) : []; }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" }).format(date); }
