import { useState, useRef, useEffect, useContext } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import AdminSidebar from "./AdminSidebar.tsx";
import { ThemeContext } from "../../App.tsx";
import { THEMES } from "../../utils/themes.ts";
import type { Theme } from "../../utils/themes.ts";
import type { User } from "../../types";

const FB: Record<string, [string, string]> = {
  "--primary": ["217 91% 60%", "217 91% 60%"],
  "--background": ["0 0% 100%", "0 0% 9%"],
  "--card": ["0 0% 100%", "0 0% 15%"],
  "--sidebar": ["210 20% 98%", "0 0% 9%"],
};
function previewColor(theme: Theme, v: string): string {
  const src = theme.isDark && theme.darkVariables ? theme.darkVariables : theme.variables;
  const val = src[v];
  if (val) return `hsl(${val})`;
  const fb = FB[v];
  return fb ? `hsl(${fb[theme.isDark ? 1 : 0]})` : "#888";
}

interface Props { user: User; onLogout: () => void; }

export default function AdminLayout({ user, onLogout }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [themeSearch, setThemeSearch] = useState("");
  const { dark, themeId, setTheme } = useContext(ThemeContext);
  const navigate = useNavigate();
  const profileRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef<HTMLDivElement>(null);
  const initials = user.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (themeRef.current && !themeRef.current.contains(e.target as Node)) setThemeOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") { setProfileOpen(false); setThemeOpen(false); } };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);

  return (
    <div className={`flex min-h-screen bg-background ${dark ? "dark" : ""}`}>
      <AdminSidebar collapsed={collapsed} onToggle={() => setCollapsed((p) => !p)} />

      {/* Right side: header + content, offset by sidebar width */}
      <div className={`flex-1 flex flex-col transition-all duration-200 ${collapsed ? "ml-16" : "ml-60"}`}>
        {/* Header — sticky within the content column, never overlaps sidebar */}
        <header className="sticky top-0 z-30 glass-header">
          <div className="flex items-center justify-between px-6 h-[60px]">
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold text-foreground whitespace-nowrap">Admin Panel</span>
              <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded-full font-medium">Admin</span>
            </div>
            <div className="flex items-center gap-2">
              {/* Theme picker */}
              <div className="relative" ref={themeRef}>
                <button
                  onClick={() => setThemeOpen(!themeOpen)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-secondary-foreground transition-all"
                  title="Change theme"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.5-.75 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-1 0-.83.67-1.5 1.5-1.5H16c3.31 0 6-2.69 6-6 0-5.52-4.48-9.5-10-9.5z" />
                    <circle cx="7.5" cy="11.5" r="1.5" fill="currentColor" />
                    <circle cx="12" cy="7.5" r="1.5" fill="currentColor" />
                    <circle cx="16.5" cy="11.5" r="1.5" fill="currentColor" />
                  </svg>
                </button>

                {themeOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-[300px] card-premium animate-in z-50 flex flex-col max-h-[70vh]">
                    <div className="p-3 pb-2 border-b border-border shrink-0">
                      <input className="w-full px-2.5 py-1.5 text-sm bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" placeholder="Search themes..." value={themeSearch} onChange={(e) => setThemeSearch(e.target.value)} autoFocus />
                      <p className="text-[11px] text-muted-foreground mt-1.5 px-0.5">{THEMES.length} themes</p>
                    </div>
                    <div className="overflow-y-auto p-2 flex flex-col gap-0.5">
                      {THEMES.filter((t) => t.name.toLowerCase().includes(themeSearch.toLowerCase())).map((t) => (
                        <button key={t.id} onClick={() => { setTheme(t.id); setThemeOpen(false); setThemeSearch(""); }} className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg transition-all text-left ${themeId === t.id ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-muted"}`}>
                          <div className="flex items-center gap-0.5 shrink-0">
                            {(["--primary", "--background", "--card", "--sidebar"] as const).map((v) => (
                              <span key={v} className="w-3.5 h-3.5 rounded-full border border-black/10" style={{ background: previewColor(t, v) }} />
                            ))}
                          </div>
                          <span className="text-[12px] font-medium text-foreground leading-tight truncate">{t.name}</span>
                          {themeId === t.id && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="ml-auto text-primary shrink-0"><polyline points="20,6 9,17 4,12"/></svg>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Profile dropdown */}
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-muted transition-all"
                >
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold shadow-sm">{initials}</div>
                  <div className="hidden sm:flex flex-col items-start">
                    <span className="text-[13px] font-medium text-foreground leading-tight">{user.name}</span>
                    <span className="text-[11px] text-muted-foreground leading-tight">{user.email}</span>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={`text-muted-foreground transition-transform duration-200 ${profileOpen ? "rotate-180" : ""}`}><polyline points="4,6 8,10 12,6"/></svg>
                </button>

                {profileOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-56 card-premium py-1.5 animate-in z-50">
                    <div className="px-3 py-2 border-b border-border mb-1">
                      <p className="text-sm font-medium text-foreground">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                    <button
                      onClick={() => { setProfileOpen(false); navigate("/profile"); }}
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-secondary-foreground hover:bg-muted/50 transition-colors"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-muted-foreground"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      Edit profile
                    </button>
                    <div className="border-t border-border mt-1 pt-1">
                      <button
                        onClick={() => { setProfileOpen(false); onLogout(); }}
                        className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-red-500 hover:bg-red-50 hover:bg-destructive/10 transition-colors"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1">
          <div className="p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
