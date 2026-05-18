/**
 * AuthModal — single modal that handles both sign-in and sign-up flows.
 *
 * Replaces the old full-page Login / Register screens. Used on the public
 * landing page when a visitor clicks any "Log in" / "Sign up" / "Get started"
 * button. The modal lives over whatever the user was looking at — they can
 * close it and pick up where they left off, no full-page route change needed.
 *
 * Visual: dark dimmer + centered card. Fade-in for the dimmer, scale-in for
 * the card. Esc and backdrop-click close it. The card itself mirrors the
 * inner panel of the old Login.tsx so styling stays familiar.
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { AxiosError } from "axios";
import { authAPI, settingsAPI } from "../../utils/api.ts";
import { getGoogleOAuthUrl } from "../../config/apiBase.ts";
import type { User } from "../../types";

export type AuthMode = "login" | "register";

interface Props {
  open: boolean;
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  onClose: () => void;
  onLogin: (user: User) => void;
}

const DEMO_EMAIL = "demo@hiretrail.com";
const DEMO_PASSWORD = "password123";

export default function AuthModal({ open, mode, onModeChange, onClose, onLogin }: Props) {
  // Keep the panel mounted briefly after `open` flips false so the exit
  // animation can play. `visible` controls the actual DOM presence; `shown`
  // controls the transition state.
  const [visible, setVisible] = useState(open);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (open) {
      setVisible(true);
      // Next tick so the initial styles apply before transitioning to "shown".
      requestAnimationFrame(() => setShown(true));
    } else {
      setShown(false);
      const t = setTimeout(() => setVisible(false), 220);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Esc closes
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose]);

  // Lock body scroll while modal is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={mode === "login" ? "Sign in to HireTrail" : "Create your HireTrail account"}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className={`absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-200 ease-out ${shown ? "opacity-100" : "opacity-0"}`}
      />
      {/* Panel */}
      <div
        className={`relative w-full max-w-[440px] transition-[opacity,transform] duration-220 ease-out ${shown ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-[0.97] translate-y-2"}`}
      >
        <AuthCard
          mode={mode}
          onModeChange={onModeChange}
          onClose={onClose}
          onLogin={onLogin}
        />
      </div>
    </div>
  );
}

function AuthCard({ mode, onModeChange, onClose, onLogin }: Omit<Props, "open">) {
  return (
    <div className="auth-card rounded-2xl p-6 sm:p-8 text-center relative">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute top-3 right-3 w-8 h-8 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-slate-100 hover:bg-muted/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
      </button>

      {mode === "login" ? (
        <LoginForm onLogin={onLogin} onSwitchMode={() => onModeChange("register")} />
      ) : (
        <RegisterForm onLogin={onLogin} onSwitchMode={() => onModeChange("login")} />
      )}
    </div>
  );
}

/* ─────────────────────────── login form ─────────────────────────── */

function LoginForm({ onLogin, onSwitchMode }: { onLogin: (u: User) => void; onSwitchMode: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [maintenanceBanner, setMaintenanceBanner] = useState(false);
  const emailRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    void settingsAPI.getMaintenanceStatus().then(({ maintenanceMode }) => {
      if (maintenanceMode) setMaintenanceBanner(true);
    }).catch(() => {});
    // Focus the email field once the modal animates in.
    const t = setTimeout(() => emailRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError("");
    setLoading(true);
    try {
      const u = await authAPI.login(email, password);
      toast.success(`Welcome back, ${u.name}!`);
      onLogin(u);
    } catch (error) {
      const ax = error as AxiosError<{ error?: string; code?: string }>;
      const status = ax.response?.status;
      const message = ax.response?.data?.error;
      const code = ax.response?.data?.code;
      const friendly =
        code === "MAINTENANCE"
          ? (message || "Scheduled maintenance is in progress.")
          : status === 401
            ? "Incorrect email or password."
            : (message || "Unable to sign in right now. Please try again.");
      setFormError(friendly);
      if (code === "MAINTENANCE") setMaintenanceBanner(true);
      else toast.error(friendly);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setFormError("");
    setLoading(true);
    try {
      const u = await authAPI.login(DEMO_EMAIL, DEMO_PASSWORD);
      toast.success(`Welcome back, ${u.name}!`);
      onLogin(u);
    } catch {
      /* api interceptor toasts on error */
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h2 className="text-3xl font-extrabold text-slate-100 mb-1">Welcome back</h2>
      <p className="text-sm text-slate-400 mb-6">Sign in to your account to continue</p>

      {maintenanceBanner && (
        <div role="status" className="mb-5 rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-left text-sm text-amber-700 dark:text-amber-100">
          Scheduled maintenance is in progress. Only authorized sign-in is available.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 text-left auth-form-stack">
        <div>
          <label className="block text-sm font-medium text-slate-100 mb-1.5">Email Address</label>
          <input ref={emailRef} type="email" className="auth-input-dark" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-100 mb-1.5">Password</label>
          <input type="password" className={`auth-input-dark ${formError ? "!border-red-400 focus:!ring-red-400/20" : ""}`} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" required />
        </div>
        {formError && <p className="text-sm text-danger">{formError}</p>}
        <button type="submit" disabled={loading} className="btn-accent w-full justify-center !py-2.5 mt-2 disabled:opacity-50">
          {loading ? "Signing in..." : "Sign in"}
        </button>
        <button type="button" onClick={handleDemoLogin} disabled={loading} className="btn-secondary demo-login-btn w-full justify-center !py-2.5 disabled:opacity-50">
          Log in as demo user
        </button>
        {loading && <p className="text-xs text-slate-400 text-center">Authenticating... this can take a few seconds.</p>}
      </form>

      <p className="text-center mt-5 text-sm text-slate-400">
        Don&apos;t have an account?{" "}
        <button type="button" onClick={onSwitchMode} className="text-primary font-medium hover:underline">Create one</button>
      </p>

      <div className="flex items-center gap-3 my-4 text-xs">
        <div className="flex-1 h-px bg-border" /><span className="text-slate-400">or continue with</span><div className="flex-1 h-px bg-border" />
      </div>

      <button type="button" onClick={() => { window.location.href = getGoogleOAuthUrl(); }} className="auth-oauth-btn w-full flex items-center justify-center gap-2.5 px-4 py-2.5 border border-border rounded-md text-sm font-medium shadow-sm transition-colors">
        <GoogleIcon />
        Continue with Google
      </button>

      <p className="mt-5 text-[11px] text-slate-400/80 leading-relaxed">
        By signing in you agree to our{" "}
        <Link to="/terms" className="underline hover:text-slate-100">Terms of Service</Link>
        {" "}and{" "}
        <Link to="/privacy" className="underline hover:text-slate-100">Privacy Policy</Link>.
      </p>
    </>
  );
}

/* ─────────────────────────── register form ─────────────────────────── */

function RegisterForm({ onLogin, onSwitchMode }: { onLogin: (u: User) => void; onSwitchMode: () => void }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const firstNameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    void settingsAPI.getMaintenanceStatus().then(({ maintenanceMode: m }) => setMaintenanceMode(m)).catch(() => {});
    const t = setTimeout(() => firstNameRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (maintenanceMode) return;
    setLoading(true);
    const name = `${firstName.trim()} ${lastName.trim()}`.trim();
    if (!name) { toast.error("Please enter your name"); setLoading(false); return; }
    try {
      const u = await authAPI.register(name, email, password);
      toast.success("Account created!");
      onLogin(u);
    } catch (err) {
      const ax = err as AxiosError<{ code?: string; error?: string }>;
      if (ax.response?.status === 503 && ax.response?.data?.code === "MAINTENANCE") {
        setMaintenanceMode(true);
        toast.error(ax.response?.data?.error || "Registration is closed during maintenance.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h2 className="text-3xl font-extrabold text-slate-100 mb-1">Create your account</h2>
      <p className="text-sm text-slate-400 mb-6">Start tracking your job search today</p>

      {maintenanceMode && (
        <div role="status" className="mb-5 rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-left text-sm text-amber-700 dark:text-amber-100">
          New registrations are disabled during scheduled maintenance. Please try again later.
        </div>
      )}

      <button type="button" disabled={maintenanceMode} onClick={() => { window.location.href = getGoogleOAuthUrl(); }} className="auth-oauth-btn w-full flex items-center justify-center gap-2.5 px-4 py-2.5 border border-border rounded-md text-sm font-medium shadow-sm transition-colors disabled:opacity-50 disabled:pointer-events-none">
        <GoogleIcon />
        Continue with Google
      </button>

      <div className="flex items-center gap-3 my-5 text-xs">
        <div className="flex-1 h-px bg-border" /><span className="text-slate-400">Or create an account with email</span><div className="flex-1 h-px bg-border" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 text-left">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-100 mb-1.5">First Name</label>
            <input ref={firstNameRef} type="text" className="auth-input-dark" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First Name" required disabled={maintenanceMode} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-100 mb-1.5">Last Name</label>
            <input type="text" className="auth-input-dark" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last Name" required disabled={maintenanceMode} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-100 mb-1.5">Email Address</label>
          <input type="email" className="auth-input-dark" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required disabled={maintenanceMode} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-100 mb-1.5">Password</label>
          <input type="password" className="auth-input-dark" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" minLength={6} required disabled={maintenanceMode} />
        </div>
        <button type="submit" disabled={loading || maintenanceMode} className="btn-accent w-full justify-center !py-2.5 mt-2 disabled:opacity-50">
          {loading ? "Creating account..." : "Register"}
        </button>
      </form>

      <p className="text-center mt-5 text-sm text-slate-400">
        Already have an account?{" "}
        <button type="button" onClick={onSwitchMode} className="text-primary font-medium hover:underline">Log in</button>
      </p>

      <p className="mt-5 text-[11px] text-slate-400/80 leading-relaxed text-center">
        By creating an account you agree to our{" "}
        <Link to="/terms" className="underline hover:text-slate-100">Terms of Service</Link>
        {" "}and{" "}
        <Link to="/privacy" className="underline hover:text-slate-100">Privacy Policy</Link>.
      </p>
    </>
  );
}

/* ─────────────────────────── google icon ─────────────────────────── */

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" />
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
    </svg>
  );
}
