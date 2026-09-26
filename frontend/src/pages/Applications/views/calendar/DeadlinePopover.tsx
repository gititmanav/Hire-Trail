/** Clicking a deadline: an Apple-style popover anchored to it — what it is,
 *  when, and the things you do with a deadline: complete (with Undo),
 *  reschedule, edit, open its application, delete (one light confirm). */
import { useRef, useState } from "react";
import { ArrowUpRight, CalendarClock, Check, ChevronLeft, Pencil, Repeat, Trash2 } from "lucide-react";
import Popover, { itemClass, PopoverDivider } from "../../../../components/ui/Popover.tsx";
import CalendarPicker from "../../../../components/ui/CalendarPicker.tsx";
import { DeadlineTypeIcon } from "../../../../components/DeadlineFormModal/DeadlineFormModal.tsx";
import { diffDaysYmd, formatDay, relativeDay, type Ymd } from "../../../../utils/dates.ts";
import type { CalendarEvent } from "../../../../utils/calendarGrid.ts";
import { isOverdue } from "./parts.tsx";

export interface DeadlineActions {
  complete: (e: CalendarEvent) => void;
  reschedule: (e: CalendarEvent, day: Ymd) => void;
  edit: (e: CalendarEvent) => void;
  remove: (e: CalendarEvent) => void;
  openApplication: (applicationId: string) => void;
}

export default function DeadlinePopover({ event: current, anchor, today, onClose, actions }: {
  event: CalendarEvent | null;
  anchor: HTMLElement | null;
  today: Ymd;
  onClose: () => void;
  actions: DeadlineActions;
}) {
  const anchorRef = useRef<HTMLElement | null>(null);
  if (anchor) anchorRef.current = anchor;
  // Keep showing the last deadline while the panel plays its exit.
  const last = useRef(current);
  if (current) last.current = current;
  const event = last.current;
  const [picking, setPicking] = useState(false);
  const open = !!current && !!anchor;
  const close = () => { setPicking(false); onClose(); };
  const act = (fn: () => void) => () => { close(); fn(); };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => { if (!o) close(); }}
      anchorRef={anchorRef}
      width={picking ? 296 : 288}
      ariaLabel={event ? `${event.title} actions` : "Deadline actions"}
    >
      {event && !picking && (
        <div className="p-1.5">
          <div className="px-2.5 pt-2 pb-2">
            <div className={`flex items-center gap-2 text-[14px] font-semibold ${isOverdue(event, today) ? "text-destructive" : "text-foreground"}`}>
              <DeadlineTypeIcon type={event.title} size={15} />
              <span className="truncate">{event.title}</span>
            </div>
            {event.company && <p className="mt-0.5 text-[12.5px] text-foreground/80 truncate">{event.company}{event.role ? <span className="text-muted-foreground"> · {event.role}</span> : null}</p>}
            <p className={`mt-1 text-[12px] ${isOverdue(event, today) ? "text-destructive/85" : "text-muted-foreground"}`}>
              {formatDay(event.date, { weekday: "long", month: "short", day: "numeric" })} · {isOverdue(event, today) ? `${-diffDaysYmd(today, event.date)} days overdue` : relativeDay(event.date, today)}
            </p>
            {!!event.recurrenceDays && (
              <p className="mt-1 inline-flex items-center gap-1 text-[12px] text-muted-foreground">
                <Repeat size={12} strokeWidth={1.8} aria-hidden /> Repeats every {event.recurrenceDays} days
              </p>
            )}
            {event.notes?.trim() && <p className="mt-2 text-[12.5px] text-foreground/80 line-clamp-4 whitespace-pre-line">{event.notes}</p>}
          </div>
          <PopoverDivider />
          <button type="button" className={itemClass()} onClick={act(() => actions.complete(event))}>
            <Check size={15} strokeWidth={1.8} className="text-muted-foreground" aria-hidden /> Mark complete
          </button>
          <button type="button" className={itemClass()} onClick={() => setPicking(true)}>
            <CalendarClock size={15} strokeWidth={1.8} className="text-muted-foreground" aria-hidden /> Reschedule…
          </button>
          <button type="button" className={itemClass()} onClick={act(() => actions.edit(event))}>
            <Pencil size={15} strokeWidth={1.8} className="text-muted-foreground" aria-hidden /> Edit
          </button>
          {event.applicationId && (
            <button type="button" className={itemClass()} onClick={act(() => actions.openApplication(event.applicationId!))}>
              <ArrowUpRight size={15} strokeWidth={1.8} className="text-muted-foreground" aria-hidden /> Open application
            </button>
          )}
          <PopoverDivider />
          <button type="button" className={itemClass({ destructive: true })} onClick={act(() => actions.remove(event))}>
            <Trash2 size={15} strokeWidth={1.8} aria-hidden /> Delete
          </button>
        </div>
      )}
      {event && picking && (
        <div className="p-3">
          <button type="button" onClick={() => setPicking(false)} className="mb-2 -ml-1 inline-flex items-center gap-1 h-7 px-1.5 rounded-md text-[12.5px] font-medium text-muted-foreground hover:text-foreground hover:bg-control focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <ChevronLeft size={14} strokeWidth={2} aria-hidden /> Reschedule {event.title}
          </button>
          <CalendarPicker value={event.date} onPick={(day) => { close(); if (day !== event.date) actions.reschedule(event, day); }} />
        </div>
      )}
    </Popover>
  );
}
