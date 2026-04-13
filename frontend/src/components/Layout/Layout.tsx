/** App shell: collapsible sidebar, header, fluid vs max-width main by route. */
import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "../Sidebar/Sidebar.tsx";
import Header from "../Header/Header.tsx";
import type { User } from "../../types";

interface Props { user: User; onLogout: () => Promise<void>; }

export default function Layout({ user, onLogout }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const fullWidth = location.pathname === "/" || location.pathname === "/kanban";

  // Close mobile sidebar on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar: off-canvas overlay on mobile, fixed on desktop */}
      <div className={`fixed top-0 left-0 bottom-0 z-50 transition-transform duration-200 md:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
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
        className={`flex-1 flex flex-col transition-[margin-left] duration-200 ease-out md:${collapsed ? "ml-16" : "ml-60"} ${collapsed ? "md:ml-16" : "md:ml-60"}`}
      >
        <Header user={user} onLogout={onLogout} onMobileMenuToggle={() => setMobileOpen(!mobileOpen)} />
        <main className="flex-1">
          <div key={location.pathname} className={`p-4 md:p-6 ${fullWidth ? "" : "max-w-[1200px]"} mx-auto fade-up`}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
