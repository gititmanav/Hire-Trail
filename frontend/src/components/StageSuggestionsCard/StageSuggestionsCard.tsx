/** Inbox-style card on the Dashboard surfacing AI-detected stage changes from the
 *  email scanner. Each row carries Confirm / Revert actions when the AI auto-applied
 *  a forward-looking stage change. */
import { useCallback, useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import toast from "react-hot-toast";
import { notificationsAPI } from "../../utils/api.ts";
import type { Notification, NotificationType } from "../../types";

const SUGGESTION_TYPES: NotificationType[] = [
  "interview_detected",
  "offer_detected",
  "rejection_detected",
  "follow_up_detected",
];

const META: Record<string, { label: string; tone: "blue" | "purple" | "emerald" | "red" | "amber" }> = {
  interview_detected: { label: "Interview", tone: "purple" },
  offer_detected: { label: "Offer", tone: "emerald" },
  rejection_detected: { label: "Rejection", tone: "red" },
  follow_up_detected: { label: "Follow-up", tone: "amber" },
};

const TONE_CLASS: Record<string, string> = {
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  purple: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200",
  emerald: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  red: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
};

interface Props {
  onApplicationStageChanged?: () => void;
}

export default function StageSuggestionsCard({ onApplicationStageChanged }: Props) {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await notificationsAPI.getAll({ limit: 25 });
      const unresolved = res.data.filter(
        (n) => SUGGESTION_TYPES.includes(n.type) && !n.resolved
      );
      setItems(unresolved);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const onConfirm = async (n: Notification) => {
    setBusyId(n._id);
    try {
      await notificationsAPI.confirm(n._id);
      setItems((prev) => prev.filter((x) => x._id !== n._id));
      toast.success("Confirmed");
    } catch { toast.error("Could not confirm"); }
    finally { setBusyId(null); }
  };

  const onRevert = async (n: Notification) => {
    setBusyId(n._id);
    try {
      await notificationsAPI.revert(n._id);
      setItems((prev) => prev.filter((x) => x._id !== n._id));
      toast.success(`Reverted to ${n.previousStage}`);
      onApplicationStageChanged?.();
    } catch { toast.error("Could not revert"); }
    finally { setBusyId(null); }
  };

  if (loading || items.length === 0) return null;

  return (
    <div className="mb-4 rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <MessageCircle size={16} strokeWidth={1.8} className="text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Stage suggestions from email</h3>
        </div>
        <span className="text-xs text-muted-foreground">{items.length} pending</span>
      </div>
      <ul className="divide-y divide-border">
        {items.map((n) => {
          const meta = META[n.type];
          const canRevert = !!n.previousStage && !!n.applicationId;
          return (
            <li key={n._id} className="px-5 py-3 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3 min-w-0">
                {meta && (
                  <span className={`shrink-0 mt-0.5 inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${TONE_CLASS[meta.tone]}`}>
                    {meta.label}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                  {n.source && (
                    <p className="text-[10px] text-muted-foreground/80 mt-0.5">
                      via {n.source} · {new Date(n.createdAt).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {canRevert && (
                  <button
                    onClick={() => onRevert(n)}
                    disabled={busyId === n._id}
                    className="px-2.5 py-1 text-xs font-medium border border-border rounded-md text-secondary-foreground hover:bg-muted disabled:opacity-50"
                    title={`Revert to ${n.previousStage}`}
                  >
                    Revert
                  </button>
                )}
                <button
                  onClick={() => onConfirm(n)}
                  disabled={busyId === n._id}
                  className="px-2.5 py-1 text-xs font-medium rounded-md bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  Confirm
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
