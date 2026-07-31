import { FileQuestion } from "lucide-react";
import { PublicPageShell } from "../../components/public/PublicPageShell";

export function PublicNotFoundPage() {
  return <PublicPageShell mainClassName="peas-not-found"><FileQuestion aria-hidden="true" /><span>404</span><h1>That page could not be found.</h1><p>The address may be outdated, or the page may have moved.</p><div><a href="/index.html">Return home</a><a href="/pages/searchResultsPage.html">Search the repository</a></div></PublicPageShell>;
}
