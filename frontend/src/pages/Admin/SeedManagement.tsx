import { useState } from "react";
import toast from "react-hot-toast";
import { adminAPI } from "../../utils/api";
import ConfirmModal from "../../components/ConfirmModal/ConfirmModal";
import { useConfirm } from "../../hooks/useConfirm";
import type { SeedResult } from "../../types";

export default function SeedManagement() {
  const [running, setRunning] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [result, setResult] = useState<SeedResult | null>(null);
  const [clearMessage, setClearMessage] = useState<string | null>(null);
  const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm();

  const handleRunSeed = async () => {
    const ok = await confirm(
      "This will create demo data in the database (1 user, 8 resumes, 650 applications, 220 contacts, 180 deadlines).",
      { title: "Run Seed?", confirmLabel: "Run Seed", danger: false }
    );
    if (!ok) return;
    setRunning(true);
    setResult(null);
    setClearMessage(null);
    try {
      const res = await adminAPI.runSeed();
      setResult(res);
      toast.success("Seed data created successfully");
    } catch {
      toast.error("Failed to run seed");
    } finally {
      setRunning(false);
    }
  };

  const handleClearSeed = async () => {
    const ok1 = await confirm(
      "Are you sure you want to clear all seed data? This cannot be undone.",
      { title: "Clear Seed Data?", confirmLabel: "Continue" }
    );
    if (!ok1) return;
    const ok2 = await confirm(
      "This is your final confirmation. All seed data will be permanently deleted.",
      { title: "Final Confirmation", confirmLabel: "Delete All Seed Data" }
    );
    if (!ok2) return;
    setClearing(true);
    setResult(null);
    setClearMessage(null);
    try {
      const res = await adminAPI.clearSeed();
      const msg = (res as { message?: string })?.message || "Seed data cleared successfully";
      setClearMessage(msg);
      toast.success("Seed data cleared");
    } catch {
      toast.error("Failed to clear seed data");
    } finally {
      setClearing(false);
    }
  };

  const isOperating = running || clearing;
  const Spinner = () => (
    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );

  return (
    <div className="fade-up space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Seed Data Management</h1>
        <p className="text-sm text-muted-foreground mt-1">Populate the database with realistic demo data for testing, or wipe it clean.</p>
      </div>

      {/* What gets seeded */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-lg font-semibold text-foreground mb-1">What seed data creates</h2>
        <p className="text-sm text-secondary-foreground mb-4">
          One demo user with realistic application history, resumes, contacts, and deadlines. Sign in as <code className="text-xs px-1 py-0.5 rounded bg-muted">demo@hiretrail.com / password123</code> after seeding.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: "Demo user", value: "1" },
            { label: "Resumes", value: "8" },
            { label: "Applications", value: "650" },
            { label: "Contacts", value: "220" },
            { label: "Deadlines", value: "180" },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-border bg-muted/40 p-3 text-center">
              <p className="text-2xl font-bold text-primary">{item.value}</p>
              <p className="text-xs font-medium text-foreground mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Actions</h2>
        <div className="flex flex-wrap gap-3">
          <button
            className="btn-accent inline-flex items-center gap-2"
            onClick={handleRunSeed}
            disabled={isOperating}
          >
            {running ? <><Spinner /> Running seed...</> : "Run seed"}
          </button>
          <button
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/10 disabled:opacity-50"
            onClick={handleClearSeed}
            disabled={isOperating}
          >
            {clearing ? <><Spinner /> Clearing...</> : "Clear seed data"}
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-3">Clearing is destructive and double-confirmed. It removes only seeded records.</p>
      </div>

      {/* Result Display */}
      {result && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6">
          <h2 className="text-lg font-semibold text-emerald-700 dark:text-emerald-300 mb-3">Seed completed</h2>
          <p className="text-sm text-secondary-foreground mb-4">{result.message}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "Users", value: result.users },
              { label: "Resumes", value: result.resumes },
              { label: "Applications", value: result.applications },
              { label: "Contacts", value: result.contacts },
              { label: "Deadlines", value: result.deadlines },
              { label: "Total", value: result.total },
            ].map((item) => (
              <div key={item.label} className="rounded-lg bg-card border border-emerald-500/20 p-3 text-center">
                <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{item.value}</p>
                <p className="text-[11px] font-medium text-muted-foreground mt-0.5">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {clearMessage && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6">
          <h2 className="text-lg font-semibold text-amber-700 dark:text-amber-300 mb-2">Seed data cleared</h2>
          <p className="text-sm text-secondary-foreground">{clearMessage}</p>
        </div>
      )}

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
