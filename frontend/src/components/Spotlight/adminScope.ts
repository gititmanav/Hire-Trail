/** Admin's search: Admin's pages (and the admin's own settings), people by
 *  name or email — searched on the server as you type, so every account is
 *  findable, not just a loaded page — Admin's quick links, and a dot on
 *  Feedback / Bug Reports while something is waiting there. */
import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  Bell, Bug, FileText, LayoutDashboard, Megaphone, MessageSquare, Palette, Plug, Send, Settings,
  SlidersHorizontal, Sparkles, User, UserCog, Users, Wallet,
} from "lucide-react";

import { adminAPI } from "../../utils/api.ts";
import type { AdminUserDetail } from "../../types";
import { page, type SearchResult } from "./searchIndex.ts";
import { useAdminQuickLinks } from "./useQuickLinks.ts";
import type { QuickLink, SpotlightScope } from "./scope.ts";

/** Labels and icons match Admin's sidebar. */
const ADMIN_PAGES: SearchResult[] = [
  page("admin-dashboard", "Dashboard", "/admin", LayoutDashboard, "home overview signups activity stats"),
  page("admin-users", "Users", "/admin/users", Users, "people accounts roles admins suspend delete export csv"),
  page("admin-announcements", "Announcements", "/admin/announcements", Megaphone, "banner notice message"),
  page("admin-broadcasts", "Broadcasts", "/admin/broadcasts", Send, "email send newsletter release notes"),
  page("admin-notifications", "Notifications", "/admin/notifications", Bell, "signals alerts"),
  page("admin-feedback", "Feedback", "/admin/feedback", MessageSquare, "suggestions ideas praise triage inbox"),
  page("admin-bugs", "Bug Reports", "/admin/bugs", Bug, "errors crashes exceptions 500 stack"),
  page("admin-connectors", "Connectors", "/admin/connectors", Plug, "gmail outlook mailbox inbox scans"),
  page("admin-ai", "AI", "/admin/ai", Sparkles, "map keys models providers included"),
  page("admin-ai-rules", "AI rules", "/admin/ai?view=rules", SlidersHorizontal, "lanes policy kill switch user map mcp"),
  page("admin-ai-spend", "AI spend", "/admin/ai?view=spend", Wallet, "budget cap usage cost allowance overrides"),
  page("admin-settings", "Settings", "/admin/settings", Settings, "maintenance feature flags reset demo"),
  page("admin-audit", "Audit Logs", "/admin/audit-logs", FileText, "history changes who actions"),
  page("account", "Account settings", "/settings/profile", UserCog, "password email name"),
  page("personalize", "Personalize", "/settings/personalize", Palette, "theme dark light colours colors appearance"),
];

/** Catalogue order (the editor's grid) — the pages an admin returns to. */
const ADMIN_QUICK_LINKS: QuickLink[] = [
  { id: "users", label: "Users", path: "/admin/users", Icon: Users },
  { id: "feedback", label: "Feedback", path: "/admin/feedback", Icon: MessageSquare },
  { id: "bugs", label: "Bug Reports", path: "/admin/bugs", Icon: Bug },
  { id: "ai", label: "AI", path: "/admin/ai", Icon: Sparkles },
  { id: "announcements", label: "Announcements", path: "/admin/announcements", Icon: Megaphone },
  { id: "broadcasts", label: "Broadcasts", path: "/admin/broadcasts", Icon: Send },
  { id: "notifications", label: "Notifications", path: "/admin/notifications", Icon: Bell },
  { id: "connectors", label: "Connectors", path: "/admin/connectors", Icon: Plug },
  { id: "settings", label: "Settings", path: "/admin/settings", Icon: Settings },
  { id: "audit", label: "Audit Logs", path: "/admin/audit-logs", Icon: FileText },
];

function personResult(u: AdminUserDetail): SearchResult {
  const state = u.deleted ? "Deleted" : u.suspended ? "Suspended" : null;
  return {
    kind: "person",
    id: u._id,
    Icon: u.role === "admin" ? UserCog : User,
    title: u.name || u.email,
    subtitle: [u.email, u.role === "admin" ? "Admin" : null, state].filter(Boolean).join(" · "),
    // Users opens this person's details (UserManagement reads ?user=).
    route: `/admin/users?user=${u._id}`,
  };
}

/** People matching what's typed, 200ms after the last keystroke. */
function useAdminRecords(enabled: boolean, query: string) {
  const [term, setTerm] = useState(query.trim());
  useEffect(() => {
    const t = window.setTimeout(() => setTerm(query.trim()), 200);
    return () => window.clearTimeout(t);
  }, [query]);
  return useQuery<SearchResult[]>({
    queryKey: ["admin", "search", "people", term],
    queryFn: ({ signal }) => adminAPI.getUsers({ search: term, limit: 8 }, { quiet: true, signal }).then((r) => r.data.map(personResult)),
    enabled: enabled && term.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    meta: { errorMessage: "Couldn't search people. Please try again." },
  });
}

/** Open feedback and open bug reports — a dot on their quick links. */
function useAdminBadges(): Partial<Record<string, string>> {
  const feedback = useQuery({
    queryKey: ["admin", "feedback", "stats"],
    queryFn: ({ signal }) => adminAPI.getFeedbackStats({ quiet: true, signal }),
    staleTime: 60_000,
    meta: { silent: true },
  });
  const bugs = useQuery({
    queryKey: ["admin", "bugs", "stats"],
    queryFn: ({ signal }) => adminAPI.getBugReportStats({ quiet: true, signal }),
    staleTime: 60_000,
    meta: { silent: true },
  });
  const out: Partial<Record<string, string>> = {};
  if (feedback.data?.open) out.feedback = `${feedback.data.open} open`;
  if (bugs.data?.open) out.bugs = `${bugs.data.open} open`;
  return out;
}

export const adminScope: SpotlightScope = {
  label: "Search Admin",
  pages: ADMIN_PAGES,
  useRecords: useAdminRecords,
  searchingText: "Searching people…",
  catalog: ADMIN_QUICK_LINKS,
  useLinks: useAdminQuickLinks,
  useBadges: useAdminBadges,
};
