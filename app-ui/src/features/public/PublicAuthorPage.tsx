import { useEffect, useState } from "react";
import { BookOpen, Mail, UserRound } from "lucide-react";
import { PublicPageShell } from "../../components/public/PublicPageShell";
import { fetchAuthors, fetchAuthorWorks, type LooseRecord } from "../../lib/api/account";
import { getErrorMessage } from "../../lib/api/http";

export function PublicAuthorPage() {
  const id = new URLSearchParams(window.location.search).get("id") ?? "";
  const [author, setAuthor] = useState<LooseRecord | null>(null);
  const [works, setWorks] = useState<LooseRecord[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!id) { setError("No author was selected."); return; }
    Promise.all([fetchAuthors(), fetchAuthorWorks(id)])
      .then(([authors, publications]) => {
        setAuthor((authors.authors ?? []).find((item) => String(item.id) === id) ?? null);
        setWorks(publications.works ?? []);
      })
      .catch((caught) => setError(getErrorMessage(caught)));
  }, [id]);
  return <PublicPageShell mainClassName="peas-author-page">{error ? <div className="peas-account-error">{error}</div> : author ? <><header><div className="peas-author-avatar">{author.profile_picture ? <img src={String(author.profile_picture)} alt="" /> : <UserRound aria-hidden="true" />}</div><div><span>Research author</span><h1>{String(author.full_name || author.name || "Author")}</h1><p>{[author.affiliation, author.department].filter(Boolean).map(String).join(" · ")}</p>{author.email ? <a href={`mailto:${String(author.email)}`}><Mail aria-hidden="true" /> {String(author.email)}</a> : null}</div></header>{author.bio ? <section className="peas-author-bio"><h2>About</h2><p>{String(author.bio)}</p></section> : null}<section><div className="peas-author-works-head"><BookOpen aria-hidden="true" /><div><span>Publications</span><h2>Works in PeAS</h2></div></div>{works.length ? <div className="peas-author-works">{works.map((work, index) => { const workId = String(work.id ?? index); return <article key={workId}><span>{String(work.category || work.document_type || "Research")}</span><h3>{String(work.title || "Untitled work")}</h3><p>{String(work.abstract || work.description || "")}</p><a href={`/pages/guest-single.html?id=${encodeURIComponent(workId)}`}>View document</a></article>; })}</div> : <p>No works are currently listed for this author.</p>}</section></> : <p>Loading author profile…</p>}</PublicPageShell>;
}
