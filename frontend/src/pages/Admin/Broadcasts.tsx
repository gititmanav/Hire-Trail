import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, X } from "lucide-react";
import toast from "react-hot-toast";
import { adminAPI } from "../../utils/api";
import ConfirmModal from "../../components/ConfirmModal/ConfirmModal";
import { useConfirm } from "../../hooks/useConfirm";
import type {
  AdminUserDetail,
  BroadcastEmailItem,
  BroadcastRecipientType,
  MailerStatus,
  Pagination,
} from "../../types";

const fmt = (d: string | null) => d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—";

const STATUS_BADGE: Record<string, string> = {
  sending: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  completed: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  partial: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  failed: "bg-red-500/10 text-red-700 dark:text-red-300",
};

interface PrefillState {
  userIds?: string[];
  userLabels?: Record<string, string>;
}

export default function Broadcasts() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefill = location.state as PrefillState | null;

  const [mailer, setMailer] = useState<MailerStatus | null>(null);
  const [recipientType, setRecipientType] = useState<BroadcastRecipientType>(prefill?.userIds?.length ? "selected" : "all");
  const [allRecipientCount, setAllRecipientCount] = useState<number>(0);
  const [selectedUsers, setSelectedUsers] = useState<{ id: string; label: string }[]>(
    prefill?.userIds?.length ? prefill.userIds.map((id) => ({ id, label: prefill.userLabels?.[id] || id })) : []
  );
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [sending, setSending] = useState(false);

  const [history, setHistory] = useState<BroadcastEmailItem[]>([]);
  const [historyPagination, setHistoryPagination] = useState<Pagination>({ page: 1, limit: 10, total: 0, pages: 0 });
  const [historyLoading, setHistoryLoading] = useState(true);
  const [activeBroadcastId, setActiveBroadcastId] = useState<string | null>(null);
  const [activeBroadcast, setActiveBroadcast] = useState<BroadcastEmailItem | null>(null);

  const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm();

  const fetchMailer = useCallback(async () => {
    try {
      const m = await adminAPI.getBroadcastMailerStatus();
      setMailer(m);
    } catch { /* surfaced as banner */ }
  }, []);

  const fetchAllCount = useCallback(async () => {
    try {
      const res = await adminAPI.getBroadcastRecipientCount("all");
      setAllRecipientCount(res.count);
    } catch { /* ignore */ }
  }, []);

  const fetchHistory = useCallback(async (page: number) => {
    setHistoryLoading(true);
    try {
      const res = await adminAPI.listBroadcasts({ page, limit: 10 });
      setHistory(res.data);
      setHistoryPagination(res.pagination);
    } catch {
      toast.error("Failed to load broadcast history");
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => { fetchMailer(); fetchAllCount(); fetchHistory(1); }, [fetchMailer, fetchAllCount, fetchHistory]);

  // Poll the active broadcast until it completes
  useEffect(() => {
    if (!activeBroadcastId) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const b = await adminAPI.getBroadcast(activeBroadcastId);
        if (cancelled) return;
        setActiveBroadcast(b);
        if (b.status !== "sending") {
          fetchHistory(historyPagination.page);
          return;
        }
        setTimeout(tick, 1500);
      } catch { /* stop polling */ }
    };
    tick();
    return () => { cancelled = true; };
  }, [activeBroadcastId, fetchHistory, historyPagination.page]);

  // ── User picker ─────────────────────────────────────────────────────
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerResults, setPickerResults] = useState<AdminUserDetail[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const pickerDebounceRef = useRef<ReturnType<typeof setTimeout>>();

  const runPickerSearch = useCallback(async (q: string) => {
    setPickerLoading(true);
    try {
      const res = await adminAPI.getUsers({ search: q || undefined, limit: 25 });
      setPickerResults(res.data);
    } catch {
      toast.error("Failed to search users");
    } finally {
      setPickerLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!pickerOpen) return;
    if (pickerDebounceRef.current) clearTimeout(pickerDebounceRef.current);
    pickerDebounceRef.current = setTimeout(() => runPickerSearch(pickerQuery), 250);
  }, [pickerQuery, pickerOpen, runPickerSearch]);

  const toggleUser = (u: AdminUserDetail) => {
    setSelectedUsers((prev) => {
      if (prev.some((p) => p.id === u._id)) return prev.filter((p) => p.id !== u._id);
      return [...prev, { id: u._id, label: `${u.name} <${u.email}>` }];
    });
  };

  const removeSelected = (id: string) => {
    setSelectedUsers((prev) => prev.filter((p) => p.id !== id));
  };

  const handleSend = async () => {
    if (!mailer?.configured) { toast.error("Email sender is not configured yet"); return; }
    if (!subject.trim()) { toast.error("Subject is required"); return; }
    if (!bodyHtml.trim()) { toast.error("Body is required"); return; }
    if (recipientType === "selected" && selectedUsers.length === 0) { toast.error("Pick at least one user"); return; }

    const recipientCount = recipientType === "all" ? allRecipientCount : selectedUsers.length;
    const ok = await confirm(
      `This will send the email to ${recipientCount} user${recipientCount === 1 ? "" : "s"} from ${mailer.sender}. Continue?`,
      { title: "Send broadcast?", confirmLabel: `Send to ${recipientCount}`, danger: false }
    );
    if (!ok) return;

    setSending(true);
    try {
      const res = await adminAPI.sendBroadcast({
        subject,
        bodyHtml,
        recipientType,
        userIds: recipientType === "selected" ? selectedUsers.map((u) => u.id) : undefined,
      });
      toast.success(`Broadcast queued for ${res.totalRecipients} recipient${res.totalRecipients === 1 ? "" : "s"}`);
      setActiveBroadcastId(res.id);
      setActiveBroadcast({
        _id: res.id,
        subject, bodyHtml, recipientType,
        recipientUserIds: recipientType === "selected" ? selectedUsers.map((u) => u.id) : [],
        sentByUserId: "you",
        status: "sending",
        totalRecipients: res.totalRecipients,
        sentCount: 0, failedCount: 0,
        startedAt: new Date().toISOString(),
        completedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      // Clear the form
      setSubject(""); setBodyHtml(""); setSelectedUsers([]); setShowPreview(false);
      // If we were prefilled, drop the navigation state so refresh doesn't re-fill
      if (prefill) navigate(location.pathname, { replace: true, state: null });
    } catch {
      toast.error("Failed to send broadcast");
    } finally {
      setSending(false);
    }
  };

  const recipientCount = recipientType === "all" ? allRecipientCount : selectedUsers.length;

  const senderEmail = mailer?.sender || "";

  const variables = useMemo(() => ([
    { key: "{{appName}}", sample: "HireTrail" },
    { key: "{{senderEmail}}", sample: senderEmail },
  ]), [senderEmail]);

  const previewHtml = useMemo(() => {
    let html = bodyHtml;
    for (const v of variables) html = html.replace(new RegExp(v.key.replace(/[{}]/g, "\\$&"), "g"), v.sample);
    return html;
  }, [bodyHtml, variables]);

  return (
    <div className="fade-up space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Broadcasts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Send announcements, updates, and release notes to users
            {senderEmail ? <> from <span className="font-mono text-foreground">{senderEmail}</span></> : null}.
          </p>
        </div>
      </div>

      {/* Mailer status */}
      {mailer && !mailer.configured && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 flex items-start gap-3">
          <AlertCircle width={18} height={18} strokeWidth={2} className="text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-red-700 dark:text-red-300">Email sender is not configured</p>
            <p className="text-red-700/80 dark:text-red-300/80 mt-0.5">
              Set <code className="text-xs px-1 py-0.5 rounded bg-card border border-border">EMAIL_APP_PASSWORD</code>{" "}
              (and optionally <code className="text-xs px-1 py-0.5 rounded bg-card border border-border">EMAIL_SENDER</code>) in the backend env, then restart the server.
            </p>
          </div>
        </div>
      )}

      {/* Composer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-5 lg:col-span-2 space-y-4">
          <h2 className="text-base font-semibold uppercase tracking-wider text-muted-foreground">Compose</h2>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Subject</label>
            <input
              type="text"
              className="input-premium w-full"
              placeholder="e.g. New: AI Tailor is live in HireTrail"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={300}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1 flex items-center justify-between">
              <span>Body (HTML)</span>
              <span className="text-[10px] font-normal">Variables: {variables.map((v) => <code key={v.key} className="ml-1 px-1 py-0.5 rounded bg-muted">{v.key}</code>)}</span>
            </label>
            <textarea
              className="input-premium w-full font-mono text-sm"
              placeholder={"<p>Hi there!</p>\n<p>We just shipped...</p>"}
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
              rows={12}
            />
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="btn-secondary text-xs mt-2"
            >
              {showPreview ? "Hide preview" : "Show preview"}
            </button>
            {showPreview && (
              <div className="mt-3 border border-border rounded-lg overflow-hidden">
                <div className="bg-muted px-3 py-2 border-b border-border">
                  <p className="text-xs text-muted-foreground">Preview (variables substituted)</p>
                </div>
                <div className="p-4 bg-background prose dark:prose-invert max-w-none text-sm" dangerouslySetInnerHTML={{ __html: previewHtml }} />
              </div>
            )}
          </div>
        </div>

        {/* Recipients sidebar */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4 h-fit">
          <h2 className="text-base font-semibold uppercase tracking-wider text-muted-foreground">Recipients</h2>

          <div className="inline-flex bg-muted rounded-lg p-1 w-full">
            {(["all", "selected"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setRecipientType(t)}
                className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${recipientType === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {t === "all" ? "All users" : "Selected"}
              </button>
            ))}
          </div>

          {recipientType === "all" ? (
            <div className="rounded-lg border border-border bg-muted/40 p-4 text-center">
              <p className="text-3xl font-bold text-foreground">{allRecipientCount.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">active users will receive this email</p>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => { setPickerOpen(true); setPickerQuery(""); runPickerSearch(""); }}
                className="btn-secondary text-xs w-full"
              >
                + Pick users
              </button>
              {selectedUsers.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">No users selected yet</p>
              ) : (
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {selectedUsers.map((u) => (
                    <div key={u.id} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md bg-muted/50 text-xs">
                      <span className="truncate">{u.label}</span>
                      <button onClick={() => removeSelected(u.id)} className="text-muted-foreground hover:text-destructive shrink-0" aria-label="Remove">
                        <X width={12} height={12} strokeWidth={2.5} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground text-center pt-2 border-t border-border">
                {selectedUsers.length} selected
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !mailer?.configured}
            className="btn-accent w-full inline-flex items-center justify-center gap-2"
          >
            {sending ? "Queueing..." : `Send to ${recipientCount}`}
          </button>
        </div>
      </div>

      {/* Active broadcast progress */}
      {activeBroadcast && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Sending: {activeBroadcast.subject}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {activeBroadcast.sentCount} sent · {activeBroadcast.failedCount} failed · {activeBroadcast.totalRecipients} total
              </p>
            </div>
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[activeBroadcast.status]}`}>{activeBroadcast.status}</span>
          </div>
          <div className="w-full h-2 bg-border rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${activeBroadcast.status === "failed" ? "bg-red-500" : "bg-primary"}`}
              style={{ width: `${activeBroadcast.totalRecipients > 0 ? ((activeBroadcast.sentCount + activeBroadcast.failedCount) / activeBroadcast.totalRecipients) * 100 : 0}%` }}
            />
          </div>
          {activeBroadcast.status !== "sending" && (
            <button onClick={() => { setActiveBroadcast(null); setActiveBroadcastId(null); }} className="text-xs text-muted-foreground hover:text-foreground mt-3">Dismiss</button>
          )}
        </div>
      )}

      {/* History */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold uppercase tracking-wider text-muted-foreground">History</h2>
            <p className="text-xs text-muted-foreground mt-0.5">All broadcasts sent from the admin panel.</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground border-b border-border bg-muted/40">
              <tr>
                <th className="px-4 py-3 text-left">Sent</th>
                <th className="px-4 py-3 text-left">Subject</th>
                <th className="px-4 py-3 text-left">Recipients</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {historyLoading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
              ) : history.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">No broadcasts yet.</td></tr>
              ) : history.map((b) => {
                const sentBy = typeof b.sentByUserId === "object" ? b.sentByUserId : null;
                return (
                  <tr key={b._id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmt(b.startedAt)}</td>
                    <td className="px-4 py-3 text-sm text-foreground max-w-[300px]">
                      <div className="truncate">{b.subject}</div>
                      <div className="text-[11px] text-muted-foreground">{b.recipientType === "all" ? "All users" : `${b.recipientUserIds.length} selected`}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="text-foreground">{b.sentCount} / {b.totalRecipients}</div>
                      {b.failedCount > 0 && <div className="text-[11px] text-red-600 dark:text-red-400">{b.failedCount} failed</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[b.status]}`}>{b.status}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{sentBy?.name || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {historyPagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-sm text-muted-foreground">
              {(historyPagination.page - 1) * historyPagination.limit + 1}–{Math.min(historyPagination.page * historyPagination.limit, historyPagination.total)} of {historyPagination.total}
            </span>
            <div className="flex gap-1">
              <button disabled={historyPagination.page <= 1} onClick={() => fetchHistory(historyPagination.page - 1)} className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-30 hover:bg-muted text-secondary-foreground">Prev</button>
              <button disabled={historyPagination.page >= historyPagination.pages} onClick={() => fetchHistory(historyPagination.page + 1)} className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-30 hover:bg-muted text-secondary-foreground">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* User picker modal */}
      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setPickerOpen(false)}>
          <div className="bg-card border border-border rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Pick users</h3>
              <button onClick={() => setPickerOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X width={18} height={18} strokeWidth={2} />
              </button>
            </div>
            <div className="p-4 border-b border-border">
              <input
                autoFocus
                type="text"
                className="input-premium w-full"
                placeholder="Search by name or email..."
                value={pickerQuery}
                onChange={(e) => setPickerQuery(e.target.value)}
              />
            </div>
            <div className="flex-1 overflow-y-auto">
              {pickerLoading ? (
                <p className="text-sm text-muted-foreground text-center py-8">Searching...</p>
              ) : pickerResults.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No users found</p>
              ) : (
                <ul className="divide-y divide-border">
                  {pickerResults.map((u) => {
                    const checked = selectedUsers.some((p) => p.id === u._id);
                    return (
                      <li key={u._id}>
                        <label className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 cursor-pointer">
                          <input type="checkbox" checked={checked} onChange={() => toggleUser(u)} className="rounded border-border" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-foreground truncate">{u.name}</div>
                            <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                          </div>
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{u.role}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="px-5 py-3 border-t border-border flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{selectedUsers.length} selected</p>
              <button onClick={() => setPickerOpen(false)} className="btn-accent text-sm">Done</button>
            </div>
          </div>
        </div>
      )}

      {confirmState.open && <ConfirmModal title={confirmState.title} message={confirmState.message} confirmLabel={confirmState.confirmLabel} danger={confirmState.danger} onConfirm={handleConfirm} onCancel={handleCancel} />}
    </div>
  );
}
