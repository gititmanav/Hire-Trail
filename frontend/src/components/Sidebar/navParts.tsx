/** Building blocks shared by the app and admin sidebars.
 *
 *  Collapse motion (a view transition, see useShellCollapse): every row keeps
 *  one layout in both states — icons sit at the same x (centred in the 64px
 *  rail), labels are clipped by the narrowing sidebar and fade — so nothing
 *  jumps between the two states. */
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

export const ICON_ROW = "relative flex items-center gap-3 h-9 pl-[15px] pr-3 rounded-lg text-sm font-medium whitespace-nowrap transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring";

export const fade = (collapsed: boolean) => `shell-fade ${collapsed ? "opacity-0" : "opacity-100"}`;

/** Items read in the quiet text colour (Sora's dull white in dark) and only
 *  brighten on hover — no fill; the selected one is a raised pill (card
 *  surface + soft shadow) in full text with its icon in the accent. Shared by
 *  the app, Settings and Admin sidebars. */
export const navTone = (active: boolean) =>
  active
    ? "bg-card text-foreground shadow-pill [&>svg]:text-primary"
    : "text-muted-foreground hover:text-foreground";

export function GroupLabel({ label, collapsed, first }: { label: string; collapsed: boolean; first: boolean }) {
  return (
    <div className="relative h-5 mb-1 px-3 flex items-center select-none" aria-hidden={collapsed}>
      <span className={`text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40 whitespace-nowrap ${fade(collapsed)}`}>{label}</span>
      {/* In the rail, a hairline stands in for the group name. */}
      {!first && (
        <span className={`shell-fade absolute left-3 right-3 top-1/2 h-px bg-sidebar-border/60 ${collapsed ? "opacity-100" : "opacity-0"}`} />
      )}
    </div>
  );
}

export function CollapseToggle({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="shrink-0 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent p-1.5 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
      {collapsed ? <PanelLeftOpen size={18} strokeWidth={1.5} /> : <PanelLeftClose size={18} strokeWidth={1.5} />}
    </button>
  );
}
