/** App shell: sidebar + header form one backdrop; the main section is a card
 *  on it that scrolls on its own (the header and sidebar never move). Pages
 *  are fluid or max-width by route. */
import { useCallback, useState, useEffect, useLayoutEffect, useRef } from "react";
import { Outlet, useLocation, useNavigationType } from "react-router-dom";
import Sidebar from "../Sidebar/Sidebar.tsx";
import Header from "../Header/Header.tsx";
import { AnnouncementsProvider } from "../Announcements/AnnouncementsProvider.tsx";
import AnnouncementBanner from "../Announcements/AnnouncementBanner.tsx";
import { APP_SCROLL_ID } from "../../utils/scrollRoot.ts";
import { useShellCollapse } from "../../hooks/useShellCollapse.ts";
import { rememberAppPath } from "../../utils/returnPath.ts";
import { FillHeightContext } from "./fillHeight.ts";
import type { User } from "../../types";

interface Props { user: User; onLogout: () => Promise<void>; }

const SIDEBAR_COLLAPSED_KEY = "hiretrail-sidebar-collapsed";

export default function Layout({ user, onLogout }: Props) {
  const [collapsed, toggleCollapsed] = useShellCollapse(SIDEBAR_COLLAPSED_KEY);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const scrollRef = useRef<HTMLElement>(null);
  // Remount (and replay the entrance) per section, not per path — switching
  // Applications views or stepping J/K through applications must not reset
  // the page or flash the fade.
  const sectionKey = location.pathname.split("/")[1] ?? "";
  // Views that own their height (the calendar, the Desk) claim it — the card
  // becomes a flex column and never scrolls (components/Layout/fillHeight).
  const [fillClaims, setFillClaims] = useState(0);
  const claimFill = useCallback((delta: 1 | -1) => setFillClaims((n) => Math.max(0, n + delta)), []);
  const fillHeight = fillClaims > 0;

  // Close mobile sidebar on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  // Settings' "Back to HireTrail" returns to this page, filters and all.
  useEffect(() => { rememberAppPath(location.pathname + location.search); }, [location.pathname, location.search]);

  // New page → start at the top. Back/forward (POP) is left alone so a list
  // can restore the exact scroll position the user left it at.
  const navigationType = useNavigationType();
  useLayoutEffect(() => {
    if (navigationType !== "POP") scrollRef.current?.scrollTo(0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return (
    <AnnouncementsProvider>
    <div className="flex h-dvh overflow-hidden bg-sidebar">
      {/* Mobile backdrop — always there on phones, so it fades with the drawer's slide. */}
      <div
        className={`fixed inset-0 bg-scrim/50 backdrop-blur-sm z-40 md:hidden transition-opacity duration-200 motion-reduce:transition-none ${mobileOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden
      />

      {/* Sidebar: off-canvas overlay on mobile, fixed on desktop. The wrapper
       *  needs an explicit width on mobile so `-translate-x-full` (100% of
       *  the element's own width) actually moves the inner sidebar off-screen.
       *  Without `w-60` here the wrapper sized to 0 and the translate was a
       *  no-op, leaving the sidebar permanently visible at <768px. */}
      <div className={`fixed top-0 left-0 bottom-0 z-50 md:z-20 transition-transform duration-200 w-60 md:w-auto md:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <Sidebar
          collapsed={collapsed}
          onToggle={() => {
            // On mobile, close the sidebar; on desktop, toggle collapse
            if (window.innerWidth < 768) setMobileOpen(false);
            else toggleCollapsed();
          }}
          isAdmin={user.role === "admin"}
        />
      </div>

      <div className={`shell-column flex-1 min-w-0 flex flex-col ${collapsed ? "md:ml-16" : "md:ml-60"}`}>
        <Header user={user} onLogout={onLogout} onMobileMenuToggle={() => setMobileOpen(!mobileOpen)} />
        {/* The main section. It is the scroll container, so page-level sticky
         *  bars pin to its top edge (top: 0) and it clips everything to its
         *  rounded corners. `overflow-x-hidden` keeps negative-margin
         *  "breakout" bars (-mx-4 md:-mx-6) from spilling a horizontal
         *  scrollbar. Edge-to-edge on mobile, a floating card from md up. */}
        <main
          ref={scrollRef}
          id={APP_SCROLL_ID}
          className={`shell-main flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-background border-t border-border md:border md:rounded-xl md:shadow-panel md:mr-2 md:mb-2 ${fillHeight ? "flex flex-col" : ""}`}
        >
          <AnnouncementBanner />
          {/* Every page gets the whole card: its PageHeader spans it, and the page
              caps only its body (ui/PageHeader PageBody). */}
          <div key={sectionKey} className={`p-4 md:p-6 fade-up ${fillHeight ? "w-full flex-1 min-h-0 flex flex-col" : ""}`}>
            <FillHeightContext.Provider value={claimFill}>
              <Outlet />
            </FillHeightContext.Provider>
          </div>
        </main>
      </div>
    </div>
    </AnnouncementsProvider>
  );
}
