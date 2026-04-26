import { useState, useEffect, FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { AxiosError } from "axios";
import { authAPI, settingsAPI } from "../../utils/api.ts";
import { getGoogleOAuthUrl } from "../../config/apiBase.ts";
import type { User } from "../../types";
import { AUTH_BRAND_LOGO_CLASS, AUTH_BRAND_LOGO_MOBILE_CLASS } from "../../components/LogoMark/LogoMark.tsx";
import ScreenshotCarousel from "../../components/ScreenshotCarousel/ScreenshotCarousel.tsx";

const DEMO_EMAIL = "demo@hiretrail.com";
const DEMO_PASSWORD = "password123";

export default function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const [searchParams] = useSearchParams();
  const [maintenanceBanner, setMaintenanceBanner] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (searchParams.get("maintenance") === "1") setMaintenanceBanner(true);
    void settingsAPI.getMaintenanceStatus().then(({ maintenanceMode }) => {
      if (maintenanceMode) setMaintenanceBanner(true);
    }).catch(() => {});
  }, [searchParams]);

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
    <div className="auth-shell flex min-h-screen">
      <div className="auth-left-panel hidden lg:flex flex-col justify-center items-center flex-1 relative overflow-hidden px-14 py-16">
        <div className="absolute top-[-120px] right-[-90px] w-[360px] h-[360px] rounded-full bg-indigo-300/15 blur-2xl" />
        <div className="absolute bottom-[-120px] left-[-90px] w-[320px] h-[320px] rounded-full bg-blue-200/25 blur-2xl" />

        <div className="w-full max-w-[900px] relative z-10">
          <div className="mb-10 flex flex-row items-center text-center gap-2" aria-label="HireTrail">
            <img src="/logo.svg" alt="" className={AUTH_BRAND_LOGO_CLASS} aria-hidden />
            <span className="font-sans text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">
              <span className="text-foreground">Hire</span>
              <span className="text-primary">Trail</span>
            </span>
          </div>

          <h1 className="text-[38px] font-extrabold text-foreground leading-[1.08] tracking-[-0.02em] mb-3" style={{ animation: "fadeSlideUp 0.6s ease-out" }}>
            Turn your job search
            <br />
            into a system.
          </h1>
          <p className="text-[16px] text-muted-foreground leading-relaxed mt-4 mb-8 max-w-[540px]" style={{ animation: "fadeSlideUp 0.6s ease-out 0.15s both" }}>
            Track applications, deadlines, and follow-ups in one clean workspace built for focused students.
          </p>

          <div className="mt-1" style={{ animation: "fadeSlideUp 0.55s ease-out 0.25s both" }}>
            <ScreenshotCarousel />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3" style={{ animation: "fadeSlideUp 0.55s ease-out 0.35s both" }}>
            <span className="auth-stat-chip text-xs text-foreground rounded-full px-4 py-1.5">Used by students and early-career professionals</span>
            <span className="auth-stat-chip text-xs text-foreground rounded-full px-4 py-1.5">Command center for applications</span>
            <a
              href="https://github.com/gititmanav/Hire-Trail"
              target="_blank"
              rel="noopener noreferrer"
              className="auth-github-chip inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium text-foreground hover:text-primary transition-colors"
            >
              Built open source on GitHub
              <span aria-hidden>↗</span>
            </a>
          </div>
        </div>
      </div>

      <div className="auth-right-panel flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="auth-card w-full max-w-[430px] rounded-2xl p-6 sm:p-8 text-center" style={{ animation: "fadeSlideUp 0.5s ease-out" }}>
          <div className="flex flex-col items-center gap-2 mb-8 lg:hidden" aria-label="HireTrail">
            <img src="/logo.svg" alt="" className={AUTH_BRAND_LOGO_MOBILE_CLASS} aria-hidden />
            <span className="font-sans text-2xl font-extrabold tracking-tight">
              <span className="text-foreground">Hire</span>
              <span className="text-primary">Trail</span>
            </span>
          </div>

          <h1 className="text-3xl font-extrabold text-foreground mb-1">Welcome back</h1>
          <p className="text-sm text-muted-foreground mb-7">Sign in to your account to continue</p>

          {maintenanceBanner && (
            <div
              role="status"
              className="mb-6 rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-left text-sm text-amber-700 dark:text-amber-100"
            >
              Scheduled maintenance is in progress. Only authorized sign-in is available. If you are the site administrator, use your Google account to continue.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-left auth-form-stack">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Email Address</label>
              <input type="email" className="auth-input-dark" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Password</label>
              <input type="password" className={`auth-input-dark ${formError ? "!border-red-400 focus:!ring-red-400/20" : ""}`} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" required />
            </div>
            {formError && <p className="text-sm text-danger">{formError}</p>}
            <button type="submit" disabled={loading} className="btn-accent w-full justify-center !py-2.5 mt-2 disabled:opacity-50">
              {loading ? "Signing in..." : "Sign in"}
            </button>
            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={loading}
              className="btn-secondary demo-login-btn w-full justify-center !py-2.5 disabled:opacity-50"
            >
              Log in as demo user
            </button>
            {loading && <p className="text-xs text-muted-foreground text-center">Authenticating... this can take a few seconds.</p>}
          </form>

          <p className="text-center mt-6 text-sm text-muted-foreground">
            Don&apos;t have an account? <Link to="/register" className="text-primary font-medium hover:underline">Create one</Link>
          </p>

          <div className="flex items-center gap-3 my-5 text-xs">
            <div className="flex-1 h-px bg-border" /><span className="text-muted-foreground">or continue with</span><div className="flex-1 h-px bg-border" />
          </div>

          <button
            type="button"
            onClick={() => { window.location.href = getGoogleOAuthUrl(); }}
            className="auth-oauth-btn w-full flex items-center justify-center gap-2.5 px-4 py-2.5 border border-border rounded-md text-sm font-medium shadow-sm transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" /><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" /><path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" /><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" /></svg>
            Continue with Google
          </button>
        </div>
      </div>
    </div>
  );
}
