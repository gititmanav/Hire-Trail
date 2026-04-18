import { useState, useEffect, FormEvent } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { AxiosError } from "axios";
import { authAPI, settingsAPI } from "../../utils/api.ts";
import { getGoogleOAuthUrl } from "../../config/apiBase.ts";
import type { User } from "../../types";
import { AUTH_BRAND_LOGO_CLASS, AUTH_BRAND_LOGO_MOBILE_CLASS } from "../../components/LogoMark/LogoMark.tsx";
import ScreenshotCarousel from "../../components/ScreenshotCarousel/ScreenshotCarousel.tsx";

export default function Register({ onLogin }: { onLogin: (u: User) => void }) {
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void settingsAPI.getMaintenanceStatus().then(({ maintenanceMode: m }) => setMaintenanceMode(m)).catch(() => {});
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
    <div className="flex min-h-screen">
      <div className="hidden lg:flex flex-col justify-center items-center flex-1 bg-[#f0f7fb] relative overflow-hidden px-12 py-16">
        <div className="absolute top-[-80px] right-[-80px] w-[300px] h-[300px] rounded-full bg-accent/5" />
        <div className="absolute bottom-[-60px] left-[-60px] w-[250px] h-[250px] rounded-full bg-emerald-500/5" />

        <div className="max-w-md relative z-10">
          <div className="mb-10 flex flex-row items-center text-center gap-2" aria-label="HireTrail">
            <img src="/logo.svg" alt="" className={AUTH_BRAND_LOGO_CLASS} aria-hidden />
            <span className="font-sans text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">
              <span className="text-foreground">Hire</span>
              <span className="text-primary">Trail</span>
            </span>
          </div>

          <h1 className="text-[32px] font-extrabold text-foreground leading-tight mb-2" style={{ animation: "fadeSlideUp 0.6s ease-out" }}>
            Your job search,
          </h1>
          <h1 className="text-[32px] font-extrabold text-foreground leading-tight mb-2" style={{ animation: "fadeSlideUp 0.6s ease-out 0.1s both" }}>
            organized and on track.
          </h1>
          <p className="text-[15px] text-muted-foreground leading-relaxed mt-4 mb-10" style={{ animation: "fadeSlideUp 0.6s ease-out 0.2s both" }}>
            Stop losing track of applications in spreadsheets. HireTrail gives you a command center for your entire job search.
          </p>

          <div className="mb-10" style={{ animation: "fadeSlideUp 0.5s ease-out 0.3s both" }}>
            <ScreenshotCarousel />
          </div>

          <div style={{ animation: "fadeSlideUp 0.5s ease-out 0.7s both" }}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Trusted by students across universities</p>
            <div className="flex items-center gap-5 opacity-40 grayscale">
              {["Northeastern", "Purdue", "UCLA", "MIT", "Stanford"].map((u) => (
                <span key={u} className="text-[13px] font-bold text-foreground tracking-tight">{u}</span>
              ))}
            </div>
          </div>

          <div className="mt-12 pt-6 border-t border-border" style={{ animation: "fadeSlideUp 0.5s ease-out 0.8s both" }}>
            <p className="text-xs text-muted-foreground">
              Built for students.{" "}
              <a href="https://github.com/gititmanav/Hire-Trail" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Open source on GitHub ↗
              </a>
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-[400px] text-center" style={{ animation: "fadeSlideUp 0.5s ease-out" }}>
          <div className="flex flex-col items-center gap-2 mb-8 lg:hidden" aria-label="HireTrail">
            <img src="/logo.svg" alt="" className={AUTH_BRAND_LOGO_MOBILE_CLASS} aria-hidden />
            <span className="font-sans text-2xl font-extrabold tracking-tight">
              <span className="text-foreground">Hire</span>
              <span className="text-primary">Trail</span>
            </span>
          </div>

          <h1 className="text-2xl font-bold text-foreground mb-1">Sign up for an account</h1>
          <p className="text-sm text-muted-foreground mb-7">Start tracking your job search today</p>

          {maintenanceMode && (
            <div
              role="status"
              className="mb-6 rounded-lg border border-amber-500/50 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-left text-sm text-amber-900 dark:text-amber-100"
            >
              New registrations are disabled during scheduled maintenance. Please try again later.
            </div>
          )}

          <button type="button" disabled={maintenanceMode} onClick={() => { window.location.href = getGoogleOAuthUrl(); }}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 border border-border rounded-lg text-sm font-medium text-foreground bg-card hover:bg-muted shadow-sm disabled:opacity-50 disabled:pointer-events-none">
            <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" /><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" /><path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" /><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" /></svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3 my-6 text-xs">
            <div className="flex-1 h-px bg-border" /><span className="text-muted-foreground">Or create an account with email</span><div className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-foreground mb-1.5">First Name</label><input type="text" className="input-premium" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First Name" required disabled={maintenanceMode} /></div>
              <div><label className="block text-sm font-medium text-foreground mb-1.5">Last Name</label><input type="text" className="input-premium" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last Name" required disabled={maintenanceMode} /></div>
            </div>
            <div><label className="block text-sm font-medium text-foreground mb-1.5">Email Address</label><input type="email" className="input-premium" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required disabled={maintenanceMode} /></div>
            <div><label className="block text-sm font-medium text-foreground mb-1.5">Password</label><input type="password" className="input-premium" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" minLength={6} required disabled={maintenanceMode} /></div>
            <button type="submit" disabled={loading || maintenanceMode} className="btn-accent w-full justify-center !py-2.5 mt-2 disabled:opacity-50">{loading ? "Creating account..." : "Register"}</button>
          </form>

          <p className="text-center mt-6 text-sm text-muted-foreground">
            Already have an account? <Link to="/login" className="text-primary font-medium hover:underline">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
