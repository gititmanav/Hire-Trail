/** Header bell — unread badge + popover list. Polls every 60s; refetches on open. */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { notificationsAPI } from "../../utils/api.ts";
import type { Notification, NotificationType } from "../../types";

const TYPE_LABEL: Record<string, { label: string; tone: string }> = {
  interview_detected: { label: "Interview", tone: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200" },
  offer_detected: { label: "Offer", tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" },
  rejection_detected: { label: "Rejection", tone: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200" },
  follow_up_detected: { label: "Follow-up", tone: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" },
};

const SUGGESTION_TYPES: NotificationType[] = [
  "interview_detected",
  "offer_detected",
  "rejection_detected",
  "follow_up_detected",
];

const POLL_MS = 60_000;
const MAX_DISPLAY = 8;

export default function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<Notification[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const refreshCount = useCallback(async () => {
    try {
      const { count } = await notificationsAPI.getUnreadCount();
      setUnread(count);
    } catch {
      /* silent — bell is non-critical */
    }
  }, []);

  // Initial fetch + interval poll
  useEffect(() => {
    void refreshCount();
    const id = setInterval(refreshCount, POLL_MS);
    return () => clearInterval(id);
  }, [refreshCount]);

  const fetchList = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await notificationsAPI.getAll({ limit: 20 });
      setItems(res.data);
    } catch {
      setItems([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  // Refetch list each time the popover opens
  useEffect(() => {
    if (open) void fetchList();
  }, [open, fetchList]);

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

  const onConfirm = async (n: Notification) => {
    setBusyId(n._id);
    try {
      await notificationsAPI.confirm(n._id);
      setItems((prev) => prev.map((x) => x._id === n._id ? { ...x, resolved: true, read: true } : x));
      if (!n.read) setUnread((c) => Math.max(0, c - 1));
      toast.success("Confirmed");
    } catch { toast.error("Could not confirm"); }
    finally { setBusyId(null); }
  };

  const onRevert = async (n: Notification) => {
    setBusyId(n._id);
    try {
      await notificationsAPI.revert(n._id);
      setItems((prev) => prev.map((x) => x._id === n._id ? { ...x, resolved: true, read: true } : x));
      if (!n.read) setUnread((c) => Math.max(0, c - 1));
      toast.success(`Reverted to ${n.previousStage}`);
    } catch { toast.error("Could not revert"); }
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
    if (n.applicationId) navigate(`/applications?focus=${n.applicationId}`);
    else navigate("/");
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-secondary-foreground"
        title="Notifications"
        aria-label={unread > 0 ? `${unread} unread notifications` : "Notifications"}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
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
            <p className="text-sm font-semibold text-foreground">Notifications</p>
            {unread > 0 && (
              <button onClick={onMarkAllRead} className="text-[11px] text-muted-foreground hover:text-foreground">
                Mark all as read
              </button>
            )}
          </div>

          {loadingList ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : items.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              <p>You're all caught up.</p>
              <p className="text-[11px] mt-1">Connected-mailbox detections show up here.</p>
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
                    className={`px-4 py-3 hover:bg-muted/40 cursor-pointer ${!n.read ? "bg-primary/5" : ""}`}
                    onClick={() => onOpenItem(n)}
                  >
                    <div className="flex items-start gap-2.5">
                      {!n.read && <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" aria-hidden />}
                      <div className="min-w-0 flex-1">
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

          {items.length > MAX_DISPLAY && (
            <div className="px-4 py-2 border-t border-border text-center">
              <button
                onClick={() => { setOpen(false); navigate("/"); }}
                className="text-[11px] text-primary hover:underline"
              >
                See all on Dashboard
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
