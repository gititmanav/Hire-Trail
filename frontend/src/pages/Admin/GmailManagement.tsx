import { useState, useEffect, useCallback, useRef } from "react";
import toast from "react-hot-toast";
import { adminAPI } from "../../utils/api";
import ConfirmModal from "../../components/ConfirmModal/ConfirmModal";
import { useConfirm } from "../../hooks/useConfirm";
import type { AdminGmailUser, AdminGmailStats, Pagination } from "../../types";

const fmt = (d: string | null) => d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "Never";

export default function GmailManagement() {
  const [users, setUsers] = useState<AdminGmailUser[]>([]);
  const [stats, setStats] = useState<AdminGmailStats | null>(null);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, pages: 0 });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm();

  const fetchData = useCallback(async (page: number, searchVal: string) => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit: 20 };
      if (searchVal) params.search = searchVal;
      const [usersRes, statsRes] = await Promise.all([
        adminAPI.getGmailUsers(params as Parameters<typeof adminAPI.getGmailUsers>[0]),
        adminAPI.getGmailStats(),
      ]);
      setUsers(usersRes.data);
      setPagination(usersRes.pagination);
      setStats(statsRes);
    } catch {
      toast.error("Failed to load Gmail data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(1, ""); }, [fetchData]);

  const handleSearch = (val: string) => {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchData(1, val), 300);
  };

  const handleScan = async (userId: string) => {
    setScanning(userId);
    try {
      const res = await adminAPI.triggerGmailScan(userId);
      toast.success(res.message);
      fetchData(pagination.page, search);
    } catch {
      toast.error("Scan failed");
    } finally {
      setScanning(null);
    }
  };

  const handleDisconnect = async (user: AdminGmailUser) => {
    const ok = await confirm(`Disconnect Gmail for ${user.name} (${user.gmailEmail})?`, {
      title: "Disconnect Gmail",
      confirmLabel: "Disconnect",
      danger: true,
    });
    if (!ok) return;
    try {
      await adminAPI.disconnectUserGmail(user._id);
      toast.success("Gmail disconnected");
      fetchData(pagination.page, search);
    } catch {
      toast.error("Failed to disconnect");
    }
  };

  return (
    <div className="fade-up">
      <h1 className="text-2xl font-bold text-foreground tracking-tight mb-6">Gmail Integration</h1>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {[
            { label: "Connected Users", value: stats.gmailConnectedCount, color: "text-primary" },
            { label: "Rejections Detected", value: stats.totalRejectionsDetected, color: "text-red-600 dark:text-red-400" },
            { label: "Detections Today", value: stats.totalScansToday, color: "text-emerald-600 dark:text-emerald-400" },
          ].map((s) => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-4">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="mb-4">
        <input
          className="input-premium w-full max-w-md"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {["Name", "Email", "Gmail Email", "Last Sync", "Actions"].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No Gmail-connected users found</td></tr>
              ) : users.map((u) => (
                <tr key={u._id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-foreground">{u.name}</td>
                  <td className="px-4 py-3 text-sm text-secondary-foreground">{u.email}</td>
                  <td className="px-4 py-3 text-sm text-secondary-foreground">{u.gmailEmail || "—"}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{fmt(u.gmailLastSyncAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        disabled={scanning === u._id}
                        onClick={() => handleScan(u._id)}
                        className="px-3 py-1 text-xs font-medium rounded-lg border border-primary text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                      >
                        {scanning === u._id ? "Scanning..." : "Scan"}
                      </button>
                      <button
                        onClick={() => handleDisconnect(u)}
                        className="px-3 py-1 text-xs font-medium rounded-lg border border-destructive text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        Disconnect
                      </button>
                    </div>
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
              <button disabled={pagination.page <= 1} onClick={() => fetchData(pagination.page - 1, search)} className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-30 hover:bg-muted text-secondary-foreground">Prev</button>
              <button disabled={pagination.page >= pagination.pages} onClick={() => fetchData(pagination.page + 1, search)} className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-30 hover:bg-muted text-secondary-foreground">Next</button>
            </div>
          </div>
        )}
      </div>

      {confirmState.open && <ConfirmModal title={confirmState.title} message={confirmState.message} confirmLabel={confirmState.confirmLabel} danger={confirmState.danger} onConfirm={handleConfirm} onCancel={handleCancel} />}
    </div>
  );
}
