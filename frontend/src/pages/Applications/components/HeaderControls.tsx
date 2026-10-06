/** The Applications header's own control: the List · Board · Calendar switch.
 *  (Search, Filters and create are every page's — ui/PageHeader, ui/FiltersPopover.) */
import { NavLink } from "react-router-dom";
import { CalendarDays, Columns3, LayoutList, type LucideIcon } from "lucide-react";
import Tooltip from "../../../components/ui/Tooltip.tsx";

/* ─── View switcher ─── */

export type ViewKey = "list" | "board" | "calendar";

export const VIEWS: { key: ViewKey; path: string; label: string; Icon: LucideIcon; shortcut: string }[] = [
  { key: "list", path: "/applications", label: "List", Icon: LayoutList, shortcut: "1" },
  { key: "board", path: "/applications/board", label: "Board", Icon: Columns3, shortcut: "2" },
  { key: "calendar", path: "/applications/calendar", label: "Calendar", Icon: CalendarDays, shortcut: "3" },
];

export function ViewSwitcher({ views, search }: { views: typeof VIEWS; search: string }) {
  return (
    <nav aria-label="Views" className="inline-flex items-center gap-0.5 p-0.5 rounded-lg border border-border bg-background">
      {views.map((v) => (
        <Tooltip key={v.key} label={`${v.label} view`} shortcut={v.shortcut}>
          <NavLink
            to={{ pathname: v.path, search }}
            end
            aria-label={`${v.label} view`}
            className={({ isActive }) =>
              `w-7 h-7 inline-flex items-center justify-center rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                isActive ? "bg-control text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-control/60"
              }`
            }
          >
            <v.Icon size={15} strokeWidth={1.8} aria-hidden />
          </NavLink>
        </Tooltip>
      ))}
    </nav>
  );
}
