import { useMemo, useState, type FormEvent } from "react";
import { CheckCircle2, FilePlus2, ListPlus, Plus, ReceiptText, Trash2, UploadCloud } from "lucide-react";
import { motion } from "motion/react";
import { getErrorMessage } from "../../lib/api/http";
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
import { PeasFileDropzone } from "../../components/forms/PeasFileDropzone";
import { PeasToaster, toast } from "../../components/ui/toast";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { PeasIconButton } from "../../components/ui/peas-button";

type UploadMode = "single" | "compiled";
type SingleCategory = "THESIS" | "DISSERTATION";
type CompiledCategory = "CONFLUENCE" | "SYNERGY";

interface SingleFormState {
  title: string;
  authors: string;
  pubMonth: string;
  pubYear: string;
  keywords: string;
  category: SingleCategory;
  file: File | null;
}

interface ResearchSection {
  id: string;
  title: string;
  authors: string;
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
  type: "single" | "compiled";
  title: string;
  documentId?: number;
  compiledDocumentId?: number;
  childDocumentIds?: number[];
}

const MONTHS = [
  ["01", "January"],
  ["02", "February"],
  ["03", "March"],
  ["04", "April"],
  ["05", "May"],
  ["06", "June"],
  ["07", "July"],
  ["08", "August"],
  ["09", "September"],
  ["10", "October"],
  ["11", "November"],
  ["12", "December"],
];

const DEPARTMENTS = [
  "College of Business in Information Technology",
  "College of Nursing",
  "College of Arts and Science Education",
  "Basic Academic Education",
];

const initialSingleForm: SingleFormState = {
  title: "",
  authors: "",
  pubMonth: "",
  pubYear: "",
  keywords: "",
  category: "THESIS",
  file: null,
};

const initialCompiledForm: CompiledFormState = {
  category: "CONFLUENCE",
  startYear: "",
  endYear: "",
  volume: "",
  issueNumber: "",
  department: "",
  forewordFile: null,
  sections: [createResearchSection()],
};

export function UploadDocumentPage() {
  const [mode, setMode] = useState<UploadMode>("single");
  const [singleForm, setSingleForm] = useState<SingleFormState>(initialSingleForm);
  const [compiledForm, setCompiledForm] = useState<CompiledFormState>(initialCompiledForm);
  const [busyStep, setBusyStep] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<UploadReceipt | null>(null);

  const busy = Boolean(busyStep);

  const compiledTitle = useMemo(() => {
    const category = compiledForm.category === "CONFLUENCE" ? "Confluence" : "Synergy";
    const volume = compiledForm.volume ? ` Vol. ${compiledForm.volume}` : "";
    const range = compiledForm.startYear || compiledForm.endYear
      ? ` (${compiledForm.startYear || "?"}-${compiledForm.endYear || compiledForm.startYear || "?"})`
      : "";
    return `${category}${volume}${range}`;
  }, [compiledForm]);

  async function handleSingleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReceipt(null);

    try {
      validateSingle(singleForm);
      setBusyStep("Uploading PDF...");
      const upload = await uploadDocumentPdf(singleForm.file, singleForm.category, singleForm.category);

      setBusyStep("Creating document record...");
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

      setBusyStep("Linking authors and keywords...");
      await Promise.allSettled([
        linkDocumentAuthors(document.id, parseList(singleForm.authors, ";")),
        linkResearchAgenda(document.id, parseList(singleForm.keywords, ",")),
      ]);

      setReceipt({
        type: "single",
        title: singleForm.title.trim(),
        documentId: document.id,
      });
      setSingleForm(initialSingleForm);
      toast.success("Document uploaded successfully.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusyStep(null);
    }
  }

  async function handleCompiledSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReceipt(null);

    try {
      validateCompiled(compiledForm);
      const documentType = compiledForm.category;

      let foreword: UploadedFileResult | null = null;
      if (compiledForm.forewordFile) {
        setBusyStep("Uploading foreword...");
        foreword = await uploadDocumentPdf(compiledForm.forewordFile, documentType, compiledForm.category, true);
      }

      setBusyStep("Creating compiled document...");
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
        setBusyStep(`Uploading study ${index + 1} of ${sectionsWithFiles.length}...`);
        const upload = await uploadDocumentPdf(section.file, documentType, compiledForm.category);

        setBusyStep(`Creating study ${index + 1} of ${sectionsWithFiles.length}...`);
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

        await Promise.allSettled([
          linkDocumentAuthors(childDocument.id, parseList(section.authors, ";")),
          linkResearchAgenda(childDocument.id, parseList(section.keywords, ",")),
        ]);
      }

      setBusyStep("Linking studies to compilation...");
      await linkDocumentsToCompilation(compiled.id, childDocumentIds);

      setReceipt({
        type: "compiled",
        title: compiledTitle,
        compiledDocumentId: compiled.id,
        childDocumentIds,
      });
      setCompiledForm({ ...initialCompiledForm, sections: [createResearchSection()] });
      toast.success("Compiled document uploaded successfully.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusyStep(null);
    }
  }

  return (
    <main className="peas-admin-island peas-upload-page">
      <PeasToaster />
      <section className="peas-upload-shell">
        <div className="peas-upload-main">
          <div className="peas-upload-header">
            <div>
              <h1>Add New Document</h1>
              <p>Upload single research documents or compiled publications using the PeAS document workflow.</p>
            </div>
            <Badge tone={mode === "single" ? "green" : "gold"}>{mode === "single" ? "Single" : "Compiled"}</Badge>
          </div>

          <Tabs value={mode} onValueChange={(value) => setMode(value as UploadMode)}>
            <TabsList aria-label="Upload mode">
              <TabsTrigger value="single">
                <FilePlus2 aria-hidden="true" />
                Single Document
              </TabsTrigger>
              <TabsTrigger value="compiled">
                <ListPlus aria-hidden="true" />
                Compiled Document
              </TabsTrigger>
            </TabsList>

            <TabsContent value="single">
              <form className="peas-upload-form" onSubmit={handleSingleSubmit}>
                <SingleDocumentForm form={singleForm} onChange={setSingleForm} busy={busy} />
                <UploadActions busy={busy} busyStep={busyStep} label="Upload Document" />
              </form>
            </TabsContent>

            <TabsContent value="compiled">
              <form className="peas-upload-form" onSubmit={handleCompiledSubmit}>
                <CompiledDocumentForm form={compiledForm} onChange={setCompiledForm} busy={busy} />
                <UploadActions busy={busy} busyStep={busyStep} label="Create Compiled Document" />
              </form>
            </TabsContent>
          </Tabs>
        </div>

        <UploadPreview mode={mode} singleForm={singleForm} compiledForm={compiledForm} compiledTitle={compiledTitle} receipt={receipt} />
      </section>
    </main>
  );
}

function SingleDocumentForm({
  form,
  onChange,
  busy,
}: {
  form: SingleFormState;
  onChange: (form: SingleFormState) => void;
  busy: boolean;
}) {
  return (
    <div className="peas-upload-section">
      <div className="peas-form-grid peas-form-grid--two">
        <PeasField label="Title" htmlFor="single-title" required>
          <Input
            id="single-title"
            value={form.title}
            disabled={busy}
            placeholder="Enter document title"
            onChange={(event) => onChange({ ...form, title: event.currentTarget.value })}
          />
        </PeasField>
        <PeasField label="Category" required>
          <Select value={form.category} disabled={busy} onValueChange={(value) => onChange({ ...form, category: value as SingleCategory })}>
            <SelectTrigger aria-label="Single document category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="THESIS">Thesis</SelectItem>
              <SelectItem value="DISSERTATION">Dissertation</SelectItem>
            </SelectContent>
          </Select>
        </PeasField>
      </div>

      <PeasField
        label="Author(s)"
        htmlFor="single-authors"
        required
        description="Separate multiple authors with semicolons."
      >
        <Input
          id="single-authors"
          value={form.authors}
          disabled={busy}
          placeholder="Juan Dela Cruz, PhD; Maria Santos, MA"
          onChange={(event) => onChange({ ...form, authors: event.currentTarget.value })}
        />
      </PeasField>

      <div className="peas-form-grid peas-form-grid--two">
        <PeasField label="Publication Month">
          <Select value={form.pubMonth || "none"} disabled={busy} onValueChange={(value) => onChange({ ...form, pubMonth: value === "none" ? "" : value })}>
            <SelectTrigger aria-label="Publication month">
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No month</SelectItem>
              {MONTHS.map(([value, label]) => (
                <SelectItem value={value} key={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PeasField>
        <PeasField label="Publication Year" htmlFor="single-year">
          <Input
            id="single-year"
            type="number"
            min="1000"
            max="9999"
            value={form.pubYear}
            disabled={busy}
            placeholder="YYYY"
            onChange={(event) => onChange({ ...form, pubYear: event.currentTarget.value })}
          />
        </PeasField>
      </div>

      <PeasField label="Keywords" htmlFor="single-keywords" description="Separate keywords with commas.">
        <Input
          id="single-keywords"
          value={form.keywords}
          disabled={busy}
          placeholder="community health, education, local governance"
          onChange={(event) => onChange({ ...form, keywords: event.currentTarget.value })}
        />
      </PeasField>

      <PeasFileDropzone
        label="Attach PDF"
        required
        file={form.file}
        disabled={busy}
        onFileChange={(file) => onChange({ ...form, file })}
      />
    </div>
  );
}

function CompiledDocumentForm({
  form,
  onChange,
  busy,
}: {
  form: CompiledFormState;
  onChange: (form: CompiledFormState) => void;
  busy: boolean;
}) {
  const synergy = form.category === "SYNERGY";

  function updateSection(id: string, updates: Partial<ResearchSection>) {
    onChange({
      ...form,
      sections: form.sections.map((section) => (section.id === id ? { ...section, ...updates } : section)),
    });
  }

  return (
    <div className="peas-upload-section">
      <div className="peas-form-grid peas-form-grid--three">
        <PeasField label="Category" required>
          <Select value={form.category} disabled={busy} onValueChange={(value) => onChange({ ...form, category: value as CompiledCategory })}>
            <SelectTrigger aria-label="Compiled document category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CONFLUENCE">Confluence</SelectItem>
              <SelectItem value="SYNERGY">Synergy</SelectItem>
            </SelectContent>
          </Select>
        </PeasField>
        <PeasField label="Start Year" htmlFor="compiled-start-year">
          <Input
            id="compiled-start-year"
            type="number"
            value={form.startYear}
            disabled={busy}
            placeholder="2017"
            onChange={(event) => onChange({ ...form, startYear: event.currentTarget.value })}
          />
        </PeasField>
        <PeasField label="End Year" htmlFor="compiled-end-year">
          <Input
            id="compiled-end-year"
            type="number"
            value={form.endYear}
            disabled={busy}
            placeholder="2018"
            onChange={(event) => onChange({ ...form, endYear: event.currentTarget.value })}
          />
        </PeasField>
      </div>

      <div className="peas-form-grid peas-form-grid--three">
        <PeasField label="Volume" htmlFor="compiled-volume">
          <Input
            id="compiled-volume"
            value={form.volume}
            disabled={busy}
            placeholder="3"
            onChange={(event) => onChange({ ...form, volume: event.currentTarget.value })}
          />
        </PeasField>
        {synergy ? (
          <PeasField label="Department">
            <Select value={form.department || "none"} disabled={busy} onValueChange={(value) => onChange({ ...form, department: value === "none" ? "" : value })}>
              <SelectTrigger aria-label="Synergy department">
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No department</SelectItem>
                {DEPARTMENTS.map((department) => (
                  <SelectItem value={department} key={department}>
                    {department}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </PeasField>
        ) : (
          <PeasField label="Issue No." htmlFor="compiled-issue">
            <Input
              id="compiled-issue"
              value={form.issueNumber}
              disabled={busy}
              placeholder="1"
              onChange={(event) => onChange({ ...form, issueNumber: event.currentTarget.value })}
            />
          </PeasField>
        )}
        <PeasFileDropzone
          label="Foreword PDF"
          file={form.forewordFile}
          disabled={busy}
          description="Optional foreword PDF."
          onFileChange={(file) => onChange({ ...form, forewordFile: file })}
        />
      </div>

      <div className="peas-research-sections">
        <div className="peas-research-sections__header">
          <div>
            <h2>Contents Section</h2>
            <p>Add each study contained in this compiled document.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => onChange({ ...form, sections: [...form.sections, createResearchSection()] })}
          >
            <Plus aria-hidden="true" />
            Add Study
          </Button>
        </div>

        {form.sections.map((section, index) => (
          <Card className="peas-research-card" key={section.id}>
            <CardContent>
              <div className="peas-research-card__header">
                <h3>Research {index + 1}</h3>
                {form.sections.length > 1 ? (
                  <PeasIconButton
                    label={`Remove research ${index + 1}`}
                    tooltip="Remove study"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => onChange({ ...form, sections: form.sections.filter((item) => item.id !== section.id) })}
                  >
                    <Trash2 aria-hidden="true" />
                  </PeasIconButton>
                ) : null}
              </div>

              <PeasField label="Study Title" htmlFor={`study-title-${section.id}`} required>
                <Input
                  id={`study-title-${section.id}`}
                  value={section.title}
                  disabled={busy}
                  placeholder="Enter study title"
                  onChange={(event) => updateSection(section.id, { title: event.currentTarget.value })}
                />
              </PeasField>

              <div className="peas-form-grid peas-form-grid--two">
                <PeasField label="Authors" htmlFor={`study-authors-${section.id}`} description="Separate authors with semicolons.">
                  <Input
                    id={`study-authors-${section.id}`}
                    value={section.authors}
                    disabled={busy}
                    placeholder="Juan Dela Cruz; Maria Santos"
                    onChange={(event) => updateSection(section.id, { authors: event.currentTarget.value })}
                  />
                </PeasField>
                <PeasField label="Keywords" htmlFor={`study-keywords-${section.id}`} description="Separate keywords with commas.">
                  <Input
                    id={`study-keywords-${section.id}`}
                    value={section.keywords}
                    disabled={busy}
                    placeholder="education, survey, student research"
                    onChange={(event) => updateSection(section.id, { keywords: event.currentTarget.value })}
                  />
                </PeasField>
              </div>

              <PeasField label="Abstract" htmlFor={`study-abstract-${section.id}`}>
                <Textarea
                  id={`study-abstract-${section.id}`}
                  value={section.abstract}
                  disabled={busy}
                  rows={4}
                  placeholder="Optional abstract. If blank, PeAS will use extracted PDF metadata when available."
                  onChange={(event) => updateSection(section.id, { abstract: event.currentTarget.value })}
                />
              </PeasField>

              <PeasFileDropzone
                label="Study PDF"
                required
                file={section.file}
                disabled={busy}
                onFileChange={(file) => updateSection(section.id, { file })}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function UploadPreview({
  mode,
  singleForm,
  compiledForm,
  compiledTitle,
  receipt,
}: {
  mode: UploadMode;
  singleForm: SingleFormState;
  compiledForm: CompiledFormState;
  compiledTitle: string;
  receipt: UploadReceipt | null;
}) {
  if (receipt) {
    return (
      <aside className="peas-upload-preview">
        <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="peas-upload-receipt">
          <CheckCircle2 aria-hidden="true" />
          <h2>Upload Complete</h2>
          <p>{receipt.title}</p>
          <div className="peas-upload-receipt__facts">
            {receipt.documentId ? <span>Document ID: {receipt.documentId}</span> : null}
            {receipt.compiledDocumentId ? <span>Compiled ID: {receipt.compiledDocumentId}</span> : null}
            {receipt.childDocumentIds ? <span>{receipt.childDocumentIds.length} contained documents</span> : null}
          </div>
          <Button type="button" onClick={() => window.location.assign("documents_list.html")}>
            View Documents
          </Button>
        </motion.div>
      </aside>
    );
  }

  return (
    <aside className="peas-upload-preview">
      <div className="peas-upload-preview__icon">
        {mode === "single" ? <FilePlus2 aria-hidden="true" /> : <ReceiptText aria-hidden="true" />}
      </div>
      <h2>{mode === "single" ? singleForm.title || "Single document preview" : compiledTitle}</h2>
      <dl>
        {mode === "single" ? (
          <>
            <div>
              <dt>Category</dt>
              <dd>{singleForm.category === "THESIS" ? "Thesis" : "Dissertation"}</dd>
            </div>
            <div>
              <dt>Authors</dt>
              <dd>{singleForm.authors || "No authors entered"}</dd>
            </div>
            <div>
              <dt>PDF</dt>
              <dd>{singleForm.file?.name || "No file selected"}</dd>
            </div>
          </>
        ) : (
          <>
            <div>
              <dt>Category</dt>
              <dd>{compiledForm.category === "CONFLUENCE" ? "Confluence" : "Synergy"}</dd>
            </div>
            <div>
              <dt>Studies</dt>
              <dd>{compiledForm.sections.filter((section) => section.title || section.file).length} prepared</dd>
            </div>
            <div>
              <dt>Foreword</dt>
              <dd>{compiledForm.forewordFile?.name || "No foreword selected"}</dd>
            </div>
          </>
        )}
      </dl>
    </aside>
  );
}

function UploadActions({ busy, busyStep, label }: { busy: boolean; busyStep: string | null; label: string }) {
  return (
    <div className="peas-upload-actions">
      {busyStep ? (
        <span className="peas-upload-actions__status">
          <UploadCloud aria-hidden="true" />
          {busyStep}
        </span>
      ) : null}
      <Button type="submit" disabled={busy}>
        <UploadCloud aria-hidden="true" />
        {busy ? "Working..." : label}
      </Button>
    </div>
  );
}

async function uploadDocumentPdf(
  file: File | null,
  documentType: SingleCategory | CompiledCategory,
  category: string,
  isForeword = false,
) {
  if (!file) throw new Error("Please choose a PDF file.");
  if (!isPdf(file)) throw new Error(`${file.name} is not a PDF file.`);

  return uploadFile(file, {
    storagePath: `storage/${documentType.toLowerCase()}${isForeword ? "/forewords" : ""}`,
    documentType,
    category,
    isForeword,
  });
}

function validateSingle(form: SingleFormState) {
  if (!form.title.trim()) throw new Error("Title is required.");
  if (parseList(form.authors, ";").length === 0) throw new Error("At least one author is required.");
  if (!form.file) throw new Error("Please attach a PDF file.");
  if (!isPdf(form.file)) throw new Error("The attached file must be a PDF.");
}

function validateCompiled(form: CompiledFormState) {
  const validSections = form.sections.filter((section) => section.title.trim() && section.file);
  if (validSections.length === 0) throw new Error("Add at least one study with a title and PDF file.");

  for (const [index, section] of form.sections.entries()) {
    if ((section.title.trim() || section.file) && (!section.title.trim() || !section.file)) {
      throw new Error(`Research ${index + 1} needs both a title and a PDF file.`);
    }
    if (section.file && !isPdf(section.file)) {
      throw new Error(`Research ${index + 1} must use a PDF file.`);
    }
  }

  if (form.forewordFile && !isPdf(form.forewordFile)) throw new Error("The foreword must be a PDF file.");
}

function createResearchSection(): ResearchSection {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title: "",
    authors: "",
    keywords: "",
    abstract: "",
    file: null,
  };
}

function buildPublicationDate(year: string, month: string) {
  if (!year.trim()) return null;
  return `${year.trim()}-${month || "01"}-01`;
}

function parseList(value: string, separator: string) {
  return value
    .split(separator)
    .map((item) => item.trim())
    .filter(Boolean);
}

function safeInt(value: string) {
  const numberValue = Number.parseInt(value, 10);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function isPdf(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}
