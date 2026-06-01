import { useState, useRef, useEffect, useContext } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Calendar, Sun, Moon, ChevronDown, User as UserIcon, LogOut } from "lucide-react";
import AdminSidebar from "./AdminSidebar.tsx";
import { ThemeContext } from "../../App.tsx";
import type { User } from "../../types";

interface Props { user: User; onLogout: () => void; }

export default function AdminLayout({ user, onLogout }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { dark, toggle } = useContext(ThemeContext);
  const navigate = useNavigate();
  const location = useLocation();
  const profileRef = useRef<HTMLDivElement>(null);
  const initials = user.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") { setProfileOpen(false); } };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);

  return (
    <div className={`flex min-h-screen bg-background ${dark ? "dark" : ""}`}>
      <AdminSidebar collapsed={collapsed} onToggle={() => setCollapsed((p) => !p)} />

      {/* Right side: header + content, offset by sidebar width */}
      <div
        className={`shell-overlap-panel flex-1 flex flex-col transition-[margin-left] duration-200 ease-out ${collapsed ? "ml-16" : "ml-60"}`}
      >
        {/* Header — sticky within the content column, never overlaps sidebar */}
        <header className="sticky top-0 z-30 glass-header">
          <div className="flex items-center justify-between px-6 h-[60px]">
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold text-foreground whitespace-nowrap">Admin Panel</span>
              <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded-full font-medium">Admin</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate("/admin/calendar")}
                className={`w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-secondary-foreground ${
                  location.pathname === "/admin/calendar" ? "bg-muted text-foreground" : ""
                }`}
                title="Open calendar"
                aria-label="Open calendar"
              >
                <Calendar size={18} strokeWidth={1.7} />
              </button>
              <button
                onClick={() => toggle()}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-secondary-foreground"
                title={dark ? "Switch to light mode" : "Switch to dark mode"}
                aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
              >
                {dark ? <Sun size={18} strokeWidth={1.8} /> : <Moon size={18} strokeWidth={1.8} />}
              </button>

              {/* Profile dropdown */}
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-muted"
                >
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold shadow-sm">{initials}</div>
                  <div className="hidden sm:flex flex-col items-start">
                    <span className="text-[13px] font-medium text-foreground leading-tight">{user.name}</span>
                    <span className="text-[11px] text-muted-foreground leading-tight">{user.email}</span>
                  </div>
                  <ChevronDown size={14} strokeWidth={1.5} className={`text-muted-foreground transition-transform duration-200 ${profileOpen ? "rotate-180" : ""}`} />
                </button>

                {profileOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-56 card-premium py-1.5 animate-in z-50">
                    <div className="px-3 py-2 border-b border-border mb-1">
                      <p className="text-sm font-medium text-foreground">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                    <button
                      onClick={() => { setProfileOpen(false); navigate("/profile"); }}
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-secondary-foreground hover:bg-muted/50"
                    >
                      <UserIcon size={16} strokeWidth={1.5} className="text-muted-foreground" />
                      Edit profile
                    </button>
                    <div className="border-t border-border mt-1 pt-1">
                      <button
                        onClick={() => { setProfileOpen(false); onLogout(); }}
                        className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-red-500 hover:bg-red-50 hover:bg-destructive/10"
                      >
                        <LogOut size={16} strokeWidth={1.5} />
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
