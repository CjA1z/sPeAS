import { useCallback, useEffect, useState } from "react";
import { BookMarked, Clock3, LayoutDashboard, LogOut, Menu, UserRound, X } from "lucide-react";
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
  const alwaysGreen = usesAlwaysGreenNavbar();
  const { session, signOut } = usePublicSession();
  const authenticated = Boolean(session?.authenticated);
  const isAdmin = session?.role === "admin";
  const userName = String(session?.user?.name ?? session?.username ?? session?.userId ?? "User");

  useEffect(() => {
    if (alwaysGreen) return;

    const updateScrolled = () => {
      const nextScrolled = window.scrollY > 16;
      setScrolled((current) => (current === nextScrolled ? current : nextScrolled));
    };

    updateScrolled();
    window.addEventListener("scroll", updateScrolled, { passive: true });
    return () => window.removeEventListener("scroll", updateScrolled);
  }, [alwaysGreen]);

  const handleLogout = useCallback(async () => {
    await signOut();
  }, [signOut]);

  return (
    <header className={`peas-public-navbar${alwaysGreen || scrolled ? " is-scrolled" : ""}`}>
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
            {isAdmin ? (
              <a className="peas-public-user-link peas-public-dashboard-link" href="/admin/dashboard.html">
                <LayoutDashboard aria-hidden="true" />
                <span>Dashboard</span>
              </a>
            ) : null}
            <a className="peas-public-icon-link" href="/pages/SavedDocument.html" aria-label="Saved documents">
              <BookMarked aria-hidden="true" />
            </a>
            <a className="peas-public-icon-link" href="/pages/UserHistory.html" aria-label="User history">
              <Clock3 aria-hidden="true" />
            </a>
            <a className="peas-public-user-link" href="/pages/UserProfile.html">
              {session?.user?.image ? <img className="peas-public-user-avatar" src={String(session.user.image)} alt="" /> : <UserRound aria-hidden="true" />}
              <span>{userName}</span>
            </a>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut aria-hidden="true" />
              Logout
            </Button>
          </>
        ) : (
          <Button className="peas-public-login-button" size="sm" onClick={() => (window.location.href = "/log-in.html")}>
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
                {isAdmin ? <a href="/admin/dashboard.html"><LayoutDashboard aria-hidden="true" /> Dashboard</a> : null}
                <a href="/pages/SavedDocument.html"><BookMarked aria-hidden="true" /> Saved Documents</a>
                <a href="/pages/UserHistory.html"><Clock3 aria-hidden="true" /> History</a>
                <a href="/pages/UserProfile.html"><UserRound aria-hidden="true" /> Profile</a>
                <Button variant="outline" onClick={handleLogout}>
                  Logout
                </Button>
              </>
            ) : (
              <Button className="peas-public-login-button" onClick={() => (window.location.href = "/log-in.html")}>Login</Button>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}

function usesAlwaysGreenNavbar() {
  return ["/news.html", "/contact", "/contact.html"].includes(window.location.pathname);
}

function isActivePath(href: string) {
  const current = window.location.pathname;
  if (href === "/index.html") return current === "/" || current === "/index.html";
  return current === href;
}
