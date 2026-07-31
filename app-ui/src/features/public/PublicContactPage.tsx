import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { CheckCircle2, Mail, Send } from "lucide-react";
import { PublicPageShell } from "../../components/public/PublicPageShell";
import { Button } from "../../components/ui/button";
import { submitContactInquiry, type ContactInquiryInput } from "../../lib/api/contact";
import { getErrorMessage } from "../../lib/api/http";

type FieldErrors = Partial<Record<keyof ContactInquiryInput, string>>;

const emptyForm: ContactInquiryInput = {
  firstName: "",
  lastName: "",
  email: "",
  subject: "",
  message: "",
  website: "",
};

export function PublicContactPage() {
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ referenceCode?: string; error?: string }>({});
  const inputIds = useMemo(() => ({
    firstName: "contact-first-name",
    lastName: "contact-last-name",
    email: "contact-email",
    subject: "contact-subject",
    message: "contact-message",
  }), []);

  const update = (field: keyof ContactInquiryInput, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setResult({});
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    const nextErrors = validateContactForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      document.getElementById(inputIds[Object.keys(nextErrors)[0] as keyof typeof inputIds])?.focus();
      return;
    }

    setSubmitting(true);
    setResult({});
    try {
      const receipt = await submitContactInquiry(form);
      setResult({ referenceCode: receipt.referenceCode });
      setForm(emptyForm);
    } catch (error) {
      setResult({ error: getErrorMessage(error) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PublicPageShell mainClassName="peas-contact-page">
      <section className="peas-contact-intro" aria-labelledby="contact-title">
        <span>Contact the Office</span>
        <h1 id="contact-title">How can we help?</h1>
        <p>
          Ask about research documents, submissions, repository access, technical concerns,
          or other Office of Research &amp; Publications matters.
        </p>
      </section>

      <div className="peas-contact-layout">
        <aside className="peas-contact-aside" aria-label="Contact guidance">
          <Mail aria-hidden="true" />
          <h2>Send an inquiry</h2>
          <p>Your message is stored securely before our notification is sent, so it will not be lost if email delivery is temporarily unavailable.</p>
          <p>After submitting, keep the reference code shown on screen for follow-up.</p>
        </aside>

        <form className="peas-contact-form" onSubmit={submit} noValidate>
          <div className="peas-contact-name-row">
            <ContactField id={inputIds.firstName} label="First name" error={errors.firstName}>
              <input id={inputIds.firstName} autoComplete="given-name" maxLength={80} value={form.firstName} onChange={(event) => update("firstName", event.currentTarget.value)} aria-invalid={Boolean(errors.firstName)} aria-describedby={errors.firstName ? `${inputIds.firstName}-error` : undefined} />
            </ContactField>
            <ContactField id={inputIds.lastName} label="Last name" error={errors.lastName}>
              <input id={inputIds.lastName} autoComplete="family-name" maxLength={80} value={form.lastName} onChange={(event) => update("lastName", event.currentTarget.value)} aria-invalid={Boolean(errors.lastName)} aria-describedby={errors.lastName ? `${inputIds.lastName}-error` : undefined} />
            </ContactField>
          </div>
          <ContactField id={inputIds.email} label="Email address" error={errors.email}>
            <input id={inputIds.email} type="email" inputMode="email" autoComplete="email" maxLength={254} value={form.email} onChange={(event) => update("email", event.currentTarget.value)} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? `${inputIds.email}-error` : undefined} />
          </ContactField>
          <ContactField id={inputIds.subject} label="Subject" error={errors.subject}>
            <input id={inputIds.subject} maxLength={160} value={form.subject} onChange={(event) => update("subject", event.currentTarget.value)} aria-invalid={Boolean(errors.subject)} aria-describedby={errors.subject ? `${inputIds.subject}-error` : undefined} />
          </ContactField>
          <ContactField id={inputIds.message} label="Message" error={errors.message}>
            <textarea id={inputIds.message} rows={8} maxLength={5000} value={form.message} onChange={(event) => update("message", event.currentTarget.value)} aria-invalid={Boolean(errors.message)} aria-describedby={`${inputIds.message}-hint${errors.message ? ` ${inputIds.message}-error` : ""}`} />
            <small id={`${inputIds.message}-hint`}>{form.message.length}/5,000 characters</small>
          </ContactField>
          <label className="peas-contact-honeypot" aria-hidden="true">
            Website
            <input tabIndex={-1} autoComplete="off" name="website" value={form.website} onChange={(event) => update("website", event.currentTarget.value)} />
          </label>
          <Button type="submit" disabled={submitting}>
            <Send aria-hidden="true" /> {submitting ? "Sending…" : "Send inquiry"}
          </Button>
          <div className="peas-contact-result" aria-live="polite" aria-atomic="true">
            {result.referenceCode ? (
              <div className="peas-contact-success"><CheckCircle2 aria-hidden="true" /><p><strong>Inquiry received.</strong> Your reference code is <code>{result.referenceCode}</code>.</p></div>
            ) : result.error ? <p className="peas-contact-error">{result.error} Your entries have been kept so you can retry.</p> : null}
          </div>
        </form>
      </div>
    </PublicPageShell>
  );
}

function ContactField({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <label className="peas-contact-field" htmlFor={id}>
      <span>{label}<b aria-hidden="true"> *</b></span>
      {children}
      {error ? <small className="peas-contact-field-error" id={`${id}-error`}>{error}</small> : null}
    </label>
  );
}

export function validateContactForm(input: ContactInquiryInput): FieldErrors {
  const errors: FieldErrors = {};
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const email = input.email.trim();
  const subject = input.subject.trim();
  const message = input.message.trim();
  if (!firstName || firstName.length > 80) errors.firstName = "Enter a first name of up to 80 characters.";
  if (!lastName || lastName.length > 80) errors.lastName = "Enter a last name of up to 80 characters.";
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email address.";
  if (subject.length < 3 || subject.length > 160) errors.subject = "Enter a subject between 3 and 160 characters.";
  if (message.length < 10 || message.length > 5000) errors.message = "Enter a message between 10 and 5,000 characters.";
  return errors;
}
