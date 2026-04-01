/** Primary navigation; paths match `App.tsx` routes. Feature-flag-aware. */
import { NavLink } from "react-router-dom";
import { useFeatureFlags } from "../../hooks/useFeatureFlags.tsx";

interface Props { collapsed: boolean; onToggle: () => void; isAdmin: boolean; }

interface NavItem {
  to: string;
  label: string;
  d: string;
  featureKey?: string;
}

const nav: NavItem[] = [
  { to: "/", label: "Dashboard", d: "M3 3h7v8H3zM12 3h7v5h-7zM3 13h7v6H3zM12 10h7v9h-7z" },
  { to: "/applications", label: "Applications", d: "M4 3h14a2 2 0 012 2v14a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2zm3 4h8m-8 3h8m-8 3h4" },
  { to: "/companies", label: "Companies", d: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
  { to: "/kanban", label: "Kanban Board", d: "M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v6m0 0H3m6 0v12m0-12h12m-12 0v12m0 0H5a2 2 0 01-2-2v-4m6 6h10a2 2 0 002-2v-4m0-6V5a2 2 0 00-2-2", featureKey: "feature_kanban" },
  { to: "/jobs", label: "Job Search", d: "M11 11a4 4 0 100-8 4 4 0 000 8zm0 0l6 6m-13-2l3-3", featureKey: "feature_job_search" },
  { to: "/resumes", label: "Resumes", d: "M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9l-7-7zm0 0v7h7" },
  { to: "/contacts", label: "Contacts", d: "M12 11a4 4 0 100-8 4 4 0 000 8zm-8 10v-1a6 6 0 016-6h4a6 6 0 016 6v1" },
  { to: "/deadlines", label: "Deadlines", d: "M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" },
  { to: "/import-export", label: "Import / Export", d: "M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5", featureKey: "feature_csv_import_export" },
];

const adminNav: NavItem = { to: "/admin", label: "Admin Panel", d: "M12 3l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V7l8-4zm0 5a2 2 0 100 4 2 2 0 000-4zm-3 8h6" };

export default function Sidebar({ collapsed, onToggle, isAdmin }: Props) {
  const { isEnabled } = useFeatureFlags();
  const allNav = isAdmin ? [...nav, adminNav] : nav;
  const navItems = allNav.filter((item) => !item.featureKey || isEnabled(item.featureKey));

  return (
    <aside className={`fixed top-0 left-0 bottom-0 bg-sidebar flex flex-col overflow-hidden z-50 transition-all duration-200 ${collapsed ? "w-16" : "w-60"}`}>
      <div className="flex items-center justify-between min-h-[60px] px-4">
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <span className="text-[18px] font-bold whitespace-nowrap select-none ml-1"><span className="text-[19px] text-[#4d8fd6]">H</span><span className="text-sidebar-foreground">ire</span><span className="text-[19px] text-[#4d8fd6]">T</span><span className="text-sidebar-foreground">rail</span></span>
          </div>
        )}
        <button onClick={onToggle} className="text-sidebar-foreground hover:text-sidebar-primary-foreground hover:bg-sidebar-accent p-1.5 rounded-md transition-colors">
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="3" y1="4" x2="15" y2="4"/><line x1="3" y1="9" x2={collapsed ? "15" : "11"} y2="9"/><line x1="3" y1="14" x2="15" y2="14"/></svg>
        </button>
      </div>
      <nav className={`flex-1 flex flex-col gap-0.5 overflow-y-auto ${collapsed ? "px-1 items-center" : "px-2"}`}>
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === "/"} title={collapsed ? item.label : undefined}
            className={({ isActive }) => `flex items-center gap-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${collapsed ? "justify-center w-11 h-11 p-0" : "px-3 py-2"} ${isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={item.d}/></svg>
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>
      <div className="px-4 py-3 border-t border-sidebar-border">
        <p className={`text-[11px] text-sidebar-foreground/50 ${collapsed ? "text-center" : ""}`}>{collapsed ? "v4" : "HireTrail v4.0"}</p>
      </div>
    </aside>
  );
}
