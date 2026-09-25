/** Settings area — its own shell, separate from the main app layout.
 *  Left rail: "Back to HireTrail", a settings search, grouped section nav.
 *  Content: one focused page per section (routes under /settings/*).
 *
 *  Legacy deep links are honored by the index redirect in App.tsx:
 *  /settings?gmail=… → mailboxes (OAuth callback), /settings#clipboard → clipboard. */
import { useMemo, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { navTone } from "../../components/Sidebar/navParts.tsx";
import {
  ArrowLeft, ClipboardList, Mail, Palette, Search, Sparkles, User as UserIcon,
  type LucideIcon,
} from "lucide-react";

interface SettingsNavItem {
  to: string;
  label: string;
  Icon: LucideIcon;
  /** Search terms beyond the label — lets "api key" find AI & Models. */
  aliases: string[];
}

interface SettingsNavGroup { label: string; items: SettingsNavItem[] }

const NAV: SettingsNavGroup[] = [
  {
    label: "Account",
    items: [
      { to: "/settings/profile", label: "Profile", Icon: UserIcon, aliases: ["name", "email", "password", "delete account", "danger", "gdpr", "close account"] },
      { to: "/settings/personalize", label: "Personalize", Icon: Palette, aliases: ["theme", "dark mode", "light mode", "appearance", "system"] },
      { to: "/settings/clipboard", label: "Clipboard", Icon: ClipboardList, aliases: ["copy", "extension", "job description", "prompt", "claude", "format"] },
    ],
  },
  {
    label: "Integrations",
    items: [
      { to: "/settings/mailboxes", label: "Mailboxes", Icon: Mail, aliases: ["gmail", "outlook", "google", "microsoft", "inbox", "scan", "email", "rejection"] },
      { to: "/settings/ai", label: "AI & Models", Icon: Sparkles, aliases: ["api key", "openai", "anthropic", "gpt", "claude", "gemini", "byok", "provider", "model", "usage", "profile sync", "merge"] },
    ],
  },
];

function matches(item: SettingsNavItem, q: string): boolean {
  const query = q.trim().toLowerCase();
  if (!query) return true;
  return item.label.toLowerCase().includes(query) || item.aliases.some((a) => a.includes(query));
}

export default function SettingsLayout() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const firstMatch = useMemo(() => {
    if (!query.trim()) return null;
    for (const group of NAV) {
      const hit = group.items.find((i) => matches(i, query));
      if (hit) return hit;
    }
    return null;
  }, [query]);

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      {/* Rail */}
      <aside className="lg:w-60 shrink-0 bg-sidebar border-b lg:border-b-0 border-sidebar-border lg:h-screen lg:sticky lg:top-0 flex flex-col">
        <div className="px-2 pt-3">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-150"
          >
            <ArrowLeft size={15} strokeWidth={1.8} />
            Back to HireTrail
          </button>
        </div>

        <div className="px-3 pt-3">
          <div className="relative">
            <Search size={13} strokeWidth={2} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && firstMatch) {
                  navigate(firstMatch.to);
                  setQuery("");
                } else if (e.key === "Escape") {
                  setQuery("");
                  (e.target as HTMLInputElement).blur();
                }
              }}
              placeholder="Search settings…"
              aria-label="Search settings"
              className="w-full h-8 pl-8 pr-2.5 text-[13px] bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring"
            />
          </div>
        </div>

        <nav className="flex lg:flex-col flex-row gap-0.5 overflow-x-auto lg:overflow-visible px-2 py-3 lg:flex-1" aria-label="Settings">
          {NAV.map((group) => (
            <div key={group.label} className="flex lg:flex-col flex-row gap-0.5 lg:mt-4 first:lg:mt-1 shrink-0">
              <div className="hidden lg:block px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40 select-none">
                {group.label}
              </div>
              {group.items.map((item) => {
                const dimmed = query.trim() !== "" && !matches(item, query);
                const Icon = item.Icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-[color,background-color,box-shadow,opacity] duration-150 ${
                        navTone(isActive)
                      } ${dimmed ? "opacity-35" : ""}`
                    }
                  >
                    <Icon size={16} strokeWidth={1.7} />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <main className="flex-1 min-w-0">
        <div className="max-w-4xl mx-auto px-5 sm:px-10 py-8 lg:py-12 fade-up">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
