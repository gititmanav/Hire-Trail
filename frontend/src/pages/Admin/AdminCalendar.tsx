/** /admin/calendar — the admin's own calendar, outside the Applications shell
 *  (no shared header, so no filters; the URL filters still apply if present). */
import PageHeader from "../../components/ui/PageHeader.tsx";
import CalendarView from "../Applications/views/calendar/CalendarView.tsx";

export default function AdminCalendar() {
  return (
    <div className="flex-1 min-h-[560px] flex flex-col">
      <PageHeader
        title="Calendar"
        meta={<span className="inline-flex items-center h-5 px-2 rounded-full border border-border text-[11px] font-medium text-muted-foreground">Admin view</span>}
      />
      <CalendarView />
    </div>
  );
}
