import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Check, CheckCircle2, ChevronLeft, ChevronRight, FilePlus2, ListPlus, Plus, Trash2, UploadCloud, X } from "lucide-react";
import { getErrorMessage } from "../../lib/api/http";
import { fetchAuthors } from "../../lib/api/authors";
import type { AuthorRecord } from "../../lib/api/types";
import type { DocumentAuthorSelection } from "../../lib/authorSelection";
import {
  createCompiledDocumentRecord,
  createDocumentRecord,
  linkDocumentAuthors,
  linkDocumentsToCompilation,
  linkResearchAgenda,
  uploadFile,
  type UploadedFileResult,
} from "../../lib/api/upload";
import { PeasField } from "../../components/forms/PeasField";
import { DocumentAuthorPicker } from "../../components/forms/DocumentAuthorPicker";
import { PeasFileDropzone } from "../../components/forms/PeasFileDropzone";
import { PeasToaster, toast } from "../../components/ui/toast";
import { AdminPageHeader } from "../../components/layout/AdminPageHeader";
import { useAdminIdentity } from "../../components/layout/AdminLayout";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { PeasIconButton } from "../../components/ui/peas-button";

type UploadMode = "single" | "compiled";
type UploadStep = 1 | 2 | 3;
type SingleCategory = "THESIS" | "DISSERTATION";
type CompiledCategory = "CONFLUENCE" | "SYNERGY";
type FieldErrors = Record<string, string>;

interface SingleFormState {
  title: string;
  authors: DocumentAuthorSelection[];
  pubMonth: string;
  pubYear: string;
  keywords: string;
  category: SingleCategory;
  file: File | null;
}

interface ResearchSection {
  id: string;
  title: string;
  authors: DocumentAuthorSelection[];
  keywords: string;
  abstract: string;
  file: File | null;
}

interface CompiledFormState {
  category: CompiledCategory;
  startYear: string;
  endYear: string;
  volume: string;
  issueNumber: string;
  department: string;
  forewordFile: File | null;
  sections: ResearchSection[];
}

interface UploadReceipt {
  type: UploadMode;
  title: string;
  documentId?: number;
  compiledDocumentId?: number;
  childDocumentIds?: number[];
  pendingReview: boolean;
}

const MONTHS = [
  ["01", "January"], ["02", "February"], ["03", "March"], ["04", "April"], ["05", "May"], ["06", "June"],
  ["07", "July"], ["08", "August"], ["09", "September"], ["10", "October"], ["11", "November"], ["12", "December"],
];

const DEPARTMENTS = [
  "College of Business in Information Technology",
  "College of Nursing",
  "College of Arts and Science Education",
  "Basic Academic Education",
];

const initialSingleForm: SingleFormState = {
  title: "", authors: [], pubMonth: "", pubYear: "", keywords: "", category: "THESIS", file: null,
};

const initialCompiledForm: CompiledFormState = {
  category: "CONFLUENCE", startYear: "", endYear: "", volume: "", issueNumber: "", department: "", forewordFile: null,
  sections: [createResearchSection()],
};

const singleSteps = ["Document details", "Publication & PDF", "Review"];
const compiledSteps = ["Publication details", "Studies", "Review"];

export function UploadDocumentPage() {
  const { role } = useAdminIdentity();
  const isPublisher = role === "publisher";
  const [mode, setMode] = useState<UploadMode>("single");
  const [step, setStep] = useState<UploadStep>(1);
  const [singleForm, setSingleForm] = useState<SingleFormState>(initialSingleForm);
  const [compiledForm, setCompiledForm] = useState<CompiledFormState>(initialCompiledForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busyStep, setBusyStep] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<UploadReceipt | null>(null);
  const [authors, setAuthors] = useState<AuthorRecord[]>([]);

  useEffect(() => {
    void fetchAuthors().then(setAuthors).catch(() => setAuthors([]));
  }, []);

  const busy = Boolean(busyStep);
  const compiledTitle = useMemo(() => {
    const category = compiledForm.category === "CONFLUENCE" ? "Confluence" : "Synergy";
    const volume = compiledForm.volume ? ` Vol. ${compiledForm.volume}` : "";
    const range = compiledForm.startYear || compiledForm.endYear
      ? ` (${compiledForm.startYear || "?"}-${compiledForm.endYear || compiledForm.startYear || "?"})`
      : "";
    return `${category}${volume}${range}`;
  }, [compiledForm]);

  function changeMode(nextMode: UploadMode) {
    if (busy) return;
    setMode(nextMode);
    setStep(1);
    setErrors({});
    setSubmissionError(null);
  }

  function continueWorkflow() {
    const nextErrors = mode === "single"
      ? validateSingleForStep(singleForm, step)
      : validateCompiledForStep(compiledForm, step);
    setErrors(nextErrors);
    setSubmissionError(null);
    if (Object.keys(nextErrors).length > 0) {
      focusFirstError(nextErrors);
      return;
    }
    setStep((current) => Math.min(3, current + 1) as UploadStep);
  }

  function goBack() {
    if (!busy) setStep((current) => Math.max(1, current - 1) as UploadStep);
  }

  function editStep(target: UploadStep) {
    if (!busy) {
      setStep(target);
      setErrors({});
      setSubmissionError(null);
    }
  }

  function markError(key: string, error?: string) {
    if (!error) {
      setErrors((current) => {
        if (!current[key]) return current;
        const next = { ...current };
        delete next[key];
        return next;
      });
      return;
    }
    setErrors((current) => ({ ...current, [key]: error }));
  }

  async function handleSingleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateSingleForStep(singleForm, 3);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      focusFirstError(nextErrors);
      return;
    }
    setReceipt(null);
    setSubmissionError(null);
    try {
      setBusyStep("Uploading PDF…");
      const upload = await uploadDocumentPdf(singleForm.file, singleForm.category, singleForm.category);
      setBusyStep("Creating document record…");
      const document = await createDocumentRecord({
        title: singleForm.title.trim(),
        abstract: upload.metadata?.abstract || "Abstract will be processed by the server.",
        publication_date: buildPublicationDate(singleForm.pubYear, singleForm.pubMonth),
        file_path: upload.filePath,
        is_public: true,
        document_type: singleForm.category,
        research_agenda: singleForm.keywords.trim() || null,
        category_id: null,
        pages: upload.metadata?.pageCount ?? upload.metadata?.pages ?? 0,
      });
      setBusyStep("Linking authors and keywords…");
      await linkDocumentAuthors(document.id, singleForm.authors);
      await linkResearchAgenda(document.id, parseList(singleForm.keywords, ","));
      await fetchAuthors().then(setAuthors).catch(() => undefined);
      const pendingReview = document.review_status === "pending_review";
      setReceipt({ type: "single", title: singleForm.title.trim(), documentId: document.id, pendingReview });
      setSingleForm(initialSingleForm);
      toast.success(pendingReview ? "Document submitted for administrator review." : "Document published successfully.");
    } catch (error) {
      const message = getErrorMessage(error);
      setSubmissionError(message);
      toast.error(message);
    } finally {
      setBusyStep(null);
    }
  }

  async function handleCompiledSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateCompiledForStep(compiledForm, 3);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      focusFirstError(nextErrors);
      return;
    }
    setReceipt(null);
    setSubmissionError(null);
    try {
      const documentType = compiledForm.category;
      let foreword: UploadedFileResult | null = null;
      if (compiledForm.forewordFile) {
        setBusyStep("Uploading foreword…");
        foreword = await uploadDocumentPdf(compiledForm.forewordFile, documentType, compiledForm.category, true);
      }
      setBusyStep("Creating compiled publication…");
      const compiled = await createCompiledDocumentRecord({
        compiledDoc: {
          start_year: safeInt(compiledForm.startYear),
          end_year: safeInt(compiledForm.endYear),
          volume: safeInt(compiledForm.volume),
          issue_number: compiledForm.category === "SYNERGY" ? null : safeInt(compiledForm.issueNumber),
          department: compiledForm.category === "SYNERGY" ? compiledForm.department || null : null,
          category: compiledForm.category,
          foreword: foreword?.filePath ?? null,
          abstract_foreword: foreword?.metadata?.abstract ?? null,
        },
        documentIds: [],
      });
      const childDocumentIds: number[] = [];
      const sectionsWithFiles = compiledForm.sections.filter((section) => section.file);
      for (const [index, section] of sectionsWithFiles.entries()) {
        setBusyStep(`Uploading study ${index + 1} of ${sectionsWithFiles.length}…`);
        const upload = await uploadDocumentPdf(section.file, documentType, compiledForm.category);
        setBusyStep(`Creating study ${index + 1} of ${sectionsWithFiles.length}…`);
        const childDocument = await createDocumentRecord({
          title: section.title.trim(),
          abstract: section.abstract.trim() || upload.metadata?.abstract || "No abstract provided",
          publication_date: new Date().toISOString().slice(0, 10),
          document_type: documentType,
          file_path: upload.filePath,
          category_id: compiledForm.category === "CONFLUENCE" ? 3 : 4,
          pages: upload.metadata?.pageCount ?? upload.metadata?.pages ?? 0,
          is_public: true,
          compiled_parent_id: compiled.id,
        });
        childDocumentIds.push(childDocument.id);
        await linkDocumentAuthors(childDocument.id, section.authors);
        await linkResearchAgenda(childDocument.id, parseList(section.keywords, ","));
      }
      await fetchAuthors().then(setAuthors).catch(() => undefined);
      setBusyStep("Linking studies to publication…");
      await linkDocumentsToCompilation(compiled.id, childDocumentIds);
      const pendingReview = compiled.reviewStatus === "pending_review";
      setReceipt({ type: "compiled", title: compiledTitle, compiledDocumentId: compiled.id, childDocumentIds, pendingReview });
      setCompiledForm({ ...initialCompiledForm, sections: [createResearchSection()] });
      toast.success(pendingReview ? "Publication submitted for administrator review." : "Publication published successfully.");
    } catch (error) {
      const message = getErrorMessage(error);
      setSubmissionError(message);
      toast.error(message);
    } finally {
      setBusyStep(null);
    }
  }

  const steps = mode === "single" ? singleSteps : compiledSteps;
  const actionLabel = isPublisher
    ? (mode === "single" ? "Submit document for review" : "Submit publication for review")
    : (mode === "single" ? "Publish document" : "Publish publication");

  return (
    <main className="peas-admin-island peas-upload-page">
      <PeasToaster />
      <AdminPageHeader
        eyebrow="Repository workflow"
        title="Upload Document"
        description="Follow the steps to add one paper or build a compiled publication."
        actions={<Badge tone={mode === "single" ? "green" : "gold"}>{mode === "single" ? "Single" : "Compiled"}</Badge>}
      />

      <section className="peas-upload-shell">
        <div className="peas-upload-main">
          <Tabs value={mode} onValueChange={(value) => changeMode(value as UploadMode)}>
            <TabsList aria-label="Choose upload type" className="peas-upload-mode-tabs">
              <TabsTrigger value="single" disabled={busy}>
                <FilePlus2 aria-hidden="true" />
                <span><strong>Single document</strong><small>One thesis or dissertation PDF</small></span>
              </TabsTrigger>
              <TabsTrigger value="compiled" disabled={busy}>
                <ListPlus aria-hidden="true" />
                <span><strong>Compiled publication</strong><small>Confluence or Synergy with studies</small></span>
              </TabsTrigger>
            </TabsList>

            <UploadProgress mode={mode} step={step} steps={steps} busy={busy} onStepChange={editStep} />

            <TabsContent value="single">
              <form className="peas-upload-form" onSubmit={handleSingleSubmit} noValidate>
                {receipt?.type === "single" ? (
                  <CompletionPanel receipt={receipt} isPublisher={isPublisher} onUploadAnother={() => { setReceipt(null); setStep(1); setErrors({}); setSubmissionError(null); }} />
                ) : (
                  <>
                    <SingleDocumentForm form={singleForm} step={step} errors={errors} busy={busy} authors={authors} onAuthorCreated={(author) => setAuthors((current) => [...current, author])} onChange={setSingleForm} onError={markError} />
                    {submissionError ? <SubmissionError message={submissionError} /> : null}
                    <UploadActions step={step} busy={busy} busyStep={busyStep} label={actionLabel} onBack={goBack} onContinue={continueWorkflow} />
                  </>
                )}
              </form>
            </TabsContent>

            <TabsContent value="compiled">
              <form className="peas-upload-form" onSubmit={handleCompiledSubmit} noValidate>
                {receipt?.type === "compiled" ? (
                  <CompletionPanel receipt={receipt} isPublisher={isPublisher} onUploadAnother={() => { setReceipt(null); setStep(1); setErrors({}); setSubmissionError(null); }} />
                ) : (
                  <>
                    <CompiledDocumentForm form={compiledForm} step={step} errors={errors} busy={busy} authors={authors} onAuthorCreated={(author) => setAuthors((current) => [...current, author])} onChange={setCompiledForm} onError={markError} />
                    {submissionError ? <SubmissionError message={submissionError} /> : null}
                    <UploadActions step={step} busy={busy} busyStep={busyStep} label={actionLabel} onBack={goBack} onContinue={continueWorkflow} />
                  </>
                )}
              </form>
            </TabsContent>
          </Tabs>
        </div>

        <UploadChecklist mode={mode} step={step} singleForm={singleForm} compiledForm={compiledForm} compiledTitle={compiledTitle} receipt={receipt?.type === mode ? receipt : null} />
      </section>
    </main>
  );
}

function UploadProgress({ mode, step, steps, busy, onStepChange }: { mode: UploadMode; step: UploadStep; steps: string[]; busy: boolean; onStepChange: (step: UploadStep) => void }) {
  return (
    <nav className="peas-upload-progress" aria-label={`${mode === "single" ? "Single document" : "Compiled publication"} steps`}>
      <p>Step {step} of {steps.length}</p>
      <ol>
        {steps.map((label, index) => {
          const number = (index + 1) as UploadStep;
          const complete = number < step;
          return (
            <li className={number === step ? "is-current" : complete ? "is-complete" : ""} key={label}>
              <button type="button" disabled={busy || number > step} aria-current={number === step ? "step" : undefined} onClick={() => onStepChange(number)}>
                <span>{complete ? <Check aria-hidden="true" /> : number}</span>
                <strong>{label}</strong>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function SingleDocumentForm({ form, step, errors, busy, authors, onAuthorCreated, onChange, onError }: { form: SingleFormState; step: UploadStep; errors: FieldErrors; busy: boolean; authors: AuthorRecord[]; onAuthorCreated: (author: AuthorRecord) => void; onChange: (form: SingleFormState) => void; onError: (key: string, error?: string) => void }) {
  const field = (key: string) => fieldA11y(key, errors[key]);
  return (
    <div className="peas-upload-section">
      {step === 1 ? (
        <WorkflowPanel title="Document details" description="Start with the information readers will use to identify this work.">
          <div className="peas-form-grid peas-form-grid--two">
            <PeasField label="Title" htmlFor="single-title" fieldKey="single.title" required error={errors["single.title"]}>
              <Input id="single-title" {...field("single.title")} value={form.title} disabled={busy} placeholder="Enter document title" onBlur={() => onError("single.title", form.title.trim() ? undefined : "Enter a title.")} onChange={(event) => onChange({ ...form, title: event.currentTarget.value })} />
            </PeasField>
            <PeasField label="Category" fieldKey="single.category" required>
              <Select value={form.category} disabled={busy} onValueChange={(value) => onChange({ ...form, category: value as SingleCategory })}>
                <SelectTrigger aria-label="Single document category"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="THESIS">Thesis</SelectItem><SelectItem value="DISSERTATION">Dissertation</SelectItem></SelectContent>
              </Select>
            </PeasField>
          </div>
          <PeasField label="Authors" htmlFor="single-authors" fieldKey="single.authors" required description="Search the directory or add a new author. Authors are saved in the order selected." error={errors["single.authors"]}>
            <DocumentAuthorPicker id="single-authors" authors={authors} value={form.authors} disabled={busy} onAuthorCreated={onAuthorCreated} onChange={(nextAuthors) => { onChange({ ...form, authors: nextAuthors }); onError("single.authors", undefined); }} />
          </PeasField>
        </WorkflowPanel>
      ) : null}

      {step === 2 ? (
        <WorkflowPanel title="Publication & PDF" description="Add the publication date, search keywords, and the PDF readers will access.">
          <div className="peas-form-grid peas-form-grid--two">
            <PeasField label="Publication month" fieldKey="single.pubMonth" optional>
              <Select value={form.pubMonth || "none"} disabled={busy} onValueChange={(value) => onChange({ ...form, pubMonth: value === "none" ? "" : value })}>
                <SelectTrigger aria-label="Publication month"><SelectValue placeholder="No month" /></SelectTrigger>
                <SelectContent><SelectItem value="none">No month</SelectItem>{MONTHS.map(([value, label]) => <SelectItem value={value} key={value}>{label}</SelectItem>)}</SelectContent>
              </Select>
            </PeasField>
            <PeasField label="Publication year" htmlFor="single-year" fieldKey="single.pubYear" optional error={errors["single.pubYear"]}>
              <Input id="single-year" {...field("single.pubYear")} type="number" min="1000" max="9999" value={form.pubYear} disabled={busy} placeholder="YYYY" onBlur={() => onError("single.pubYear", validateYear(form.pubYear, "Enter a four-digit year."))} onChange={(event) => onChange({ ...form, pubYear: event.currentTarget.value })} />
            </PeasField>
          </div>
          <PeasField label="Keywords" htmlFor="single-keywords" fieldKey="single.keywords" optional description="Separate keywords with semicolons.">
            <KeywordBadgeInput id="single-keywords" value={form.keywords} disabled={busy} placeholder="community health; education; local governance" onChange={(keywords) => onChange({ ...form, keywords })} />
          </PeasField>
          <PeasFileDropzone label="Document PDF" fieldKey="single.file" required file={form.file} error={errors["single.file"]} disabled={busy} description="PDF only. You can choose a file or drag it here." onFileChange={(file) => { onChange({ ...form, file }); onError("single.file", file ? (isPdf(file) ? undefined : "Choose a PDF file.") : "Attach the document PDF."); }} />
        </WorkflowPanel>
      ) : null}

      {step === 3 ? <SingleReview form={form} errors={errors} /> : null}
    </div>
  );
}

function CompiledDocumentForm({ form, step, errors, busy, authors, onAuthorCreated, onChange, onError }: { form: CompiledFormState; step: UploadStep; errors: FieldErrors; busy: boolean; authors: AuthorRecord[]; onAuthorCreated: (author: AuthorRecord) => void; onChange: (form: CompiledFormState) => void; onError: (key: string, error?: string) => void }) {
  const synergy = form.category === "SYNERGY";
  const field = (key: string) => fieldA11y(key, errors[key]);
  function updateSection(id: string, updates: Partial<ResearchSection>) {
    onChange({ ...form, sections: form.sections.map((section) => section.id === id ? { ...section, ...updates } : section) });
  }
  return (
    <div className="peas-upload-section">
      {step === 1 ? (
        <WorkflowPanel title="Publication details" description="Set the identity and date range for this compiled publication. Add a foreword only if one exists.">
          <div className="peas-form-grid peas-form-grid--three">
            <PeasField label="Category" fieldKey="compiled.category" required>
              <Select value={form.category} disabled={busy} onValueChange={(value) => onChange({ ...form, category: value as CompiledCategory })}><SelectTrigger aria-label="Compiled document category"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CONFLUENCE">Confluence</SelectItem><SelectItem value="SYNERGY">Synergy</SelectItem></SelectContent></Select>
            </PeasField>
            <PeasField label="Start year" htmlFor="compiled-start-year" fieldKey="compiled.startYear" optional error={errors["compiled.startYear"]}><Input id="compiled-start-year" {...field("compiled.startYear")} type="number" min="1000" max="9999" value={form.startYear} disabled={busy} placeholder="YYYY" onBlur={() => onError("compiled.startYear", validateYear(form.startYear, "Enter a four-digit year."))} onChange={(event) => onChange({ ...form, startYear: event.currentTarget.value })} /></PeasField>
            <PeasField label="End year" htmlFor="compiled-end-year" fieldKey="compiled.endYear" optional error={errors["compiled.endYear"]}><Input id="compiled-end-year" {...field("compiled.endYear")} type="number" min="1000" max="9999" value={form.endYear} disabled={busy} placeholder="YYYY" onBlur={() => onError("compiled.endYear", validateYear(form.endYear, "Enter a four-digit year."))} onChange={(event) => onChange({ ...form, endYear: event.currentTarget.value })} /></PeasField>
          </div>
          <div className="peas-form-grid peas-form-grid--three">
            <PeasField label="Volume" htmlFor="compiled-volume" fieldKey="compiled.volume" optional><Input id="compiled-volume" value={form.volume} disabled={busy} placeholder="3" onChange={(event) => onChange({ ...form, volume: event.currentTarget.value })} /></PeasField>
            {synergy ? <PeasField label="Department" fieldKey="compiled.department" optional><Select value={form.department || "none"} disabled={busy} onValueChange={(value) => onChange({ ...form, department: value === "none" ? "" : value })}><SelectTrigger aria-label="Synergy department"><SelectValue placeholder="Select department" /></SelectTrigger><SelectContent><SelectItem value="none">No department</SelectItem>{DEPARTMENTS.map((department) => <SelectItem value={department} key={department}>{department}</SelectItem>)}</SelectContent></Select></PeasField> : <PeasField label="Issue number" htmlFor="compiled-issue" fieldKey="compiled.issueNumber" optional><Input id="compiled-issue" value={form.issueNumber} disabled={busy} placeholder="1" onChange={(event) => onChange({ ...form, issueNumber: event.currentTarget.value })} /></PeasField>}
            <PeasFileDropzone label="Foreword PDF" fieldKey="compiled.foreword" file={form.forewordFile} disabled={busy} description="Optional PDF." onFileChange={(file) => { onChange({ ...form, forewordFile: file }); onError("compiled.foreword", file && !isPdf(file) ? "Choose a PDF file." : undefined); }} />
          </div>
        </WorkflowPanel>
      ) : null}

      {step === 2 ? (
        <WorkflowPanel title="Studies" description="Add every study contained in this publication. Each study needs a title and PDF before you can continue.">
          <div className="peas-study-list">
            {form.sections.map((section, index) => {
              const complete = Boolean(section.title.trim() && section.file && isPdf(section.file));
              const sectionError = errors[`compiled.section.${section.id}`];
              return <StudyCard key={section.id} section={section} index={index} complete={complete} errors={errors} sectionError={sectionError} busy={busy} authors={authors} onAuthorCreated={onAuthorCreated} onChange={(updates) => updateSection(section.id, updates)} onError={onError} onRemove={() => { if (!section.title.trim() && !section.file || window.confirm(`Remove Study ${index + 1}?`)) onChange({ ...form, sections: form.sections.filter((item) => item.id !== section.id) }); }} />;
            })}
          </div>
          {errors["compiled.sections"] ? <p className="peas-upload-inline-error" role="alert">{errors["compiled.sections"]}</p> : null}
          <Button type="button" variant="outline" disabled={busy} onClick={() => onChange({ ...form, sections: [...form.sections, createResearchSection()] })}><Plus aria-hidden="true" /> Add study</Button>
        </WorkflowPanel>
      ) : null}

      {step === 3 ? <CompiledReview form={form} title={buildCompiledTitle(form)} errors={errors} /> : null}
    </div>
  );
}

function StudyCard({ section, index, complete, errors, sectionError, busy, authors, onAuthorCreated, onChange, onError, onRemove }: { section: ResearchSection; index: number; complete: boolean; errors: FieldErrors; sectionError?: string; busy: boolean; authors: AuthorRecord[]; onAuthorCreated: (author: AuthorRecord) => void; onChange: (updates: Partial<ResearchSection>) => void; onError: (key: string, error?: string) => void; onRemove: () => void }) {
  const [open, setOpen] = useState(index === 0);
  const titleKey = `compiled.section.${section.id}.title`;
  const fileKey = `compiled.section.${section.id}.file`;
  return (
    <Card className={`peas-study-card${open ? " is-open" : ""}`}>
      <button type="button" className="peas-study-card__summary" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <span className={`peas-study-card__status${complete ? " is-ready" : ""}`}>{complete ? <Check aria-hidden="true" /> : index + 1}</span>
        <span><strong>Study {index + 1}</strong><small>{section.title || section.file?.name || "Add a title and PDF"}</small></span>
        <Badge tone={complete ? "green" : "slate"}>{complete ? "Ready" : "Incomplete"}</Badge>
        <ChevronRight aria-hidden="true" className="peas-study-card__chevron" />
      </button>
      {open ? <CardContent className="peas-study-card__content">
        {sectionError ? <p className="peas-upload-inline-error" role="alert">{sectionError}</p> : null}
        <PeasField label="Study title" htmlFor={`study-title-${section.id}`} fieldKey={titleKey} required error={errors[titleKey]}><Input id={`study-title-${section.id}`} {...fieldA11y(titleKey, errors[titleKey])} value={section.title} disabled={busy} placeholder="Enter study title" onBlur={() => onError(titleKey, section.title.trim() ? undefined : "Enter a study title.")} onChange={(event) => onChange({ title: event.currentTarget.value })} /></PeasField>
        <div className="peas-form-grid peas-form-grid--two">
          <PeasField label="Authors" htmlFor={`study-authors-${section.id}`} fieldKey={`compiled.section.${section.id}.authors`} optional description="Search the directory or add a new author. Authors are saved in the order selected."><DocumentAuthorPicker id={`study-authors-${section.id}`} authors={authors} value={section.authors} disabled={busy} onAuthorCreated={onAuthorCreated} onChange={(nextAuthors) => onChange({ authors: nextAuthors })} /></PeasField>
          <PeasField label="Keywords" htmlFor={`study-keywords-${section.id}`} fieldKey={`compiled.section.${section.id}.keywords`} optional description="Separate keywords with semicolons."><KeywordBadgeInput id={`study-keywords-${section.id}`} value={section.keywords} disabled={busy} placeholder="education; survey; student research" onChange={(keywords) => onChange({ keywords })} /></PeasField>
        </div>
        <PeasField label="Abstract" htmlFor={`study-abstract-${section.id}`} fieldKey={`compiled.section.${section.id}.abstract`} optional><Textarea id={`study-abstract-${section.id}`} value={section.abstract} disabled={busy} rows={4} placeholder="Optional. If blank, PeAS will use extracted PDF metadata when available." onChange={(event) => onChange({ abstract: event.currentTarget.value })} /></PeasField>
        <PeasFileDropzone label="Study PDF" fieldKey={fileKey} required file={section.file} error={errors[fileKey]} disabled={busy} description="PDF only." onFileChange={(file) => { onChange({ file }); onError(fileKey, file ? (isPdf(file) ? undefined : "Choose a PDF file.") : "Attach the study PDF."); }} />
        <Button type="button" variant="ghost" className="peas-study-card__remove" disabled={busy} onClick={onRemove}><Trash2 aria-hidden="true" /> Remove study</Button>
      </CardContent> : null}
    </Card>
  );
}

function SingleReview({ form, errors }: { form: SingleFormState; errors: FieldErrors }) {
  return <ReviewPanel title="Review your document" description="Check the details before the PDF is sent to PeAS.">
    <ReviewRow label="Title" value={form.title || "Not entered"} error={errors["single.title"]} />
    <ReviewRow label="Category" value={form.category === "THESIS" ? "Thesis" : "Dissertation"} />
    <ReviewRow label="Author(s)" value={formatAuthors(form.authors)} error={errors["single.authors"]} />
    <ReviewRow label="Publication" value={form.pubYear ? `${form.pubMonth ? MONTHS.find(([value]) => value === form.pubMonth)?.[1] + " " : ""}${form.pubYear}` : "No publication date"} />
    <ReviewRow label="Keywords" value={form.keywords || "No keywords"} />
    <ReviewRow label="PDF" value={form.file?.name || "Not selected"} error={errors["single.file"]} />
  </ReviewPanel>;
}

function KeywordBadgeInput({ id, value, disabled, placeholder, onChange }: { id: string; value: string; disabled?: boolean; placeholder?: string; onChange: (value: string) => void }) {
  const storedKeywords = parseList(value, ";");
  const [draft, setDraft] = useState("");

  useEffect(() => {
    const lastSeparator = value.lastIndexOf(";");
    setDraft(lastSeparator >= 0 ? value.slice(lastSeparator + 1).trim() : (storedKeywords.length ? "" : value));
  }, [value]);

  const keywords = storedKeywords.filter((keyword) => keyword !== draft.trim());
  const commitDraft = () => {
    const keyword = draft.trim();
    if (!keyword) { setDraft(""); return; }
    onChange([...keywords, keyword].join("; "));
    setDraft("");
  };

  return <div className="peas-keyword-input" onClick={() => document.getElementById(id)?.focus()}>
    <div className="peas-keyword-input__badges">
      {keywords.map((keyword, index) => <Badge key={`${keyword}-${index}`} tone="green" className="peas-keyword-input__badge">{keyword}<button type="button" aria-label={`Remove keyword ${keyword}`} disabled={disabled} onClick={(event) => { event.stopPropagation(); onChange(keywords.filter((_, itemIndex) => itemIndex !== index).join("; ")); }}><X aria-hidden="true" /></button></Badge>)}
      <input id={id} value={draft} disabled={disabled} placeholder={keywords.length ? undefined : placeholder} onChange={(event) => { const next = event.currentTarget.value; if (next.includes(";")) { const parts = next.split(";"); setDraft(parts.pop()?.trim() || ""); onChange([...keywords, ...parts.map((part) => part.trim()).filter(Boolean)].join("; ")); } else setDraft(next); }} onKeyDown={(event) => { if (event.key === "Backspace" && !draft && keywords.length) { onChange(keywords.slice(0, -1).join("; ")); } }} onBlur={commitDraft} />
    </div>
  </div>;
}

function CompiledReview({ form, title, errors }: { form: CompiledFormState; title: string; errors: FieldErrors }) {
  const studyAuthors = form.sections
    .filter((section) => section.title.trim() && section.file)
    .map((section) => `${section.title.trim()}: ${formatAuthors(section.authors)}`)
    .join(" · ") || "No authors entered";
  return <ReviewPanel title="Review your publication" description="Check the publication details and study count before continuing.">
    <ReviewRow label="Publication" value={title} />
    <ReviewRow label="Year range" value={form.startYear || form.endYear ? `${form.startYear || "?"}–${form.endYear || form.startYear || "?"}` : "No year range"} error={errors["compiled.startYear"] || errors["compiled.endYear"]} />
    <ReviewRow label="Volume / issue" value={`${form.volume || "No volume"}${form.category === "CONFLUENCE" && form.issueNumber ? ` · Issue ${form.issueNumber}` : ""}`} />
    <ReviewRow label="Studies" value={`${form.sections.filter((section) => section.title.trim() && section.file).length} prepared`} error={errors["compiled.sections"]} />
    <ReviewRow label="Study authors" value={studyAuthors} />
    <ReviewRow label="Foreword" value={form.forewordFile?.name || "No foreword"} />
  </ReviewPanel>;
}

function ReviewPanel({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <section className="peas-upload-review"><div><h2>{title}</h2><p>{description}</p></div><div className="peas-upload-review__rows">{children}</div></section>;
}

function ReviewRow({ label, value, error }: { label: string; value: string; error?: string }) {
  return <div className="peas-upload-review__row"><span>{label}</span><strong>{value}</strong>{error ? <small role="alert">{error}</small> : null}</div>;
}

function WorkflowPanel({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <section className="peas-upload-panel"><header><div><h2>{title}</h2><p>{description}</p></div><span className="peas-upload-required-note"><b>*</b> Required</span></header>{children}</section>;
}

function UploadChecklist({ mode, step, singleForm, compiledForm, compiledTitle, receipt }: { mode: UploadMode; step: UploadStep; singleForm: SingleFormState; compiledForm: CompiledFormState; compiledTitle: string; receipt: UploadReceipt | null }) {
  const isSingle = mode === "single";
  const preparedStudies = compiledForm.sections.filter((section) => section.title.trim() || section.file).length;
  return <aside className="peas-upload-preview peas-upload-checklist" aria-label="Upload checklist">
    {receipt ? <div className="peas-upload-receipt"><CheckCircle2 aria-hidden="true" /><h2>{receipt.pendingReview ? "Submitted for review" : "Published successfully"}</h2><p>{receipt.title}</p>{receipt.pendingReview ? <p>An administrator must approve this upload before it appears publicly.</p> : null}<div className="peas-upload-receipt__facts">{receipt.documentId ? <span>Document ID: {receipt.documentId}</span> : null}{receipt.compiledDocumentId ? <span>Publication ID: {receipt.compiledDocumentId}</span> : null}{receipt.childDocumentIds ? <span>{receipt.childDocumentIds.length} studies</span> : null}</div><Button type="button" onClick={() => receipt.pendingReview ? window.location.reload() : window.location.assign("/admin/Components/documents_list.html")}>{receipt.pendingReview ? "Upload another" : "View documents"}</Button></div> : <>
      <div><h2>{step === 3 ? "Final checklist" : "Upload checklist"}</h2><p className="peas-upload-checklist__intro">{isSingle ? "One document will be added to the repository." : "Your publication will include the studies you prepare below."}</p></div>
      <dl><ChecklistRow label="Type" value={isSingle ? (singleForm.category === "THESIS" ? "Thesis" : "Dissertation") : compiledForm.category === "CONFLUENCE" ? "Confluence" : "Synergy"} /><ChecklistRow label={isSingle ? "Title" : "Category"} value={isSingle ? singleForm.title || "Not entered" : compiledTitle} /><ChecklistRow label={isSingle ? "PDF" : "Studies"} value={isSingle ? singleForm.file?.name || "Not selected" : `${preparedStudies} prepared`} /><ChecklistRow label="Step" value={`${step} of 3`} /></dl>
    </>}
  </aside>;
}

function ChecklistRow({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }

function CompletionPanel({ receipt, isPublisher, onUploadAnother }: { receipt: UploadReceipt; isPublisher: boolean; onUploadAnother: () => void }) {
  return <section className="peas-upload-completion"><CheckCircle2 aria-hidden="true" /><h2>{receipt.pendingReview ? "Your upload is awaiting review" : "Your upload is published"}</h2><p><strong>{receipt.title}</strong> has been processed successfully.</p><p>{receipt.pendingReview ? (isPublisher ? "An administrator will review the document before it appears publicly." : "The document is queued for administrator review.") : "The document is now available in the repository."}</p><div className="peas-upload-receipt__facts">{receipt.documentId ? <span>Document ID: {receipt.documentId}</span> : null}{receipt.compiledDocumentId ? <span>Publication ID: {receipt.compiledDocumentId}</span> : null}{receipt.childDocumentIds ? <span>{receipt.childDocumentIds.length} studies</span> : null}</div><div className="peas-upload-completion__actions"><Button type="button" variant="outline" onClick={onUploadAnother}>Upload another</Button>{!receipt.pendingReview && !isPublisher ? <Button type="button" onClick={() => window.location.assign("/admin/Components/documents_list.html")}>View documents</Button> : null}</div></section>;
}

function SubmissionError({ message }: { message: string }) { return <div className="peas-upload-alert" role="alert"><strong>We couldn’t finish this upload.</strong><span>{message} Your entered details are still here. Check the fields and try again.</span></div>; }

function UploadActions({ step, busy, busyStep, label, onBack, onContinue }: { step: UploadStep; busy: boolean; busyStep: string | null; label: string; onBack: () => void; onContinue: () => void }) {
  return <div className="peas-upload-actions">
    {busyStep ? <UploadProgressDetails busyStep={busyStep} /> : null}
    {step > 1 ? <Button type="button" variant="outline" disabled={busy} onClick={(event) => { event.preventDefault(); onBack(); }}><ChevronLeft aria-hidden="true" /> Back</Button> : null}
    {step < 3 ? <Button type="button" disabled={busy} onClick={(event) => { event.preventDefault(); onContinue(); }}>Continue <ChevronRight aria-hidden="true" /></Button> : <Button type="submit" disabled={busy} onClick={(event) => { event.preventDefault(); event.currentTarget.form?.requestSubmit(); }}><UploadCloud aria-hidden="true" />{busy ? "Working…" : label}</Button>}
  </div>;
}

function UploadProgressDetails({ busyStep }: { busyStep: string }) {
  const progress = getUploadProgress(busyStep);
  const stages = ["Upload and validate PDF", "Create repository record", "Link metadata"];

  return <details className="peas-upload-progress-status">
    <summary aria-live="polite">
      <span className="peas-upload-progress-status__summary">
        <strong>{busyStep}</strong>
        <span>{progress.value}% · View details</span>
      </span>
      <span className="peas-upload-progress-bar" role="progressbar" aria-label="Upload workflow progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.value} aria-valuetext={`${progress.value}% complete`}>
        <span style={{ width: `${progress.value}%` }} />
      </span>
    </summary>
    <div className="peas-upload-progress-status__details">
      <p><strong>What’s happening</strong>{progress.detail}</p>
      <ol>
        {stages.map((stage, index) => <li className={index < progress.stage ? "is-complete" : index === progress.stage ? "is-current" : ""} key={stage}>
          <span aria-hidden="true">{index < progress.stage ? <Check /> : index + 1}</span>
          <strong>{stage}</strong>
          {index < progress.stage ? <small>Complete</small> : index === progress.stage ? <small>In progress</small> : <small>Next</small>}
        </li>)}
      </ol>
    </div>
  </details>;
}

function getUploadProgress(busyStep: string) {
  const normalized = busyStep.toLowerCase();
  const studyMatch = busyStep.match(/uploading study (\d+) of (\d+)/i);
  if (studyMatch) {
    const currentStudy = Number(studyMatch[1]);
    const totalStudies = Number(studyMatch[2]);
    const value = Math.round(18 + (currentStudy / Math.max(totalStudies, 1)) * 26);
    return { value, stage: 0, detail: `Sending study ${currentStudy} of ${totalStudies} and checking that it is a valid PDF.` };
  }
  if (normalized.includes("linking")) {
    return { value: 84, stage: 2, detail: "Connecting the document to its authors, keywords, or compiled publication." };
  }
  if (normalized.includes("creating")) {
    return { value: 58, stage: 1, detail: "Saving the publication details and preparing the repository record." };
  }
  return { value: 24, stage: 0, detail: "Sending the PDF securely and validating its file signature." };
}

function validateSingleForStep(form: SingleFormState, step: UploadStep): FieldErrors {
  const errors: FieldErrors = {};
  if (step >= 1) { if (!form.title.trim()) errors["single.title"] = "Enter a title."; if (!form.authors.length) errors["single.authors"] = "Enter at least one author."; }
  if (step >= 2) { const yearError = validateYear(form.pubYear, "Enter a four-digit year."); if (yearError) errors["single.pubYear"] = yearError; if (!form.file) errors["single.file"] = "Attach the document PDF."; else if (!isPdf(form.file)) errors["single.file"] = "Choose a PDF file."; }
  return errors;
}

function validateCompiledForStep(form: CompiledFormState, step: UploadStep): FieldErrors {
  const errors: FieldErrors = {};
  if (step >= 1) {
    const startError = validateYear(form.startYear, "Enter a four-digit year."); const endError = validateYear(form.endYear, "Enter a four-digit year.");
    if (startError) errors["compiled.startYear"] = startError; if (endError) errors["compiled.endYear"] = endError;
    if (form.startYear && form.endYear && Number(form.startYear) > Number(form.endYear)) { errors["compiled.startYear"] = "Start year must be before the end year."; errors["compiled.endYear"] = "End year must be after the start year."; }
    if (form.forewordFile && !isPdf(form.forewordFile)) errors["compiled.foreword"] = "Choose a PDF file.";
  }
  if (step >= 2) {
    const complete = form.sections.some((section) => section.title.trim() && section.file && isPdf(section.file));
    if (!complete) errors["compiled.sections"] = "Add at least one study with a title and PDF.";
    for (const section of form.sections) {
      const hasTitle = Boolean(section.title.trim()); const hasFile = Boolean(section.file);
      if (hasTitle !== hasFile) { errors[`compiled.section.${section.id}`] = `Study ${form.sections.indexOf(section) + 1} needs both a title and a PDF.`; if (!hasTitle) errors[`compiled.section.${section.id}.title`] = "Enter a study title."; if (!hasFile) errors[`compiled.section.${section.id}.file`] = "Attach the study PDF."; }
      if (section.file && !isPdf(section.file)) errors[`compiled.section.${section.id}.file`] = "Choose a PDF file.";
    }
  }
  return errors;
}

function fieldA11y(key: string, error?: string) { return { "aria-invalid": error ? true : undefined, "aria-describedby": `${key}-description${error ? ` ${key}-error` : ""}` }; }
function focusFirstError(errors: FieldErrors) { const key = Object.keys(errors)[0]; if (!key) return; window.requestAnimationFrame(() => { const element = document.querySelector<HTMLElement>(`[data-upload-field="${key}"] input, [data-upload-field="${key}"] textarea, [data-upload-field="${key}"] button`); element?.focus(); }); }
function validateYear(value: string, message: string) { return value.trim() && !/^\d{4}$/.test(value.trim()) ? message : undefined; }
function createResearchSection(): ResearchSection { return { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, title: "", authors: [], keywords: "", abstract: "", file: null }; }
function buildCompiledTitle(form: CompiledFormState) { const category = form.category === "CONFLUENCE" ? "Confluence" : "Synergy"; const volume = form.volume ? ` Vol. ${form.volume}` : ""; const range = form.startYear || form.endYear ? ` (${form.startYear || "?"}-${form.endYear || form.startYear || "?"})` : ""; return `${category}${volume}${range}`; }
function buildPublicationDate(year: string, month: string) { return year.trim() ? `${year.trim()}-${month || "01"}-01` : null; }
function formatAuthors(authors: DocumentAuthorSelection[]) { return authors.map((author) => author.fullName).join(", ") || "Not entered"; }
function parseList(value: string, separator: string) { return value.split(separator).map((item) => item.trim()).filter(Boolean); }
function safeInt(value: string) { const numberValue = Number.parseInt(value, 10); return Number.isFinite(numberValue) ? numberValue : null; }
function isPdf(file: File) { return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"); }
async function uploadDocumentPdf(file: File | null, documentType: SingleCategory | CompiledCategory, category: string, isForeword = false) { if (!file) throw new Error("Please choose a PDF file."); if (!isPdf(file)) throw new Error(`${file.name} is not a PDF file.`); return uploadFile(file, { storagePath: `storage/${documentType.toLowerCase()}${isForeword ? "/forewords" : ""}`, documentType, category, isForeword }); }
