/** Settings → Profile: identity, password, and account deletion. */
import { useContext, useMemo, useState, FormEvent } from "react";
import toast from "react-hot-toast";
import { api, authAPI } from "../../../utils/api.ts";
import type { User } from "../../../types";
import { UserContext } from "../../../App.tsx";
import { useDemoGate } from "../../../hooks/useDemoGate.tsx";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "../../../components/ui/Modal.tsx";
import { TextField } from "../../../components/ui/Field.tsx";
import Button from "../../../components/ui/Button.tsx";
import { SettingsCard, SettingsHeader, SettingsRow, SettingsSection, inputCls } from "../ui.tsx";

const fieldCls = `${inputCls} sm:w-80`;

function DeleteAccountModal({ email, onClose }: { email: string; onClose: () => void }) {
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (confirm !== "DELETE") return;
    setSubmitting(true);
    try {
      await authAPI.deleteAccount(confirm);
      toast.success("Account deleted.");
      // Full reload so AuthContext and any in-memory state reset cleanly.
      window.location.href = "/";
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e.response?.data?.error || "Account deletion failed");
      setSubmitting(false);
    }
  };

  const canSubmit = confirm === "DELETE" && !submitting;

  return (
    <Modal onClose={() => !submitting && onClose()} size="sm" ariaLabel="Delete account">
      <ModalHeader title="Delete account" description={email} onClose={submitting ? undefined : onClose} />
      <form className="flex flex-col min-h-0" onSubmit={handleSubmit}>
        <ModalBody className="space-y-4">
          <div className="rounded-lg border border-red-300 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 p-3">
            <p className="text-sm text-red-900 dark:text-red-200 font-medium">This is permanent.</p>
            <ul className="text-xs text-red-900/85 dark:text-red-200/85 mt-1.5 space-y-0.5 list-disc pl-4">
              <li>All applications, contacts, resumes, deadlines, notifications, and your master profile.</li>
              <li>Your Gmail / Outlook connection (tokens revoked at the provider).</li>
              <li>Your account and all sessions across devices.</li>
            </ul>
          </div>
          <TextField
            label={<>Type <span className="font-mono font-semibold text-red-600 dark:text-red-400">DELETE</span> to confirm</>}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="DELETE"
            autoComplete="off"
            spellCheck={false}
            disabled={submitting}
            data-autofocus
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button type="submit" variant="danger" disabled={!canSubmit} loading={submitting}>
            Delete account permanently
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

export default function ProfileSettings() {
  const { user, setUser } = useContext(UserContext);
  const { requireRealAccount } = useDemoGate();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [saving, setSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);

  const initials = useMemo(() => {
    if (!user?.name) return "U";
    return user.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  }, [user]);

  const dirty = name !== (user?.name ?? "") || email !== (user?.email ?? "");

  const handleProfile = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put<User>("/auth/profile", { name, email });
      setUser(res.data);
      toast.success("Profile updated");
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e.response?.data?.error || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const handlePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) { toast.error("New password must be at least 6 characters"); return; }
    setPasswordSaving(true);
    try {
      await api.put("/auth/password", { currentPassword, newPassword });
      toast.success("Password changed");
      setCurrentPassword(""); setNewPassword("");
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e.response?.data?.error || "Password change failed");
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div>
      <SettingsHeader title="Profile" description="How you appear across HireTrail, and how you sign in." />

      <form onSubmit={handleProfile}>
        <SettingsCard>
          <SettingsRow title="Avatar" description="Shown next to your name across HireTrail.">
            <span className="w-11 h-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold select-none">
              {initials}
            </span>
          </SettingsRow>
          <SettingsRow title="Full name" description="Used across the app and in exports.">
            <input className={fieldCls} value={name} onChange={(e) => setName(e.target.value)} required aria-label="Full name" />
          </SettingsRow>
          <SettingsRow title="Email" description="Your sign-in address.">
            <input type="email" className={fieldCls} value={email} onChange={(e) => setEmail(e.target.value)} required aria-label="Email" />
          </SettingsRow>
          {dirty && (
            <div className="flex justify-end px-5 py-3 bg-muted/30">
              <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50">
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          )}
        </SettingsCard>
      </form>

      <SettingsSection
        title="Password"
        description="Use at least 6 characters. If you sign in with Google, setting a password also enables email login."
      >
        <form onSubmit={handlePassword}>
          <SettingsCard>
            <SettingsRow title="Current password">
              <input type="password" className={fieldCls} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" required aria-label="Current password" />
            </SettingsRow>
            <SettingsRow title="New password" description="At least 6 characters.">
              <input type="password" className={fieldCls} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" minLength={6} required aria-label="New password" />
            </SettingsRow>
            <div className="flex justify-end px-5 py-3 bg-muted/30">
              <button type="submit" disabled={passwordSaving || !currentPassword || !newPassword} className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50">
                {passwordSaving ? "Updating…" : "Update password"}
              </button>
            </div>
          </SettingsCard>
        </form>
      </SettingsSection>

      {/* Danger zone — GDPR right-to-erasure; required for Google OAuth
       *  verification on gmail.readonly. Demo account is gated. */}
      <SettingsSection title="Danger zone">
        <div className="rounded-xl border border-red-300/70 dark:border-red-900/60 bg-card shadow-panel overflow-hidden">
          <SettingsRow
            title={<span className="text-red-700 dark:text-red-300">Delete account</span>}
            description="Permanently delete your account and all associated data. Gmail / Outlook tokens are revoked at the provider. This cannot be undone."
          >
            <button
              type="button"
              onClick={() => {
                if (!requireRealAccount("Account deletion")) return;
                setDeleteModal(true);
              }}
              className="px-3.5 py-2 text-sm font-medium border border-red-400 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
            >
              Delete account…
            </button>
          </SettingsRow>
        </div>
      </SettingsSection>

      {deleteModal && user && <DeleteAccountModal email={user.email} onClose={() => setDeleteModal(false)} />}
    </div>
  );
}
