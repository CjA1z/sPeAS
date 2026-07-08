import { Fragment, useState, type CSSProperties } from "react";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

type OrgRole = {
  id: string;
  /** Full role title, used in the detail panel and for accessibility. */
  title: string;
  /** Short text shown in the name pill until a `name` is set. */
  label: string;
  /** Small-caps line under the pill. */
  caption: string;
  /** Person currently holding the role; replaces `label` in the pill when set. */
  name?: string;
  /** Portrait shown popping out of the hexagon frame. Use a background-removed
   *  (transparent PNG) head-and-shoulders cutout so the pop-out reads well.
   *  Drop the file in Deno/Public/Components/images/team/ and point here,
   *  e.g. "/Components/images/team/director.png". Falls back to a silhouette. */
  photo?: string;
  /** Boards and committees render a group silhouette. */
  group?: boolean;
  /** Hexagon fill and outer ring colors. */
  fill: string;
  ring: string;
  summary: string;
};

const CHAIN: OrgRole[] = [
  {
    id: "president",
    title: "University President",
    label: "University President",
    caption: "Administration",
    fill: "#ffd15c",
    ring: "#cfe6c2",
    summary:
      "Provides overall institutional leadership and sets the strategic direction that the university's research and publication programs support.",
  },
  {
    id: "vp-student-affairs",
    title: "Vice President, Student Affairs",
    label: "Vice President",
    caption: "Student Affairs",
    fill: "#79c9e8",
    ring: "#d3c4f0",
    summary:
      "Oversees the student affairs cluster and ensures the research and publications agenda stays aligned with university priorities.",
  },
  {
    id: "director-orp",
    title: "Director, Office of Research and Publications",
    label: "Director",
    caption: "Research & Publications",
    fill: "#f4a6c2",
    ring: "#cfd8f5",
    summary:
      "Leads the Office of Research and Publications — coordinating research activity, publication support, and institutional scholarly output.",
  },
];

const UNITS: OrgRole[] = [
  {
    id: "associate-assistant",
    title: "Associate Assistant",
    label: "Associate Assistant",
    caption: "Office Support",
    fill: "#f8bcd0",
    ring: "#f3ccd7",
    summary:
      "Supports the director in day-to-day operations, records management, and coordination with researchers and university units.",
  },
  {
    id: "editorial-board",
    title: "Editorial Board",
    label: "Editorial Board",
    caption: "Publications",
    fill: "#ffb64c",
    ring: "#f3ccd7",
    group: true,
    summary:
      "Reviews manuscripts and safeguards the editorial quality of the university's journals and scholarly publications.",
  },
  {
    id: "technical-board",
    title: "Technical Board",
    label: "Technical Board",
    caption: "Research Review",
    fill: "#ffd15c",
    ring: "#f3ccd7",
    group: true,
    summary:
      "Evaluates research design and methodology, providing technical guidance to student and faculty researchers.",
  },
  {
    id: "research-ethics-board",
    title: "Research Ethics Board",
    label: "Research Ethics Board",
    caption: "Ethics Review",
    fill: "#35b39a",
    ring: "#f3ccd7",
    group: true,
    summary:
      "Reviews research protocols to protect the rights and welfare of participants and uphold ethical standards in every study.",
  },
];

const ALL_ROLES = [...CHAIN, ...UNITS];

export function OrgChart() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = ALL_ROLES.find((role) => role.id === selectedId) ?? null;

  const toggle = (id: string) => {
    setSelectedId((current) => (current === id ? null : id));
  };

  return (
    <div className="peas-org-chart">
      <div className="peas-org-tree" role="group" aria-label="Organizational chart for the Office of Research and Publications">
        {CHAIN.map((role, index) => (
          <Fragment key={role.id}>
            {index > 0 ? <span className="peas-org-link peas-org-link--into" aria-hidden="true" /> : null}
            <div className="peas-org-row">
              <OrgNodeButton role={role} selected={selectedId === role.id} onToggle={toggle} />
            </div>
          </Fragment>
        ))}

        <span className="peas-org-link" aria-hidden="true" />
        <div className="peas-org-units">
          {UNITS.map((role) => (
            <div className="peas-org-unit" key={role.id}>
              <OrgNodeButton role={role} selected={selectedId === role.id} onToggle={toggle} />
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {selected ? (
          <motion.aside
            className="peas-org-detail"
            key={selected.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            aria-live="polite"
          >
            <OrgFigure role={selected} />
            <div className="peas-org-detail__body">
              <strong>{selected.title}</strong>
              {selected.name ? <em>{selected.name}</em> : null}
              <p>{selected.summary}</p>
            </div>
            <button
              type="button"
              className="peas-org-detail__close"
              onClick={() => setSelectedId(null)}
              aria-label="Close role details"
            >
              <X aria-hidden="true" />
            </button>
          </motion.aside>
        ) : (
          <motion.p
            className="peas-org-hint"
            key="hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            Select a role to learn more about it.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function OrgNodeButton({
  role,
  selected,
  onToggle,
}: {
  role: OrgRole;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <button
      type="button"
      className={`peas-org-node${selected ? " is-selected" : ""}`}
      onClick={() => onToggle(role.id)}
      aria-expanded={selected}
      aria-label={role.name ? `${role.name}, ${role.title}` : role.title}
    >
      <OrgFigure role={role} />
      <span className="peas-org-node__meta">
        <span className="peas-org-pill">{role.name ?? role.label}</span>
        <span className="peas-org-caption">{role.name ? role.label : role.caption}</span>
      </span>
    </button>
  );
}

function OrgFigure({ role }: { role: OrgRole }) {
  const [broken, setBroken] = useState(false);

  return (
    <span
      className="peas-org-figure"
      style={{ "--org-fill": role.fill, "--org-ring": role.ring } as CSSProperties}
    >
      <span className="peas-org-hex peas-org-hex--ring" aria-hidden="true" />
      <span className="peas-org-hex" aria-hidden="true" />
      {role.photo && !broken ? (
        <img
          className="peas-org-person"
          src={role.photo}
          alt={role.name ? `Portrait of ${role.name}` : ""}
          onError={() => setBroken(true)}
        />
      ) : (
        <Silhouette group={role.group} />
      )}
    </span>
  );
}

function Silhouette({ group }: { group?: boolean }) {
  if (group) {
    return (
      <svg className="peas-org-person" viewBox="0 0 120 100" aria-hidden="true">
        <g fill="#4d5a75">
          <circle cx="38" cy="33" r="13" />
          <path d="M14 100 C14 76 25 64 38 64 C51 64 62 76 62 100 Z" />
        </g>
        <g fill="#42506a">
          <circle cx="82" cy="33" r="13" />
          <path d="M58 100 C58 76 69 64 82 64 C95 64 106 76 106 100 Z" />
        </g>
        <g fill="#2b3648">
          <circle cx="60" cy="34" r="16" />
          <path d="M30 100 C30 78 43 66 60 66 C77 66 90 78 90 100 Z" />
        </g>
      </svg>
    );
  }

  return (
    <svg className="peas-org-person" viewBox="0 0 100 100" aria-hidden="true">
      <g fill="#2b3648">
        <circle cx="50" cy="28" r="18" />
        <path d="M14 100 C14 72 30 58 50 58 C70 58 90 72 90 100 Z" />
      </g>
    </svg>
  );
}
