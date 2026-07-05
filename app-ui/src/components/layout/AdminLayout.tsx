import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Archive,
  Bell,
  ClipboardList,
  FileArchive,
  FilePlus2,
  FileText,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  ScrollText,
  Settings,
  ShieldCheck,
  UsersRound,
  X,
} from "lucide-react";
import { fetchSession, fetchUserProfile, logout, type SessionResponse, type UserProfile } from "../../lib/api/auth";
import { Button } from "../ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { GlassBackdrop } from "../ui/glass-surface";

interface AdminLayoutProps {
  children: ReactNode;
}

const navItems = [
  { label: "Dashboard", href: "/admin/dashboard.html", icon: LayoutDashboard },
  { label: "Documents List", href: "/admin/Components/documents_list.html", icon: FileText },
  { label: "Archive Documents", href: "/admin/Components/archive-documents.html", icon: Archive },
  { label: "Author List", href: "/admin/Components/author-list.html", icon: UsersRound },
  { label: "Document Permissions", href: "/admin/Components/document-permissions.html", icon: ShieldCheck },
  { label: "Generate Reports", href: "/admin/Components/reports.html", icon: ClipboardList },
  { label: "Experience Studio", href: "/admin/Components/experience-studio.html", icon: FileArchive },
];

const utilityItems = [
  { label: "View Site", href: "/index.html", icon: Home },
  { label: "System Logs", href: "/admin/Components/admin_logs.html", icon: ScrollText },
  { label: "Settings", href: "/admin/Components/admin_settings.html", icon: Settings },
];

export function AdminLayout({ children }: AdminLayoutProps) {
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [collapsed, setCollapsed] = useStoredSidebarState();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetchSession().then((payload) => {
      if (mounted) setSession(payload);
    }).catch(() => {
      if (mounted) setSession(null);
    });

    fetchUserProfile().then((payload) => {
      if (mounted) setProfile(payload);
    }).catch(() => {
      if (mounted) setProfile(null);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const userName = useMemo(() => {
    const names = [profile?.first_name, profile?.middle_name, profile?.last_name]
      .map((value) => String(value ?? "").trim())
      .filter(Boolean);
    return names.join(" ") || String(session?.username ?? session?.userId ?? "Admin");
  }, [profile, session]);

  const role = String(session?.role ?? session?.user?.role ?? "Admin");
  const initials = userName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "A";

  const handleLogout = useCallback(async () => {
    try {
      localStorage.removeItem("userInfo");
      sessionStorage.removeItem("userInfo");
      await logout();
    } finally {
      window.location.href = `/index.html?loggedOut=true&t=${Date.now()}`;
    }
  }, []);

  return (
    <div className={`peas-admin-shell${collapsed ? " is-collapsed" : ""}`}>
      <AdminSidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        onLogout={handleLogout}
      />

      <div className="peas-admin-frame">
        <header className="peas-admin-topbar">
          <GlassBackdrop />
          <div className="peas-admin-topbar__left">
            <button className="peas-admin-icon-btn peas-admin-mobile-menu" type="button" aria-label="Open navigation" onClick={() => setMobileOpen(true)}>
              <Menu aria-hidden="true" />
            </button>
            <button className="peas-admin-collapse-btn" type="button" onClick={() => setCollapsed(!collapsed)}>
              {collapsed ? "Expand" : "Collapse"}
            </button>
          </div>

          <div className="peas-admin-topbar__right">
            <button className="peas-admin-icon-btn" type="button" aria-label="Notifications">
              <Bell aria-hidden="true" />
            </button>
            <div className="peas-admin-user">
              <Avatar>
                {profile?.profile_picture ? <AvatarImage src={`/${profile.profile_picture}`} alt="" /> : null}
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <span>
                <strong>{userName}</strong>
                <small>{role}</small>
              </span>
            </div>
          </div>
        </header>

        <div className="peas-admin-content">
          {children}
        </div>
      </div>
    </div>
  );
}

function AdminSidebar({
  collapsed,
  mobileOpen,
  onCloseMobile,
  onLogout,
}: {
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onLogout: () => void;
}) {
  return (
    <>
      {mobileOpen ? <button className="peas-admin-sidebar-backdrop" type="button" aria-label="Close navigation" onClick={onCloseMobile} /> : null}
      <aside className={`peas-admin-sidebar${mobileOpen ? " is-mobile-open" : ""}`} aria-label="Admin navigation">
        <GlassBackdrop />
        <div className="peas-admin-sidebar__brand">
          <img src="/admin/Components/img/logo_2.png" alt="" />
          <span>
            <strong>Office of Research & Publications</strong>
            <small>PeAS Admin</small>
          </span>
          <button className="peas-admin-icon-btn peas-admin-sidebar__close" type="button" aria-label="Close navigation" onClick={onCloseMobile}>
            <X aria-hidden="true" />
          </button>
        </div>

        <a className="peas-admin-upload-link" href="/admin/Components/upload_document.html">
          <FilePlus2 aria-hidden="true" />
          <span>Upload Document</span>
        </a>

        <nav className="peas-admin-nav" aria-label="Workspace">
          <small>Workspace</small>
          {navItems.map((item) => <AdminNavLink item={item} key={item.href} />)}
        </nav>

        <nav className="peas-admin-nav peas-admin-nav--utility" aria-label="Utilities">
          {utilityItems.map((item) => <AdminNavLink item={item} key={item.href} />)}
          <Button variant="ghost" onClick={onLogout}>
            <LogOut aria-hidden="true" />
            <span>Logout</span>
          </Button>
        </nav>
      </aside>
    </>
  );
}

function AdminNavLink({ item }: { item: (typeof navItems)[number] }) {
  const Icon = item.icon;
  const active = normalizePath(window.location.pathname) === normalizePath(item.href);

  return (
    <a className={active ? "is-active" : ""} href={item.href} aria-current={active ? "page" : undefined}>
      <Icon aria-hidden="true" />
      <span>{item.label}</span>
    </a>
  );
}

function useStoredSidebarState(): [boolean, (value: boolean) => void] {
  const [collapsed, setCollapsedState] = useState(() => localStorage.getItem("peas-admin-sidebar-collapsed") === "true");

  const setCollapsed = useCallback((value: boolean) => {
    setCollapsedState(value);
    localStorage.setItem("peas-admin-sidebar-collapsed", String(value));
  }, []);

  return [collapsed, setCollapsed];
}

function normalizePath(path: string) {
  return path.replace(/\/+$/, "");
}
