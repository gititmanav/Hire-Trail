/** What the header search finds: pages (by name or a word people use for
 *  them), then the person's records — applications, companies, contacts,
 *  deadlines. Records load once, quietly, the first time the bar is used
 *  (TanStack Query, cached a minute) and are filtered in the browser — fine
 *  up to a few thousand records; past that, move to a /search endpoint. */
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeftRight, Bell, Briefcase, Building2, CalendarClock, CalendarDays, ClipboardList, Columns3, FileText,
  Inbox, LayoutDashboard, LayoutList, Palette, Plug, Search, Sparkles, User, UserCog, Users, Wand2, type LucideIcon,
} from "lucide-react";

import { applicationsAPI, companiesAPI, contactsAPI, deadlinesAPI } from "../../utils/api.ts";
import { dayOf, formatDay } from "../../utils/dates.ts";

export type ResultKind = "page" | "application" | "company" | "contact" | "deadline" | "person";

export interface SearchResult {
  kind: ResultKind;
  id: string;
  title: string;
  subtitle: string;
  route: string;
  Icon: LucideIcon;
  /** Extra words that should find it (pages only). */
  keywords?: string;
  flag?: string;
}

export const page = (id: string, title: string, route: string, Icon: LucideIcon, keywords = "", flag?: string): SearchResult =>
  ({ kind: "page", id: `page:${id}`, title, subtitle: "Go to page", route, Icon, keywords, flag });

export const PAGES: SearchResult[] = [
  page("dashboard", "Dashboard", "/", LayoutDashboard, "home overview stats"),
  page("applications", "Applications", "/applications", LayoutList, "list table jobs pipeline tracker"),
  page("board", "Board", "/applications/board", Columns3, "kanban stages pipeline", "feature_kanban"),
  page("calendar", "Calendar", "/applications/calendar", CalendarDays, "dates schedule month week"),
  page("deadlines", "Deadlines", "/deadlines", CalendarClock, "due follow-ups reminders"),
  page("contacts", "Contacts", "/contacts", Users, "people recruiters referrals network"),
  page("companies", "Companies", "/companies", Building2, "employers"),
  page("resumes", "Resumes", "/resumes", FileText, "cv"),
  page("studio", "Resume Studio", "/resume-studio", Wand2, "tailor rewrite ai"),
  page("jobs", "Job Search", "/jobs", Search, "find openings", "feature_job_search"),
  page("import", "Import / Export", "/import-export", ArrowLeftRight, "csv spreadsheet download upload", "feature_csv_import_export"),
  page("notifications", "Notifications", "/notifications", Bell, "alerts updates"),
  page("review", "Inbox review", "/email-review", Inbox, "email scan gmail candidates"),
  page("profile", "Profile", "/profile", User, "experience skills education master profile"),
  page("settings-profile", "Account settings", "/settings/profile", UserCog, "password delete account name email"),
  page("personalize", "Personalize", "/settings/personalize", Palette, "theme dark light colours colors appearance"),
  page("clipboard", "Clipboard", "/settings/clipboard", ClipboardList, "copy extension format"),
  page("connectors", "Connectors", "/settings/connectors", Plug, "gmail mailbox inbox integrations"),
  page("ai", "AI", "/settings/ai", Sparkles, "map keys models assistant mcp claude gemini openai"),
];

async function loadRecords({ signal }: { signal: AbortSignal }): Promise<SearchResult[]> {
  const quiet = { quiet: true, signal };
  const none = { data: [] as never[] };
  const [apps, companies, contacts, deadlines] = await Promise.all([
    applicationsAPI.getAll({ limit: 500, fields: "summary" }, quiet).catch(() => none),
    companiesAPI.getAll({ limit: 500 }, quiet).catch(() => none),
    contactsAPI.getAll({ limit: 500 }, quiet).catch(() => none),
    deadlinesAPI.getAllAggregated({ status: "all" }, quiet).catch(() => []),
  ]);
  return [
    ...apps.data.map((a): SearchResult => ({
      kind: "application", id: a._id, Icon: Briefcase,
      title: a.role, subtitle: `${a.company} · ${a.stage}`, route: `/applications/${a._id}`,
    })),
    ...companies.data.map((c): SearchResult => ({
      kind: "company", id: c._id, Icon: Building2,
      title: c.name, subtitle: c.domain || "Company", route: `/companies/${c._id}`,
    })),
    ...contacts.data.map((c): SearchResult => ({
      kind: "contact", id: c._id, Icon: User,
      title: c.name, subtitle: [c.role, c.company].filter(Boolean).join(" · ") || "Contact", route: `/contacts?focus=${c._id}`,
    })),
    ...deadlines.map((d): SearchResult => ({
      kind: "deadline", id: d._id, Icon: CalendarClock,
      title: d.notes || d.type, subtitle: `${d.type} · due ${formatDay(dayOf(d.dueDate), {})}`, route: `/deadlines?focus=${d._id}`,
    })),
  ];
}

/** Records for the search; fetched only once `enabled` (the bar was used). */
export function useSearchRecords(enabled: boolean) {
  return useQuery({ queryKey: ["search", "records"], queryFn: loadRecords, enabled, staleTime: 60_000 });
}

/** Rank: a title starting with the query, then a word in it, then anywhere,
 *  then the subtitle / keywords. Pages win ties; at most `limit`. */
export function rankResults(query: string, items: SearchResult[], limit = 40): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored: { r: SearchResult; s: number; i: number }[] = [];
  items.forEach((r, i) => {
    const t = r.title.toLowerCase();
    let s = 0;
    if (t.startsWith(q)) s = 4;
    else if (t.split(/[\s·/-]+/).some((w) => w.startsWith(q))) s = 3;
    else if (t.includes(q)) s = 2;
    else if (r.subtitle.toLowerCase().includes(q) || r.keywords?.includes(q)) s = 1;
    if (s) scored.push({ r, s: s + (r.kind === "page" ? 0.5 : 0), i });
  });
  scored.sort((a, b) => b.s - a.s || a.i - b.i);
  return scored.slice(0, limit).map((x) => x.r);
}
