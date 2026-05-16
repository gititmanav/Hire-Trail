/** Tiny "next 5 upcoming" list shown in the left panel. Click an item → main calendar jumps + selects.
 *  "Upcoming" excludes completed and past-dated deadlines — only today + future. */
import { format, isToday, startOfDay } from "date-fns";
import type { Deadline } from "../../../types";

interface Props {
  deadlines: Deadline[];
  onSelect: (deadline: Deadline) => void;
  limit?: number;
}

export function UpcomingList({ deadlines, onSelect, limit = 5 }: Props) {
  const todayStart = startOfDay(new Date()).getTime();
  const upcoming = deadlines
    .filter((d) => !d.completed && startOfDay(new Date(d.dueDate)).getTime() >= todayStart)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, limit);

  if (upcoming.length === 0) {
    return (
      <div className="upcoming">
        <p className="upcoming__empty">No upcoming deadlines. Click any empty day to add one.</p>
      </div>
    );
  }

  return (
    <ul className="upcoming">
      {upcoming.map((d) => {
        const due = new Date(d.dueDate);
        const status = isToday(due) ? "today" : "upcoming";
        return (
          <li key={d._id}>
            <button type="button" className={`upcoming__item upcoming__item--${status}`} onClick={() => onSelect(d)}>
              <span className="upcoming__dot" />
              <span className="upcoming__body">
                <span className="upcoming__type">{d.type}</span>
                <span className="upcoming__date">{format(due, "EEE, MMM d")}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
