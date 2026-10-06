/** The pages the header search can pin as quick links — the circles that bud
 *  off the bar on hover. Up to QUICK_LINK_MAX, chosen in place from the "+"
 *  circle; saved on the account (utils/preferences.ts). */
import { Bell, CalendarDays, Columns3, FileText, LayoutList, Palette, Sparkles, type LucideIcon } from "lucide-react";

import type { QuickLinkId } from "../../utils/preferences.ts";

export interface QuickLink {
  id: QuickLinkId;
  label: string;
  path: string;
  Icon: LucideIcon;
  /** A feature flag the page lives behind. */
  flag?: string;
}

/** Catalogue order (the editor's grid). */
export const QUICK_LINKS: QuickLink[] = [
  { id: "ai", label: "AI", path: "/settings/ai", Icon: Sparkles },
  { id: "notifications", label: "Notifications", path: "/notifications", Icon: Bell },
  { id: "calendar", label: "Calendar", path: "/applications/calendar", Icon: CalendarDays },
  { id: "list", label: "Applications", path: "/applications", Icon: LayoutList },
  { id: "board", label: "Board", path: "/applications/board", Icon: Columns3, flag: "feature_kanban" },
  { id: "resumes", label: "Resumes", path: "/resumes", Icon: FileText },
  { id: "personalize", label: "Personalize", path: "/settings/personalize", Icon: Palette },
];

const BY_ID = new Map(QUICK_LINKS.map((l) => [l.id, l]));

export function quickLink(id: QuickLinkId): QuickLink {
  return BY_ID.get(id)!;
}
