/**
 * Full-width banner shown under the header for active, non-dismissed
 * announcements. Renders nothing when there's nothing to show. Styling is keyed
 * to the announcement type; dismissible entries get an X (which routes the
 * announcement into the header megaphone for later).
 */
import { X, AlertTriangle, CheckCircle2, Info, type LucideIcon } from "lucide-react";
import { useAnnouncements } from "./AnnouncementsProvider.tsx";
import type { Announcement } from "../../types";

const STYLES: Record<Announcement["type"], string> = {
  info: "bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950/40 dark:border-blue-900/60 dark:text-blue-100",
  warning: "bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-900/60 dark:text-amber-100",
  success: "bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-900/60 dark:text-emerald-100",
};

const ICONS: Record<Announcement["type"], LucideIcon> = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle2,
};

export default function AnnouncementBanner() {
  const { visible, dismiss } = useAnnouncements();
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-col">
      {visible.map((a) => {
        const Icon = ICONS[a.type] ?? Info;
        return (
          <div key={a._id} className={`flex items-start gap-3 px-4 md:px-6 py-2.5 border-b text-sm ${STYLES[a.type] ?? STYLES.info}`}>
            <Icon size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="font-semibold">{a.title}</span>
              {a.body && <span className="opacity-90">{" "}— {a.body}</span>}
            </div>
            {a.dismissible && (
              <button
                onClick={() => dismiss(a._id)}
                className="shrink-0 p-1 -m-1 rounded hover:bg-black/5 dark:hover:bg-white/10"
                aria-label="Dismiss announcement"
                title="Dismiss"
              >
                <X size={15} strokeWidth={2} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
