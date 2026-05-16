import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import toast from "react-hot-toast";
import { adminAPI } from "../../utils/api";
import ConfirmModal from "../../components/ConfirmModal/ConfirmModal";
import { useConfirm } from "../../hooks/useConfirm";
import type { AdminNotificationItem, AdminNotificationStats, Pagination, NotificationSignalType } from "../../types";

const TYPE_META: Record<NotificationSignalType, { label: string; cls: string; dot: string }> = {
  rejection_detected: { label: "Rejection", cls: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20", dot: "bg-red-500" },
  interview_detected: { label: "Interview", cls: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20", dot: "bg-blue-500" },
  offer_detected: { label: "Offer", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20", dot: "bg-emerald-500" },
  follow_up_detected: { label: "Follow-up", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20", dot: "bg-amber-500" },
  info: { label: "Info", cls: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20", dot: "bg-slate-500" },
};

const SOURCE_META: Record<string, { label: string; cls: string }> = {
  gmail: { label: "Gmail", cls: "bg-red-500/10 text-red-700 dark:text-red-300" },
  outlook: { label: "Outlook", cls: "bg-blue-500/10 text-blue-700 dark:text-blue-300" },
};

const fmt = (d: string) => new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function getUserName(userId: AdminNotificationItem["userId"]): string {
  if (typeof userId === "object" && userId !== null) return userId.name;
  return "Unknown";
}

export default function NotificationCenter() {
  const [notifications, setNotifications] = useState<AdminNotificationItem[]>([]);
  const [stats, setStats] = useState<AdminNotificationStats | null>(null);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, pages: 0 });
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [readFilter, setReadFilter] = useState("");
  const [resolvedFilter, setResolvedFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm();

  const fetchData = useCallback(async (page: number, searchVal: string, type: string, source: string, read: string, resolved: string) => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit: 20 };
      if (searchVal) params.search = searchVal;
      if (type) params.type = type;
      if (source) params.source = source;
      if (read) params.read = read;
      if (resolved) params.resolved = resolved;
      const [notifRes, statsRes] = await Promise.all([
        adminAPI.getAdminNotifications(params as Parameters<typeof adminAPI.getAdminNotifications>[0]),
        adminAPI.getAdminNotificationStats(),
      ]);
      setNotifications(notifRes.data);
      setPagination(notifRes.pagination);
      setStats(statsRes);
    } catch {
      toast.error("Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(1, "", "", "", "", ""); }, [fetchData]);

  const refetch = (overrides: Partial<{ page: number; searchVal: string; type: string; source: string; read: string; resolved: string }> = {}) => {
    fetchData(
      overrides.page ?? 1,
      overrides.searchVal ?? search,
      overrides.type ?? typeFilter,
      overrides.source ?? sourceFilter,
      overrides.read ?? readFilter,
      overrides.resolved ?? resolvedFilter,
    );
  };

  const handleSearch = (val: string) => {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => refetch({ searchVal: val }), 300);
  };

  const handleDelete = async (n: AdminNotificationItem) => {
    const ok = await confirm(`Delete notification "${n.title}"?`, {
      title: "Delete Notification",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await adminAPI.deleteAdminNotification(n._id);
      toast.success("Notification deleted");
      refetch({ page: pagination.page });
    } catch {
      toast.error("Failed to delete");
    }
  };

  const signalStats = useMemo(() => {
    const byType = stats?.byType ?? [];
    const lookup = Object.fromEntries(byType.map((b) => [b._id, b.count]));
    return {
      interviews: lookup.interview_detected || 0,
      offers: lookup.offer_detected || 0,
      followUps: lookup.follow_up_detected || 0,
      rejections: lookup.rejection_detected || 0,
    };
  }, [stats]);

  const sourceStats = useMemo(() => {
    const bySource = stats?.bySource ?? [];
    const lookup = Object.fromEntries(bySource.map((b) => [b._id, b.count]));
    return { gmail: lookup.gmail || 0, outlook: lookup.outlook || 0 };
  }, [stats]);

  const clearFilters = () => {
    setSearch("");
    setTypeFilter("");
    setSourceFilter("");
    setReadFilter("");
    setResolvedFilter("");
    fetchData(1, "", "", "", "", "");
  };

  const hasFilters = Boolean(search || typeFilter || sourceFilter || readFilter || resolvedFilter);

  return (
    <div className="fade-up">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Notification Center</h1>
        <p className="text-sm text-muted-foreground mt-1">Auto-classified email signals from connected mailboxes, plus manual notifications.</p>
      </div>

      {/* Stats */}
      {stats && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            {[
              { label: "Total", value: stats.total, accent: "text-foreground" },
              { label: "Unread", value: stats.unread, accent: "text-amber-600 dark:text-amber-400" },
              { label: "Open signals", value: stats.unresolvedSignals, accent: "text-primary" },
              { label: "Today", value: stats.todayCount, accent: "text-emerald-600 dark:text-emerald-400" },
            ].map((s) => (
              <div key={s.label} className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</p>
                <p className={`text-2xl font-bold mt-1 ${s.accent}`}>{s.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {([
              { key: "interview_detected", label: "Interviews", value: signalStats.interviews, color: "text-blue-600 dark:text-blue-400", grad: "from-blue-500/15 to-blue-500/0" },
              { key: "offer_detected", label: "Offers", value: signalStats.offers, color: "text-emerald-600 dark:text-emerald-400", grad: "from-emerald-500/15 to-emerald-500/0" },
              { key: "follow_up_detected", label: "Follow-ups", value: signalStats.followUps, color: "text-amber-600 dark:text-amber-400", grad: "from-amber-500/15 to-amber-500/0" },
              { key: "rejection_detected", label: "Rejections", value: signalStats.rejections, color: "text-red-600 dark:text-red-400", grad: "from-red-500/15 to-red-500/0" },
            ] as const).map((c) => (
              <button
                key={c.key}
                onClick={() => { setTypeFilter(c.key); refetch({ type: c.key }); }}
                className={`relative overflow-hidden bg-card border rounded-xl p-4 text-left transition-shadow hover:shadow-sm ${typeFilter === c.key ? "border-primary/50 ring-1 ring-primary/30" : "border-border"}`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${c.grad} pointer-events-none`} />
                <div className="relative">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">{c.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${c.color}`}>{c.value}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Click to filter</p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          className="input-premium w-full max-w-[280px]"
          placeholder="Search title or message..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
        />
        <select
          className="input-premium w-auto"
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); refetch({ type: e.target.value }); }}
        >
          <option value="">All types</option>
          <option value="interview_detected">Interview</option>
          <option value="offer_detected">Offer</option>
          <option value="follow_up_detected">Follow-up</option>
          <option value="rejection_detected">Rejection</option>
          <option value="info">Info</option>
        </select>
        <select
          className="input-premium w-auto"
          value={sourceFilter}
          onChange={(e) => { setSourceFilter(e.target.value); refetch({ source: e.target.value }); }}
        >
          <option value="">All sources</option>
          <option value="gmail">Gmail ({sourceStats.gmail})</option>
          <option value="outlook">Outlook ({sourceStats.outlook})</option>
        </select>
        <select
          className="input-premium w-auto"
          value={readFilter}
          onChange={(e) => { setReadFilter(e.target.value); refetch({ read: e.target.value }); }}
        >
          <option value="">Read & unread</option>
          <option value="false">Unread only</option>
          <option value="true">Read only</option>
        </select>
        <select
          className="input-premium w-auto"
          value={resolvedFilter}
          onChange={(e) => { setResolvedFilter(e.target.value); refetch({ resolved: e.target.value }); }}
        >
          <option value="">Any state</option>
          <option value="false">Unresolved</option>
          <option value="true">Resolved</option>
        </select>
        {hasFilters && (
          <button onClick={clearFilters} className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                {["User", "Type", "Source", "Title", "Application", "State", "Date", ""].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
              ) : notifications.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">No notifications match these filters</td></tr>
              ) : notifications.map((n) => {
                const meta = TYPE_META[n.type] ?? TYPE_META.info;
                const src = n.source ? SOURCE_META[n.source] : null;
                return (
                <tr key={n._id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 text-sm">
                    <div className="font-medium text-foreground">{getUserName(n.userId)}</div>
                    {typeof n.userId === "object" && n.userId && <div className="text-xs text-muted-foreground">{n.userId.email}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium rounded-full border ${meta.cls}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                      {meta.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {src ? (
                      <span className={`inline-block px-2 py-0.5 text-[11px] font-medium rounded-full ${src.cls}`}>{src.label}</span>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground max-w-[260px]">
                    <div className="truncate">{n.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{n.message}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {n.applicationId ? (
                      <div>
                        <div className="text-foreground">{n.applicationId.company}</div>
                        <div className="text-muted-foreground">{n.applicationId.role}</div>
                        {n.previousStage && <div className="text-[10px] text-muted-foreground mt-0.5">was: {n.previousStage}</div>}
                      </div>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span className={`inline-flex items-center gap-1 text-[11px] ${n.read ? "text-muted-foreground" : "text-emerald-600 dark:text-emerald-400"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${n.read ? "bg-muted-foreground/30" : "bg-emerald-500"}`} />
                        {n.read ? "Read" : "Unread"}
                      </span>
                      {n.source && (
                        <span className={`inline-flex items-center gap-1 text-[11px] ${n.resolved ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${n.resolved ? "bg-emerald-500" : "bg-amber-500"}`} />
                          {n.resolved ? "Resolved" : "Open"}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmt(n.createdAt)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDelete(n)}
                      className="px-2.5 py-1 text-[11px] font-medium rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
        </div>

        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-sm text-muted-foreground">
              {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </span>
            <div className="flex gap-1">
              <button disabled={pagination.page <= 1} onClick={() => refetch({ page: pagination.page - 1 })} className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-30 hover:bg-muted text-secondary-foreground">Prev</button>
              <button disabled={pagination.page >= pagination.pages} onClick={() => refetch({ page: pagination.page + 1 })} className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-30 hover:bg-muted text-secondary-foreground">Next</button>
            </div>
          </div>
        )}
      </div>

      {confirmState.open && <ConfirmModal title={confirmState.title} message={confirmState.message} confirmLabel={confirmState.confirmLabel} danger={confirmState.danger} onConfirm={handleConfirm} onCancel={handleCancel} />}
    </div>
  );
}
