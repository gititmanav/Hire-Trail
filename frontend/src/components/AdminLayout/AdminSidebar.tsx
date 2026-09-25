import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, Shield, FileEdit, Calendar, Mail, Bell, MessageSquare, Bug,
  HardDrive, Settings, Megaphone, FileText, Send, UserPlus, Database,
  Archive, Sparkles,
  type LucideIcon,
} from "lucide-react";
import { CollapseToggle, GroupLabel, ICON_ROW, fade, navTone } from "../Sidebar/navParts.tsx";

interface Props { collapsed: boolean; onToggle: () => void; }

interface AdminNavItem {
  to: string;
  label: string;
  Icon: LucideIcon;
  end?: boolean;
}

interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

const groups: AdminNavGroup[] = [
  {
    label: "Overview",
    items: [
      { to: "/admin",          label: "Dashboard", Icon: LayoutDashboard, end: true },
      { to: "/admin/calendar", label: "Calendar",  Icon: Calendar },
    ],
  },
  {
    label: "People",
    items: [
      { to: "/admin/users",   label: "Users & Roles", Icon: Shield },
      { to: "/admin/invites", label: "Invites",       Icon: UserPlus },
    ],
  },
  {
    label: "Content",
    items: [
      { to: "/admin/content",         label: "Content",         Icon: FileEdit },
      { to: "/admin/announcements",   label: "Announcements",   Icon: Megaphone },
      { to: "/admin/email-templates", label: "Email Templates", Icon: Mail },
      { to: "/admin/broadcasts",      label: "Broadcasts",      Icon: Send },
    ],
  },
  {
    label: "Inbox",
    items: [
      { to: "/admin/mailbox",       label: "Mailboxes",     Icon: Mail },
      { to: "/admin/notifications", label: "Notifications", Icon: Bell },
    ],
  },
  {
    label: "Support",
    items: [
      { to: "/admin/feedback", label: "Feedback",    Icon: MessageSquare },
      { to: "/admin/bugs",     label: "Bug Reports", Icon: Bug },
    ],
  },
  {
    label: "AI",
    items: [
      { to: "/admin/ai", label: "AI Providers", Icon: Sparkles },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/admin/settings",   label: "Settings",   Icon: Settings },
      { to: "/admin/storage",    label: "Storage",    Icon: HardDrive },
      { to: "/admin/audit-logs", label: "Audit Logs", Icon: FileText },
      { to: "/admin/backup",     label: "Backup",     Icon: Archive },
      { to: "/admin/seed",       label: "Seed Data",  Icon: Database },
    ],
  },
];

export default function AdminSidebar({ collapsed, onToggle }: Props) {
  return (
    <aside
      className={`shell-sidebar fixed top-0 left-0 bottom-0 bg-sidebar flex flex-col overflow-hidden z-20 ${collapsed ? "w-16" : "w-60"}`}
    >
      <div className="flex items-center min-h-[60px] px-4">
        <span className={`flex-1 min-w-0 overflow-hidden flex items-center gap-2.5 whitespace-nowrap select-none ${fade(collapsed)}`} aria-hidden={collapsed}>
          <span className="w-7 h-7 shrink-0 bg-destructive rounded-md flex items-center justify-center text-destructive-foreground font-bold text-[13px]">A</span>
          <span className="text-[17px] font-semibold text-sidebar-foreground">Admin</span>
        </span>
        <CollapseToggle collapsed={collapsed} onToggle={onToggle} />
      </div>
      <nav className="scroll-quiet flex-1 flex flex-col overflow-y-auto overflow-x-hidden px-2 pb-2">
        {groups.map((group, gIdx) => (
          <div key={group.label} className={gIdx === 0 ? "" : "mt-4"}>
            <GroupLabel label={group.label} collapsed={collapsed} first={gIdx === 0} />
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end || false}
                  title={collapsed ? item.label : undefined}
                  aria-label={collapsed ? item.label : undefined}
                  className={({ isActive }) => `${ICON_ROW} ${navTone(isActive)}`}
                >
                  <item.Icon size={18} strokeWidth={1.6} className="shrink-0" />
                  <span className={fade(collapsed)}>{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="relative h-10 px-4 flex items-center">
        <p className={`text-[11px] text-sidebar-foreground/50 whitespace-nowrap ${fade(collapsed)}`} aria-hidden={collapsed}>HireTrail Admin</p>
        <p className={`shell-fade absolute left-0 w-16 text-center text-[11px] text-sidebar-foreground/50 ${collapsed ? "opacity-100" : "opacity-0"}`} aria-hidden={!collapsed}>Admin</p>
      </div>
    </aside>
  );
}
