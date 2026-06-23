/** Primary navigation; paths match `App.tsx` routes. Feature-flag-aware. */
import { useState, lazy, Suspense } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, ClipboardList, Columns3, Calendar, Clock,
  Users, Building2, FileText, Sparkles, Search, ArrowLeftRight,
  Shield, MessageSquare, PanelLeftClose, PanelLeftOpen, Wand2,
  type LucideIcon,
} from "lucide-react";
import { useFeatureFlags } from "../../hooks/useFeatureFlags.tsx";

const FeedbackModal = lazy(() => import("../FeedbackWidget/FeedbackModal.tsx"));

interface Props { collapsed: boolean; onToggle: () => void; isAdmin: boolean; }

interface NavItem {
  to: string;
  label: string;
  /** Lucide icon component reference — kept on the config so the render
   *  loop stays a single `<Icon size={18} strokeWidth={1.5} />` line. */
  Icon: LucideIcon;
  featureKey?: string;
  badge?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const groups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { to: "/", label: "Dashboard", Icon: LayoutDashboard },
    ],
  },
  {
    label: "Track",
    items: [
      { to: "/applications", label: "Applications", Icon: ClipboardList },
      { to: "/kanban", label: "Kanban Board", Icon: Columns3, featureKey: "feature_kanban" },
      { to: "/calendar", label: "Calendar", Icon: Calendar },
      { to: "/deadlines", label: "Deadlines", Icon: Clock },
    ],
  },
  {
    label: "Network",
    items: [
      { to: "/contacts", label: "Contacts", Icon: Users },
      { to: "/companies", label: "Companies", Icon: Building2 },
    ],
  },
  {
    label: "Tools",
    items: [
      { to: "/resumes", label: "Resumes", Icon: FileText },
      { to: "/resume-studio", label: "Resume Studio", badge: "New", Icon: Wand2 },
      { to: "/tailor", label: "AI Tailor", badge: "Beta", Icon: Sparkles },
      { to: "/jobs", label: "Job Search", Icon: Search, featureKey: "feature_job_search" },
      { to: "/import-export", label: "Import / Export", Icon: ArrowLeftRight, featureKey: "feature_csv_import_export" },
    ],
  },
];

const adminItem: NavItem = { to: "/admin", label: "Admin Panel", Icon: Shield };

export default function Sidebar({ collapsed, onToggle, isAdmin }: Props) {
  const { isEnabled } = useFeatureFlags();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const visibleGroups = groups
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.featureKey || isEnabled(i.featureKey)) }))
    .filter((g) => g.items.length > 0);

  return (
    <aside
      className={`fixed top-0 left-0 bottom-0 bg-sidebar flex flex-col overflow-hidden z-20 transition-[width] duration-200 ease-out ${collapsed ? "w-16" : "w-60"}`}
    >
      <div className="flex items-center justify-between min-h-[60px] px-4">
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <span className="text-[18px] font-bold whitespace-nowrap select-none ml-1"><span className="text-[19px] text-primary">H</span><span className="text-sidebar-foreground">ire</span><span className="text-[19px] text-primary">T</span><span className="text-sidebar-foreground">rail</span></span>
          </div>
        )}
        <button onClick={onToggle} className="text-sidebar-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent p-1.5 rounded-md" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {collapsed ? <PanelLeftOpen size={18} strokeWidth={1.5} /> : <PanelLeftClose size={18} strokeWidth={1.5} />}
        </button>
      </div>
      <nav className={`flex-1 flex flex-col overflow-y-auto ${collapsed ? "px-1 items-center" : "px-2"}`}>
        {visibleGroups.map((group, gIdx) => (
          <div key={group.label} className={`flex flex-col ${collapsed ? "items-center w-full" : ""} ${gIdx === 0 ? "" : collapsed ? "mt-2 pt-2 border-t border-sidebar-border/40 w-full" : "mt-4"}`}>
            {!collapsed && (
              <div className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40 select-none">
                {group.label}
              </div>
            )}
            <div className={`flex flex-col gap-0.5 ${collapsed ? "items-center w-full" : ""}`}>
              {group.items.map((item) => {
                const Icon = item.Icon;
                return (
                  <NavLink key={item.to} to={item.to} end={item.to === "/"} title={collapsed ? `${item.label}${item.badge ? ` (${item.badge})` : ""}` : undefined}
                    className={({ isActive }) => `relative flex items-center gap-2.5 rounded-lg text-sm font-medium whitespace-nowrap ${collapsed ? "justify-center w-11 h-11 p-0" : "px-3 py-2"} ${isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}`}>
                    <Icon size={18} strokeWidth={1.6} />
                    {!collapsed && (
                      <span className="flex-1 inline-flex items-center justify-between">
                        <span>{item.label}</span>
                        {item.badge && (
                          <span className="ml-2 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">{item.badge}</span>
                        )}
                      </span>
                    )}
                    {collapsed && item.badge && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary border border-sidebar" aria-hidden />
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}

        {isAdmin && (
          <div className={`flex flex-col ${collapsed ? "items-center w-full mt-2 pt-2 border-t border-sidebar-border/40" : "mt-4"}`}>
            {!collapsed && (
              <div className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40 select-none">
                Admin
              </div>
            )}
            <NavLink to={adminItem.to} title={collapsed ? adminItem.label : undefined}
              className={({ isActive }) => `flex items-center gap-2.5 rounded-lg text-sm font-medium whitespace-nowrap ${collapsed ? "justify-center w-11 h-11 p-0" : "px-3 py-2"} ${isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}`}>
              <adminItem.Icon size={18} strokeWidth={1.6} />
              {!collapsed && <span>{adminItem.label}</span>}
            </NavLink>
          </div>
        )}
      </nav>
      <div className={`border-t border-sidebar-border ${collapsed ? "px-1 py-2" : "px-2 py-2"}`}>
        <button
          type="button"
          onClick={() => setFeedbackOpen(true)}
          title={collapsed ? "Send feedback" : undefined}
          className={`flex items-center gap-2.5 rounded-lg text-sm font-medium whitespace-nowrap text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground w-full ${collapsed ? "justify-center w-11 h-11 p-0 mx-auto" : "px-3 py-2"}`}
        >
          <MessageSquare size={18} strokeWidth={1.6} />
          {!collapsed && <span>Send feedback</span>}
        </button>
      </div>
      <div className="px-4 py-2.5 border-t border-sidebar-border">
        {collapsed ? (
          <p className="text-[11px] text-sidebar-foreground/50 text-center">v4</p>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-sidebar-foreground/50">HireTrail v4.0</p>
            <div className="flex items-center gap-2 text-[10px] text-sidebar-foreground/50">
              <NavLink to="/privacy" className="hover:text-sidebar-foreground">Privacy</NavLink>
              <span aria-hidden>·</span>
              <NavLink to="/terms" className="hover:text-sidebar-foreground">Terms</NavLink>
            </div>
          </div>
        )}
      </div>

      {feedbackOpen && (
        <Suspense fallback={null}>
          <FeedbackModal onClose={() => setFeedbackOpen(false)} />
        </Suspense>
      )}
    </aside>
  );
}
