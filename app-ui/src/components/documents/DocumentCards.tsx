import { CalendarDays, ChevronDown, ChevronRight, Eye, ListTree, Pencil, Trash2, UserRound } from "lucide-react";
import { getCategoryMeta } from "../../lib/constants/categories";
import { formatDate, formatYearRange } from "../../lib/formatters/date";
import type { DocumentRecord } from "../../lib/api/types";
import { Badge } from "../ui/badge";
import { PeasIconButton } from "../ui/peas-button";
import { PeasInlineSpinner } from "../feedback/PeasStates";
import { CategoryIcon } from "./CategoryIcon";

interface DocumentCardProps {
  document: DocumentRecord;
  onPreview: (document: DocumentRecord) => void;
  onEdit: (document: DocumentRecord) => void;
  onArchive: (document: DocumentRecord) => void;
}

export function PeasDocumentCard({ document, onPreview, onEdit, onArchive }: DocumentCardProps) {
  const category = getCategoryMeta(document.category);

  return (
    <article className={`peas-document-card peas-category-tone-${category.tone}`}>
      <div className="peas-document-card__icon">
        <CategoryIcon category={category.value} />
      </div>
      <div className="peas-document-card__body">
        <div className="peas-document-card__title-row">
          <h3>{document.title}</h3>
          <Badge tone={badgeTone(category.tone)}>{category.label}</Badge>
        </div>
        <DocumentMeta document={document} />
      </div>
      <div className="peas-document-card__actions">
        <PeasIconButton label="View document" variant="actionBlue" onClick={() => onPreview(document)}>
          <Eye aria-hidden="true" />
        </PeasIconButton>
        <PeasIconButton label="Edit document" variant="actionGreen" onClick={() => onEdit(document)}>
          <Pencil aria-hidden="true" />
        </PeasIconButton>
        <PeasIconButton label="Archive document" variant="actionRed" onClick={() => onArchive(document)}>
          <Trash2 aria-hidden="true" />
        </PeasIconButton>
      </div>
    </article>
  );
}

interface CompiledDocumentCardProps extends DocumentCardProps {
  expanded: boolean;
  childrenDocuments: DocumentRecord[];
  loadingChildren: boolean;
  onToggleChildren: (document: DocumentRecord) => void;
}

export function PeasCompiledDocumentCard({
  document,
  expanded,
  childrenDocuments,
  loadingChildren,
  onToggleChildren,
  onPreview,
  onEdit,
  onArchive,
}: CompiledDocumentCardProps) {
  const category = getCategoryMeta(document.category);
  const yearRange = formatYearRange(document.startYear, document.endYear);

  return (
    <article className={`peas-compiled-card peas-category-tone-${category.tone}`}>
      <div className="peas-compiled-card__main">
        <button
          className="peas-compiled-card__summary"
          type="button"
          aria-expanded={expanded}
          onClick={() => onToggleChildren(document)}
        >
          <span className="peas-compiled-card__chevron">
            {expanded ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
          </span>
          <span className="peas-document-card__icon">
            <CategoryIcon category={category.value} />
          </span>
          <span className="peas-compiled-card__copy">
            <span className="peas-compiled-card__title">{document.title}</span>
            <span className="peas-document-card__meta">
              <span>
                <ListTree aria-hidden="true" />
                {document.childCount} {document.childCount === 1 ? "document" : "documents"}
              </span>
              {yearRange ? <span>{yearRange}</span> : null}
            </span>
          </span>
        </button>
        <div className="peas-document-card__actions">
          <PeasIconButton
            label={expanded ? "Hide contained documents" : "Show contained documents"}
            variant="actionPurple"
            onClick={() => onToggleChildren(document)}
          >
            <ListTree aria-hidden="true" />
          </PeasIconButton>
          <PeasIconButton label="Edit compiled document" variant="actionGreen" onClick={() => onEdit(document)}>
            <Pencil aria-hidden="true" />
          </PeasIconButton>
          <PeasIconButton label="Archive compiled document" variant="actionRed" onClick={() => onArchive(document)}>
            <Trash2 aria-hidden="true" />
          </PeasIconButton>
        </div>
      </div>

      {expanded ? (
        <div className="peas-child-documents">
          {loadingChildren ? (
            <PeasInlineSpinner label="Loading contained documents" />
          ) : childrenDocuments.length > 0 ? (
            childrenDocuments.map((child) => (
              <div className="peas-child-document" key={child.id}>
                <div className="peas-child-document__copy">
                  <h4>{child.title}</h4>
                  <DocumentMeta document={child} compact />
                </div>
                <div className="peas-child-document__actions">
                  <PeasIconButton label="View child document" variant="actionBlue" onClick={() => onPreview(child)}>
                    <Eye aria-hidden="true" />
                  </PeasIconButton>
                  <PeasIconButton label="Edit child document" variant="actionGreen" onClick={() => onEdit(child)}>
                    <Pencil aria-hidden="true" />
                  </PeasIconButton>
                </div>
              </div>
            ))
          ) : (
            <p className="peas-child-documents__empty">No contained documents were returned.</p>
          )}
        </div>
      ) : null}
    </article>
  );
}

function DocumentMeta({ document, compact = false }: { document: DocumentRecord; compact?: boolean }) {
  return (
    <div className={compact ? "peas-document-card__meta peas-document-card__meta--compact" : "peas-document-card__meta"}>
      <span>
        <UserRound aria-hidden="true" />
        {document.authorsText}
      </span>
      <span>
        <CalendarDays aria-hidden="true" />
        {formatDate(document.publicationDate)}
      </span>
    </div>
  );
}

function badgeTone(tone: string) {
  if (tone === "thesis") return "rose";
  if (tone === "dissertation") return "violet";
  if (tone === "confluence") return "gold";
  if (tone === "synergy") return "blue";
  return "green";
}
