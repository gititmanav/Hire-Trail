/** Outlook-inspired toolbar: Today / prev / next / month label / view switcher / filters / refresh. */
import type { View } from "react-big-calendar";
import type { ReactNode } from "react";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, RefreshCw, PanelRight } from "lucide-react";

interface Props {
  date: Date;
  view: View;
  onNavigate: (date: Date) => void;
  onView: (v: View) => void;
  onRefresh: () => void;
  refreshing: boolean;
  rightPaneOpen: boolean;
  onToggleRightPane: () => void;
  filtersSlot?: ReactNode;
}

const VIEWS: { key: View; label: string; short: string }[] = [
  { key: "month", label: "Month", short: "M" },
  { key: "week", label: "Week", short: "W" },
  { key: "day", label: "Day", short: "D" },
  { key: "agenda", label: "Agenda", short: "A" },
];

function navByView(view: View, date: Date, dir: -1 | 1): Date {
  const next = new Date(date);
  if (view === "month") next.setMonth(next.getMonth() + dir);
  else if (view === "week") next.setDate(next.getDate() + 7 * dir);
  else if (view === "day") next.setDate(next.getDate() + dir);
  else if (view === "agenda") next.setDate(next.getDate() + 30 * dir);
  return next;
}

function labelForRange(view: View, date: Date): string {
  if (view === "month") return format(date, "MMMM yyyy");
  if (view === "day") return format(date, "EEEE, MMM d, yyyy");
  if (view === "week") {
    const start = new Date(date);
    const dow = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - dow);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
  }
  return format(date, "MMM d, yyyy");
}

export function CalendarToolbar({ date, view, onNavigate, onView, onRefresh, refreshing, rightPaneOpen, onToggleRightPane, filtersSlot }: Props) {
  const today = new Date();
  return (
    <div className="cal-toolbar">
      <div className="cal-toolbar__left">
        <button type="button" className="cal-toolbar__today" onClick={() => onNavigate(today)} title="Jump to today (T)">
          Today
        </button>
        <div className="cal-toolbar__nav">
          <button type="button" onClick={() => onNavigate(navByView(view, date, -1))} aria-label="Previous" title="Previous (←)">
            <ChevronLeft size={14} strokeWidth={2} />
          </button>
          <button type="button" onClick={() => onNavigate(navByView(view, date, 1))} aria-label="Next" title="Next (→)">
            <ChevronRight size={14} strokeWidth={2} />
          </button>
        </div>
        <h2 className="cal-toolbar__label">{labelForRange(view, date)}</h2>
      </div>
      <div className="cal-toolbar__right">
        {filtersSlot}
        <div className="cal-toolbar__views" role="tablist" aria-label="Calendar view">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              role="tab"
              aria-selected={view === v.key}
              className={`cal-toolbar__view ${view === v.key ? "cal-toolbar__view--active" : ""}`}
              onClick={() => onView(v.key)}
              title={`${v.label} (${v.short})`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <button type="button" className="cal-toolbar__refresh" onClick={onRefresh} disabled={refreshing} title="Refresh">
          <RefreshCw size={14} strokeWidth={2} className={refreshing ? "spin" : ""} />
        </button>
        <button
          type="button"
          className={`cal-toolbar__pane ${rightPaneOpen ? "cal-toolbar__pane--open" : ""}`}
          onClick={onToggleRightPane}
          title={rightPaneOpen ? "Hide details panel" : "Show details panel"}
          aria-pressed={rightPaneOpen}
        >
          <PanelRight size={14} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
