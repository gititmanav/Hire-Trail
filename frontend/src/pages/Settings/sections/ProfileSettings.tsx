/** Settings → Profile: identity, password, and account deletion. */
import { useContext, useMemo, useState, FormEvent } from "react";
import toast from "../../../components/ui/toast.ts";
import { api, authAPI, type DeletionReason } from "../../../utils/api.ts";
import type { User } from "../../../types";
import { UserContext } from "../../../App.tsx";
import { useDemoGate } from "../../../hooks/useDemoGate.tsx";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "../../../components/ui/Modal.tsx";
import { Field, TextField, Textarea } from "../../../components/ui/Field.tsx";
import Button from "../../../components/ui/Button.tsx";
import { SettingsCard, SettingsHeader, SettingsRow, SettingsSection, inputCls } from "../ui.tsx";

const fieldCls = `${inputCls} sm:w-80`;

const REASONS: { value: DeletionReason; label: string }[] = [
  { value: "found_job", label: "I found a job" },
  { value: "not_useful", label: "It isn't useful for me" },
  { value: "privacy", label: "Privacy" },
  { value: "too_much", label: "Too many emails or notifications" },
  { value: "other", label: "Something else" },
];

/** Deleting an account takes two steps on purpose: why (with the gentler
 *  option of just signing out), then proof and the word DELETE. The account
 *  is scheduled for deletion in 14 days — signing in before then keeps it. */
function DeleteAccountModal({ email, hasPassword, onClose }: { email: string; hasPassword: boolean; onClose: () => void }) {
  const [step, setStep] = useState<"why" | "confirm">("why");
  const [reason, setReason] = useState<DeletionReason | null>(null);
  const [note, setNote] = useState("");
  const [proof, setProof] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!reason || confirm !== "DELETE" || !proof) return;
    setSubmitting(true);
    try {
      const { scheduledFor } = await authAPI.requestDeletion({
        reason,
        note: note.trim() || undefined,
        confirm,
        ...(hasPassword ? { password: proof } : { email: proof }),
      });
      // The session is gone — a full reload lands signed out; the landing says what happens next.
      try { sessionStorage.setItem("ht-deletion-scheduled", scheduledFor); } catch { /* best-effort */ }
      window.location.href = "/";
    } catch {
      // The API layer says why (a wrong password, most often).
      setSubmitting(false);
    }
  };

  return (
    <Modal onClose={() => !submitting && onClose()} size="sm" ariaLabel="Delete your account">
      <ModalHeader
        title={step === "why" ? "Before you go" : "Delete your account"}
        description={step === "why" ? "What's making you leave? It helps us make HireTrail better." : email}
        onClose={submitting ? undefined : onClose}
      />
      {step === "why" ? (
        <>
          <ModalBody className="space-y-4">
            <div role="radiogroup" aria-label="Why are you deleting your account?" className="space-y-1.5">
              {REASONS.map((r) => {
                const on = reason === r.value;
                return (
                  <button
                    key={r.value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setReason(r.value)}
                    className={`w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-[13.5px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      on ? "border-foreground/25 bg-control text-foreground" : "border-border text-foreground hover:bg-control/50"
                    }`}
                  >
                    <span aria-hidden className={`w-4 h-4 shrink-0 rounded-full border grid place-items-center ${on ? "border-primary" : "border-input"}`}>
                      {on && <span className="w-2 h-2 rounded-full bg-primary" />}
                    </span>
                    {r.label}
                  </button>
                );
              })}
            </div>
            <Field label="Anything we could have done better?" hint="Optional — only the HireTrail team reads it.">
              <Textarea rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
            <p className="text-[12.5px] text-muted-foreground leading-relaxed">
              Just taking a break? You can sign out instead — nothing is deleted, and your tracker is here when you're back.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={onClose}>Keep my account</Button>
            <Button variant="secondary" disabled={!reason} onClick={() => setStep("confirm")}>Continue</Button>
          </ModalFooter>
        </>
      ) : (
        <form className="flex flex-col min-h-0" onSubmit={submit}>
          <ModalBody className="space-y-4">
            <div className="rounded-lg border border-red-300 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 p-3 space-y-1.5">
              <p className="text-sm text-red-900 dark:text-red-200 font-medium">Your account is deleted in 14 days.</p>
              <p className="text-xs text-red-900/85 dark:text-red-200/85 leading-relaxed">
                You're signed out everywhere now. Sign in any time in the next 14 days and everything is kept. After that it's erased for good: applications, resumes and their files, your profile, contacts, deadlines, AI keys and settings, assistant connections, and inbox scans. Google's access to your Gmail is revoked.
              </p>
            </div>
            {hasPassword ? (
              <TextField label="Your password" type="password" value={proof} onChange={(e) => setProof(e.target.value)} autoComplete="current-password" disabled={submitting} data-autofocus />
            ) : (
              <TextField label="Type your email address" type="email" value={proof} onChange={(e) => setProof(e.target.value)} placeholder={email} autoComplete="off" disabled={submitting} data-autofocus />
            )}
            <TextField
              label={<>Type <span className="font-mono font-semibold text-red-600 dark:text-red-400">DELETE</span> to confirm</>}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="DELETE"
              autoComplete="off"
              spellCheck={false}
              disabled={submitting}
            />
          </ModalBody>
          <ModalFooter start={<Button variant="ghost" onClick={() => setStep("why")} disabled={submitting}>Back</Button>}>
            <Button variant="ghost" onClick={onClose} disabled={submitting}>Keep my account</Button>
            <Button type="submit" variant="danger" disabled={confirm !== "DELETE" || !proof || submitting} loading={submitting}>
              Delete my account
            </Button>
          </ModalFooter>
        </form>
      )}
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
            description="Schedule your account for deletion. It's erased 14 days later, with everything in it — sign in before then to keep it."
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

      {deleteModal && user && <DeleteAccountModal email={user.email} hasPassword={user.hasPassword !== false} onClose={() => setDeleteModal(false)} />}
    </div>
  );
}
