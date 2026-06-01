import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Mail } from "lucide-react";
import toast from "react-hot-toast";
import { adminAPI } from "../../utils/api";
import ConfirmModal from "../../components/ConfirmModal/ConfirmModal";
import { useConfirm } from "../../hooks/useConfirm";
import type { AdminMailboxUser, AdminMailboxStats, Pagination, MailboxProvider } from "../../types";

const fmt = (d: string | null) => d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "Never";

type ProviderTab = MailboxProvider | "all";

const TABS: { value: ProviderTab; label: string }[] = [
  { value: "all", label: "All providers" },
  { value: "gmail", label: "Gmail" },
  { value: "outlook", label: "Outlook" },
];

export default function MailboxManagement() {
  const [users, setUsers] = useState<AdminMailboxUser[]>([]);
  const [stats, setStats] = useState<AdminMailboxStats | null>(null);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, pages: 0 });
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<ProviderTab>("all");
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm();

  const fetchData = useCallback(async (page: number, searchVal: string, providerTab: ProviderTab) => {
    setLoading(true);
    try {
      const [usersRes, statsRes] = await Promise.all([
        adminAPI.getMailboxUsers({ page, limit: 20, search: searchVal || undefined, provider: providerTab }),
        adminAPI.getMailboxStats(),
      ]);
      setUsers(usersRes.data);
      setPagination(usersRes.pagination);
      setStats(statsRes);
    } catch {
      toast.error("Failed to load mailbox data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(1, search, tab); }, [fetchData, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (val: string) => {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchData(1, val, tab), 300);
  };

  const handleScan = async (userId: string, provider: MailboxProvider) => {
    const key = `${userId}:${provider}:scan`;
    setBusyKey(key);
    try {
      const res = await adminAPI.triggerMailboxScan(userId, provider);
      toast.success(res.message);
      fetchData(pagination.page, search, tab);
    } catch {
      toast.error("Scan failed");
    } finally {
      setBusyKey(null);
    }
  };

  const handleDisconnect = async (user: AdminMailboxUser, provider: MailboxProvider) => {
    const providerLabel = provider === "gmail" ? "Gmail" : "Outlook";
    const targetEmail = provider === "gmail" ? user.gmailEmail : user.outlookEmail;
    const ok = await confirm(`Disconnect ${providerLabel} for ${user.name} (${targetEmail})?`, {
      title: `Disconnect ${providerLabel}`,
      confirmLabel: "Disconnect",
      danger: true,
    });
    if (!ok) return;
    const key = `${user._id}:${provider}:disconnect`;
    setBusyKey(key);
    try {
      await adminAPI.disconnectMailbox(user._id, provider);
      toast.success(`${providerLabel} disconnected`);
      fetchData(pagination.page, search, tab);
    } catch {
      toast.error("Failed to disconnect");
    } finally {
      setBusyKey(null);
    }
  };

  const statCards = useMemo(() => {
    if (!stats) return [];
    return [
      { label: "Total connected", value: stats.providers.anyConnected, hint: `${stats.providers.bothConnected} with both` },
      { label: "Gmail", value: stats.providers.gmailConnected, hint: "Google Workspace + personal" },
      { label: "Outlook", value: stats.providers.outlookConnected, hint: "Microsoft Graph" },
      { label: "Signals today", value: stats.signalsToday, hint: "Auto-classified emails", accent: "text-emerald-600 dark:text-emerald-400" },
    ];
  }, [stats]);

  const signalCards = useMemo(() => {
    if (!stats) return [];
    return [
      { label: "Interviews", value: stats.signals.interviews, color: "from-blue-500/15 to-blue-500/0", text: "text-blue-600 dark:text-blue-400" },
      { label: "Offers", value: stats.signals.offers, color: "from-emerald-500/15 to-emerald-500/0", text: "text-emerald-600 dark:text-emerald-400" },
      { label: "Follow-ups", value: stats.signals.followUps, color: "from-amber-500/15 to-amber-500/0", text: "text-amber-600 dark:text-amber-400" },
      { label: "Rejections", value: stats.signals.rejections, color: "from-red-500/15 to-red-500/0", text: "text-red-600 dark:text-red-400" },
    ];
  }, [stats]);

  return (
    <div className="fade-up">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Mailbox Management</h1>
        <p className="text-sm text-muted-foreground mt-1">Gmail and Outlook connections with email-signal triage.</p>
      </div>

      {/* Provider stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {statCards.map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.accent ?? "text-foreground"}`}>{s.value}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{s.hint}</p>
          </div>
        ))}
      </div>

      {/* Signal breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {signalCards.map((c) => (
          <div key={c.label} className={`relative overflow-hidden bg-card border border-border rounded-xl p-4`}>
            <div className={`absolute inset-0 bg-gradient-to-br ${c.color} pointer-events-none`} />
            <div className="relative">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{c.label}</p>
              <p className={`text-2xl font-bold mt-1 ${c.text}`}>{c.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs + search */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="inline-flex bg-muted rounded-lg p-1">
          {TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${tab === t.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <input
          className="input-premium w-full max-w-xs"
          placeholder="Search by name or mailbox email..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                {["User", "Gmail", "Outlook", "Last activity", "Actions"].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">No mailbox-connected users found</td></tr>
              ) : users.map((u) => {
                const lastActivity = [u.gmailLastSyncAt, u.outlookLastSyncAt].filter(Boolean).sort().reverse()[0] ?? null;
                return (
                <tr key={u._id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 text-sm">
                    <div className="font-medium text-foreground">{u.name}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {u.gmailConnected ? (
                      <div className="space-y-1">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium rounded-full bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                          <Mail width={10} height={10} strokeWidth={2} />
                          Connected
                        </span>
                        <div className="text-xs text-secondary-foreground">{u.gmailEmail || "—"}</div>
                        <div className="text-[11px] text-muted-foreground">Synced {fmt(u.gmailLastSyncAt)}</div>
                      </div>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {u.outlookConnected ? (
                      <div className="space-y-1">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                          <Mail width={10} height={10} strokeWidth={2} />
                          Connected
                        </span>
                        <div className="text-xs text-secondary-foreground">{u.outlookEmail || "—"}</div>
                        <div className="text-[11px] text-muted-foreground">Synced {fmt(u.outlookLastSyncAt)}</div>
                      </div>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmt(lastActivity)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {(["gmail", "outlook"] as const).map((p) => {
                        const connected = p === "gmail" ? u.gmailConnected : u.outlookConnected;
                        if (!connected) return null;
                        const scanKey = `${u._id}:${p}:scan`;
                        const discKey = `${u._id}:${p}:disconnect`;
                        return (
                          <div key={p} className="flex gap-1.5">
                            <button
                              disabled={busyKey === scanKey}
                              onClick={() => handleScan(u._id, p)}
                              className="px-2.5 py-1 text-[11px] font-medium rounded-md border border-primary/40 text-primary hover:bg-primary/10 disabled:opacity-50"
                              title={`Scan ${p === "gmail" ? "Gmail" : "Outlook"}`}
                            >
                              {busyKey === scanKey ? "Scanning…" : `Scan ${p === "gmail" ? "Gmail" : "Outlook"}`}
                            </button>
                            <button
                              disabled={busyKey === discKey}
                              onClick={() => handleDisconnect(u, p)}
                              className="px-2.5 py-1 text-[11px] font-medium rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10 disabled:opacity-50"
                              title={`Disconnect ${p === "gmail" ? "Gmail" : "Outlook"}`}
                            >
                              Disconnect
                            </button>
                          </div>
                        );
                      })}
                    </div>
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
              <button disabled={pagination.page <= 1} onClick={() => fetchData(pagination.page - 1, search, tab)} className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-30 hover:bg-muted text-secondary-foreground">Prev</button>
              <button disabled={pagination.page >= pagination.pages} onClick={() => fetchData(pagination.page + 1, search, tab)} className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-30 hover:bg-muted text-secondary-foreground">Next</button>
            </div>
          </div>
        )}
      </div>

      {confirmState.open && <ConfirmModal title={confirmState.title} message={confirmState.message} confirmLabel={confirmState.confirmLabel} danger={confirmState.danger} onConfirm={handleConfirm} onCancel={handleCancel} />}
    </div>
  );
}
