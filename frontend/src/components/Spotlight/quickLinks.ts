/** The pages the app's header search can pin as quick links — the circles that
 *  bud off the bar on hover. Up to QUICK_LINK_MAX, chosen in place from the "+"
 *  circle; saved on the account (utils/preferences.ts). Admin's are in
 *  adminScope.ts. */
import { Bell, CalendarDays, Columns3, FileText, LayoutList, Palette, Sparkles } from "lucide-react";

import type { QuickLinkId } from "../../utils/preferences.ts";
import type { QuickLink } from "./scope.ts";

/** Catalogue order (the editor's grid). */
export const QUICK_LINKS: (QuickLink & { id: QuickLinkId })[] = [
  { id: "ai", label: "AI", path: "/settings/ai", Icon: Sparkles },
  { id: "notifications", label: "Notifications", path: "/notifications", Icon: Bell },
  { id: "calendar", label: "Calendar", path: "/applications/calendar", Icon: CalendarDays },
  { id: "list", label: "Applications", path: "/applications", Icon: LayoutList },
  { id: "board", label: "Board", path: "/applications/board", Icon: Columns3, flag: "feature_kanban" },
  { id: "resumes", label: "Resumes", path: "/resumes", Icon: FileText },
  { id: "personalize", label: "Personalize", path: "/settings/personalize", Icon: Palette },
];
