/**
 * Fixed-slot detail grid for an ApplicationRow. Every slot is always rendered
 * (with a muted "None" fallback when empty) so the visual rhythm is identical
 * across every row in the list. Matches the icon vocabulary used in the
 * detail sidebar — single source of truth in `fieldIcons.tsx`.
 *
 * Six slots: Location · Salary · Type · Resume · Contact · Next deadline.
 * On wide viewports it lays out as a 3-col / 2-row grid; on narrow ones it
 * wraps naturally.
 */
import { memo } from "react";
import { Icons } from "./fieldIcons.tsx";
import type { Application, Contact, Deadline, Resume } from "../../../types";

interface Props {
  app: Application;
  resume?: Resume;
  contact?: Contact;
  deadlines: Deadline[];
}

const NONE = "None";
const DAY_MS = 86_400_000;

function Cell({ icon, label, value, valueClass = "" }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
}) {
  const isMissing = value === NONE;
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className={`shrink-0 ${isMissing ? "text-muted-foreground/60" : "text-muted-foreground"}`}>
        {icon}
      </span>
      <div className="min-w-0 flex flex-col leading-tight">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
          {label}
        </span>
        <span
          className={`text-[12.5px] truncate ${
            isMissing ? "text-muted-foreground/60 italic" : `text-foreground ${valueClass}`
          }`}
          title={isMissing ? `No ${label.toLowerCase()} saved` : value}
        >
          {value}
        </span>
      </div>
    </div>
  );
}

function AppFieldGridImpl({ app, resume, contact, deadlines }: Props) {
  // Next-upcoming deadline for this app (closest unfinished due date).
  const next = (() => {
    const now = Date.now();
    const list = deadlines
      .filter((d) => d.applicationId === app._id && !d.completed)
      .map((d) => ({ ...d, due: new Date(d.dueDate).getTime() }))
      .filter((d) => !isNaN(d.due));
    list.sort((a, b) => a.due - b.due);
    const n = list[0];
    if (!n) return null;
    const dueIn = Math.round((n.due - now) / DAY_MS);
    return { type: n.type, dueIn };
  })();

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 mt-1.5">
      <Cell icon={<Icons.location />}  label="Location" value={app.location || NONE} />
      <Cell icon={<Icons.salary />}    label="Salary"   value={app.salary   || NONE} />
      <Cell icon={<Icons.jobType />}   label="Type"     value={app.jobType  || NONE} />
      <Cell icon={<Icons.resume />}    label="Resume"   value={resume?.name || NONE} />
      <Cell icon={<Icons.contact />}   label="Contact"  value={contact?.name ? `${contact.name}${contact.role ? ` · ${contact.role}` : ""}` : NONE} />
      <Cell
        icon={<Icons.deadline />}
        label="Next deadline"
        value={next ? `${next.type} · ${next.dueIn <= 0 ? "today" : `${next.dueIn}d`}` : NONE}
        valueClass={next && next.dueIn <= 3 ? "text-orange-600 dark:text-orange-300 font-medium" : ""}
      />
    </div>
  );
}

export default memo(AppFieldGridImpl);
