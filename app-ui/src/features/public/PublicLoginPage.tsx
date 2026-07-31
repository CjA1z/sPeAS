import { useState, type FormEvent } from "react";
import { ArrowLeft, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { AuthShell } from "../../components/public/PublicPageShell";
import { Button } from "../../components/ui/button";
import { getErrorMessage } from "../../lib/api/http";
import { requestPasswordReset, safeSameOriginRedirect, signInMicrosoft, signInUsername } from "../../lib/api/auth";
import { experienceBlockProps, usePublicExperience } from "../../lib/api/experience";

export function PublicLoginPage() {
  const { config, canvasMode } = usePublicExperience("login");
  const content = experienceBlockProps(config, "login", "LoginShellBlock");
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [schoolId, setSchoolId] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState<"password" | "microsoft" | "forgot" | null>(null);
  const [notice, setNotice] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  const submitLogin = async (event: FormEvent) => {
    event.preventDefault();
    if (canvasMode) return;
    if (!schoolId.trim() || !password) return setNotice({ kind: "error", text: "Enter both your School ID and password." });
    setBusy("password"); setNotice(null);
    try {
      const session = await signInUsername(schoolId, password);
      const fallback = session.role === "admin" ? "/admin/dashboard.html" : "/index.html";
      window.location.assign(safeSameOriginRedirect(new URLSearchParams(window.location.search).get("redirect"), fallback));
    } catch (error) { setNotice({ kind: "error", text: getErrorMessage(error) }); }
    finally { setBusy(null); }
  };

  const submitForgot = async (event: FormEvent) => {
    event.preventDefault();
    if (canvasMode) return;
    if (!email.trim()) return setNotice({ kind: "error", text: "Enter your registered email address." });
    setBusy("forgot"); setNotice(null);
    try { await requestPasswordReset(email); setNotice({ kind: "success", text: "If the address is registered, a reset link has been sent." }); }
    catch (error) { setNotice({ kind: "error", text: getErrorMessage(error) }); }
    finally { setBusy(null); }
  };

  return <AuthShell><section className="peas-login-page">
    <div className="peas-login-panel">
      <a className="peas-login-brand" href="/index.html"><img src={String(content.logoUrl || "/Components/images/peas.png")} alt="" /><span>{String(content.brandText || "Paulinian electronic Archiving System (PeAS)")}</span></a>
      {mode === "forgot" ? <button className="peas-login-back" type="button" onClick={() => { setMode("login"); setNotice(null); }}><ArrowLeft aria-hidden="true" /> Back to sign in</button> : null}
      <h1>{String(mode === "forgot" ? content.forgotPasswordTitle || "Forgot Password?" : content.title || "Welcome back")}</h1>
      <p>{String(mode === "forgot" ? content.forgotPasswordSubtitle || "We will send reset instructions to your registered email." : content.subtitle || "Sign in to access PeAS.")}</p>
      {notice ? <div className={`peas-login-notice is-${notice.kind}`} role="status" aria-live="polite">{notice.text}</div> : null}
      {mode === "login" ? <form className="peas-login-form" onSubmit={submitLogin}>
        <label htmlFor="school-id">School ID</label><input id="school-id" autoComplete="username" value={schoolId} onChange={(event) => setSchoolId(event.currentTarget.value)} />
        <label htmlFor="password">Password</label><div className="peas-login-password"><input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.currentTarget.value)} /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</button></div>
        <button className="peas-login-forgot" type="button" onClick={() => { setMode("forgot"); setNotice(null); }}>Forgot password?</button>
        <Button disabled={busy !== null || canvasMode} type="submit">{busy === "password" ? <LoaderCircle className="peas-spin" aria-hidden="true" /> : null} Sign in</Button>
        <div className="peas-login-divider"><span>or</span></div>
        <Button disabled={busy !== null || canvasMode} variant="outline" type="button" onClick={async () => { setBusy("microsoft"); setNotice(null); try { await signInMicrosoft(); } catch (error) { setNotice({ kind: "error", text: getErrorMessage(error) }); setBusy(null); } }}>Continue with Microsoft</Button>
      </form> : <form className="peas-login-form" onSubmit={submitForgot}><label htmlFor="reset-email">Registered email</label><input id="reset-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.currentTarget.value)} /><Button disabled={busy !== null || canvasMode} type="submit">{busy === "forgot" ? "Sending…" : "Send reset instructions"}</Button></form>}
      <small className="peas-login-footer">{String(content.footerText || "PeAS. All Rights Reserved.")}</small>
    </div>
    <div className="peas-login-art" style={{ backgroundImage: `linear-gradient(rgba(0,65,48,.76),rgba(0,65,48,.76)),url(${String(content.backgroundImageUrl || "/Components/images/1.jpg")})` }}><img src={String(content.graphicLogoUrl || "/Components/images/spud_logo_s.png")} alt="St. Paul University Dumaguete" /></div>
  </section></AuthShell>;
}
