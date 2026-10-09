/** Top bar: the extension CTA, the search (centred — components/Spotlight),
 *  the user menu. Notifications live in the sidebar (with the unread count)
 *  and the search's quick links; theme lives in Settings → Personalize. */
import { lazy, Suspense, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Menu as MenuIcon, Puzzle, Download, ChevronDown, User as UserIcon,
  Settings as SettingsIcon, LogOut, Megaphone,
} from "lucide-react";
import Menu from "../ui/Menu.tsx";
import SpotlightIdle from "../Spotlight/SpotlightIdle.tsx";
import { useBarPlace } from "../Spotlight/useBarPlace.ts";

// The search (and the motion engine) loads beside the shell, not in it.
const Spotlight = lazy(() => import("../Spotlight/AppSpotlight.tsx"));
import { useAnnouncements } from "../Announcements/AnnouncementsProvider.tsx";
import type { User } from "../../types";

const EXT_DISMISSED_KEY = "hiretrail-ext-banner-dismissed";

interface Props { user: User; onLogout: () => Promise<void>; onMobileMenuToggle?: () => void; }

export default function Header({ user, onLogout, onMobileMenuToggle }: Props) {
  const { hasAnnouncements, reopenAll } = useAnnouncements();
  const navigate = useNavigate();
  const initials = user.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  const [extHighlight, setExtHighlight] = useState(() => !localStorage.getItem(EXT_DISMISSED_KEY));
  const [loggingOut, setLoggingOut] = useState(false);
  const { rowRef, startRef, endRef, place } = useBarPlace();

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
      <div ref={rowRef} className="relative flex items-center justify-between px-4 md:px-6 py-2.5 gap-2">
        {/* Mobile hamburger + Extension download CTA (slides with the sidebar edge) */}
        <div ref={startRef} className="shell-header-start flex items-center">
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
        </div>
        {place && (
          <div className="absolute top-2.5" style={{ left: place.left }}>
            <Suspense fallback={<SpotlightIdle width={place.width} />}>
              <Spotlight width={place.width} panel={place.panel} />
            </Suspense>
          </div>
        )}
        <div ref={endRef} className="flex items-center gap-2">
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
                <div className="hidden xl:flex flex-col items-start">
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
