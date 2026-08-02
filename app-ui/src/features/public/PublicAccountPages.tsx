import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowUpRight,
  BookMarked,
  CalendarDays,
  Check,
  Clock3,
  Download,
  Eye,
  FileText,
  ImagePlus,
  KeyRound,
  LockKeyhole,
  Trash2,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { PeasDateRange } from "../../components/forms/PeasDateRange";
import { PeasErrorState, PeasEmptyState, PeasInlineSpinner } from "../../components/feedback/PeasStates";
import { PeasPagination } from "../../components/data-display/PeasPagination";
import { PublicPageShell } from "../../components/public/PublicPageShell";
import { usePublicSession } from "../../components/public/PublicSessionProvider";
import { Button } from "../../components/ui/button";
import { PeasToaster, toast } from "../../components/ui/toast";
import {
  addSavedDocument,
  changePassword,
  fetchSavedDocuments,
  fetchUserHistory,
  removeSavedDocument,
  uploadProfilePicture,
  type AccountHistoryItem,
  type AccountLibraryItem,
} from "../../lib/api/account";
import { fetchUserProfile, type UserProfile } from "../../lib/api/auth";
import { getErrorMessage } from "../../lib/api/http";

const LIBRARY_PAGE_SIZE = 8;
const HISTORY_PAGE_SIZE = 10;

export function PublicSavedDocumentsPage() {
  return <ProtectedPublicPage active="saved"><SavedDocuments /></ProtectedPublicPage>;
}

export function PublicHistoryPage() {
  return <ProtectedPublicPage active="history"><History /></ProtectedPublicPage>;
}

export function PublicProfilePage() {
  return <ProtectedPublicPage active="profile"><Profile /></ProtectedPublicPage>;
}

function ProtectedPublicPage({ children, active }: { children: ReactNode; active: "saved" | "history" | "profile" }) {
  const { session, loading } = usePublicSession();
  useEffect(() => {
    if (!loading && !session?.authenticated) {
      const samePath = `${window.location.pathname}${window.location.search}`;
      window.location.replace(`/log-in.html?redirect=${encodeURIComponent(samePath)}`);
    }
  }, [loading, session]);

  if (loading || !session?.authenticated) {
    return <PublicPageShell mainClassName="peas-account-loading"><PeasInlineSpinner label="Checking your session" /></PublicPageShell>;
  }

  return (
    <PublicPageShell mainClassName="peas-account-page">
      <AccountShell active={active}>{children}</AccountShell>
    </PublicPageShell>
  );
}

function AccountShell({ active, children }: { active: "saved" | "history" | "profile"; children: ReactNode }) {
  return (
    <div className="peas-account-shell">
      <nav className="peas-account-nav" aria-label="Account navigation">
        <a className={active === "saved" ? "is-active" : ""} href="/pages/SavedDocument.html"><BookMarked aria-hidden="true" /> Saved Documents</a>
        <a className={active === "history" ? "is-active" : ""} href="/pages/UserHistory.html"><Clock3 aria-hidden="true" /> History</a>
        <a className={active === "profile" ? "is-active" : ""} href="/pages/UserProfile.html"><UserRound aria-hidden="true" /> Profile</a>
      </nav>
      <PeasToaster />
      {children}
    </div>
  );
}

function SavedDocuments() {
  const initial = useMemo(() => readAccountSearch(), []);
  const [items, setItems] = useState<AccountLibraryItem[]>([]);
  const [count, setCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(initial.page);
  const [query, setQuery] = useState(initial.query);
  const [submittedQuery, setSubmittedQuery] = useState(initial.query);
  const [category, setCategory] = useState(initial.category);
  const [sort, setSort] = useState(initial.sort || "saved-newest");
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(page), limit: String(LIBRARY_PAGE_SIZE), sort, recordType: "all" });
    if (submittedQuery) params.set("search", submittedQuery);
    if (category !== "all") params.set("category", category);
    updateAccountUrl("SavedDocument.html", { page, query: submittedQuery, category, sort });
    fetchSavedDocuments(params)
      .then((data) => {
        setItems(data.items ?? data.documents ?? []);
        setCount(data.count ?? 0);
        setTotalCount(data.totalCount ?? data.count ?? 0);
        setTotalPages(data.totalPages ?? 0);
        setCategories(data.filters?.availableCategories ?? []);
      })
      .catch((caught) => setError(getErrorMessage(caught)))
      .finally(() => setLoading(false));
  }, [category, page, sort, submittedQuery]);

  useEffect(load, [load]);

  const remove = async (item: AccountLibraryItem) => {
    const previous = items;
    setItems((current) => current.filter((candidate) => candidate !== item));
    try {
      await removeSavedDocument(item.record_id, item.record_type);
      setCount((current) => Math.max(0, current - 1));
      setTotalCount((current) => {
        const next = Math.max(0, current - 1);
        setTotalPages(Math.ceil(next / LIBRARY_PAGE_SIZE));
        return next;
      });
      toast.success("Removed from Saved Documents", {
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await addSavedDocument(item.record_id, item.record_type);
              setItems(previous);
              setCount((current) => current + 1);
              setTotalCount((current) => {
                const next = current + 1;
                setTotalPages(Math.ceil(next / LIBRARY_PAGE_SIZE));
                return next;
              });
            } catch (caught) {
              toast.error(getErrorMessage(caught));
            }
          },
        },
      });
    } catch (caught) {
      setItems(previous);
      toast.error(getErrorMessage(caught));
    }
  };

  return (
    <>
      <AccountHeader icon={<BookMarked />} eyebrow="Your library" title="Saved Documents" copy="Research records you saved for quick access." />
      <section className="peas-account-summary" aria-label="Saved document summary">
        <div><BookMarked aria-hidden="true" /><strong>{count}</strong><span>saved records</span></div>
        <div><FileText aria-hidden="true" /><strong>{totalCount}</strong><span>matching this view</span></div>
      </section>
      <form className="peas-account-toolbar" onSubmit={(event) => { event.preventDefault(); setPage(1); setSubmittedQuery(query.trim()); }}>
        <label className="peas-account-search-field">
          <span>Search saved records</span>
          <span className="peas-account-input-wrap"><FileText aria-hidden="true" /><input aria-label="Search saved records" value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Title, author, or category" />{query ? <button type="button" aria-label="Clear search" onClick={() => { setQuery(""); setSubmittedQuery(""); setPage(1); }}><X aria-hidden="true" /></button> : null}</span>
        </label>
        <label><span>Collection</span><select aria-label="Saved document category" value={category} onChange={(event) => { setCategory(event.currentTarget.value); setPage(1); }}><option value="all">All collections</option>{categories.map((item) => <option key={item} value={item}>{formatCategory(item)}</option>)}</select></label>
        <label><span>Sort</span><select aria-label="Saved document sort" value={sort} onChange={(event) => { setSort(event.currentTarget.value); setPage(1); }}><option value="saved-newest">Recently saved</option><option value="saved-oldest">Oldest saved</option><option value="title-asc">Title A–Z</option><option value="title-desc">Title Z–A</option></select></label>
        <Button type="submit"><ArrowUpRight aria-hidden="true" /> Search</Button>
      </form>
      {loading ? <AccountListSkeleton /> : error ? <PeasErrorState title="Unable to load saved documents" message={error} onRetry={load} /> : items.length ? <div className="peas-account-record-list">{items.map((item) => <SavedRecordCard key={`${item.record_type}-${item.record_id}`} item={item} onRemove={() => remove(item)} />)}</div> : <PeasEmptyState icon={<BookMarked aria-hidden="true" />} title={submittedQuery || category !== "all" ? "No saved records match" : "Your library is ready for research"} description={submittedQuery || category !== "all" ? "Try a broader search or clear the filters." : "Save a repository record to keep it close for your next visit."} action={<a className="peas-account-state-link" href="/pages/searchResultsPage.html">Browse the repository <ArrowUpRight aria-hidden="true" /></a>} />}
      {!loading && !error && totalCount > 0 ? <PeasPagination page={page} totalPages={totalPages} totalCount={totalCount} visibleCount={items.length} label="Saved documents pagination" onPageChange={setPage} /> : null}
    </>
  );
}

function SavedRecordCard({ item, onRemove }: { item: AccountLibraryItem; onRemove: () => void }) {
  const unavailable = item.availability !== "available";
  const href = unavailable ? undefined : `${item.record_type === "compiled" ? "/pages/user-compiled.html" : "/pages/user-single.html"}?id=${encodeURIComponent(String(item.record_id))}`;
  return (
    <article className={`peas-account-record${unavailable ? " is-unavailable" : ""}`}>
      <span className="peas-account-record__icon"><FileText aria-hidden="true" /></span>
      <div className="peas-account-record__body">
        <div className="peas-account-record__labels"><span>{formatCategory(item.category || item.document_type)}</span>{item.record_type === "compiled" ? <small>{item.child_count} {item.child_count === 1 ? "work" : "works"}</small> : null}</div>
        {href ? <a className="peas-account-record__title" href={href}>{item.title || "Untitled record"}<ArrowUpRight aria-hidden="true" /></a> : <h2 className="peas-account-record__title">This record is no longer available</h2>}
        {!unavailable ? <p>{item.author_names?.length ? item.author_names.join(", ") : item.record_type === "compiled" ? "Compiled collection" : "Author information unavailable"}</p> : <p>It may have been archived or removed from the public repository.</p>}
        <div className="peas-account-record__meta"><span><CalendarDays aria-hidden="true" /> {item.publication_date ? formatDate(item.publication_date) : "Publication date unavailable"}</span><span><Clock3 aria-hidden="true" /> Saved {formatDate(item.saved_at)}</span></div>
      </div>
      <Button variant="outline" size="sm" aria-label={`Remove ${item.title || "record"} from saved documents`} onClick={onRemove}><Trash2 aria-hidden="true" /> Remove</Button>
    </article>
  );
}

function History() {
  const initial = useMemo(() => readAccountSearch(), []);
  const [items, setItems] = useState<AccountHistoryItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(initial.page);
  const [query, setQuery] = useState(initial.query);
  const [submittedQuery, setSubmittedQuery] = useState(initial.query);
  const [category, setCategory] = useState(initial.category);
  const [action, setAction] = useState(initial.action || "all");
  const [startDate, setStartDate] = useState(initial.startDate);
  const [endDate, setEndDate] = useState(initial.endDate);
  const [sort, setSort] = useState(initial.sort || "newest");
  const [categories, setCategories] = useState<string[]>([]);
  const [actions, setActions] = useState<string[]>(["VIEW", "DOWNLOAD"]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(page), limit: String(HISTORY_PAGE_SIZE), sortBy: sort });
    if (submittedQuery) params.set("search", submittedQuery);
    if (category !== "all") params.set("category", category);
    if (action !== "all") params.set("action", action);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    updateAccountUrl("UserHistory.html", { page, query: submittedQuery, category, sort, action, startDate, endDate });
    fetchUserHistory(params)
      .then((data) => {
        setItems(data.items ?? []);
        setTotalCount(data.totalCount ?? 0);
        setTotalPages(data.totalPages ?? 0);
        setCategories(data.filters?.availableCategories ?? []);
        setActions(data.filters?.availableActions?.length ? data.filters.availableActions : ["VIEW", "DOWNLOAD"]);
      })
      .catch((caught) => setError(getErrorMessage(caught)))
      .finally(() => setLoading(false));
  }, [action, category, endDate, page, sort, startDate, submittedQuery]);

  useEffect(load, [load]);

  return (
    <>
      <AccountHeader icon={<Clock3 />} eyebrow="Account activity" title="History" copy="A focused view of the repository records you recently opened or downloaded." />
      <form className="peas-account-toolbar peas-history-toolbar" onSubmit={(event) => { event.preventDefault(); setPage(1); setSubmittedQuery(query.trim()); }}>
        <label className="peas-account-search-field"><span>Search history</span><span className="peas-account-input-wrap"><FileText aria-hidden="true" /><input aria-label="Search history" value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Title, author, or collection" />{query ? <button type="button" aria-label="Clear history search" onClick={() => { setQuery(""); setSubmittedQuery(""); setPage(1); }}><X aria-hidden="true" /></button> : null}</span></label>
        <label><span>Collection</span><select aria-label="History category" value={category} onChange={(event) => { setCategory(event.currentTarget.value); setPage(1); }}><option value="all">All collections</option>{categories.map((item) => <option key={item} value={item}>{formatCategory(item)}</option>)}</select></label>
        <label><span>Activity</span><select aria-label="History activity" value={action} onChange={(event) => { setAction(event.currentTarget.value); setPage(1); }}><option value="all">All activity</option>{actions.map((item) => <option key={item} value={item}>{item === "DOWNLOAD" ? "Downloaded" : "Opened"}</option>)}</select></label>
        <label><span>Sort</span><select aria-label="History sort" value={sort} onChange={(event) => { setSort(event.currentTarget.value); setPage(1); }}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="title-asc">Title A–Z</option></select></label>
        <PeasDateRange from={startDate} to={endDate} onFromChange={(value) => { setStartDate(value); setPage(1); }} onToChange={(value) => { setEndDate(value); setPage(1); }} />
        <Button type="submit"><ArrowUpRight aria-hidden="true" /> Apply</Button>
      </form>
      {loading ? <AccountListSkeleton /> : error ? <PeasErrorState title="Unable to load history" message={error} onRetry={load} /> : items.length ? <div className="peas-account-record-list">{items.map((item) => <HistoryRecordCard key={item.id} item={item} />)}</div> : <PeasEmptyState icon={<Clock3 aria-hidden="true" />} title="No history records match" description="Open a repository record to build your personal activity history." action={<a className="peas-account-state-link" href="/pages/searchResultsPage.html">Browse the repository <ArrowUpRight aria-hidden="true" /></a>} />}
      {!loading && !error && totalCount > 0 ? <PeasPagination page={page} totalPages={totalPages} totalCount={totalCount} visibleCount={items.length} label="History pagination" onPageChange={setPage} /> : null}
    </>
  );
}

function HistoryRecordCard({ item }: { item: AccountHistoryItem }) {
  const unavailable = item.availability !== "available";
  const href = unavailable ? undefined : `${item.record_type === "compiled" ? "/pages/user-compiled.html" : "/pages/user-single.html"}?id=${encodeURIComponent(String(item.record_id))}`;
  return (
    <article className={`peas-account-record${unavailable ? " is-unavailable" : ""}`}>
      <span className="peas-account-record__icon"><Clock3 aria-hidden="true" /></span>
      <div className="peas-account-record__body">
        <div className="peas-account-record__labels"><span>{formatCategory(item.category)}</span><small>{item.latest_action === "DOWNLOAD" ? <><Download aria-hidden="true" /> Downloaded</> : <><Eye aria-hidden="true" /> Opened</>}</small></div>
        {href ? <a className="peas-account-record__title" href={href}>{item.title || "Untitled record"}<ArrowUpRight aria-hidden="true" /></a> : <h2 className="peas-account-record__title">This record is no longer available</h2>}
        {!unavailable ? <p>{item.author_names?.length ? item.author_names.join(", ") : item.record_type === "compiled" ? "Compiled collection" : "Author information unavailable"}</p> : <p>Its metadata is no longer available in the public repository.</p>}
        <div className="peas-account-record__meta"><span><Clock3 aria-hidden="true" /> Last activity {formatDate(item.last_accessed_at)}</span><span><Eye aria-hidden="true" /> {item.view_count} {item.view_count === 1 ? "open" : "opens"}</span><span><Download aria-hidden="true" /> {item.download_count} {item.download_count === 1 ? "download" : "downloads"}</span></div>
      </div>
    </article>
  );
}

function Profile() {
  const { session, refresh } = usePublicSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileError, setProfileError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedImage, setSelectedImage] = useState("");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const loadProfile = useCallback(() => {
    setProfileError("");
    return fetchUserProfile().then(setProfile).catch((caught) => setProfileError(getErrorMessage(caught)));
  }, []);
  useEffect(() => { void loadProfile(); }, [loadProfile]);

  const name = profile ? [profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(" ") || profile.name : session?.user?.name || session?.username || "PeAS user";
  const imageUrl = selectedImage || profileImageUrl(profile?.profile_picture) || String(session?.user?.image || "");
  // Do not render a credential form until the server explicitly confirms that
  // this account owns a credential password. This keeps Microsoft-only and
  // temporarily unavailable profile states safe by default.
  const canChangePassword = profile?.can_change_password === true;
  const passwordChecks = passwordRequirements(newPassword);

  const chooseImage = async (file: File | undefined) => {
    if (!file) return;
    if (!/image\/(jpeg|png|webp)/i.test(file.type) || file.size > 5 * 1024 * 1024) {
      setNotice("Choose a JPEG, PNG, or WebP image no larger than 5 MB.");
      return;
    }
    const preview = URL.createObjectURL(file);
    setSelectedImage(preview);
    setUploadBusy(true);
    setNotice("");
    try {
      const result = await uploadProfilePicture(file);
      setSelectedImage(profileImageUrl(String(result.pictureUrl || result.profilePicture || "")));
      URL.revokeObjectURL(preview);
      setProfile((current) => current ? { ...current, profile_picture: String(result.profilePicture || result.pictureUrl || "") } : current);
      await refresh();
      toast.success("Profile picture updated");
    } catch (caught) {
      URL.revokeObjectURL(preview);
      setSelectedImage("");
      setNotice(getErrorMessage(caught));
    } finally {
      setUploadBusy(false);
    }
  };

  const submitPassword = async (event: FormEvent) => {
    event.preventDefault();
    if (!passwordChecks.every(Boolean) || newPassword !== confirmPassword) {
      setNotice("Use at least 8 characters with a number and a symbol, then confirm the same password.");
      return;
    }
    setPasswordBusy(true);
    setNotice("");
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      toast.success("Password updated successfully");
    } catch (caught) {
      setNotice(getErrorMessage(caught));
    } finally {
      setPasswordBusy(false);
    }
  };

  return (
    <>
      <AccountHeader icon={<UserRound />} eyebrow="Account" title="Profile" copy="Review your institutional account, profile picture, and sign-in security." />
      {profileError ? <PeasErrorState title="Unable to load your profile" message={profileError} onRetry={loadProfile} /> : null}
      {notice ? <div className="peas-account-notice" role="status">{notice}</div> : null}
      <div className="peas-profile-grid">
        <section className="peas-profile-card peas-profile-card--identity">
          <div className="peas-profile-card__heading"><div><span className="peas-account-eyebrow">Institutional account</span><h2>Profile details</h2></div><span className="peas-profile-role">{formatRole(profile?.role || session?.role)}</span></div>
          <div className="peas-profile-identity">
            <div className="peas-profile-avatar">{imageUrl ? <img src={imageUrl} alt={`${name}'s profile`} /> : <UserRound aria-hidden="true" />}</div>
            <div><strong>{name}</strong><span>{profile?.email || session?.user?.email || "Email unavailable"}</span><small>Account ID: {profile?.id || session?.userId || "Unavailable"}</small></div>
          </div>
          <dl className="peas-profile-details"><div><dt>Name</dt><dd>{name}</dd></div><div><dt>Email</dt><dd>{profile?.email || session?.user?.email || "Not provided"}</dd></div><div><dt>Member since</dt><dd>{profile?.created_at ? formatDate(profile.created_at) : "Unavailable"}</dd></div></dl>
          <label className="peas-profile-upload" aria-busy={uploadBusy}><span><ImagePlus aria-hidden="true" /> Update profile picture</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploadBusy} onChange={(event) => void chooseImage(event.currentTarget.files?.[0])} /><span className="peas-profile-upload__surface"><Upload aria-hidden="true" /> {uploadBusy ? "Uploading…" : "Choose an image"}</span><small>JPEG, PNG, or WebP · maximum 5 MB</small></label>
        </section>
        <section className="peas-profile-card peas-profile-card--security">
          <div className="peas-profile-card__heading"><div><span className="peas-account-eyebrow">Sign-in security</span><h2>Password</h2></div><LockKeyhole aria-hidden="true" /></div>
          {profile ? canChangePassword ? <form className="peas-password-form" onSubmit={submitPassword}><PasswordField label="Current password" value={currentPassword} onChange={setCurrentPassword} visible={showCurrent} onToggle={() => setShowCurrent((value) => !value)} autoComplete="current-password" /><PasswordField label="New password" value={newPassword} onChange={setNewPassword} visible={showNew} onToggle={() => setShowNew((value) => !value)} autoComplete="new-password" /><PasswordField label="Confirm new password" value={confirmPassword} onChange={setConfirmPassword} visible={showConfirm} onToggle={() => setShowConfirm((value) => !value)} autoComplete="new-password" /><div className="peas-password-requirements" aria-live="polite"><span className={passwordChecks[0] ? "is-valid" : ""}>{passwordChecks[0] ? <Check aria-hidden="true" /> : <X aria-hidden="true" />} At least 8 characters</span><span className={passwordChecks[1] ? "is-valid" : ""}>{passwordChecks[1] ? <Check aria-hidden="true" /> : <X aria-hidden="true" />} Contains a number</span><span className={passwordChecks[2] ? "is-valid" : ""}>{passwordChecks[2] ? <Check aria-hidden="true" /> : <X aria-hidden="true" />} Contains a symbol</span></div><Button type="submit" disabled={passwordBusy}>{passwordBusy ? <PeasInlineSpinner label="Updating" /> : <><KeyRound aria-hidden="true" /> Update password</>}</Button></form> : <div className="peas-profile-managed"><LockKeyhole aria-hidden="true" /><h3>Password managed by your institution</h3><p>This account signs in through Microsoft. Manage your password through your university identity provider.</p></div> : <div className="peas-profile-managed"><PeasInlineSpinner label="Loading security options" /></div>}
        </section>
      </div>
    </>
  );
}

function PasswordField({ label, value, onChange, visible, onToggle, autoComplete }: { label: string; value: string; onChange: (value: string) => void; visible: boolean; onToggle: () => void; autoComplete: string }) {
  return <label className="peas-password-field"><span>{label}</span><span><input type={visible ? "text" : "password"} autoComplete={autoComplete} value={value} onChange={(event) => onChange(event.currentTarget.value)} /><button type="button" aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`} onClick={onToggle}>{visible ? <Eye aria-hidden="true" /> : <LockKeyhole aria-hidden="true" />}</button></span></label>;
}

function AccountHeader({ icon, eyebrow, title, copy }: { icon: ReactNode; eyebrow: string; title: string; copy: string }) {
  return <header className="peas-account-header"><div className="peas-account-header__eyebrow">{icon}<span>{eyebrow}</span></div><h1>{title}</h1><p>{copy}</p></header>;
}

function AccountListSkeleton() {
  return <div className="peas-account-record-list" aria-label="Loading account records">{Array.from({ length: 3 }).map((_, index) => <div className="peas-account-record peas-account-record--skeleton" key={index}><span /><div><span /><span /><span /></div><span /></div>)}</div>;
}

function passwordRequirements(password: string) {
  return [password.length >= 8, /\d/.test(password), /[^A-Za-z0-9]/.test(password)];
}

function readAccountSearch() {
  const params = new URLSearchParams(window.location.search);
  return { page: Math.max(1, Number(params.get("page") || 1) || 1), query: params.get("search") || "", category: params.get("category") || "all", sort: params.get("sort") || "", action: params.get("action") || "", startDate: params.get("startDate") || "", endDate: params.get("endDate") || "" };
}

function updateAccountUrl(pageName: string, values: Record<string, unknown>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value && value !== "all" && value !== "saved-newest" && value !== "newest" && value !== 1) params.set(key, String(value));
  }
  const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
  if (window.location.pathname.endsWith(pageName)) window.history.replaceState(null, "", next);
}

function formatCategory(value: unknown) {
  const text = String(value || "Research").replace(/_/g, " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatRole(value: unknown) {
  const role = String(value || "user").toLowerCase();
  return role === "admin" ? "Administrator" : role === "publisher" ? "Publisher" : "Registered user";
}

function formatDate(value: unknown) {
  const date = new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function profileImageUrl(value: unknown) {
  const raw = String(value || "");
  if (!raw) return "";
  return raw.startsWith("/") ? raw : `/${raw}`;
}
