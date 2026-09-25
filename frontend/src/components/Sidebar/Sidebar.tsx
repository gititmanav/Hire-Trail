/** Primary navigation; paths match `App.tsx` routes. Feature-flag-aware. */
import { useState, lazy, Suspense } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, ClipboardList, Clock,
  Users, Building2, FileText, Search, ArrowLeftRight,
  Shield, MessageSquare, Wand2, Bell,
  type LucideIcon,
} from "lucide-react";
import { useFeatureFlags } from "../../hooks/useFeatureFlags.tsx";
import { CollapseToggle, GroupLabel, ICON_ROW, fade, navTone } from "./navParts.tsx";

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
      { to: "/notifications", label: "Notifications", Icon: Bell },
    ],
  },
  {
    label: "Track",
    items: [
      // Board and Calendar are views inside Applications now (header switcher).
      { to: "/applications", label: "Applications", Icon: ClipboardList },
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

  const navItem = (item: NavItem) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.to === "/"}
      title={collapsed ? `${item.label}${item.badge ? ` (${item.badge})` : ""}` : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={({ isActive }) => `${ICON_ROW} ${navTone(isActive)}`}
    >
      <item.Icon size={18} strokeWidth={1.6} className="shrink-0" />
      <span className={`flex-1 min-w-0 inline-flex items-center justify-between ${fade(collapsed)}`}>
        <span>{item.label}</span>
        {item.badge && (
          <span className="ml-2 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">{item.badge}</span>
        )}
      </span>
      {item.badge && (
        <span className={`shell-fade absolute left-[30px] top-[7px] w-2 h-2 rounded-full bg-primary border border-sidebar ${collapsed ? "opacity-100" : "opacity-0"}`} aria-hidden />
      )}
    </NavLink>
  );

  return (
    <aside
      className={`shell-sidebar fixed top-0 left-0 bottom-0 bg-sidebar flex flex-col overflow-hidden z-20 ${collapsed ? "w-16" : "w-60"}`}
    >
      <div className="flex items-center min-h-[60px] px-4">
        <span className={`flex-1 min-w-0 overflow-hidden text-[18px] font-bold whitespace-nowrap select-none ml-1 ${fade(collapsed)}`} aria-hidden={collapsed}>
          <span className="text-[19px] text-primary">H</span><span className="text-sidebar-foreground">ire</span><span className="text-[19px] text-primary">T</span><span className="text-sidebar-foreground">rail</span>
        </span>
        <CollapseToggle collapsed={collapsed} onToggle={onToggle} />
      </div>
      <nav className="scroll-quiet flex-1 flex flex-col overflow-y-auto overflow-x-hidden px-2">
        {visibleGroups.map((group, gIdx) => (
          <div key={group.label} className={gIdx === 0 ? "" : "mt-4"}>
            <GroupLabel label={group.label} collapsed={collapsed} first={gIdx === 0} />
            <div className="flex flex-col gap-0.5">{group.items.map(navItem)}</div>
          </div>
        ))}

        {isAdmin && (
          <div className="mt-4">
            <GroupLabel label="Admin" collapsed={collapsed} first={false} />
            <div className="flex flex-col gap-0.5">{navItem(adminItem)}</div>
          </div>
        )}
      </nav>
      <div className="px-2 py-2">
        <button
          type="button"
          onClick={() => setFeedbackOpen(true)}
          title={collapsed ? "Send feedback" : undefined}
          aria-label={collapsed ? "Send feedback" : undefined}
          className={`${ICON_ROW} w-full ${navTone(false)}`}
        >
          <MessageSquare size={18} strokeWidth={1.6} className="shrink-0" />
          <span className={fade(collapsed)}>Send feedback</span>
        </button>
      </div>
      <div className="relative h-10 px-4 flex items-center">
        <div className={`flex-1 flex items-center justify-between gap-2 whitespace-nowrap ${fade(collapsed)} ${collapsed ? "pointer-events-none" : ""}`} aria-hidden={collapsed}>
          <p className="text-[11px] text-sidebar-foreground/50">HireTrail v4.0</p>
          <div className="flex items-center gap-2 text-[10px] text-sidebar-foreground/50">
            <NavLink to="/privacy" tabIndex={collapsed ? -1 : undefined} className="hover:text-sidebar-foreground">Privacy</NavLink>
            <span aria-hidden>·</span>
            <NavLink to="/terms" tabIndex={collapsed ? -1 : undefined} className="hover:text-sidebar-foreground">Terms</NavLink>
          </div>
        </div>
        <p className={`shell-fade absolute left-0 w-16 text-center text-[11px] text-sidebar-foreground/50 ${collapsed ? "opacity-100" : "opacity-0"}`} aria-hidden={!collapsed}>v4</p>
      </div>

      {feedbackOpen && (
        <Suspense fallback={null}>
          <FeedbackModal onClose={() => setFeedbackOpen(false)} />
        </Suspense>
      )}
    </aside>
  );
}
