/** Top bar: theme picker, extension download, user menu. */
import { useState, useRef, useEffect, useContext, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ThemeContext } from "../../App.tsx";
import type { User } from "../../types";

const EXT_DISMISSED_KEY = "hiretrail-ext-banner-dismissed";

const SUPPORTED_SITES = [
  { name: "LinkedIn", domain: "linkedin.com", color: "#0A66C2" },
  { name: "Indeed", domain: "indeed.com", color: "#2164F3" },
  { name: "Greenhouse", domain: "greenhouse.io", color: "#23A47F", note: "boards + job-boards" },
  { name: "Lever", domain: "lever.co", color: "#4B5563" },
  { name: "Glassdoor", domain: "glassdoor.com", color: "#0CAA41" },
  { name: "Workday", domain: "myworkdayjobs.com", color: "#005CB9" },
];

interface Props { user: User; onLogout: () => Promise<void>; onMobileMenuToggle?: () => void; }

export default function Header({ user, onLogout, onMobileMenuToggle }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { dark, toggle } = useContext(ThemeContext);
  const navigate = useNavigate();
  const location = useLocation();
  const initials = user.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  const [extHighlight, setExtHighlight] = useState(() => !localStorage.getItem(EXT_DISMISSED_KEY));
  const [sitesOpen, setSitesOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const sitesRef = useRef<HTMLDivElement>(null);

  const handleExtDownload = useCallback(() => {
    if (extHighlight) {
      localStorage.setItem(EXT_DISMISSED_KEY, "1");
      setExtHighlight(false);
    }
  }, [extHighlight]);

  // Click-outside for user menu
  useEffect(() => { const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, []);
  // Escape closes menus
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "Escape") { setMenuOpen(false); setSitesOpen(false); } }; document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h); }, []);
  // Click-outside for supported-sites popover (esp. mobile tap-to-toggle)
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (sitesRef.current && !sitesRef.current.contains(e.target as Node)) setSitesOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    setMenuOpen(false);
    try {
      await onLogout();
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <header className="glass-header">
      <div className="flex items-center justify-between px-6 py-2.5">
        {/* Mobile hamburger + Extension download CTA */}
        <div className="flex items-center">
          {onMobileMenuToggle && (
            <button onClick={onMobileMenuToggle} className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground mr-1">
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="3" y1="5" x2="17" y2="5"/><line x1="3" y1="10" x2="17" y2="10"/><line x1="3" y1="15" x2="17" y2="15"/></svg>
            </button>
          )}
          <a
            href="/extension.zip"
            download="HireTrail-Extension.zip"
            onClick={handleExtDownload}
            title="Download the browser extension to track jobs from LinkedIn, Indeed, Glassdoor & more with one click"
            className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-[transform,box-shadow,filter] duration-200 ${
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
          {/* "Where it works" hover card */}
          <div
            className="relative hidden sm:block"
            ref={sitesRef}
            onMouseEnter={() => {
              if (typeof matchMedia !== "undefined" && matchMedia("(hover: hover)").matches) setSitesOpen(true);
            }}
            onMouseLeave={() => {
              if (typeof matchMedia !== "undefined" && matchMedia("(hover: hover)").matches) setSitesOpen(false);
            }}
          >
            <button
              type="button"
              className="flex items-center gap-1 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded-md hover:bg-muted"
              onClick={() => {
                if (typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches) {
                  setSitesOpen((o) => !o);
                }
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
              Where it works
            </button>
            <div className={`absolute left-0 top-full mt-1 w-[240px] card-premium z-50 transition-[opacity,transform] duration-200 origin-top-left ${sitesOpen ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none"}`}>
              <div className="p-3 pb-2 border-b border-border">
                <p className="text-xs font-semibold text-foreground">Supported job boards</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">One-click tracking on these sites</p>
              </div>
              <div className="p-2 space-y-0.5">
                {SUPPORTED_SITES.map((s) => (
                  <div key={s.domain} className="flex items-center gap-2.5 px-2 py-1.5 rounded-md">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                    <span className="text-[12px] font-medium text-foreground">{s.name}</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">{s.domain}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/calendar")}
            className={`w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-secondary-foreground ${
              location.pathname === "/calendar" ? "bg-muted text-foreground" : ""
            }`}
            title="Open calendar"
            aria-label="Open calendar"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 2v3" />
              <path d="M16 2v3" />
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M3 10h18" />
            </svg>
          </button>
          <button
            onClick={() => toggle()}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-secondary-foreground"
            title={dark ? "Switch to light mode" : "Switch to dark mode"}
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {dark ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2" /><path d="M12 20v2" />
                <path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" />
                <path d="M2 12h2" /><path d="M20 12h2" />
                <path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />
              </svg>
            )}
          </button>

          {/* User menu */}
          <div className="relative" ref={menuRef}>
            <button onClick={() => setMenuOpen(!menuOpen)} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-muted">
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
                <button onClick={() => { setMenuOpen(false); navigate("/profile"); }} className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-secondary-foreground hover:bg-muted/50">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-muted-foreground"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>Edit profile
                </button>
                <button onClick={() => { setMenuOpen(false); navigate("/settings"); }} className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-secondary-foreground hover:bg-muted/50">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-muted-foreground"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>Settings
                </button>
                <div className="border-t border-border mt-1 pt-1">
                  <button onClick={() => void handleLogout()} disabled={loggingOut} className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-red-500 hover:bg-red-50 hover:bg-destructive/10 disabled:opacity-60 disabled:cursor-not-allowed">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>{loggingOut ? "Signing out..." : "Sign out"}
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
