/** The month's "N more": the whole day in a panel that opens over its cell
 *  (Apple's zoom card) — every event as a full row, with the same hover card
 *  and click behaviour as a chip. A ui/Popover, so it layers, dismisses and
 *  moves like every other floating surface. */
import { useRef } from "react";
import { Plus } from "lucide-react";
import Popover from "../../../../components/ui/Popover.tsx";
import { formatDay, type Ymd } from "../../../../utils/dates.ts";
import type { CalendarEvent } from "../../../../utils/calendarGrid.ts";
import type { CalendarApp } from "../../../../utils/api.ts";
import { EventChip, type ChipHandlers } from "./parts.tsx";

export default function DayPeek({ peek, list, apps, today, chips, onAdd, onClose }: {
  peek: { day: Ymd; cell: HTMLElement } | null;
  list: CalendarEvent[];
  apps: Record<string, CalendarApp>;
  today: Ymd;
  chips: ChipHandlers;
  onAdd: (day: Ymd) => void;
  onClose: () => void;
}) {
  const anchorRef = useRef<HTMLElement | null>(null);
  // While it fades out, the panel keeps showing the day it was opened on —
  // its rows and its size — instead of emptying mid-fade. The cell is
  // measured when the peek opens, not on every render.
  const last = useRef(peek);
  const lastList = useRef(list);
  const rectRef = useRef<DOMRect | null>(null);
  if (peek) {
    if (last.current !== peek || !rectRef.current) rectRef.current = peek.cell.getBoundingClientRect();
    last.current = peek;
    lastList.current = list;
    anchorRef.current = peek.cell;
  }
  const shown = last.current;
  const rows = peek ? list : lastList.current;
  const rect = rectRef.current;

  return (
    <Popover
      open={!!peek}
      onOpenChange={(o) => { if (!o) onClose(); }}
      anchorRef={anchorRef}
      // Open over the cell itself, a little larger than it.
      offset={rect ? -rect.height - 4 : 6}
      width={rect ? Math.max(rect.width + 16, 264) : 264}
      maxHeight={420}
      ariaLabel={shown ? `${formatDay(shown.day, { weekday: "long", month: "long", day: "numeric" })}` : "Day"}
      className="flex flex-col !overflow-hidden"
    >
      {shown && (
        <>
          <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5 shrink-0">
            <span className="text-[12.5px] font-semibold text-foreground">{formatDay(shown.day, { weekday: "short", month: "short", day: "numeric" })}</span>
            <span className="text-[11px] font-medium text-muted-foreground tabular-nums">{rows.length}</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto scroll-quiet px-1.5 pb-1 flex flex-col gap-px">
            {rows.map((e) => (
              <EventChip key={e.id} event={e} today={today} app={e.applicationId ? apps[e.applicationId] : undefined} dragging={false} lines={2} handlers={chips} />
            ))}
          </div>
          <div className="shrink-0 border-t border-border p-1">
            <button
              type="button"
              onClick={() => { onClose(); onAdd(shown.day); }}
              className="w-full inline-flex items-center gap-1.5 h-8 px-2 rounded-lg text-[12.5px] font-medium text-muted-foreground hover:text-foreground hover:bg-control focus:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
            >
              <Plus size={14} strokeWidth={2} aria-hidden /> New deadline
            </button>
          </div>
        </>
      )}
    </Popover>
  );
}
