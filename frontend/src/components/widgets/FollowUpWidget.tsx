import { Link } from "react-router-dom";
import type { Contact } from "../../types";

const daysSince = (d: string) => Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
const daysOverdue = (d: string) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(d); due.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - due.getTime()) / 86400000);
};

interface Props {
  contacts: Contact[];
  onFollowUp: (id: string) => void;
  onSnooze: (id: string) => void;
}

export default function FollowUpWidget({ contacts, onFollowUp, onSnooze }: Props) {
  if (contacts.length === 0)
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
        <p className="text-sm">No follow-ups needed</p>
      </div>
    );

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
          Needs attention
        </span>
        <Link to="/contacts" className="text-xs text-muted-foreground hover:text-foreground hover:underline">
          View all
        </Link>
      </div>
      <div className="flex-1 overflow-auto divide-y divide-border">
        {contacts.map((c) => {
          const overdue = c.nextFollowUpDate ? daysOverdue(c.nextFollowUpDate) : null;
          const staleOutreach =
            c.outreachStatus === "reached_out" && c.lastOutreachDate && daysSince(c.lastOutreachDate) > 7;
          const label =
            overdue !== null
              ? overdue === 0
                ? "Due today"
                : `${overdue}d overdue`
              : staleOutreach && c.lastOutreachDate
                ? `${daysSince(c.lastOutreachDate)}d since outreach`
                : "";

          return (
            <div key={c._id} className="flex items-center justify-between py-2.5 gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium text-foreground truncate">
                  {c.name}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">{c.company}</div>
              </div>
              <span
                className={`text-[11px] whitespace-nowrap font-medium ${
                  overdue !== null && overdue > 0
                    ? "text-danger"
                    : overdue === 0
                      ? "text-warning"
                      : "text-orange-400"
                }`}
              >
                {label}
              </span>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => onFollowUp(c._id)}
                  className="px-2 py-1 text-[11px] font-medium rounded-md bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50"
                  title="Mark followed up"
                >
                  Done
                </button>
                <button
                  onClick={() => onSnooze(c._id)}
                  className="px-2 py-1 text-[11px] font-medium rounded-md bg-muted text-muted-foreground hover:bg-border hover:bg-muted"
                  title="Snooze 3 days"
                >
                  +3d
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
