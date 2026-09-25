/** Admin shell — the same shape as the app's (Layout): sidebar + header form
 *  one backdrop and the main section is a card that scrolls on its own. */
import { useLayoutEffect, useRef } from "react";
import { Outlet, useLocation, useNavigate, useNavigationType } from "react-router-dom";
import { ChevronDown, User as UserIcon, Settings as SettingsIcon, LogOut } from "lucide-react";
import AdminSidebar from "./AdminSidebar.tsx";
import Menu from "../ui/Menu.tsx";
import { useShellCollapse } from "../../hooks/useShellCollapse.ts";
import { APP_SCROLL_ID } from "../../utils/scrollRoot.ts";
import type { User } from "../../types";

interface Props { user: User; onLogout: () => void; }

const SIDEBAR_COLLAPSED_KEY = "hiretrail-admin-sidebar-collapsed";

export default function AdminLayout({ user, onLogout }: Props) {
  const [collapsed, toggleCollapsed] = useShellCollapse(SIDEBAR_COLLAPSED_KEY);
  const navigate = useNavigate();
  const location = useLocation();
  const scrollRef = useRef<HTMLElement>(null);
  const initials = user.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  // New page → start at the top; back/forward keeps where the user was.
  const navigationType = useNavigationType();
  useLayoutEffect(() => {
    if (navigationType !== "POP") scrollRef.current?.scrollTo(0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return (
    <div className="flex h-dvh overflow-hidden bg-sidebar">
      <AdminSidebar collapsed={collapsed} onToggle={toggleCollapsed} />

      <div className={`shell-column flex-1 min-w-0 flex flex-col ${collapsed ? "ml-16" : "ml-60"}`}>
        <header className="shrink-0 bg-sidebar">
          <div className="flex items-center justify-between px-6 py-2.5 gap-2">
            <div className="shell-header-start flex items-center gap-3">
              <span className="text-[15px] font-semibold text-foreground whitespace-nowrap">Admin Panel</span>
              <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded-full font-medium">Admin</span>
            </div>
            <div className="flex items-center gap-2">
              {/* Profile dropdown */}
              <Menu
                ariaLabel="Account"
                align="end"
                width={232}
                header={
                  <>
                    <p className="text-[13.5px] font-medium text-foreground truncate">{user.name}</p>
                    <p className="text-[12px] text-muted-foreground truncate">{user.email}</p>
                  </>
                }
                items={[
                  { label: "Edit profile", icon: <UserIcon size={16} strokeWidth={1.6} />, onSelect: () => navigate("/profile") },
                  { label: "Settings", icon: <SettingsIcon size={16} strokeWidth={1.6} />, onSelect: () => navigate("/settings") },
                  { label: "Sign out", icon: <LogOut size={16} strokeWidth={1.6} />, destructive: true, dividerBefore: true, onSelect: () => onLogout() },
                ]}
                trigger={(open) => (
                  <button type="button" aria-label="Account menu" className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold shadow-sm">{initials}</div>
                    <div className="hidden sm:flex flex-col items-start">
                      <span className="text-[13px] font-medium text-foreground leading-tight">{user.name}</span>
                      <span className="text-[11px] text-muted-foreground leading-tight">{user.email}</span>
                    </div>
                    <ChevronDown size={14} strokeWidth={1.5} className={`text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
                  </button>
                )}
              />
            </div>
          </div>
        </header>

        {/* The main section: a card on the backdrop and the scroll container
         *  (utils/scrollRoot), so sticky bars pin to its top edge. */}
        <main
          ref={scrollRef}
          id={APP_SCROLL_ID}
          className="shell-main flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-background border rounded-xl shadow-panel mr-2 mb-2"
        >
          <div className="p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
