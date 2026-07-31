import { useCallback, useEffect, useState } from "react";
import { BookOpen, Clock, LogOut, Menu, UserRound, X } from "lucide-react";
import { Button } from "../ui/button";
import { usePublicSession } from "./PublicSessionProvider";

const links = [
  { label: "Home", href: "/index.html" },
  { label: "News", href: "/news.html" },
  { label: "Contact", href: "/contact.html" },
];

export function PublicNavbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { session, signOut } = usePublicSession();
  const authenticated = Boolean(session?.authenticated);
  const userName = String(session?.user?.name ?? session?.username ?? session?.userId ?? "User");

  useEffect(() => {
    const updateScrolled = () => {
      const nextScrolled = window.scrollY > 16;
      setScrolled((current) => (current === nextScrolled ? current : nextScrolled));
    };

    updateScrolled();
    window.addEventListener("scroll", updateScrolled, { passive: true });
    return () => window.removeEventListener("scroll", updateScrolled);
  }, []);

  const handleLogout = useCallback(async () => {
    await signOut();
  }, [signOut]);

  return (
    <header className={`peas-public-navbar${scrolled ? " is-scrolled" : ""}`}>
      <a className="peas-public-brand" href="/index.html" aria-label="PeAS home">
        <img src="/Components/images/spud_logo_s.png" alt="" />
        <span>
          <strong>Office of Research & Publications</strong>
          <small>St. Paul University – Dumaguete</small>
        </span>
      </a>

      <nav className="peas-public-navlinks" aria-label="Public navigation">
        {links.map((link) => (
          <a href={link.href} key={link.href} aria-current={isActivePath(link.href) ? "page" : undefined}>
            {link.label}
          </a>
        ))}
      </nav>

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
            {links.map((link) => (
              <a
                href={link.href}
                key={link.href}
                aria-current={isActivePath(link.href) ? "page" : undefined}
                onClick={() => setOpen(false)}
              >
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

function isActivePath(href: string) {
  const current = window.location.pathname;
  if (href === "/index.html") return current === "/" || current === "/index.html";
  return current === href;
}
