import { Component, type ErrorInfo, type ReactNode } from "react";
import { PublicFooter } from "./PublicFooter";
import { PublicNavbar } from "./PublicNavbar";

export function PublicPageShell({ children, mainClassName = "" }: { children: ReactNode; mainClassName?: string }) {
  return (
    <div className="peas-public-page">
      <a className="peas-skip-link" href="#main-content">Skip to main content</a>
      <PublicNavbar />
      <main id="main-content" className={mainClassName}>{children}</main>
      <PublicFooter />
    </div>
  );
}

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main id="main-content" className="peas-auth-shell">
      <a className="peas-auth-home" href="/index.html" aria-label="Return to PeAS home">PeAS</a>
      {children}
    </main>
  );
}

export class PublicErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("Public page render failed", error, info); }

  render() {
    if (this.state.failed) {
      return (
        <PublicPageShell mainClassName="peas-public-state-page">
          <section className="peas-public-state-card" role="alert">
            <span>Page unavailable</span>
            <h1>We could not display this page.</h1>
            <p>Refresh the page or return to the PeAS home page.</p>
            <a className="peas-public-primary-link" href="/index.html">Return home</a>
          </section>
        </PublicPageShell>
      );
    }
    return this.props.children;
  }
}
