import { useEffect, useState, type FormEvent } from "react";
import { BookOpen, CalendarDays, Check, Download, FileText, LockKeyhole, UserRound, X } from "lucide-react";
import { AuthorPreviewLink } from "../../components/public/AuthorPreviewLink";
import { PublicErrorPage, PublicPageShell } from "../../components/public/PublicPageShell";
import { PeasInlineSpinner } from "../../components/feedback/PeasStates";
import { usePublicSession } from "../../components/public/PublicSessionProvider";
import { Button } from "../../components/ui/button";
import { addSavedDocument, checkSavedDocument, type LooseRecord } from "../../lib/api/account";
import { getErrorMessage } from "../../lib/api/http";
import { PeasToaster, toast } from "../../components/ui/toast";
import { fetchPublicDocumentDetail, getPublicDocumentErrorStatus, submitDocumentAccessRequest } from "../../lib/api/publicDocument";
import { HybridPaperViewer } from "../../components/public/HybridPaperViewer";

export function PublicDocumentDetailPage() {
  const { session, loading: sessionLoading } = usePublicSession();
  const id = new URLSearchParams(window.location.search).get("id") ?? new URLSearchParams(window.location.hash.replace(/^#/, "")).get("id") ?? "";
  const routeCompiled = window.location.pathname.includes("compiled");
  const [detail, setDetail] = useState<{ record: LooseRecord; children: LooseRecord[]; authors: LooseRecord[]; compiled: boolean } | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  useEffect(() => {
    if (sessionLoading) return;
    setErrorStatus(null);
    if (!id) { setErrorStatus(400); return; }
    fetchPublicDocumentDetail(id, routeCompiled, Boolean(session?.authenticated))
      .then(setDetail)
      .catch((caught) => setErrorStatus(getPublicDocumentErrorStatus(caught)));
  }, [id, routeCompiled, session?.authenticated, sessionLoading]);

  if (errorStatus) return <PublicErrorPage status={errorStatus} />;

  return <PublicPageShell mainClassName="peas-document-detail-page">{detail ? <DocumentContent id={id} detail={detail} authenticated={Boolean(session?.authenticated)} onRequest={() => setRequestOpen(true)} /> : <p>Loading document details…</p>}{requestOpen && detail ? <AccessRequestDialog id={id} title={titleOf(detail.record)} onClose={() => setRequestOpen(false)} /> : null}</PublicPageShell>;
}

function DocumentContent({ id, detail, authenticated, onRequest }: { id: string; detail: { record: LooseRecord; children: LooseRecord[]; authors: LooseRecord[]; compiled: boolean }; authenticated: boolean; onRequest: () => void }) {
  const item = detail.record;
  const [saved, setSaved] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState("");
  const authorReferences: LooseRecord[] = detail.authors.length ? detail.authors : authorNames(item).map((name) => ({ full_name: name }));
  const [authorRefreshKey, setAuthorRefreshKey] = useState(0);
  const topics = arrayStrings(item.topics).concat(arrayStrings(item.keywords));
  const readUrl = detail.compiled ? `/api/compiled-documents/${encodeURIComponent(id)}/foreword` : `/api/papers/${encodeURIComponent(id)}/stream?download=true`;
  useEffect(() => {
    if (!authenticated) return;
    checkSavedDocument(id, detail.compiled ? "compiled" : "document")
      .then((result) => setSaved(Boolean(result.inLibrary)))
      .catch((caught) => setSaveError(getErrorMessage(caught)));
  }, [authenticated, detail.compiled, id]);

  const toggleSaved = async () => {
    if (saved) return;
    setSaveBusy(true);
    setSaveError("");
    try {
      await addSavedDocument(id, detail.compiled ? "compiled" : "document");
      setSaved(true);
      setAuthorRefreshKey((current) => current + 1);
      toast.success("Saved to your library");
    } catch (caught) {
      if (caught && typeof caught === "object" && "status" in caught && Number((caught as { status?: number }).status) === 409) {
        setSaved(true);
      } else {
        setSaveError(getErrorMessage(caught));
      }
    } finally {
      setSaveBusy(false);
    }
  };

  return <><PeasToaster /><header className="peas-document-hero"><h1>{titleOf(item)}</h1><div className="peas-document-hero__meta"><div className="peas-document-authors" aria-label="Authors">{authorReferences.map((author, index) => <AuthorPreviewLink key={String(author.id ?? author.full_name ?? index)} author={author} refreshKey={authorRefreshKey} />)}</div>{item.publication_date || item.year || item.start_year ? <span className="peas-document-hero__date"><CalendarDays aria-hidden="true" /> {String(item.year || item.start_year || new Date(String(item.publication_date)).getFullYear())}</span> : null}</div></header><section className="peas-document-abstract"><h2>{detail.compiled ? "Collection overview" : "Abstract"}</h2><p>{String(item.abstract || item.abstract_foreword || item.foreword || item.description || "No abstract or overview is available for this record.")}</p></section>{topics.length ? <section className="peas-document-topics"><h2>Topics and keywords</h2><div className="peas-document-tags">{topics.map((topic) => <a key={topic} href={`/pages/searchResultsPage.html?keyword=${encodeURIComponent(topic)}`}>{topic}</a>)}</div></section> : null}<div className="peas-document-layout"><article><DocumentAccessPanel authenticated={authenticated} compiled={detail.compiled} readUrl={readUrl} onRequest={onRequest} saved={saved} saveBusy={saveBusy} saveError={saveError} toggleSaved={toggleSaved} />{!detail.compiled ? <HybridPaperViewer paperId={id} title={titleOf(item)} authenticated={authenticated} pageCount={item.pages} /> : null}{detail.compiled ? <section><h2>Documents in this collection</h2>{detail.children.length ? <div className="peas-document-children">{detail.children.map((child, index) => { const childId = String(child.id || child.doc_id || index); return <article key={childId}><FileText aria-hidden="true" /><div><h3>{titleOf(child)}</h3><p>{authorNames(child).join(", ") || String(child.category || child.document_type || "Research document")}</p></div><a href={`/pages/${authenticated ? "user" : "guest"}-single.html?id=${encodeURIComponent(childId)}`}>Details</a></article>; })}</div> : <p>No child records were returned.</p>}</section> : null}</article></div></>;
}

function DocumentAccessPanel({ authenticated, compiled, readUrl, onRequest, saved, saveBusy, saveError, toggleSaved }: { authenticated: boolean; compiled: boolean; readUrl: string; onRequest: () => void; saved: boolean; saveBusy: boolean; saveError: string; toggleSaved: () => Promise<void> }) {
  return <section className={`peas-document-access-popup${authenticated ? " is-authenticated" : ""}`} aria-labelledby="document-access-title"><header><div><BookOpen aria-hidden="true" /><h2 id="document-access-title">{authenticated ? "PDF Controls" : "Document Access"}</h2></div>{authenticated ? <a className="peas-document-primary-action" href={readUrl} {...(compiled ? { target: "_blank", rel: "noopener" } : {})}><Download aria-hidden="true" /> {compiled ? "Download foreword" : "Download PDF"}</a> : null}</header>{authenticated ? <><Button variant="outline" disabled={saveBusy || saved} aria-pressed={saved} onClick={toggleSaved}>{saved ? <><Check aria-hidden="true" /> Saved</> : saveBusy ? <PeasInlineSpinner label="Saving" /> : <><BookOpen aria-hidden="true" /> Save for later</>}</Button>{saveError ? <p className="peas-document-save-error" role="alert">{saveError}</p> : null}</> : <><p>Preview the paper as images, or sign in for selectable text and full-PDF downloads.</p><Button onClick={onRequest}><LockKeyhole aria-hidden="true" /> Request access</Button><a href={`/log-in.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`}>Already have an account? Sign in</a></>}</section>;
}

function AccessRequestDialog({ id, title, onClose }: { id: string; title: string; onClose: () => void }) {
  const [form, setForm] = useState({ fullName: "", email: "", affiliation: "", reason: "Academic research", details: "" }); const [busy, setBusy] = useState(false); const [notice, setNotice] = useState("");
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); setNotice(""); try { const result = await submitDocumentAccessRequest({ document_id: id, full_name: form.fullName.trim(), email: form.email.trim(), affiliation: form.affiliation.trim(), reason: form.reason, reason_details: form.details.trim() || `Request for access based on: ${form.reason}` }); setNotice(`Request received${result.id ? ` (REQ-${result.id})` : ""}. Check your email for updates.`); } catch (caught) { setNotice(getErrorMessage(caught)); } finally { setBusy(false); } };
  return <div className="peas-request-backdrop"><section className="peas-request-dialog" role="dialog" aria-modal="true" aria-labelledby="request-title"><header><div><span>Request access</span><h2 id="request-title">{title}</h2></div><button type="button" aria-label="Close" onClick={onClose}><X aria-hidden="true" /></button></header>{notice ? <div role="status">{notice}</div> : null}<form onSubmit={submit}><label>Full name<input required maxLength={160} value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.currentTarget.value })} /></label><label>Email<input required type="email" maxLength={254} value={form.email} onChange={(event) => setForm({ ...form, email: event.currentTarget.value })} /></label><label>Affiliation<input required maxLength={200} value={form.affiliation} onChange={(event) => setForm({ ...form, affiliation: event.currentTarget.value })} /></label><label>Reason<select value={form.reason} onChange={(event) => setForm({ ...form, reason: event.currentTarget.value })}><option>Academic research</option><option>Teaching or instruction</option><option>Personal study</option><option>Other</option></select></label><label>Details<textarea rows={4} value={form.details} onChange={(event) => setForm({ ...form, details: event.currentTarget.value })} /></label><label className="peas-request-consent"><input required type="checkbox" /> I agree to the PeAS <a href="/pages/miscellaneous/T&A-Public.html" target="_blank" rel="noreferrer">Terms and Conditions</a>.</label><Button disabled={busy}>{busy ? "Submitting…" : "Submit request"}</Button></form></section></div>;
}

function titleOf(item: LooseRecord) { return String(item.title || item.document_title || `${item.category || "Document"}${item.volume ? ` Volume ${item.volume}` : ""}`); }
function authorNames(item: LooseRecord) { const direct = arrayStrings(item.author_names); if (direct.length) return direct; const nested = item.authors ?? item.enhancedAuthors ?? item.document_authors; return Array.isArray(nested) ? nested.map((author: any) => String(author.full_name || author.name || author.author_name || author.author?.full_name || "")).filter(Boolean) : []; }
function arrayStrings(value: unknown): string[] { return Array.isArray(value) ? value.map((item: any) => typeof item === "string" ? item : String(item.name || item.keyword || item.text || "")).filter(Boolean) : []; }
