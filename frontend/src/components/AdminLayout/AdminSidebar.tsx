import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, Shield, FileEdit, Calendar, Mail, Bell, MessageSquare, Bug,
  HardDrive, Settings, Megaphone, FileText, Send, UserPlus, Database,
  PanelLeftClose, PanelLeftOpen, Archive, Sparkles,
  type LucideIcon,
} from "lucide-react";

interface Props { collapsed: boolean; onToggle: () => void; }

interface AdminNavItem {
  to: string;
  label: string;
  Icon: LucideIcon;
  end?: boolean;
}

const adminNav: AdminNavItem[] = [
  { to: "/admin",                  label: "Dashboard",       Icon: LayoutDashboard, end: true },
  { to: "/admin/users",            label: "Users & Roles",   Icon: Shield },
  { to: "/admin/content",          label: "Content",         Icon: FileEdit },
  { to: "/admin/calendar",         label: "Calendar",        Icon: Calendar },
  { to: "/admin/mailbox",          label: "Mailboxes",       Icon: Mail },
  { to: "/admin/notifications",    label: "Notifications",   Icon: Bell },
  { to: "/admin/feedback",         label: "Feedback",        Icon: MessageSquare },
  { to: "/admin/bugs",             label: "Bug Reports",     Icon: Bug },
  { to: "/admin/storage",          label: "Storage",         Icon: HardDrive },
  { to: "/admin/settings",         label: "Settings",        Icon: Settings },
  { to: "/admin/ai",               label: "AI Providers",    Icon: Sparkles },
  { to: "/admin/announcements",    label: "Announcements",   Icon: Megaphone },
  { to: "/admin/audit-logs",       label: "Audit Logs",      Icon: FileText },
  { to: "/admin/email-templates",  label: "Email Templates", Icon: Mail },
  { to: "/admin/broadcasts",       label: "Broadcasts",      Icon: Send },
  { to: "/admin/invites",          label: "Invites",         Icon: UserPlus },
  { to: "/admin/backup",           label: "Backup",          Icon: Archive },
  { to: "/admin/seed",             label: "Seed Data",       Icon: Database },
];

export default function AdminSidebar({ collapsed, onToggle }: Props) {
  return (
    <aside
      className={`fixed top-0 left-0 bottom-0 bg-sidebar flex flex-col overflow-hidden z-20 transition-[width] duration-200 ease-out ${collapsed ? "w-16" : "w-60"}`}
    >
      <div className="flex items-center justify-between min-h-[60px] px-4">
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-destructive rounded-md flex items-center justify-center text-white font-bold text-sm shadow-sm">A</div>
            <span className="text-[17px] font-semibold text-sidebar-foreground whitespace-nowrap">Admin</span>
          </div>
        )}
        <button onClick={onToggle} className="text-sidebar-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent p-1.5 rounded-md" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {collapsed ? <PanelLeftOpen size={18} strokeWidth={1.5} /> : <PanelLeftClose size={18} strokeWidth={1.5} />}
        </button>
      </div>
      <nav className={`flex-1 flex flex-col gap-0.5 overflow-y-auto ${collapsed ? "px-1 items-center" : "px-2"}`}>
        {adminNav.map((item) => {
          const Icon = item.Icon;
          return (
            <NavLink key={item.to} to={item.to} end={item.end || false} title={collapsed ? item.label : undefined}
              className={({ isActive }) => `flex items-center gap-2.5 rounded-lg text-sm font-medium whitespace-nowrap ${collapsed ? "justify-center w-11 h-11 p-0" : "px-3 py-2"} ${isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}`}>
              <Icon size={18} strokeWidth={1.6} />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>
      <div className="px-4 py-3 border-t border-sidebar-border">
        <p className={`text-[11px] text-sidebar-foreground/50 ${collapsed ? "text-center" : ""}`}>{collapsed ? "Admin" : "Admin Panel"}</p>
      </div>
    </aside>
  );
}
