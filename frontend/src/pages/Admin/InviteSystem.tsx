import { useState, useEffect, useCallback, useMemo } from "react";
import { Copy } from "lucide-react";
import toast from "react-hot-toast";
import { adminAPI } from "../../utils/api";
import ConfirmModal from "../../components/ConfirmModal/ConfirmModal";
import { useConfirm } from "../../hooks/useConfirm";
import type { Invite } from "../../types";

export default function InviteSystem() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm();

  const [email, setEmail] = useState("");
  const [maxUses, setMaxUses] = useState(1);
  const [expiresAt, setExpiresAt] = useState("");

  const fetchInvites = useCallback(() => {
    adminAPI
      .getInvites({ limit: 100 })
      .then((res) => setInvites(res.data))
      .catch(() => toast.error("Failed to load invites"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchInvites();
  }, [fetchInvites]);

  const handleGenerate = async () => {
    if (!expiresAt) {
      toast.error("Expiration date is required");
      return;
    }
    setGenerating(true);
    try {
      const data: { email?: string; maxUses?: number; expiresAt: string } = {
        expiresAt: new Date(expiresAt).toISOString(),
      };
      if (email.trim()) data.email = email.trim();
      if (maxUses > 0) data.maxUses = maxUses;
      await adminAPI.createInvite(data);
      toast.success("Invite code generated");
      setEmail("");
      setMaxUses(1);
      setExpiresAt("");
      fetchInvites();
    } catch {
      toast.error("Failed to generate invite");
    } finally {
      setGenerating(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    const ok = await confirm("Are you sure you want to deactivate this invite code?", {
      title: "Deactivate Invite",
      confirmLabel: "Deactivate",
    });
    if (!ok) return;
    try {
      await adminAPI.deleteInvite(id);
      toast.success("Invite deactivated");
      fetchInvites();
    } catch {
      toast.error("Failed to deactivate invite");
    }
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code).then(
      () => toast.success("Code copied to clipboard"),
      () => toast.error("Failed to copy")
    );
  };

  const getStatus = (invite: Invite): { label: string; className: string; dot: string } => {
    if (!invite.active) return { label: "Inactive", className: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/40" };
    if (new Date(invite.expiresAt) < new Date()) return { label: "Expired", className: "bg-red-500/10 text-red-700 dark:text-red-300", dot: "bg-red-500" };
    if (invite.usedCount >= invite.maxUses) return { label: "Maxed", className: "bg-amber-500/10 text-amber-700 dark:text-amber-300", dot: "bg-amber-500" };
    return { label: "Active", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" };
  };

  const stats = useMemo(() => {
    let active = 0, expired = 0, maxed = 0, inactive = 0, totalUses = 0;
    for (const i of invites) {
      totalUses += i.usedCount;
      if (!i.active) inactive++;
      else if (new Date(i.expiresAt) < new Date()) expired++;
      else if (i.usedCount >= i.maxUses) maxed++;
      else active++;
    }
    return { total: invites.length, active, expired, maxed, inactive, totalUses };
  }, [invites]);

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card-premium animate-pulse h-32 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="fade-up space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Invite System</h1>
        <p className="text-sm text-muted-foreground mt-1">Generate single-use or multi-use invite codes for restricted signup.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total codes", value: stats.total, accent: "text-foreground" },
          { label: "Active", value: stats.active, accent: "text-emerald-600 dark:text-emerald-400" },
          { label: "Maxed", value: stats.maxed, accent: "text-amber-600 dark:text-amber-400" },
          { label: "Expired", value: stats.expired, accent: "text-red-600 dark:text-red-400" },
          { label: "Redemptions", value: stats.totalUses, accent: "text-primary" },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.accent}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Generate Invite Form */}
      <div className="card-premium p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Generate invite code</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Email Restriction (optional)
            </label>
            <input
              type="email"
              className="input-premium w-full"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Max Uses
            </label>
            <input
              type="number"
              className="input-premium w-full"
              min={1}
              value={maxUses}
              onChange={(e) => setMaxUses(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Expires At
            </label>
            <input
              type="datetime-local"
              className="input-premium w-full"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>
        </div>
        <button
          className="btn-accent mt-4"
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating ? "Generating..." : "Generate Invite Code"}
        </button>
      </div>

      {/* Invites Table */}
      <div className="card-premium p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Invite Codes ({invites.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase text-muted-foreground border-b border-border">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Email Restriction</th>
                <th className="px-4 py-3">Uses</th>
                <th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invites.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                    No invite codes yet.
                  </td>
                </tr>
              )}
              {invites.map((invite) => {
                const status = getStatus(invite);
                return (
                  <tr key={invite._id} className="hover:bg-muted">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                          {invite.code}
                        </code>
                        <button
                          onClick={() => handleCopy(invite.code)}
                          className="text-muted-foreground hover:text-secondary-foreground"
                          title="Copy code"
                        >
                          <Copy className="h-4 w-4" strokeWidth={2} />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {invite.email || <span className="text-muted-foreground italic">None</span>}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {invite.usedCount} / {invite.maxUses}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {new Date(invite.expiresAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full ${status.className}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {invite.active && (
                        <button
                          onClick={() => handleDeactivate(invite._id)}
                          className="text-xs text-red-600 dark:text-red-400 hover:underline"
                        >
                          Deactivate
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {confirmState.open && (
        <ConfirmModal
          title={confirmState.title}
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel}
          danger={confirmState.danger}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}
