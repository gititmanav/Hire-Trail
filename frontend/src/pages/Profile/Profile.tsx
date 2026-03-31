/** Profile and password forms; session cookies via shared API client. */
import { useState, useEffect, FormEvent } from "react";
import toast from "react-hot-toast";
import { api, applicationsAPI } from "../../utils/api.ts";
import type { User } from "../../types";

const inputCls = "w-full px-3 py-2 text-sm bg-card border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-accent";

function ReportRejectionModal({ onClose }: { onClose: () => void }) {
  const [company, setCompany] = useState("");
  const [dateReceived, setDateReceived] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // Find matching application by company name
      const res = await applicationsAPI.getAll({ search: company, limit: 100 });
      const match = res.data.find(
        (a) => a.company.toLowerCase() === company.toLowerCase() && a.stage !== "Rejected"
      );
      if (!match) {
        toast.error("No matching active application found for that company.");
        setSubmitting(false);
        return;
      }
      await applicationsAPI.update(match._id, { stage: "Rejected", archivedReason: "rejected" });
      toast.success("Application rejected. It will be auto-archived in 7 days.");
      onClose();
    } catch {
      toast.error("Failed to report rejection");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/45 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl p-6 w-full max-w-[440px] animate-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-foreground">Report a rejection</h2>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Company name *</label>
            <input className={inputCls} value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Google" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Date received *</label>
            <input type="date" className={inputCls} value={dateReceived} onChange={(e) => setDateReceived(e.target.value)} required />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium border border-border rounded-lg text-secondary-foreground hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={submitting} className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50">{submitting ? "Submitting..." : "Submit"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Profile() {
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rejectionModal, setRejectionModal] = useState(false);

  useEffect(() => {
    api
      .get<User>("/auth/me")
      .then((r) => {
        setUser(r.data);
        setName(r.data.name);
        setEmail(r.data.email);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleProfile = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put<User>("/auth/profile", { name, email });
      setUser(res.data);
      toast.success("Profile updated");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const handlePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    setSaving(true);
    try {
      await api.put("/auth/password", { currentPassword, newPassword });
      toast.success("Password changed");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Password change failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="spinner" />;

  const initials = user?.name
    ?.split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U";

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-foreground mb-6">Profile</h1>

      <div className="bg-card border border-border rounded-xl p-6 mb-4">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-semibold">
            {initials}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">{user?.name}</h2>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </div>

        <form onSubmit={handleProfile} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Full name</label>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
            <input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50">
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="text-base font-semibold text-foreground mb-4">Change password</h3>
        <form onSubmit={handlePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Current password</label>
            <input type="password" className={inputCls} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">New password</label>
            <input type="password" className={inputCls} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={6} required />
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50">
              Change password
            </button>
          </div>
        </form>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 mt-4">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-base font-semibold text-foreground">Email Integration</h3>
          <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-primary/10 text-primary">Beta</span>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          HireTrail can detect rejection emails and automatically update your applications.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button disabled className="relative px-4 py-2 text-sm font-medium border border-border rounded-lg text-muted-foreground cursor-not-allowed opacity-60">
            Connect Gmail
            <span className="absolute -top-2 -right-2 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-muted text-muted-foreground border border-border">Coming soon</span>
          </button>
          <button onClick={() => setRejectionModal(true)} className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors">
            Report a rejection
          </button>
        </div>
      </div>

      {rejectionModal && <ReportRejectionModal onClose={() => setRejectionModal(false)} />}
    </div>
  );
}
