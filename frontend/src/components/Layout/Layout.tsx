/** App shell: collapsible sidebar, header, fluid vs max-width main by route. */
import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "../Sidebar/Sidebar.tsx";
import Header from "../Header/Header.tsx";
import type { User } from "../../types";

interface Props { user: User; onLogout: () => Promise<void>; }

const SIDEBAR_COLLAPSED_KEY = "hiretrail-sidebar-collapsed";

export default function Layout({ user, onLogout }: Props) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1"; } catch { return false; }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const fullWidth = ["/", "/kanban", "/calendar", "/profile", "/tailor", "/resume-studio"].includes(location.pathname);

  // Close mobile sidebar on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0"); } catch { /* ignore */ }
  }, [collapsed]);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar: off-canvas overlay on mobile, fixed on desktop. The wrapper
       *  needs an explicit width on mobile so `-translate-x-full` (100% of
       *  the element's own width) actually moves the inner sidebar off-screen.
       *  Without `w-60` here the wrapper sized to 0 and the translate was a
       *  no-op, leaving the sidebar permanently visible at <768px. */}
      <div className={`fixed top-0 left-0 bottom-0 z-50 md:z-20 transition-transform duration-200 w-60 md:w-auto md:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <Sidebar
          collapsed={collapsed}
          onToggle={() => {
            // On mobile, close the sidebar; on desktop, toggle collapse
            if (window.innerWidth < 768) setMobileOpen(false);
            else setCollapsed(!collapsed);
          }}
          isAdmin={user.role === "admin"}
        />
      </div>

      <div
        className={`shell-overlap-panel flex-1 flex flex-col transition-[margin-left] duration-200 ease-out md:${collapsed ? "ml-16" : "ml-60"} ${collapsed ? "md:ml-16" : "md:ml-60"}`}
      >
        <Header user={user} onLogout={onLogout} onMobileMenuToggle={() => setMobileOpen(!mobileOpen)} />
        {/* `overflow-x-clip` lets pages use `-mx-4` negative-margin "breakout"
         *  patterns (full-bleed sticky filter bars on Applications, Deadlines,
         *  Companies, etc.) without spilling past the viewport on mobile.
         *  `clip` is preferred over `hidden` because it doesn't create a
         *  scroll container — sticky positioning inside still works. */}
        <main className="flex-1 overflow-x-clip">
          <div key={location.pathname} className={`p-4 md:p-6 ${fullWidth ? "" : "max-w-[1200px]"} mx-auto fade-up`}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
