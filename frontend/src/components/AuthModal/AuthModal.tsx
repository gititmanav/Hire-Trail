/**
 * AuthModal — the one sign-in / sign-up dialog.
 *
 * Opened from the landing page ("Log in", "Sign up", every call to action)
 * and from the demo upgrade prompt inside the app. Built on ui/Modal (focus
 * trap, Escape, scroll lock, exit motion) and the shared fields and buttons,
 * wearing the dark tokens on a deeper surface (`.auth-surface`) so it reads
 * the same over the landing's black and over the app.
 *
 * A theme the visitor built on the landing is shown in sign-up and carried
 * into the new account (utils/landingTheme.ts; the ThemeProvider adopts it).
 */
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Info, Play, X } from "lucide-react";
import toast from "react-hot-toast";
import { AxiosError } from "axios";
import { authAPI, settingsAPI } from "../../utils/api.ts";
import { getGoogleOAuthUrl } from "../../config/apiBase.ts";
import { peekLandingTheme, saveLandingTheme, setLandingThemeIntent } from "../../utils/landingTheme.ts";
import { generated } from "../../utils/themeDom.ts";
import type { ThemePrefs } from "../../utils/preferences.ts";
import type { User } from "../../types";
import { Modal } from "../ui/Modal.tsx";
import Button from "../ui/Button.tsx";
import { Field, Input } from "../ui/Field.tsx";
import BrandMark from "../BrandMark/BrandMark.tsx";

export type AuthMode = "login" | "register";

interface Props {
  open: boolean;
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  onClose: () => void;
  onLogin: (user: User) => void;
  /** Optional banner shown above the form — used by the demo upgrade flow to
   *  explain which feature triggered the prompt. */
  contextHeader?: string;
}

const DEMO_EMAIL = "demo@hiretrail.com";
const DEMO_PASSWORD = "password123";

export default function AuthModal({ open, mode, onModeChange, onClose, onLogin, contextHeader }: Props) {
  if (!open) return null;
  return (
    <Modal
      onClose={onClose}
      size="sm"
      ariaLabel={mode === "login" ? "Sign in to HireTrail" : "Create your HireTrail account"}
      className="theme-dark dark auth-surface"
      overlayClassName="auth-overlay"
      motion="soft"
    >
      <div className="relative overflow-y-auto px-6 sm:px-8 pt-8 pb-7">
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute top-3.5 right-3.5 w-8 h-8 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-control transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X size={16} strokeWidth={2} aria-hidden />
        </button>
        <div className="flex flex-col items-center text-center">
          <BrandMark size={36} tone="dark" />
          <h2 className="mt-5 text-[22px] font-semibold tracking-[-0.02em] text-foreground">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {mode === "login" ? "Sign in to pick up where you left off." : "Free, and ready in a minute."}
          </p>
        </div>

        {contextHeader && (
          <div role="status" className="mt-6 flex items-start gap-2 rounded-lg border border-border bg-control/60 px-3.5 py-3 text-left text-[13px] leading-snug text-foreground">
            <Info size={15} strokeWidth={2} aria-hidden className="mt-0.5 shrink-0 text-muted-foreground" />
            <span>{contextHeader}</span>
          </div>
        )}

        {mode === "login" ? (
          <LoginForm onLogin={onLogin} onSwitchMode={() => onModeChange("register")} />
        ) : (
          <RegisterForm onLogin={onLogin} onSwitchMode={() => onModeChange("login")} />
        )}
      </div>
    </Modal>
  );
}

/* ─────────────────────────── shared bits ─────────────────────────── */

function GoogleButton({ label, disabled, onBeforeRedirect }: { label: string; disabled?: boolean; onBeforeRedirect?: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        onBeforeRedirect?.();
        window.location.href = getGoogleOAuthUrl();
      }}
      className="w-full h-11 inline-flex items-center justify-center gap-2.5 rounded-lg border border-border bg-control/50 hover:bg-control text-sm font-medium text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none"
    >
      <GoogleIcon />
      {label}
    </button>
  );
}

function Divider({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-3 my-5 text-xs text-muted-foreground">
      <span className="flex-1 h-px bg-border" />
      {children}
      <span className="flex-1 h-px bg-border" />
    </div>
  );
}

function Legal({ verb }: { verb: string }) {
  return (
    <p className="mt-6 text-center text-[11.5px] leading-relaxed text-muted-foreground/80">
      By {verb} you agree to our{" "}
      <Link to="/terms" className="underline underline-offset-2 hover:text-foreground">Terms of Service</Link>
      {" "}and{" "}
      <Link to="/privacy" className="underline underline-offset-2 hover:text-foreground">Privacy Policy</Link>.
    </p>
  );
}

function MaintenanceNote({ children }: { children: string }) {
  return (
    <div role="status" className="mt-6 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3.5 py-3 text-left text-[13px] text-amber-200">
      {children}
    </div>
  );
}

/* ─────────────────────────── login ─────────────────────────── */

function LoginForm({ onLogin, onSwitchMode }: { onLogin: (u: User) => void; onSwitchMode: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState<"form" | "demo" | null>(null);
  const [formError, setFormError] = useState("");
  const [maintenance, setMaintenance] = useState(false);
  const emailRef = useRef<HTMLInputElement | null>(null);
  const emailId = useId();
  const passwordId = useId();

  useEffect(() => {
    void settingsAPI.getMaintenanceStatus().then(({ maintenanceMode }) => {
      if (maintenanceMode) setMaintenance(true);
    }).catch(() => {});
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError("");
    setLoading("form");
    try {
      const u = await authAPI.login(email, password);
      // Logging in never carries a landing theme — that's for new accounts.
      setLandingThemeIntent(false);
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
      if (code === "MAINTENANCE") setMaintenance(true);
    } finally {
      setLoading(null);
    }
  };

  const handleDemoLogin = async () => {
    setFormError("");
    setLoading("demo");
    try {
      const u = await authAPI.login(DEMO_EMAIL, DEMO_PASSWORD);
      setLandingThemeIntent(false);
      toast.success(`Welcome, ${u.name}!`);
      onLogin(u);
    } catch {
      /* the api interceptor toasts on error */
    } finally {
      setLoading(null);
    }
  };

  return (
    <>
      {maintenance && <MaintenanceNote>Scheduled maintenance is in progress. Only authorized sign-in is available.</MaintenanceNote>}
      <div className="mt-7">
        <GoogleButton label="Continue with Google" onBeforeRedirect={() => setLandingThemeIntent(false)} />
      </div>
      <Divider>or</Divider>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Email" htmlFor={emailId}>
          <Input ref={emailRef} id={emailId} type="email" autoComplete="email" data-autofocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required className="!h-11" />
        </Field>
        <Field label="Password" htmlFor={passwordId} error={formError || undefined}>
          <Input
            id={passwordId}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            required
            aria-invalid={formError ? true : undefined}
            className="!h-11"
          />
        </Field>
        <Button type="submit" variant="primary" loading={loading === "form"} disabled={loading !== null} className="w-full !h-11 mt-1">
          {loading === "form" ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <Button variant="ghost" onClick={handleDemoLogin} loading={loading === "demo"} disabled={loading !== null} className="w-full !h-10 mt-2">
        {loading !== "demo" && <Play size={13} strokeWidth={2.4} aria-hidden />}
        {loading === "demo" ? "Opening the demo…" : "Try the live demo instead"}
      </Button>
      <p className="mt-5 text-center text-sm text-muted-foreground">
        New to HireTrail?{" "}
        <button type="button" onClick={onSwitchMode} className="font-medium text-foreground hover:underline underline-offset-2">Create an account</button>
      </p>
      <Legal verb="signing in" />
    </>
  );
}

/* ─────────────────────────── register ─────────────────────────── */

/** The landing pick, as a two-tone swatch and a way to leave it behind. */
function CarriedTheme({ prefs, onRemove }: { prefs: ThemePrefs; onRemove: () => void }) {
  const t = prefs.mode === "custom" && prefs.custom ? generated(prefs.custom).tokens : null;
  const base = t ? `hsl(${t["--background"]})` : prefs.mode === "dark" ? "#171717" : "#fcfcfc";
  const accent = t ? `hsl(${t["--primary"]})` : prefs.mode === "dark" ? "#ededed" : "#262626";
  return (
    <div className="mt-6 flex items-center gap-3 rounded-lg border border-border bg-control/50 px-3.5 py-2.5">
      <span className="w-6 h-6 rounded-full shrink-0 ring-1 ring-white/15" style={{ background: `linear-gradient(135deg, ${base} 0 55%, ${accent} 55% 100%)` }} aria-hidden />
      <p className="flex-1 min-w-0 text-[13px] text-foreground">Your theme comes with you</p>
      <button type="button" onClick={onRemove} className="text-[12.5px] font-medium text-muted-foreground hover:text-foreground">Remove</button>
    </div>
  );
}

function RegisterForm({ onLogin, onSwitchMode }: { onLogin: (u: User) => void; onSwitchMode: () => void }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [maintenance, setMaintenance] = useState(false);
  const [carried, setCarried] = useState<ThemePrefs | null>(() => peekLandingTheme());
  const ids = { first: useId(), last: useId(), email: useId(), password: useId() };

  useEffect(() => {
    void settingsAPI.getMaintenanceStatus().then(({ maintenanceMode: m }) => setMaintenance(m)).catch(() => {});
  }, []);

  const forgetTheme = () => {
    saveLandingTheme(null);
    setCarried(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (maintenance) return;
    const name = `${firstName.trim()} ${lastName.trim()}`.trim();
    if (!name) { toast.error("Please enter your name"); return; }
    setLoading(true);
    try {
      const u = await authAPI.register(name, email, password);
      if (carried) setLandingThemeIntent(true);
      toast.success("Account created!");
      onLogin(u);
    } catch (err) {
      const ax = err as AxiosError<{ code?: string; error?: string }>;
      if (ax.response?.status === 503 && ax.response?.data?.code === "MAINTENANCE") {
        setMaintenance(true);
        toast.error(ax.response?.data?.error || "Registration is closed during maintenance.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {maintenance && <MaintenanceNote>New registrations are paused during scheduled maintenance. Please try again later.</MaintenanceNote>}
      {carried && !maintenance && <CarriedTheme prefs={carried} onRemove={forgetTheme} />}
      <div className="mt-6">
        <GoogleButton label="Sign up with Google" disabled={maintenance} onBeforeRedirect={() => { if (carried) setLandingThemeIntent(true); }} />
      </div>
      <Divider>or with email</Divider>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" htmlFor={ids.first}>
            <Input id={ids.first} autoComplete="given-name" data-autofocus value={firstName} onChange={(e) => setFirstName(e.target.value)} required disabled={maintenance} className="!h-11" />
          </Field>
          <Field label="Last name" htmlFor={ids.last}>
            <Input id={ids.last} autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} required disabled={maintenance} className="!h-11" />
          </Field>
        </div>
        <Field label="Email" htmlFor={ids.email}>
          <Input id={ids.email} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required disabled={maintenance} className="!h-11" />
        </Field>
        <Field label="Password" htmlFor={ids.password} hint="At least 6 characters.">
          <Input id={ids.password} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required disabled={maintenance} className="!h-11" />
        </Field>
        <Button type="submit" variant="primary" loading={loading} disabled={loading || maintenance} className="w-full !h-11 mt-1">
          {loading ? "Creating your account…" : "Create account"}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <button type="button" onClick={onSwitchMode} className="font-medium text-foreground hover:underline underline-offset-2">Log in</button>
      </p>
      <Legal verb="creating an account" />
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
