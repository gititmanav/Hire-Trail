import { NavLink } from "react-router-dom";

interface Props { collapsed: boolean; onToggle: () => void; }

const adminNav = [
  { to: "/admin", label: "Dashboard", d: "M3 3h7v8H3zM12 3h7v5h-7zM3 13h7v6H3zM12 10h7v9h-7z", end: true },
  { to: "/admin/users", label: "Users & Roles", d: "M12 3l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V7l8-4zm0 5a2 2 0 100 4 2 2 0 000-4zm-3 8h6" },
  { to: "/admin/content", label: "Content", d: "M9 12h6m-3-3v6m-7 4h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
  { to: "/admin/gmail", label: "Gmail", d: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
  { to: "/admin/notifications", label: "Notifications", d: "M15 17h5l-1.4-1.4A2 2 0 0118 14V8A6 6 0 006 8v6a2 2 0 01-.6 1.4L4 17h5m6 0a3 3 0 01-6 0m6 0H9" },
  { to: "/admin/storage", label: "Storage", d: "M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7M1 4h22M10 11h4" },
  { to: "/admin/settings", label: "Settings", d: "M12 15a3 3 0 100-6 3 3 0 000 6zm7.4-1.8l1.6 1.2-2 3.4-1.8-.8a7 7 0 01-2 1.1L15 20h-4l-.2-1.9a7 7 0 01-2-1.1l-1.8.8-2-3.4 1.6-1.2a7 7 0 010-2.4l-1.6-1.2 2-3.4 1.8.8a7 7 0 012-1.1L11 4h4l.2 1.9a7 7 0 012 1.1l1.8-.8 2 3.4-1.6 1.2a7 7 0 010 2.4z" },
  { to: "/admin/announcements", label: "Announcements", d: "M15 17h5l-1.4-1.4A2 2 0 0118 14V8A6 6 0 006 8v6a2 2 0 01-.6 1.4L4 17h5m6 0a3 3 0 01-6 0m6 0H9" },
  { to: "/admin/audit-logs", label: "Audit Logs", d: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
  { to: "/admin/email-templates", label: "Email Templates", d: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
  { to: "/admin/invites", label: "Invites", d: "M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" },
  { to: "/admin/backup", label: "Backup", d: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" },
  { to: "/admin/seed", label: "Seed Data", d: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" },
];

export default function AdminSidebar({ collapsed, onToggle }: Props) {
  return (
    <aside
      className={`fixed top-0 left-0 bottom-0 bg-sidebar flex flex-col overflow-hidden z-50 transition-[width] duration-200 ease-out ${collapsed ? "w-16" : "w-60"}`}
    >
      <div className="flex items-center justify-between min-h-[60px] px-4">
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-destructive rounded-md flex items-center justify-center text-white font-bold text-sm shadow-sm">A</div>
            <span className="text-[17px] font-semibold text-sidebar-foreground whitespace-nowrap">Admin</span>
          </div>
        )}
        <button onClick={onToggle} className="text-sidebar-foreground hover:text-sidebar-primary-foreground hover:bg-sidebar-accent p-1.5 rounded-md">
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="3" y1="4" x2="15" y2="4"/><line x1="3" y1="9" x2={collapsed ? "15" : "11"} y2="9"/><line x1="3" y1="14" x2="15" y2="14"/></svg>
        </button>
      </div>
      <nav className={`flex-1 flex flex-col gap-0.5 overflow-y-auto ${collapsed ? "px-1 items-center" : "px-2"}`}>
        {adminNav.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end || false} title={collapsed ? item.label : undefined}
            className={({ isActive }) => `flex items-center gap-2.5 rounded-lg text-sm font-medium whitespace-nowrap ${collapsed ? "justify-center w-11 h-11 p-0" : "px-3 py-2"} ${isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={item.d}/></svg>
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>
      <div className="px-4 py-3 border-t border-sidebar-border">
        <p className={`text-[11px] text-sidebar-foreground/50 ${collapsed ? "text-center" : ""}`}>{collapsed ? "Admin" : "Admin Panel"}</p>
      </div>
    </aside>
  );
}
