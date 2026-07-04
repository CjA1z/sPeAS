import { Render } from "@puckeditor/core";
import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  defaultExperienceConfig,
  ExperienceConfig,
  ExperienceConfigSchema,
} from "../../../Deno/shared/experienceConfig";
import { experiencePuckConfig } from "../shared/puckConfig";
import "../styles.css";

type LoginProps = Record<string, any>;

function getStoredUser() {
  try {
    const raw = sessionStorage.getItem("userInfo") || localStorage.getItem("userInfo");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function replaceTokens(value: unknown, user: any): unknown {
  const role = user?.role || "guest";
  const firstName = user?.first_name || user?.firstName || user?.username || user?.id || "there";
  const tokenValues: Record<string, string> = {
    first_name: String(firstName),
    role: String(role),
    department: String(user?.department || user?.college || user?.office || ""),
    saved_count: String(user?.savedCount ?? user?.saved_count ?? 0),
    recent_activity: String(user?.recentActivity || user?.recent_activity || ""),
    role_quick_link: String(role).toLowerCase() === "admin" ? "/admin/dashboard.html" : "/pages/SavedDocument.html",
  };

  if (typeof value === "string") {
    return value.replace(/\{\{([a-z_]+)\}\}/g, (match, token: string) => tokenValues[token] ?? match);
  }
  if (Array.isArray(value)) return value.map((item) => replaceTokens(item, user));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, replaceTokens(item, user)]),
    );
  }
  return value;
}

function applyThemeVars(theme: ExperienceConfig["theme"]) {
  const root = document.documentElement;
  root.style.setProperty("--xp-primary", theme.primaryColor);
  root.style.setProperty("--xp-primary-dark", theme.primaryDarkColor);
  root.style.setProperty("--xp-accent", theme.accentColor);
  root.style.setProperty("--xp-surface", theme.surfaceColor);
  root.style.setProperty("--xp-text", theme.textColor);
  root.style.setProperty("--xp-muted", theme.mutedTextColor);
  root.style.setProperty("--xp-bg", theme.pageBackground);
  root.style.setProperty("--xp-radius", theme.radius === "compact" ? "8px" : theme.radius === "rounded" ? "18px" : "14px");
  document.body.classList.add("xp-runtime-body");
}

let draftPreviewActive = false;

// Canvas mode: the page is embedded in the Experience Studio's preview iframe
// and renders whatever config the studio streams in via postMessage.
const canvasMode = window.parent !== window &&
  new URLSearchParams(location.search).get("experienceCanvas") === "1";

if (canvasMode) {
  // Keep the preview stable: links must not navigate the canvas away and
  // forms (e.g. the login form) must not fire real requests.
  document.addEventListener("click", (event) => {
    const anchor = (event.target as HTMLElement | null)?.closest?.("a[href]");
    if (anchor) event.preventDefault();
  }, true);
  document.addEventListener("submit", (event) => {
    event.preventDefault();
    event.stopPropagation();
  }, true);
}

function CanvasHost({ page }: { page: "landing" | "login" }) {
  const [config, setConfig] = useState<ExperienceConfig | null>(null);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== location.origin) return;
      if (event.data?.type !== "experience-config") return;
      const parsed = ExperienceConfigSchema.safeParse(event.data.config);
      // Ignore configs that are invalid mid-edit and keep the last good one.
      if (!parsed.success) return;
      applyThemeVars(parsed.data.theme);
      setConfig(parsed.data);
    };
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: "experience-canvas-ready", page }, location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, [page]);

  if (!config) return null;
  return page === "landing"
    ? <LandingExperience config={config} />
    : <LoginExperience config={config} />;
}

async function loadExperience(): Promise<ExperienceConfig | null> {
  // ?experiencePreview=draft lets admins preview the unpublished draft; the
  // endpoint is admin-gated, so everyone else falls through to the live config.
  if (new URLSearchParams(location.search).get("experiencePreview") === "draft") {
    try {
      const response = await fetch("/api/admin/experience/draft", {
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (response.ok) {
        const payload = await response.json();
        draftPreviewActive = true;
        return ExperienceConfigSchema.parse(payload.config || payload);
      }
    } catch {
      // Fall through to the published config.
    }
  }

  try {
    const response = await fetch("/api/experience/public", {
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    const payload = await response.json();
    return ExperienceConfigSchema.parse(payload.config || payload);
  } catch {
    return null;
  }
}

function showDraftPreviewBadge() {
  if (!draftPreviewActive) return;
  const badge = document.createElement("div");
  badge.className = "xp-draft-badge";
  badge.textContent = "Draft preview — not published yet";
  document.body.appendChild(badge);
}

function LandingExperience({ config }: { config: ExperienceConfig }) {
  const user = getStoredUser();
  const data = useMemo(() => {
    const next = JSON.parse(JSON.stringify(config.pages.landing.data));
    next.content = replaceTokens(next.content, user);

    if (config.personalization.enabled && user?.isLoggedIn) {
      next.content.unshift({
        type: "AnnouncementBanner",
        props: {
          id: "personalized-greeting",
          tone: "green",
          text: (config.personalization.greetingTemplate || "Welcome back, {{first_name}}")
            .replace("{{first_name}}", user.first_name || user.username || user.id || "there"),
          href: String(user.role || "").toLowerCase() === "admin" ? "/admin/dashboard.html" : "/pages/SavedDocument.html",
          linkLabel: String(user.role || "").toLowerCase() === "admin" ? "Open dashboard" : "Open saved documents",
        },
      });
    }

    return next;
  }, [config, user]);

  return <Render config={experiencePuckConfig} data={data} />;
}

function LoginExperience({ config }: { config: ExperienceConfig }) {
  const shell = config.pages.login.data.content.find((block) => block.type === "LoginShellBlock");
  const props = (shell?.props || {}) as LoginProps;
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [schoolId, setSchoolId] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"idle" | "error" | "success">("idle");
  const [loading, setLoading] = useState(false);

  const showMessage = (text: string, type: "error" | "success") => {
    setMessage(text);
    setMessageType(type);
  };

  const submitLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!schoolId.trim() || !password.trim()) {
      showMessage("Please enter both School ID and Password", "error");
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ID: schoolId.trim(), Password: password.trim() }),
        credentials: "include",
      });
      const result = await response.json();

      if (!response.ok) {
        showMessage(result.message || "Login failed. Please check your credentials.", "error");
        return;
      }

      const userInfo = {
        isLoggedIn: true,
        id: result.userId || schoolId.trim(),
        role: result.role || "User",
        username: result.username || schoolId.trim(),
        serverTime: result.serverTime || Date.now(),
        loginTime: Date.now(),
      };

      sessionStorage.setItem("userInfo", JSON.stringify(userInfo));
      localStorage.setItem("userInfo", JSON.stringify(userInfo));
      window.dispatchEvent(new StorageEvent("storage", {
        key: "userInfo",
        newValue: JSON.stringify(userInfo),
        storageArea: localStorage,
      }));

      showMessage(result.message || "Login successful! Redirecting...", "success");
      setTimeout(() => {
        window.location.href = result.redirect || (String(result.role || "").toLowerCase() === "admin" ? "/admin/dashboard.html" : "/index.html");
      }, 900);
    } catch {
      showMessage("An unexpected error occurred. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  const submitForgot = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) {
      showMessage("Please enter your registered email", "error");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const result = await response.json();
      if (!response.ok) {
        showMessage(result.message || "Failed to send reset link. Please try again.", "error");
        return;
      }
      showMessage(result.message || "Password reset link sent! Please check your email.", "success");
    } catch {
      showMessage("An unexpected error occurred. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  const closeLogin = () => {
    if (document.referrer && document.referrer !== window.location.href) {
      window.history.back();
    } else {
      window.location.href = "/index.html";
    }
  };

  return (
    <main className="xp-login-runtime">
      <button className="main-close-button" aria-label="Close Login Form" onClick={closeLogin}>×</button>
      <section className={`xp-login-shell xp-login-${props.layout || "split"}`}>
        <div className="xp-login-form-surface">
          <div>
            <a href="/index.html" className="xp-login-brand" aria-label="Back to PeAS Main Page">
              {props.logoUrl ? <img src={props.logoUrl} alt="" /> : null}
              <span>{props.brandText || config.theme.brandName}</span>
            </a>
            <h1>{mode === "forgot" ? props.forgotPasswordTitle || "Forgot Password?" : props.title || "Welcome back"}</h1>
            <p>{mode === "forgot" ? props.forgotPasswordSubtitle || "No worries, we'll send you reset instructions." : props.subtitle}</p>
          </div>

          {message ? <div className={`xp-message is-${messageType}`}>{message}</div> : <div className="xp-message">Secure session cookie authentication is enabled.</div>}

          {mode === "login" ? (
            <form className="xp-auth-form" onSubmit={submitLogin}>
              <label htmlFor="xp-school-id">{props.schoolIdLabel || "School ID"}</label>
              <input
                id="xp-school-id"
                value={schoolId}
                onChange={(event) => setSchoolId(event.target.value)}
                placeholder={props.schoolIdPlaceholder || "Enter your School ID"}
                autoComplete="username"
                required
              />
              <label htmlFor="xp-password">{props.passwordLabel || "Password"}</label>
              <input
                id="xp-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={props.passwordPlaceholder || "••••••••"}
                autoComplete="current-password"
                required
              />
              <button type="submit" disabled={loading}>{loading ? "Signing in..." : props.submitLabel || "Sign in"}</button>
              <button className="xp-form-link" type="button" onClick={() => setMode("forgot")}>
                {props.forgotPasswordLabel || "Forgot Password?"}
              </button>
            </form>
          ) : (
            <form className="xp-auth-form" onSubmit={submitForgot}>
              <label htmlFor="xp-email">Registered Email</label>
              <input
                id="xp-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="e.g., user@example.com"
                autoComplete="email"
                required
              />
              <button type="submit" disabled={loading}>{loading ? "Sending..." : "Send Reset Link"}</button>
              <button className="xp-form-link" type="button" onClick={() => setMode("login")}>Back to Login</button>
            </form>
          )}

          <small className="xp-login-footer">© {new Date().getFullYear()} {props.footerText || "PeAS. All Rights Reserved."}</small>
        </div>
        <div className="xp-login-graphic" style={{ backgroundImage: `url(${props.backgroundImageUrl || ""})` }}>
          {props.graphicLogoUrl ? <img src={props.graphicLogoUrl} alt="" /> : null}
        </div>
      </section>
    </main>
  );
}

async function mountLanding() {
  const config = canvasMode ? null : await loadExperience();
  if (!canvasMode && !config) return;
  if (config) applyThemeVars(config.theme);

  const container = document.getElementById("page-content-container");
  if (!container) return;
  container.innerHTML = '<div class="xp-runtime-mount" id="xp-public-landing"></div>';
  document.querySelector(".footer-wrapper")?.setAttribute("hidden", "true");

  const mount = document.getElementById("xp-public-landing");
  if (!mount) return;
  if (canvasMode) {
    createRoot(mount).render(<CanvasHost page="landing" />);
    return;
  }
  createRoot(mount).render(<LandingExperience config={config!} />);
  showDraftPreviewBadge();
}

async function mountLogin() {
  const existing = document.getElementById("mainLoginFormContainer");
  if (existing) existing.setAttribute("hidden", "true");

  const mount = document.createElement("div");
  mount.id = "xp-public-login";
  document.body.appendChild(mount);

  if (canvasMode) {
    createRoot(mount).render(<CanvasHost page="login" />);
    return;
  }

  const config = await loadExperience() || defaultExperienceConfig;
  applyThemeVars(config.theme);
  createRoot(mount).render(<LoginExperience config={config} />);
  showDraftPreviewBadge();
}

const page = document.documentElement.dataset.experiencePage ||
  (location.pathname.includes("log-in") ? "login" : location.pathname.endsWith("/") || location.pathname.includes("index") ? "landing" : "");

if (page === "landing") {
  mountLanding();
} else if (page === "login") {
  mountLogin();
}
