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

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Seed Data Management</h1>

      {/* Description */}
      <div className="card-premium p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">What Seed Data Creates</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Running the seed will populate the database with demo data for testing and demonstration purposes.
          The following resources will be created:
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: "Demo User", value: "1", detail: "demo@hiretrail.com / password123" },
            { label: "Resumes", value: "8", detail: null },
            { label: "Applications", value: "650", detail: null },
            { label: "Contacts", value: "220", detail: null },
            { label: "Deadlines", value: "180", detail: null },
          ].map((item) => (
            <div key={item.label} className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-3 text-center">
              <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{item.value}</p>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{item.label}</p>
              {item.detail && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{item.detail}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="card-premium p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Actions</h2>
        <div className="flex flex-wrap gap-4">
          <button
            className="btn-accent"
            onClick={handleRunSeed}
            disabled={isOperating}
          >
            {running ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Running Seed...
              </span>
            ) : (
              "Run Seed"
            )}
          </button>
          <button
            className="btn-secondary text-red-600 dark:text-red-400"
            onClick={handleClearSeed}
            disabled={isOperating}
          >
            {clearing ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Clearing...
              </span>
            ) : (
              "Clear Seed Data"
            )}
          </button>
        </div>
      </div>

      {/* Result Display */}
      {result && (
        <div className="card-premium p-6">
          <h2 className="text-lg font-semibold text-green-700 dark:text-green-400 mb-3">Seed Completed</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{result.message}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "Users", value: result.users },
              { label: "Resumes", value: result.resumes },
              { label: "Applications", value: result.applications },
              { label: "Contacts", value: result.contacts },
              { label: "Deadlines", value: result.deadlines },
              { label: "Total", value: result.total },
            ].map((item) => (
              <div key={item.label} className="rounded-lg bg-green-50 dark:bg-green-900/20 p-3 text-center">
                <p className="text-xl font-bold text-green-700 dark:text-green-400">{item.value}</p>
                <p className="text-xs font-medium text-green-600 dark:text-green-500">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {clearMessage && (
        <div className="card-premium p-6">
          <h2 className="text-lg font-semibold text-orange-700 dark:text-orange-400 mb-2">Seed Data Cleared</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">{clearMessage}</p>
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
