import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Archive,
  Bell,
  ClipboardList,
  FileArchive,
  FileText,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Newspaper,
  MailQuestion,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  Settings,
  ShieldCheck,
  UsersRound,
  X,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { fetchSession, fetchUserProfile, logout, type SessionResponse, type UserProfile } from "../../lib/api/auth";
import { Button } from "../ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { GlassBackdrop } from "../ui/glass-surface";
import { fetchAdminContactSummary } from "../../lib/api/adminContact";
import { fetchAdminNotifications, markAdminNotificationRead, type AdminNotification, type AdminNotificationSummary } from "../../lib/api/notifications";

interface AdminLayoutProps {
  children: ReactNode;
  allowedRoles?: WorkspaceRole[];
}

export type WorkspaceRole = "admin" | "publisher";
const ADMIN_ONLY_ROLES: WorkspaceRole[] = ["admin"];
const WORKSPACE_BOOTSTRAP_KEY = "peas-admin-workspace-bootstrap-v1";
const WORKSPACE_BOOTSTRAP_MAX_AGE = 15 * 60 * 1000;

interface WorkspaceBootstrap {
  session: SessionResponse;
  profile: UserProfile | null;
  cachedAt: number;
}

interface AdminIdentity {
  userName: string;
  role: WorkspaceRole;
  roleLabel: "Administrator" | "Content Publisher";
  profile: UserProfile | null;
  updateProfile: (update: Partial<UserProfile>) => void;
}

const AdminIdentityContext = createContext<AdminIdentity | null>(null);

const navItems = [
  { label: "Dashboard", href: "/admin/dashboard.html", icon: LayoutDashboard, roles: ["admin"] as WorkspaceRole[] },
  { label: "Documents", href: "/admin/Components/documents_list.html", icon: FileText, roles: ["admin"] as WorkspaceRole[] },
  { label: "Archived Documents", href: "/admin/Components/archive-documents.html", icon: Archive, roles: ["admin"] as WorkspaceRole[] },
  { label: "Authors", href: "/admin/Components/author-list.html", icon: UsersRound, roles: ["admin"] as WorkspaceRole[] },
  { label: "Document Permissions", href: "/admin/Components/document-permissions.html", icon: ShieldCheck, roles: ["admin"] as WorkspaceRole[] },
  { label: "Operational Reports", href: "/admin/Components/reports.html", icon: ClipboardList, roles: ["admin"] as WorkspaceRole[] },
  { label: "Experience Studio", href: "/admin/Components/experience-studio.html", icon: FileArchive, roles: ["admin"] as WorkspaceRole[] },
  { label: "Department News", href: "/admin/Components/news.html", icon: Newspaper, roles: ["admin", "publisher"] as WorkspaceRole[] },
  { label: "Role Management", href: "/admin/Components/role-management.html", icon: ShieldCheck, roles: ["admin"] as WorkspaceRole[] },
  { label: "Contact Inquiries", href: "/admin/Components/contact-inquiries.html", icon: MailQuestion, roles: ["admin"] as WorkspaceRole[] },
];

const utilityItems = [
  { label: "View Site", href: "/index.html", icon: Home, roles: ["admin", "publisher"] as WorkspaceRole[] },
  { label: "System Logs", href: "/admin/Components/admin_logs.html", icon: ScrollText, roles: ["admin"] as WorkspaceRole[] },
  { label: "Settings", href: "/admin/Components/admin_settings.html", icon: Settings, roles: ["admin"] as WorkspaceRole[] },
];

export function AdminLayout({ children, allowedRoles = ADMIN_ONLY_ROLES }: AdminLayoutProps) {
  const [initialBootstrap] = useState(readWorkspaceBootstrap);
  const [session, setSession] = useState<SessionResponse | null>(initialBootstrap?.session ?? null);
  const [sessionLoaded, setSessionLoaded] = useState(Boolean(initialBootstrap));
  const [profile, setProfile] = useState<UserProfile | null>(initialBootstrap?.profile ?? null);
  const [collapsed, setCollapsed] = useStoredSidebarState();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() => window.matchMedia("(max-width: 980px)").matches);
  const [contactNewCount, setContactNewCount] = useState(0);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [notificationSummary, setNotificationSummary] = useState<AdminNotificationSummary>({ total: 0, unread: 0, urgent: 0 });
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 980px)");
    const updateViewport = () => {
      setIsMobileViewport(media.matches);
      if (!media.matches) setMobileOpen(false);
    };
    updateViewport();
    media.addEventListener("change", updateViewport);
    return () => media.removeEventListener("change", updateViewport);
  }, []);

  useEffect(() => {
    let mounted = true;
    Promise.allSettled([fetchSession(), fetchUserProfile()]).then(([sessionResult, profileResult]) => {
      if (!mounted) return;
      const nextSession = sessionResult.status === "fulfilled" ? sessionResult.value : null;
      const nextProfile = profileResult.status === "fulfilled" ? profileResult.value : null;
      setSession(nextSession);
      setProfile(nextProfile);
      setSessionLoaded(true);
      if (nextSession) writeWorkspaceBootstrap({ session: nextSession, profile: nextProfile, cachedAt: Date.now() });
      else clearWorkspaceBootstrap();
    });

    return () => {
      mounted = false;
    };
  }, []);

  const workspaceRole = normalizeWorkspaceRole(session?.role ?? session?.user?.role);

  const updateProfile = useCallback((update: Partial<UserProfile>) => {
    setProfile((current) => {
      const nextProfile = { ...(current ?? {}), ...update };
      if (session) writeWorkspaceBootstrap({ session, profile: nextProfile, cachedAt: Date.now() });
      return nextProfile;
    });
  }, [session]);

  useEffect(() => {
    if (workspaceRole !== "admin") return;
    fetchAdminContactSummary()
      .then((payload) => setContactNewCount(payload.byStatus.new))
      .catch(() => undefined);
  }, [workspaceRole]);

  const refreshNotifications = useCallback(async () => {
    if (workspaceRole !== "admin") return;
    try {
      const result = await fetchAdminNotifications();
      setNotifications(result.notifications);
      setNotificationSummary(result.summary);
    } catch {
      // The admin shell should remain usable when notifications are unavailable.
    }
  }, [workspaceRole]);

  useEffect(() => { void refreshNotifications(); }, [refreshNotifications]);

  useEffect(() => {
    if (!sessionLoaded) return;
    if (!session) {
      const redirect = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
      window.location.replace(`/log-in.html?redirect=${redirect}`);
      return;
    }
    if (!workspaceRole || !allowedRoles.includes(workspaceRole)) {
      const destination = workspaceRole === "publisher"
        ? "/admin/Components/news.html"
        : "/index.html";
      const timer = window.setTimeout(() => window.location.replace(destination), 900);
      return () => window.clearTimeout(timer);
    }
  }, [allowedRoles, session, sessionLoaded, workspaceRole]);

  const userName = useMemo(() => {
    const names = [profile?.first_name, profile?.middle_name, profile?.last_name]
      .map((value) => String(value ?? "").trim())
      .filter(Boolean);
    return names.join(" ") || String(session?.user?.name ?? session?.username ?? session?.userId ?? "Administrator");
  }, [profile, session]);

  const role = workspaceRole === "publisher" ? "Content Publisher" : "Administrator";
  const sidebarToggleLabel = isMobileViewport
    ? (mobileOpen ? "Close navigation" : "Open navigation")
    : (collapsed ? "Expand sidebar" : "Collapse sidebar");
  const nameParts = userName.trim().split(/\s+/).filter(Boolean);
  const initials = nameParts.length > 1
    ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
    : (nameParts[0]?.[0] || "A").toUpperCase();

  const handleLogout = useCallback(async () => {
    try {
      localStorage.removeItem("userInfo");
      sessionStorage.removeItem("userInfo");
      clearWorkspaceBootstrap();
      await logout();
    } finally {
      window.location.href = `/index.html?loggedOut=true&t=${Date.now()}`;
    }
  }, []);

  if (!sessionLoaded || !session) {
    return <WorkspaceGate message="Checking your workspace access…" />;
  }

  if (!workspaceRole || !allowedRoles.includes(workspaceRole)) {
    return <WorkspaceGate message="You do not have access to this workspace. Redirecting…" />;
  }

  return (
    <AdminIdentityContext.Provider value={{ userName, role: workspaceRole, roleLabel: role, profile, updateProfile }}>
    <div className={`peas-admin-shell${collapsed ? " is-collapsed" : ""}`}>
      <AdminSidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        onLogout={handleLogout}
        contactNewCount={contactNewCount}
        role={workspaceRole}
      />

      <div className="peas-admin-frame">
        <header className="peas-admin-topbar">
          <GlassBackdrop />
          <div className="peas-admin-topbar__left">
            <button
              className={`peas-admin-icon-btn peas-admin-sidebar-toggle${mobileOpen ? " is-mobile-open" : ""}`}
              type="button"
              aria-label={sidebarToggleLabel}
              aria-expanded={isMobileViewport ? mobileOpen : !collapsed}
              aria-controls="peas-admin-sidebar"
              title={sidebarToggleLabel}
              onClick={() => {
                if (isMobileViewport) {
                  setMobileOpen((open) => !open);
                  return;
                }
                setCollapsed(!collapsed);
              }}
            >
              <Menu className="peas-admin-sidebar-toggle__mobile-icon" aria-hidden="true" />
              {collapsed ? <PanelLeftOpen className="peas-admin-sidebar-toggle__desktop-icon" aria-hidden="true" /> : <PanelLeftClose className="peas-admin-sidebar-toggle__desktop-icon" aria-hidden="true" />}
            </button>
          </div>

          <div className="peas-admin-topbar__right">
            <div className="peas-admin-notifications">
            <button className="peas-admin-icon-btn" type="button" aria-label={`Notifications${notificationSummary.urgent ? `, ${notificationSummary.urgent} urgent` : ""}`} aria-expanded={notificationsOpen} onClick={() => { setNotificationsOpen((open) => !open); if (!notificationsOpen) void refreshNotifications(); }}>
              <Bell aria-hidden="true" />
              {notificationSummary.urgent ? <span className="peas-admin-notification-badge" aria-hidden="true">{notificationSummary.urgent > 99 ? "99+" : notificationSummary.urgent}</span> : null}
            </button>
            {notificationsOpen ? <AdminNotificationPanel notifications={notifications} onClose={() => setNotificationsOpen(false)} onOpen={async (notification) => { if (!notification.isRead) { await markAdminNotificationRead(notification.id).catch(() => undefined); } setNotificationsOpen(false); if (notification.actionPath) window.location.assign(notification.actionPath); }} /> : null}
            </div>
            <div className="peas-admin-user">
              <Avatar>
                {profile?.profile_picture ? <AvatarImage src={normalizeProfilePicture(profile.profile_picture)} alt="" /> : null}
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <span className="peas-admin-user__details">
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
    </AdminIdentityContext.Provider>
  );
}

function AdminNotificationPanel({ notifications, onClose, onOpen }: { notifications: AdminNotification[]; onClose: () => void; onOpen: (notification: AdminNotification) => void }) {
  return <div className="peas-admin-notification-panel" role="dialog" aria-label="Notifications">
    <header><div><strong>Notifications</strong><small>Items requiring administrator attention</small></div><button type="button" aria-label="Close notifications" onClick={onClose}>×</button></header>
    {notifications.length ? <div className="peas-admin-notification-list">{notifications.map((notification) => <button type="button" className={`peas-admin-notification${notification.isRead ? " is-read" : ""}`} key={notification.id} onClick={() => void onOpen(notification)}><span className="peas-admin-notification__icon"><AlertTriangle aria-hidden="true" /></span><span><strong>{notification.title}</strong><small>{notification.message}</small><em>Complete profile <ArrowRight aria-hidden="true" /></em></span></button>)}</div> : <p className="peas-admin-notification-empty">You’re all caught up.</p>}
  </div>;
}

export function useAdminIdentity() {
  const identity = useContext(AdminIdentityContext);
  if (!identity) throw new Error("useAdminIdentity must be used within AdminLayout");
  return identity;
}

function AdminSidebar({
  collapsed,
  mobileOpen,
  onCloseMobile,
  onLogout,
  contactNewCount,
  role,
}: {
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onLogout: () => void;
  contactNewCount: number;
  role: WorkspaceRole;
}) {
  const visibleNavItems = navItems.filter((item) => item.roles.includes(role));
  const visibleUtilityItems = utilityItems.filter((item) => item.roles.includes(role));

  return (
    <>
      {mobileOpen ? <button className="peas-admin-sidebar-backdrop" type="button" aria-label="Close navigation" onClick={onCloseMobile} /> : null}
      <aside id="peas-admin-sidebar" className={`peas-admin-sidebar${mobileOpen ? " is-mobile-open" : ""}`} aria-label="Admin navigation">
        <GlassBackdrop />
        <div className="peas-admin-sidebar__brand">
          <img src="/admin/Components/img/logo_2.png" alt="" />
          <span>
            <strong>Office of Research & Publications</strong>
            <small>{role === "publisher" ? "Content Workspace" : "PeAS Admin"}</small>
          </span>
          {mobileOpen ? (
            <button className="peas-admin-icon-btn peas-admin-sidebar__close" type="button" aria-label="Close navigation" onClick={onCloseMobile}>
              <X aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <a className="peas-admin-upload-link" href="/admin/Components/upload_document.html">
          <span>Upload Document</span>
        </a>

        <nav className="peas-admin-nav" aria-label="Workspace">
          <small>Workspace</small>
          {visibleNavItems.map((item) => <AdminNavLink item={item} badge={item.label === "Contact Inquiries" ? contactNewCount : 0} key={item.href} />)}
        </nav>

        <nav className="peas-admin-nav peas-admin-nav--utility" aria-label="Utilities">
          {visibleUtilityItems.map((item) => <AdminNavLink item={item} key={item.href} />)}
          <Button className="peas-admin-logout" variant="ghost" onClick={onLogout}>
            <LogOut aria-hidden="true" />
            <span>Logout</span>
          </Button>
        </nav>
      </aside>
    </>
  );
}

function AdminNavLink({ item, badge = 0 }: { item: (typeof navItems)[number] | (typeof utilityItems)[number]; badge?: number }) {
  const Icon = item.icon;
  const active = normalizePath(window.location.pathname) === normalizePath(item.href);

  return (
    <a className={active ? "is-active" : ""} href={item.href} aria-current={active ? "page" : undefined}>
      <Icon aria-hidden="true" />
      <span>{item.label}</span>
      {badge > 0 ? <small className="peas-admin-nav-badge" aria-label={`${badge} new inquiries`}>{badge > 99 ? "99+" : badge}</small> : null}
    </a>
  );
}

function WorkspaceGate({ message }: { message: string }) {
  return (
    <main className="peas-admin-gate" role="status">
      <img src="/admin/Components/img/logo_2.png" alt="" />
      <h1>PeAS Workspace</h1>
      <p>{message}</p>
    </main>
  );
}

function normalizeWorkspaceRole(value: unknown): WorkspaceRole | null {
  const role = String(value ?? "").toLowerCase();
  return role === "admin" || role === "publisher" ? role : null;
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

function normalizeProfilePicture(path: string) {
  return path.startsWith("http") || path.startsWith("/") ? path : `/${path}`;
}

function readWorkspaceBootstrap(): WorkspaceBootstrap | null {
  try {
    const raw = sessionStorage.getItem(WORKSPACE_BOOTSTRAP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WorkspaceBootstrap;
    if (!parsed.session || Date.now() - Number(parsed.cachedAt) > WORKSPACE_BOOTSTRAP_MAX_AGE) {
      clearWorkspaceBootstrap();
      return null;
    }
    return parsed;
  } catch {
    clearWorkspaceBootstrap();
    return null;
  }
}

function writeWorkspaceBootstrap(value: WorkspaceBootstrap) {
  try {
    sessionStorage.setItem(WORKSPACE_BOOTSTRAP_KEY, JSON.stringify(value));
  } catch {
    // Storage can be unavailable in privacy modes; server validation still works.
  }
}

function clearWorkspaceBootstrap() {
  try {
    sessionStorage.removeItem(WORKSPACE_BOOTSTRAP_KEY);
  } catch {
    // Nothing else to clear.
  }
}
