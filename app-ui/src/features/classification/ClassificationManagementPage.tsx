import { useEffect, useState } from "react";
import { CheckCircle2, Plus, RefreshCw, Save, XCircle } from "lucide-react";
import { AdminPageHeader } from "../../components/layout/AdminPageHeader";
import { PeasToaster, toast } from "../../components/ui/toast";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { fetchAdminResearchAgendas, fetchAdminTopics, createAdminResearchAgenda, createAdminTopic, reviewAdminTopic, updateAdminResearchAgenda, fetchClassificationMigrationReview, resolveClassificationMigrationReview, type ClassificationMigrationReview } from "../../lib/api/upload";
import { apiFetch } from "../../lib/api/http";
import { getErrorMessage } from "../../lib/api/http";

type Agenda = { id: number; code?: string; name: string; is_active?: boolean };
type Topic = { id: number; name: string; status?: string };

export function ClassificationManagementPage() {
  const [agendas, setAgendas] = useState<Agenda[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [status, setStatus] = useState("all");
  const [summary, setSummary] = useState({ missingDocuments: 0, pendingMigration: 0 });
  const [reviews, setReviews] = useState<ClassificationMigrationReview[]>([]);
  const [reviewTargets, setReviewTargets] = useState<Record<string, string>>({});
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [agendaDraft, setAgendaDraft] = useState({ code: "", name: "", description: "" });
  const [topicDraft, setTopicDraft] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    try {
      const [nextAgendas, nextTopics, nextSummary, nextReviews] = await Promise.all([
        fetchAdminResearchAgendas(),
        fetchAdminTopics(status),
        apiFetch<typeof summary>("/api/admin/classification/summary"),
        fetchClassificationMigrationReview(),
      ]);
      setAgendas(nextAgendas);
      setTopics(nextTopics);
      setSummary(nextSummary);
      setReviews(nextReviews);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { void load(); }, [status]);

  async function saveAgenda(id: number, payload: Record<string, unknown>) {
    try {
      await updateAdminResearchAgenda(id, payload);
      toast.success("Research agenda updated.");
      await load();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  async function addAgenda() {
    if (!agendaDraft.code.trim() || !agendaDraft.name.trim()) return;
    try {
      await createAdminResearchAgenda({ ...agendaDraft, sortOrder: agendas.length + 1 });
      setAgendaDraft({ code: "", name: "", description: "" });
      toast.success("Research agenda added.");
      await load();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  async function addTopic() {
    if (!topicDraft.trim()) return;
    try {
      await createAdminTopic(topicDraft);
      setTopicDraft("");
      toast.success("Approved topic added.");
      await load();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  async function reviewTopic(id: number, decision: "approve" | "reject") {
    try {
      await reviewAdminTopic(id, decision);
      toast.success(decision === "approve" ? "Topic approved." : "Topic retired.");
      await load();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  async function resolveReview(review: ClassificationMigrationReview, selectedDecision: "agenda" | "topic" | "keyword" | "discard") {
    const key = `${review.document_id}-${review.legacy_research_agenda_id}`;
    const selectedTarget = Number(reviewTargets[key] ?? review.target_id ?? 0);
    try {
      await resolveClassificationMigrationReview(review.document_id, review.legacy_research_agenda_id, { decision: selectedDecision, targetId: selectedTarget || undefined, notes: reviewNotes[key] });
      toast.success("Migration item resolved.");
      await load();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  return <main className="peas-admin-island peas-classification-management">
    <PeasToaster />
    <AdminPageHeader eyebrow="Metadata governance" title="Classification Management" description="Keep official research agendas, approved topics, and normalized keywords distinct across the repository." actions={<Button variant="outline" onClick={() => void load()} disabled={busy}><RefreshCw aria-hidden="true" /> Refresh</Button>} />
    <div className="peas-classification-summary" aria-label="Classification integrity summary">
      <div><strong>{agendas.filter((agenda) => agenda.is_active !== false).length}</strong><span>active official agendas</span></div>
      <div><strong>{summary.missingDocuments}</strong><span>public documents missing required classification</span></div>
      <div><strong>{summary.pendingMigration}</strong><span>migration items awaiting review</span></div>
    </div>
    <section className="peas-classification-management__section">
      <header><div><h2>Official research agendas</h2><p>Administrators manage the canonical institutional list. Existing associations retain history when an agenda is deactivated.</p></div></header>
      <div className="peas-classification-create-row"><Input aria-label="Agenda code" placeholder="RA-21" value={agendaDraft.code} onChange={(event) => setAgendaDraft({ ...agendaDraft, code: event.currentTarget.value })} /><Input aria-label="Agenda name" placeholder="Agenda name" value={agendaDraft.name} onChange={(event) => setAgendaDraft({ ...agendaDraft, name: event.currentTarget.value })} /><Button onClick={() => void addAgenda()} disabled={busy || !agendaDraft.code.trim() || !agendaDraft.name.trim()}><Plus aria-hidden="true" /> Add agenda</Button></div>
      <div className="peas-classification-list">{agendas.map((agenda, index) => <div className="peas-classification-row" key={agenda.id}><span className="peas-classification-row__order">{String(index + 1).padStart(2, "0")}</span><div><strong>{agenda.code}</strong><span>{agenda.name}</span></div><Badge tone={agenda.is_active === false ? "slate" : "green"}>{agenda.is_active === false ? "Inactive" : "Active"}</Badge><Button size="sm" variant="outline" onClick={() => void saveAgenda(agenda.id, { isActive: agenda.is_active === false })}>{agenda.is_active === false ? "Activate" : "Deactivate"}</Button></div>)}</div>
    </section>
    <section className="peas-classification-management__section">
      <header><div><h2>Topics</h2><p>Publishers propose topics; administrators approve, retire, or later merge them.</p></div><div className="peas-classification-tabs">{["all", "pending", "approved", "retired"].map((item) => <Button key={item} size="sm" variant={status === item ? "default" : "outline"} onClick={() => setStatus(item)}>{item}</Button>)}</div></header>
      <div className="peas-classification-create-row"><Input aria-label="New approved topic" placeholder="Create approved topic" value={topicDraft} onChange={(event) => setTopicDraft(event.currentTarget.value)} onKeyDown={(event) => { if (event.key === "Enter") void addTopic(); }} /><Button onClick={() => void addTopic()} disabled={busy || !topicDraft.trim()}><Plus aria-hidden="true" /> Add topic</Button></div>
      <div className="peas-classification-list">{topics.map((topic) => <div className="peas-classification-row" key={topic.id}><div><strong>{topic.name}</strong><span>ID {topic.id}</span></div><Badge tone={topic.status === "approved" ? "green" : topic.status === "pending" ? "gold" : "slate"}>{topic.status ?? "unknown"}</Badge>{topic.status === "pending" ? <><Button size="sm" onClick={() => void reviewTopic(topic.id, "approve")}><CheckCircle2 aria-hidden="true" /> Approve</Button><Button size="sm" variant="outline" onClick={() => void reviewTopic(topic.id, "reject")}><XCircle aria-hidden="true" /> Retire</Button></> : null}</div>)}</div>
    </section>
    <section className="peas-classification-management__section">
      <header><div><h2>Legacy migration review</h2><p>Resolve ambiguous legacy values one association at a time. Applying a decision changes classifications transactionally and preserves this review record.</p></div></header>
      <div className="peas-classification-list">{reviews.length ? reviews.map((review) => { const key = `${review.document_id}-${review.legacy_research_agenda_id}`; return <div className="peas-classification-row peas-classification-row--review" key={key}><div><strong>{review.legacy_value}</strong><span>{review.document_title ?? "Document"} · suggested {review.suggested_type ?? "review"}</span></div>{review.suggested_type === "agenda" && review.target_id ? <Button size="sm" onClick={() => void resolveReview(review, "agenda")}>Map agenda</Button> : null}<select aria-label={`Migration target for ${review.legacy_value}`} value={reviewTargets[key] ?? ""} onChange={(event) => setReviewTargets({ ...reviewTargets, [key]: event.currentTarget.value })}><option value="">Choose target</option>{review.suggested_type === "topic" ? topics.filter((topic) => topic.status === "approved").map((topic) => <option value={topic.id} key={topic.id}>{topic.name}</option>) : null}</select>{review.suggested_type === "topic" ? <Button size="sm" disabled={!reviewTargets[key]} onClick={() => void resolveReview(review, "topic")}>Map topic</Button> : null}<Button size="sm" variant="outline" onClick={() => void resolveReview(review, "keyword")}>Map keyword</Button><Input aria-label={`Discard reason for ${review.legacy_value}`} placeholder="Discard reason" value={reviewNotes[key] ?? ""} onChange={(event) => setReviewNotes({ ...reviewNotes, [key]: event.currentTarget.value })} /><Button size="sm" variant="outline" disabled={!reviewNotes[key]?.trim()} onClick={() => void resolveReview(review, "discard")}>Discard</Button></div>; }) : <p>No unresolved migration associations.</p>}</div>
    </section>
  </main>;
}
