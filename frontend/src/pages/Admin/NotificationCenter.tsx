import { useState, useEffect, useCallback, useRef } from "react";
import toast from "react-hot-toast";
import { adminAPI } from "../../utils/api";
import ConfirmModal from "../../components/ConfirmModal/ConfirmModal";
import { useConfirm } from "../../hooks/useConfirm";
import type { AdminNotificationItem, AdminNotificationStats, Pagination } from "../../types";

const typeBadge: Record<string, string> = {
  rejection_detected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
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
  const [readFilter, setReadFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm();

  const fetchData = useCallback(async (page: number, searchVal: string, type: string, read: string) => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit: 20 };
      if (searchVal) params.search = searchVal;
      if (type) params.type = type;
      if (read) params.read = read;
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

  useEffect(() => { fetchData(1, "", "", ""); }, [fetchData]);

  const handleSearch = (val: string) => {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchData(1, val, typeFilter, readFilter), 300);
  };

  const handleTypeFilter = (val: string) => {
    setTypeFilter(val);
    fetchData(1, search, val, readFilter);
  };

  const handleReadFilter = (val: string) => {
    setReadFilter(val);
    fetchData(1, search, typeFilter, val);
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
      fetchData(pagination.page, search, typeFilter, readFilter);
    } catch {
      toast.error("Failed to delete");
    }
  };

  const rejectionCount = stats?.byType.find((b) => b._id === "rejection_detected")?.count || 0;

  return (
    <div className="fade-up">
      <h1 className="text-2xl font-bold text-foreground tracking-tight mb-6">Notification Center</h1>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total", value: stats.total, color: "text-foreground" },
            { label: "Unread", value: stats.unread, color: "text-amber-600 dark:text-amber-400" },
            { label: "Rejections", value: rejectionCount, color: "text-red-600 dark:text-red-400" },
            { label: "Last 30 Days", value: stats.last30Days, color: "text-primary" },
          ].map((s) => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-4">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          className="input-premium w-full max-w-[280px]"
          placeholder="Search title or message..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
        />
        <select
          className="input-premium w-auto"
          value={typeFilter}
          onChange={(e) => handleTypeFilter(e.target.value)}
        >
          <option value="">All Types</option>
          <option value="rejection_detected">Rejection</option>
          <option value="info">Info</option>
        </select>
        <select
          className="input-premium w-auto"
          value={readFilter}
          onChange={(e) => handleReadFilter(e.target.value)}
        >
          <option value="">All Status</option>
          <option value="false">Unread</option>
          <option value="true">Read</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {["User", "Type", "Title", "Message", "Read", "Date", "Actions"].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
              ) : notifications.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No notifications found</td></tr>
              ) : notifications.map((n) => (
                <tr key={n._id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-foreground">{getUserName(n.userId)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 text-[11px] font-medium rounded-full ${typeBadge[n.type] || ""}`}>
                      {n.type === "rejection_detected" ? "Rejection" : "Info"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground max-w-[200px] truncate">{n.title}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground max-w-[250px] truncate">{n.message}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block w-2 h-2 rounded-full ${n.read ? "bg-muted-foreground/30" : "bg-emerald-500"}`} title={n.read ? "Read" : "Unread"} />
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{fmt(n.createdAt)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDelete(n)}
                      className="px-3 py-1 text-xs font-medium rounded-lg border border-destructive text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-sm text-muted-foreground">
              {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </span>
            <div className="flex gap-1">
              <button disabled={pagination.page <= 1} onClick={() => fetchData(pagination.page - 1, search, typeFilter, readFilter)} className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-30 hover:bg-muted text-secondary-foreground">Prev</button>
              <button disabled={pagination.page >= pagination.pages} onClick={() => fetchData(pagination.page + 1, search, typeFilter, readFilter)} className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-30 hover:bg-muted text-secondary-foreground">Next</button>
            </div>
          </div>
        )}
      </div>

      {confirmState.open && <ConfirmModal title={confirmState.title} message={confirmState.message} confirmLabel={confirmState.confirmLabel} danger={confirmState.danger} onConfirm={handleConfirm} onCancel={handleCancel} />}
    </div>
  );
}
