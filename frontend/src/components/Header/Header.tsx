/** Top bar: theme picker, extension download, user menu. */
import { useState, useRef, useEffect, useContext, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../../App.tsx";
import { THEMES, getTheme } from "../../utils/themes.ts";
import type { Theme } from "../../utils/themes.ts";
import type { User } from "../../types";

const EXT_DISMISSED_KEY = "hiretrail-ext-banner-dismissed";

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

export default function Header({ user, onLogout }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [themeSearch, setThemeSearch] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef<HTMLDivElement>(null);
  const { themeId, setTheme } = useContext(ThemeContext);
  const navigate = useNavigate();
  const initials = user.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  const [extHighlight, setExtHighlight] = useState(() => !localStorage.getItem(EXT_DISMISSED_KEY));

  const handleExtDownload = useCallback(() => {
    if (extHighlight) {
      localStorage.setItem(EXT_DISMISSED_KEY, "1");
      setExtHighlight(false);
    }
  }, [extHighlight]);

  // Click-outside for user menu
  useEffect(() => { const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, []);
  // Click-outside for theme picker
  useEffect(() => { const h = (e: MouseEvent) => { if (themeRef.current && !themeRef.current.contains(e.target as Node)) setThemeOpen(false); }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, []);
  // Escape closes both
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "Escape") { setMenuOpen(false); setThemeOpen(false); } }; document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h); }, []);

  return (
    <header className="glass-header">
      <div className="flex items-center justify-between px-6 py-2.5">
        {/* Extension download CTA */}
        <div className="flex items-center">
          <a
            href="/extension.zip"
            download="HireTrail-Extension.zip"
            onClick={handleExtDownload}
            title="Download the browser extension to track jobs from LinkedIn, Indeed, Glassdoor & more with one click"
            className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              extHighlight
                ? "ext-cta-highlight bg-primary text-primary-foreground shadow-md hover:shadow-lg hover:brightness-110"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {/* Puzzle-piece icon */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={extHighlight ? "text-primary-foreground" : ""}>
              <path d="M19.439 7.85c-.049 0-.195.01-.293.01C17.442 7.86 16 6.474 16 4.711c0-.312.043-.604.132-.878C15.548 3.6 14.748 3.5 14 3.5h-2c-.633 0-1.236.068-1.815.192C10.068 3.898 10 4.29 10 4.711 10 6.474 8.507 7.86 6.8 7.86c-.098 0-.244-.01-.293-.01C5.577 8.525 5 9.616 5 10.861v1.278c0 .633.068 1.236.192 1.815.207.117.599.185 1.02.185C7.974 14.139 9.36 15.632 9.36 17.339c0 .098-.01.244-.01.293.675.93 1.766 1.507 3.011 1.507h1.278c1.245 0 2.336-.577 3.011-1.507 0-.049-.01-.195-.01-.293 0-1.707 1.386-3.2 3.149-3.2.421 0 .813.068 1.02.185A7.77 7.77 0 0021 12.5v-1.639c0-1.245-.577-2.336-1.507-3.011h-.054z" />
            </svg>
            <span className="hidden sm:inline">
              {extHighlight ? "Get the Extension" : "Download Extension"}
            </span>
            {extHighlight && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="hidden sm:block">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7,10 12,15 17,10" /><line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            )}
          </a>
        </div>
        <div className="flex items-center gap-2">
          {/* Theme picker */}
          <div className="relative" ref={themeRef}>
            <button onClick={() => setThemeOpen(!themeOpen)} className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-secondary-foreground transition-all" title="Change theme">
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
                  <input
                    className="w-full px-2.5 py-1.5 text-sm bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    placeholder="Search themes..."
                    value={themeSearch}
                    onChange={(e) => setThemeSearch(e.target.value)}
                    autoFocus
                  />
                  <p className="text-[11px] text-muted-foreground mt-1.5 px-0.5">{THEMES.length} themes</p>
                </div>
                <div className="overflow-y-auto p-2 flex flex-col gap-0.5">
                  {THEMES.filter((t) => t.name.toLowerCase().includes(themeSearch.toLowerCase())).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => { setTheme(t.id); setThemeOpen(false); setThemeSearch(""); }}
                      className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg transition-all text-left ${
                        themeId === t.id
                          ? "bg-primary/10 ring-1 ring-primary/30"
                          : "hover:bg-muted"
                      }`}
                    >
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

          {/* User menu */}
          <div className="relative" ref={menuRef}>
            <button onClick={() => setMenuOpen(!menuOpen)} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-muted transition-all">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold shadow-sm">{initials}</div>
              <div className="hidden sm:flex flex-col items-start">
                <span className="text-[13px] font-medium text-foreground leading-tight">{user.name}</span>
                <span className="text-[11px] text-muted-foreground leading-tight">{user.email}</span>
              </div>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={`text-muted-foreground transition-transform duration-200 ${menuOpen ? "rotate-180" : ""}`}><polyline points="4,6 8,10 12,6"/></svg>
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-56 card-premium py-1.5 animate-in z-50">
                <div className="px-3 py-2 border-b border-border mb-1"><p className="text-sm font-medium text-foreground">{user.name}</p><p className="text-xs text-muted-foreground">{user.email}</p></div>
                <button onClick={() => { setMenuOpen(false); navigate("/profile"); }} className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-secondary-foreground hover:bg-muted/50 transition-colors">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-muted-foreground"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>Edit profile
                </button>
                <button onClick={() => { setMenuOpen(false); navigate("/settings"); }} className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-secondary-foreground hover:bg-muted/50 transition-colors">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-muted-foreground"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>Settings
                </button>
                <div className="border-t border-border mt-1 pt-1">
                  <button onClick={() => { setMenuOpen(false); onLogout(); }} className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-red-500 hover:bg-red-50 hover:bg-destructive/10 transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
