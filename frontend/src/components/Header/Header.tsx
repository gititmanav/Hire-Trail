/** Top bar: extension CTA, global search, notifications, user menu. (Theme lives in
 *  Settings → Personalize; the calendar is a view in Applications.) */
import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Menu as MenuIcon, Puzzle, Download, Info, ChevronDown, User as UserIcon,
  Settings as SettingsIcon, LogOut, Wrench, Megaphone,
} from "lucide-react";
import Menu from "../ui/Menu.tsx";
import HoverCard from "../ui/HoverCard.tsx";
import NotificationBell from "./NotificationBell.tsx";
import GlobalSearch from "./GlobalSearch.tsx";
import { useAnnouncements } from "../Announcements/AnnouncementsProvider.tsx";
import { useAIKeyStatus } from "../../hooks/useAIKeyStatus.tsx";
import type { User } from "../../types";

const EXT_DISMISSED_KEY = "hiretrail-ext-banner-dismissed";

const SUPPORTED_SITES = [
  { name: "LinkedIn", domain: "linkedin.com", color: "#0A66C2" },
  { name: "Indeed", domain: "indeed.com", color: "#2164F3" },
  { name: "Greenhouse", domain: "greenhouse.io", color: "#23A47F", note: "boards + job-boards" },
  { name: "Lever", domain: "lever.co", color: "#4B5563" },
  { name: "Glassdoor", domain: "glassdoor.com", color: "#0CAA41" },
  { name: "Workday", domain: "myworkdayjobs.com", color: "#005CB9" },
];

interface Props { user: User; onLogout: () => Promise<void>; onMobileMenuToggle?: () => void; }

export default function Header({ user, onLogout, onMobileMenuToggle }: Props) {
  const { hasActiveKey, ready } = useAIKeyStatus();
  const { hasAnnouncements, reopenAll } = useAnnouncements();
  const navigate = useNavigate();
  const initials = user.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  const [extHighlight, setExtHighlight] = useState(() => !localStorage.getItem(EXT_DISMISSED_KEY));
  const [loggingOut, setLoggingOut] = useState(false);

  const handleExtDownload = useCallback(() => {
    if (extHighlight) {
      localStorage.setItem(EXT_DISMISSED_KEY, "1");
      setExtHighlight(false);
    }
  }, [extHighlight]);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await onLogout();
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <header className="shrink-0 bg-sidebar">
      <div className="flex items-center justify-between px-4 md:px-6 py-2.5 gap-2">
        {/* Mobile hamburger + Extension download CTA (slides with the sidebar edge) */}
        <div className="shell-header-start flex items-center">
          {onMobileMenuToggle && (
            <button onClick={onMobileMenuToggle} className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-background hover:text-foreground mr-1">
              <MenuIcon size={20} strokeWidth={1.5} />
            </button>
          )}
          <a
            href="https://chromewebstore.google.com/detail/cgibkejpkbfhkcdjlnkgebdnacpfonhl"
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleExtDownload}
            title="Download the browser extension to track jobs from LinkedIn, Indeed, Glassdoor & more with one click"
            className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-[transform,box-shadow,filter] duration-200 ${
              extHighlight
                ? "ext-cta-highlight bg-primary text-primary-foreground shadow-md hover:shadow-lg hover:brightness-110"
                : "text-muted-foreground hover:text-foreground hover:bg-background"
            }`}
          >
            <Puzzle size={16} strokeWidth={1.8} className={extHighlight ? "text-primary-foreground" : ""} />
            <span className="hidden sm:inline">
              {extHighlight ? "Get the Extension" : "Add to Chrome"}
            </span>
            {extHighlight && (
              <Download size={14} strokeWidth={2} className="hidden sm:block" />
            )}
          </a>
          {/* "Where it works" hover card */}
          <span className="hidden sm:inline-flex">
            <HoverCard
              ariaLabel="Supported job boards"
              content={
                <>
                  <div className="px-3.5 pt-3 pb-2.5 border-b border-border">
                    <p className="text-[13px] font-semibold text-foreground">Supported job boards</p>
                    <p className="text-[12px] text-muted-foreground mt-0.5">One-click tracking on these sites</p>
                  </div>
                  <div className="p-1.5">
                    {SUPPORTED_SITES.map((s) => (
                      <div key={s.domain} className="flex items-center gap-2.5 min-h-8 px-2.5 rounded-lg">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                        <span className="text-[13px] font-medium text-foreground">{s.name}</span>
                        <span className="text-[11.5px] text-muted-foreground ml-auto">{s.domain}</span>
                      </div>
                    ))}
                  </div>
                </>
              }
            >
              <button
                type="button"
                className="flex items-center gap-1 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded-md hover:bg-background"
              >
                <Info size={13} strokeWidth={2} />
                Where it works
              </button>
            </HoverCard>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <GlobalSearch />
          {/* No active AI key → persistent reminder (red wrench). Clears the
           *  moment a key is activated. Links to AI settings. */}
          {ready && !hasActiveKey && (
            <button
              onClick={() => navigate("/settings/ai")}
              className="relative w-9 h-9 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-500/10"
              title="No AI key connected — add one to unlock full AI features"
              aria-label="No AI key connected — open AI settings"
            >
              <Wrench size={18} strokeWidth={1.8} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-sidebar" aria-hidden />
            </button>
          )}
          {/* Announcements: only present when there's an active announcement.
           *  This is where a dismissed banner "lives" — click to re-open it. */}
          {hasAnnouncements && (
            <button
              onClick={reopenAll}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-background hover:text-foreground"
              title="Show announcements"
              aria-label="Show announcements"
            >
              <Megaphone size={18} strokeWidth={1.7} />
            </button>
          )}
          <NotificationBell />
          {/* User menu */}
          <Menu
            ariaLabel="Account"
            align="end"
            width={232}
            header={
              <>
                <p className="text-[13.5px] font-medium text-foreground truncate">{user.name}</p>
                <p className="text-[12px] text-muted-foreground truncate">{user.email}</p>
              </>
            }
            items={[
              { label: "Profile", icon: <UserIcon size={16} strokeWidth={1.6} />, onSelect: () => navigate("/profile") },
              { label: "Settings", icon: <SettingsIcon size={16} strokeWidth={1.6} />, onSelect: () => navigate("/settings") },
              {
                label: loggingOut ? "Signing out…" : "Sign out",
                icon: <LogOut size={16} strokeWidth={1.6} />,
                destructive: true,
                disabled: loggingOut,
                dividerBefore: true,
                onSelect: () => void handleLogout(),
              },
            ]}
            trigger={(open) => (
              <button data-tour="user-menu" type="button" aria-label="Account menu" className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold shadow-sm">{initials}</div>
                <div className="hidden sm:flex flex-col items-start">
                  <span className="text-[13px] font-medium text-foreground leading-tight">{user.name}</span>
                  <span className="text-[11px] text-muted-foreground leading-tight">{user.email}</span>
                </div>
                <ChevronDown size={14} strokeWidth={1.5} className={`text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
              </button>
            )}
          />
        </div>
      </div>
    </header>
  );
}
