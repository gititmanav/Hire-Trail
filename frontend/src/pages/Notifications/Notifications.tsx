/**
 * Notifications page — the full list behind the header bell's "See all".
 *
 * The bell popover only shows the most recent few; this is the complete,
 * paginated history with the same per-item actions (confirm / revert /
 * dismiss) plus a "Mark all as read" affordance.
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Bell, Check, RotateCcw, X } from "lucide-react";
import { notificationsAPI } from "../../utils/api.ts";
import EmptyState from "../../components/EmptyState/EmptyState.tsx";
import type { Notification, NotificationType } from "../../types";

const TYPE_LABEL: Record<string, { label: string; tone: string }> = {
  interview_detected: { label: "Interview", tone: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200" },
  offer_detected: { label: "Offer", tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" },
  rejection_detected: { label: "Rejection", tone: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200" },
  follow_up_detected: { label: "Follow-up", tone: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" },
  scan_ready: { label: "Inbox scan", tone: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200" },
};

const SUGGESTION_TYPES: NotificationType[] = [
  "interview_detected",
  "offer_detected",
  "rejection_detected",
  "follow_up_detected",
];

const PAGE_SIZE = 30;

type Tab = "current" | "past";

export default function Notifications() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("current");
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  const fetchPage = useCallback(async (which: Tab, p: number) => {
    setLoading(true);
    try {
      const res = await notificationsAPI.getAll({ page: p, limit: PAGE_SIZE, status: which });
      setItems(res.data);
      setPages(res.pagination.pages || 1);
      setPage(res.pagination.page || p);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchPage(tab, 1); }, [tab, fetchPage]);

  // Confirm / revert / dismiss all mark the notification dealt-with → it leaves
  // the Current tab and moves to Past. Drop it from the visible list.
  const dropFromList = (id: string) => setItems((prev) => prev.filter((x) => x._id !== id));

  const onConfirm = async (n: Notification) => {
    setBusyId(n._id);
    try {
      await notificationsAPI.confirm(n._id);
      dropFromList(n._id);
      toast.success("Confirmed");
    } catch { toast.error("Could not confirm"); }
    finally { setBusyId(null); }
  };

  const onRevert = async (n: Notification) => {
    setBusyId(n._id);
    try {
      await notificationsAPI.revert(n._id);
      dropFromList(n._id);
      toast.success(`Reverted to ${n.previousStage}`);
    } catch { toast.error("Could not revert"); }
    finally { setBusyId(null); }
  };

  const onDismiss = async (n: Notification) => {
    setBusyId(n._id);
    try {
      await notificationsAPI.dismiss(n._id);
      dropFromList(n._id);
    } catch { toast.error("Could not dismiss"); }
    finally { setBusyId(null); }
  };

  const onRemove = async (n: Notification) => {
    setBusyId(n._id);
    try {
      await notificationsAPI.remove(n._id);
      dropFromList(n._id);
    } catch { toast.error("Could not delete"); }
    finally { setBusyId(null); }
  };

  const onMarkAllRead = async () => {
    try {
      await notificationsAPI.markAllRead();
      setItems((prev) => prev.map((x) => ({ ...x, read: true })));
      toast.success("All marked as read");
    } catch { toast.error("Could not mark all as read"); }
  };

  const onOpen = async (n: Notification) => {
    if (!n.read) {
      try {
        await notificationsAPI.markRead(n._id);
        setItems((prev) => prev.map((x) => x._id === n._id ? { ...x, read: true } : x));
      } catch { /* ignore */ }
    }
    if (n.type === "scan_ready") navigate("/settings/email-review");
    else if (n.applicationId) navigate(`/applications?focus=${n.applicationId}`);
  };

  const hasUnread = items.some((n) => !n.read);

  return (
    <div className="max-w-3xl mx-auto px-5 py-8">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <Bell size={20} strokeWidth={1.8} className="text-foreground" />
          <h1 className="text-2xl font-semibold text-foreground">Notifications</h1>
        </div>
        {tab === "current" && hasUnread && (
          <button onClick={onMarkAllRead} className="text-xs text-muted-foreground hover:text-foreground">
            Mark all as read
          </button>
        )}
      </div>

      <div className="inline-flex items-center gap-0.5 rounded-lg bg-muted p-0.5 mb-6">
        {(["current", "past"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md capitalize transition-colors ${
              tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        tab === "current" ? (
          <EmptyState
            title="You're all caught up"
            description="Connected-mailbox detections and inbox-scan results show up here."
            actions={[{ label: "Open Settings", href: "/settings" }]}
          />
        ) : (
          <EmptyState
            title="Nothing in your history yet"
            description="Notifications you've dealt with are kept here for reference."
          />
        )
      ) : (
        <ul className="space-y-2">
          {items.map((n) => {
            const meta = TYPE_LABEL[n.type];
            const isSuggestion = SUGGESTION_TYPES.includes(n.type);
            const canRevert = isSuggestion && !n.resolved && !!n.previousStage && !!n.applicationId;
            const canConfirm = isSuggestion && !n.resolved;
            const clickable = n.type === "scan_ready" || !!n.applicationId;
            return (
              <li
                key={n._id}
                className={`group relative rounded-xl border border-border p-4 ${!n.read ? "bg-primary/5" : "bg-card"} ${clickable ? "cursor-pointer hover:border-muted-foreground/30" : ""}`}
                onClick={clickable ? () => onOpen(n) : undefined}
              >
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); void (tab === "past" ? onRemove(n) : onDismiss(n)); }}
                  disabled={busyId === n._id}
                  title={tab === "past" ? "Delete" : "Dismiss"}
                  aria-label={tab === "past" ? "Delete notification" : "Dismiss notification"}
                  className="absolute top-2.5 right-2.5 w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground/60 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-muted hover:text-foreground disabled:opacity-50"
                >
                  <X size={14} strokeWidth={2} />
                </button>
                <div className="flex items-start gap-2.5 pr-6">
                  {!n.read && <span className="mt-2 w-1.5 h-1.5 rounded-full bg-primary shrink-0" aria-hidden />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {meta && (
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${meta.tone}`}>
                          {meta.label}
                        </span>
                      )}
                      <p className="text-sm font-medium text-foreground">{n.title}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground/70 mt-1">
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                    {(canConfirm || canRevert) && (
                      <div className="flex items-center gap-2 mt-2.5" onClick={(e) => e.stopPropagation()}>
                        {canRevert && (
                          <button
                            onClick={() => onRevert(n)}
                            disabled={busyId === n._id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium border border-border rounded-md text-secondary-foreground hover:bg-muted disabled:opacity-50"
                            title={`Revert to ${n.previousStage}`}
                          >
                            <RotateCcw size={11} strokeWidth={2} /> Revert
                          </button>
                        )}
                        {canConfirm && (
                          <button
                            onClick={() => onConfirm(n)}
                            disabled={busyId === n._id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                          >
                            <Check size={11} strokeWidth={2.5} /> Confirm
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 && !loading && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={() => fetchPage(tab, page - 1)}
            disabled={page <= 1}
            className="px-3 py-1.5 text-xs font-medium border border-border rounded-md text-secondary-foreground hover:bg-muted disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-xs text-muted-foreground">Page {page} of {pages}</span>
          <button
            onClick={() => fetchPage(tab, page + 1)}
            disabled={page >= pages}
            className="px-3 py-1.5 text-xs font-medium border border-border rounded-md text-secondary-foreground hover:bg-muted disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
