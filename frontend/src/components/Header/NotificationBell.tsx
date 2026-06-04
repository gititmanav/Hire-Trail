/** Header bell — unread badge + popover list. Refetches on focus + a slow
 *  background tick so the count stays fresh without hammering the API. */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Bell, X } from "lucide-react";
import { notificationsAPI } from "../../utils/api.ts";
import { useRefetchOnFocus } from "../../hooks/useRefetchOnFocus.ts";
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

/** Long fallback poll so a tab left visible (e.g. dashboard on a second monitor)
 *  still refreshes occasionally without the focus event ever firing. Most
 *  freshness comes from the focus refetch — this is the safety net. */
const FALLBACK_POLL_MS = 5 * 60_000;
const MAX_DISPLAY = 8;

type Tab = "current" | "past";

export default function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<Notification[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("current");
  const rootRef = useRef<HTMLDivElement>(null);

  const refreshCount = useCallback(async () => {
    try {
      const { count } = await notificationsAPI.getUnreadCount();
      setUnread(count);
    } catch {
      /* silent — bell is non-critical */
    }
  }, []);

  // Initial fetch + long fallback poll. Focus / visibility-change handle the
  // common case (user returns to the tab) much faster than any interval would.
  useEffect(() => {
    void refreshCount();
    const id = setInterval(refreshCount, FALLBACK_POLL_MS);
    return () => clearInterval(id);
  }, [refreshCount]);

  useRefetchOnFocus(refreshCount, { minIntervalMs: 10_000 });

  const fetchList = useCallback(async (which: Tab) => {
    setLoadingList(true);
    try {
      const res = await notificationsAPI.getAll({ limit: 20, status: which });
      setItems(res.data);
    } catch {
      setItems([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  // Refetch list each time the popover opens or the tab changes.
  useEffect(() => {
    if (open) void fetchList(tab);
  }, [open, tab, fetchList]);

  // Click-outside + Escape close
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Confirm / revert / dismiss all "deal with" the notification — it leaves the
  // Current tab (becomes resolved → Past). We drop it from the visible list and
  // decrement the unread badge if it was unread.
  const dealtWith = (n: Notification) => {
    setItems((prev) => prev.filter((x) => x._id !== n._id));
    if (!n.read) setUnread((c) => Math.max(0, c - 1));
  };

  const onConfirm = async (n: Notification) => {
    setBusyId(n._id);
    try {
      await notificationsAPI.confirm(n._id);
      dealtWith(n);
      toast.success("Confirmed");
    } catch { toast.error("Could not confirm"); }
    finally { setBusyId(null); }
  };

  const onRevert = async (n: Notification) => {
    setBusyId(n._id);
    try {
      await notificationsAPI.revert(n._id);
      dealtWith(n);
      toast.success(`Reverted to ${n.previousStage}`);
    } catch { toast.error("Could not revert"); }
    finally { setBusyId(null); }
  };

  const onDismiss = async (n: Notification) => {
    setBusyId(n._id);
    try {
      await notificationsAPI.dismiss(n._id);
      dealtWith(n);
    } catch { toast.error("Could not dismiss"); }
    finally { setBusyId(null); }
  };

  // Past tab: permanently delete.
  const onRemove = async (n: Notification) => {
    setBusyId(n._id);
    try {
      await notificationsAPI.remove(n._id);
      setItems((prev) => prev.filter((x) => x._id !== n._id));
    } catch { toast.error("Could not delete"); }
    finally { setBusyId(null); }
  };

  const onMarkAllRead = async () => {
    try {
      await notificationsAPI.markAllRead();
      setItems((prev) => prev.map((x) => ({ ...x, read: true })));
      setUnread(0);
    } catch { toast.error("Could not mark all as read"); }
  };

  const onOpenItem = async (n: Notification) => {
    // Mark read in-place
    if (!n.read) {
      try {
        await notificationsAPI.markRead(n._id);
        setItems((prev) => prev.map((x) => x._id === n._id ? { ...x, read: true } : x));
        setUnread((c) => Math.max(0, c - 1));
      } catch { /* ignore */ }
    }
    setOpen(false);
    if (n.type === "scan_ready") navigate("/settings/email-review");
    else if (n.applicationId) navigate(`/applications?focus=${n.applicationId}`);
    else navigate("/notifications");
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => { if (!o) setTab("current"); return !o; })}
        className="relative w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-secondary-foreground"
        title="Notifications"
        aria-label={unread > 0 ? `${unread} unread notifications` : "Notifications"}
      >
        <Bell size={18} strokeWidth={1.7} />
        {unread > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center border border-background"
            aria-hidden
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-[360px] max-w-[calc(100vw-24px)] card-premium z-50 animate-in">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
            <div className="inline-flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
              {(["current", "past"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md capitalize transition-colors ${
                    tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            {tab === "current" && unread > 0 && (
              <button onClick={onMarkAllRead} className="text-[11px] text-muted-foreground hover:text-foreground">
                Mark all as read
              </button>
            )}
          </div>

          {loadingList ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : items.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {tab === "current" ? (
                <>
                  <p>You're all caught up.</p>
                  <p className="text-[11px] mt-1">Connected-mailbox detections show up here.</p>
                </>
              ) : (
                <>
                  <p>Nothing in your history yet.</p>
                  <p className="text-[11px] mt-1">Dealt-with notifications are kept here for reference.</p>
                </>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-border max-h-[420px] overflow-y-auto">
              {items.slice(0, MAX_DISPLAY).map((n) => {
                const meta = TYPE_LABEL[n.type];
                const isSuggestion = SUGGESTION_TYPES.includes(n.type);
                const canRevert = isSuggestion && !n.resolved && !!n.previousStage && !!n.applicationId;
                const canConfirm = isSuggestion && !n.resolved;
                return (
                  <li
                    key={n._id}
                    className={`group relative px-4 py-3 hover:bg-muted/40 cursor-pointer ${!n.read ? "bg-primary/5" : ""}`}
                    onClick={() => onOpenItem(n)}
                  >
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); void (tab === "past" ? onRemove(n) : onDismiss(n)); }}
                      disabled={busyId === n._id}
                      title={tab === "past" ? "Delete" : "Dismiss"}
                      aria-label={tab === "past" ? "Delete notification" : "Dismiss notification"}
                      className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground/60 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-muted hover:text-foreground disabled:opacity-50"
                    >
                      <X size={13} strokeWidth={2} />
                    </button>
                    <div className="flex items-start gap-2.5">
                      {!n.read && <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" aria-hidden />}
                      <div className="min-w-0 flex-1 pr-5">
                        <div className="flex items-center gap-2 flex-wrap">
                          {meta && (
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${meta.tone}`}>
                              {meta.label}
                            </span>
                          )}
                          <p className="text-sm font-medium text-foreground truncate">{n.title}</p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.message}</p>
                        <p className="text-[10px] text-muted-foreground/70 mt-1">
                          {new Date(n.createdAt).toLocaleString()}
                        </p>
                        {(canConfirm || canRevert) && (
                          <div className="flex items-center gap-1.5 mt-2" onClick={(e) => e.stopPropagation()}>
                            {canRevert && (
                              <button
                                onClick={() => onRevert(n)}
                                disabled={busyId === n._id}
                                className="px-2 py-0.5 text-[11px] font-medium border border-border rounded text-secondary-foreground hover:bg-muted disabled:opacity-50"
                                title={`Revert to ${n.previousStage}`}
                              >
                                Revert
                              </button>
                            )}
                            {canConfirm && (
                              <button
                                onClick={() => onConfirm(n)}
                                disabled={busyId === n._id}
                                className="px-2 py-0.5 text-[11px] font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                              >
                                Confirm
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

          {items.length > 0 && (
            <div className="px-4 py-2 border-t border-border text-center">
              <button
                onClick={() => { setOpen(false); navigate("/notifications"); }}
                className="text-[11px] text-primary hover:underline"
              >
                See all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
