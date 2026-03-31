import { useState, useEffect, useCallback } from "react";
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

  const getStatus = (invite: Invite): { label: string; className: string } => {
    if (!invite.active) return { label: "Inactive", className: "bg-muted text-foreground" };
    if (new Date(invite.expiresAt) < new Date()) return { label: "Expired", className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300" };
    if (invite.usedCount >= invite.maxUses) return { label: "Maxed", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300" };
    return { label: "Active", className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" };
  };

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
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold text-foreground">Invite System</h1>

      {/* Generate Invite Form */}
      <div className="card-premium p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Generate Invite Code</h2>
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
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
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
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.className}`}>
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
