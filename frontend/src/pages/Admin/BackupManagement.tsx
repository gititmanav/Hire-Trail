import { useState, useCallback } from "react";
import toast from "react-hot-toast";
import { adminAPI } from "../../utils/api";

export default function BackupManagement() {
  const [exportingFull, setExportingFull] = useState(false);
  const [exportingUser, setExportingUser] = useState(false);
  const [userIdOrEmail, setUserIdOrEmail] = useState("");

  const triggerDownload = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const handleFullExport = async () => {
    setExportingFull(true);
    try {
      const blob = await adminAPI.exportBackup();
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      triggerDownload(blob, `hiretrail-backup-${timestamp}.json`);
      toast.success("Full backup exported successfully");
    } catch {
      toast.error("Failed to export backup");
    } finally {
      setExportingFull(false);
    }
  };

  const handleUserExport = async () => {
    const id = userIdOrEmail.trim();
    if (!id) {
      toast.error("Please enter a user ID or email");
      return;
    }
    setExportingUser(true);
    try {
      const blob = await adminAPI.exportUserData(id);
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      triggerDownload(blob, `user-data-${id}-${timestamp}.json`);
      toast.success("User data exported successfully");
    } catch {
      toast.error("Failed to export user data");
    } finally {
      setExportingUser(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Backup Management</h1>

      {/* Warning Banner */}
      <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4">
        <div className="flex items-start gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">Large Backup Warning</p>
            <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
              Backup files can be very large depending on the amount of data in the system. Full database exports include all users, applications, resumes, contacts, deadlines, and audit logs. Ensure you have sufficient bandwidth and storage before proceeding.
            </p>
          </div>
        </div>
      </div>

      {/* Full Database Export */}
      <div className="card-premium p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Full Database Export</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Export the entire database as a JSON file. This includes all users, applications, resumes, contacts,
          deadlines, audit logs, announcements, settings, and invite codes. The exported file can be used for
          disaster recovery, migration, or archival purposes.
        </p>
        <button
          className="btn-accent"
          onClick={handleFullExport}
          disabled={exportingFull}
        >
          {exportingFull ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Exporting...
            </span>
          ) : (
            "Export Full Backup"
          )}
        </button>
      </div>

      {/* Single User Data Export */}
      <div className="card-premium p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Single User Data Export</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Export all data for a specific user. Useful for GDPR data portability requests or individual account backups.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            className="input-premium flex-1"
            placeholder="User ID or email address"
            value={userIdOrEmail}
            onChange={(e) => setUserIdOrEmail(e.target.value)}
          />
          <button
            className="btn-accent whitespace-nowrap"
            onClick={handleUserExport}
            disabled={exportingUser}
          >
            {exportingUser ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Exporting...
              </span>
            ) : (
              "Export User Data"
            )}
          </button>
        </div>
      </div>

      {/* Backup History */}
      <div className="card-premium p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Backup History</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
          Backup history not yet implemented.
        </p>
      </div>
    </div>
  );
}
