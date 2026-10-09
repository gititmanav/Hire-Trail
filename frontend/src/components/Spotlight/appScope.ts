/** The app's search: its pages, the person's records (applications,
 *  companies, contacts, deadlines), their quick links, and the unread dot on
 *  Notifications. */
import { useUnreadNotifications } from "../../hooks/useUnreadNotifications.ts";
import { PAGES, useSearchRecords } from "./searchIndex.ts";
import { QUICK_LINKS } from "./quickLinks.ts";
import { useQuickLinks } from "./useQuickLinks.ts";
import type { SpotlightScope } from "./scope.ts";

function useAppRecords(enabled: boolean) {
  return useSearchRecords(enabled);
}

function useAppBadges(): Partial<Record<string, string>> {
  const unread = useUnreadNotifications();
  return unread > 0 ? { notifications: `${unread} unread` } : {};
}

export const appScope: SpotlightScope = {
  label: "Search HireTrail",
  pages: PAGES,
  useRecords: useAppRecords,
  searchingText: "Searching your records…",
  catalog: QUICK_LINKS,
  useLinks: useQuickLinks,
  useBadges: useAppBadges,
};
