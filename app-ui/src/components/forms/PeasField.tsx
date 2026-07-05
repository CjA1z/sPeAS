import type { ReactNode } from "react";

interface PeasFieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  description?: string;
  error?: string;
  children: ReactNode;
}

export function PeasField({ label, htmlFor, required, description, error, children }: PeasFieldProps) {
  return (
    <div className="peas-field">
      <label className="peas-field__label" htmlFor={htmlFor}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      {children}
      {description ? <p className="peas-field__description">{description}</p> : null}
      {error ? <p className="peas-field__error">{error}</p> : null}
    </div>
  );
}
