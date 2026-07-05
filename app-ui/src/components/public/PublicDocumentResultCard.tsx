import { BookOpen } from "lucide-react";
import { CategoryIcon } from "../documents/CategoryIcon";
import type { SessionResponse } from "../../lib/api/auth";
import type { DocumentRecord } from "../../lib/api/types";
import { getCategoryMeta } from "../../lib/constants/categories";
import { formatDate } from "../../lib/formatters/date";

interface PublicDocumentResultCardProps {
  document: DocumentRecord;
  session?: SessionResponse | null;
  showDescription?: boolean;
}

export function PublicDocumentResultCard({
  document,
  session,
  showDescription = false,
}: PublicDocumentResultCardProps) {
  const category = getCategoryMeta(document.category);
  const authenticated = Boolean(session?.authenticated ?? session?.isAuthenticated);
  const basePath = document.isCompiled
    ? authenticated ? "/pages/user-compiled.html" : "/pages/guest-compiled.html"
    : authenticated ? "/pages/user-single.html" : "/pages/guest-single.html";
  const href = `${basePath}?id=${encodeURIComponent(String(document.id))}`;

  return (
    <a className={`peas-public-document-card peas-category-tone-${category.tone}`} href={href}>
      <span className="peas-public-document-card__icon">
        <CategoryIcon category={category.value} />
      </span>
      <span className="peas-public-document-card__copy">
        <strong>{document.title}</strong>
        <small>
          {document.authorsText} · {formatDate(document.publicationDate)}
        </small>
        {showDescription && document.description ? <em>{document.description}</em> : null}
      </span>
      <BookOpen aria-hidden="true" />
    </a>
  );
}
