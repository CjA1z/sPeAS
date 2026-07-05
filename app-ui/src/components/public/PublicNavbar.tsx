import { useCallback, useState } from "react";
import { BookOpen, Clock, LogOut, Menu, Search, UserRound, X } from "lucide-react";
import { Button } from "../ui/button";
import { fetchOptionalSession, searchResultsUrl } from "../../lib/api/public";
import type { SessionResponse } from "../../lib/api/auth";

interface PublicNavbarProps {
  session: SessionResponse | null;
  onSessionChange: (session: SessionResponse | null) => void;
}

const links = [
  { label: "Home", href: "/index.html" },
  { label: "Search", href: "/pages/searchResultsPage.html" },
  { label: "News", href: "/news.html" },
  { label: "Contact", href: "/contact.html" },
];

export function PublicNavbar({ session, onSessionChange }: PublicNavbarProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const authenticated = Boolean(session?.authenticated ?? session?.isAuthenticated);
  const userName = String(session?.user?.name ?? session?.username ?? session?.userId ?? "User");

  const submitSearch = useCallback(() => {
    window.location.href = searchResultsUrl(search);
  }, [search]);

  const handleLogout = useCallback(async () => {
    try {
      await fetch("/logout", { method: "POST", credentials: "include", redirect: "follow" });
    } finally {
      localStorage.removeItem("userInfo");
      sessionStorage.removeItem("userInfo");
      onSessionChange(await fetchOptionalSession());
      window.location.href = `/index.html?logout=true&t=${Date.now()}`;
    }
  }, [onSessionChange]);

  return (
    <header className="peas-public-navbar">
      <a className="peas-public-brand" href="/index.html" aria-label="PeAS home">
        <img src="/Components/images/spud-logo.png" alt="" />
        <span>
          <strong>PeAS</strong>
          <small>Research & Publications</small>
        </span>
      </a>

      <nav className="peas-public-navlinks" aria-label="Public navigation">
        {links.map((link) => (
          <a href={link.href} key={link.href}>
            {link.label}
          </a>
        ))}
      </nav>

      <form
        className="peas-public-navsearch"
        onSubmit={(event) => {
          event.preventDefault();
          submitSearch();
        }}
      >
        <Search aria-hidden="true" />
        <input
          aria-label="Search repository"
          placeholder="Search research..."
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
        />
      </form>

      <div className="peas-public-nav-actions">
        {authenticated ? (
          <>
            <a className="peas-public-icon-link" href="/pages/SavedDocument.html" aria-label="Saved documents">
              <BookOpen aria-hidden="true" />
            </a>
            <a className="peas-public-icon-link" href="/pages/UserHistory.html" aria-label="User history">
              <Clock aria-hidden="true" />
            </a>
            <a className="peas-public-user-link" href="/pages/UserProfile.html">
              <UserRound aria-hidden="true" />
              <span>{userName}</span>
            </a>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut aria-hidden="true" />
              Logout
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={() => (window.location.href = "/log-in.html")}>
            Login
          </Button>
        )}
      </div>

      <button className="peas-public-mobile-toggle" type="button" aria-label="Open navigation" onClick={() => setOpen(true)}>
        <Menu aria-hidden="true" />
      </button>

      {open ? (
        <div className="peas-public-mobile-menu">
          <div className="peas-public-mobile-panel">
            <div className="peas-public-mobile-head">
              <span>PeAS</span>
              <button type="button" aria-label="Close navigation" onClick={() => setOpen(false)}>
                <X aria-hidden="true" />
              </button>
            </div>
            <form
              className="peas-public-mobile-search"
              onSubmit={(event) => {
                event.preventDefault();
                submitSearch();
              }}
            >
              <Search aria-hidden="true" />
              <input
                aria-label="Search repository"
                placeholder="Search research..."
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
              />
            </form>
            {links.map((link) => (
              <a href={link.href} key={link.href} onClick={() => setOpen(false)}>
                {link.label}
              </a>
            ))}
            {authenticated ? (
              <>
                <a href="/pages/SavedDocument.html">Saved Documents</a>
                <a href="/pages/UserHistory.html">History</a>
                <a href="/pages/UserProfile.html">Profile</a>
                <Button variant="outline" onClick={handleLogout}>
                  Logout
                </Button>
              </>
            ) : (
              <Button onClick={() => (window.location.href = "/log-in.html")}>Login</Button>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
